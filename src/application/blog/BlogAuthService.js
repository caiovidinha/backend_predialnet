const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { hash, compare } = require('bcryptjs');

const userRepo = require('../../infrastructure/repositories/blogUserRepository');
const auditRepo = require('../../infrastructure/repositories/blogAuditRepository');
const { naoAutenticado, validacao, conflito, naoEncontrado } = require('../../domain/blog/errors');
const logger = require('../../utils/logger');

// Autenticação do painel (seção 4 da spec): access token JWT curto + refresh
// token opaco e rotativo. O refresh vive no banco apenas como sha256.

const ACCESS_TTL_SEC = Number.parseInt(process.env.BLOG_ACCESS_TTL_SEC, 10) || 900; // 15 min
const REFRESH_TTL_DIAS = Number.parseInt(process.env.BLOG_REFRESH_TTL_DIAS, 10) || 30;
const EMISSOR = 'predialnet-blog';
const PAPEIS = ['admin', 'editor'];

const segredo = () => {
  const valor = process.env.BLOG_ACCESS_TOKEN_SECRET;
  if (!valor) throw new Error('BLOG_ACCESS_TOKEN_SECRET não configurado.');
  return valor;
};

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const usuarioPublico = (u) => ({ id: u.id, nome: u.nome, email: u.email, papel: u.papel });

const emitirTokens = async (usuario) => {
  const accessToken = jwt.sign(
    { sub: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel },
    segredo(),
    { expiresIn: ACCESS_TTL_SEC, issuer: EMISSOR },
  );

  const refreshToken = crypto.randomBytes(48).toString('hex');
  await userRepo.criarRefresh({
    usuarioId: usuario.id,
    tokenHash: hashToken(refreshToken),
    expiraEm: new Date(Date.now() + REFRESH_TTL_DIAS * 24 * 60 * 60 * 1000),
  });

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expira_em: ACCESS_TTL_SEC,
    usuario: usuarioPublico(usuario),
  };
};

const login = async ({ usuario: email, senha, ip }) => {
  const campos = {};
  if (!email) campos.usuario = 'Obrigatório.';
  if (!senha) campos.senha = 'Obrigatório.';
  if (Object.keys(campos).length) throw validacao(campos);

  const conta = await userRepo.buscarPorEmail(String(email).trim().toLowerCase());

  // Mesma resposta para e-mail inexistente, senha errada e conta desativada —
  // não entregamos ao atacante a informação de qual e-mail existe.
  const generico = naoAutenticado('Usuário ou senha incorretos.');
  generico.erro = 'credenciais_invalidas';

  if (!conta || !conta.ativo) throw generico;
  if (!(await compare(String(senha), conta.senha_hash))) throw generico;

  await userRepo.marcarLogin(conta.id);
  await auditRepo.registrar({ usuario: conta, acao: 'login', entidade: 'usuario', entidadeId: conta.id, ip });

  // Higiene oportunista dos tokens vencidos — barato e sem cron.
  userRepo.limparExpirados().catch((err) =>
    logger.warn('blog: falha ao limpar refresh tokens', { error: err.message }));

  return emitirTokens(conta);
};

// Rotativo: o refresh usado é revogado e um novo é emitido junto.
const refresh = async ({ refreshToken }) => {
  if (!refreshToken) throw validacao({ refresh_token: 'Obrigatório.' });

  const registro = await userRepo.buscarRefresh(hashToken(String(refreshToken)));
  if (!registro || registro.revogado_em || registro.expira_em < new Date())
    throw naoAutenticado('Sessão expirada. Faça login novamente.');

  if (!registro.usuario?.ativo) throw naoAutenticado('Conta desativada.');

  await userRepo.revogarRefresh(registro.id);
  return emitirTokens(registro.usuario);
};

const logout = async ({ refreshToken }) => {
  if (!refreshToken) return;
  const registro = await userRepo.buscarRefresh(hashToken(String(refreshToken)));
  if (registro && !registro.revogado_em) await userRepo.revogarRefresh(registro.id);
};

// Usado pelo middleware de autenticação das rotas /blog/admin/*.
const verificarAccessToken = (token) => {
  try {
    const payload = jwt.verify(token, segredo(), { issuer: EMISSOR });
    return { id: payload.sub, nome: payload.nome, email: payload.email, papel: payload.papel };
  } catch {
    throw naoAutenticado('Token ausente, inválido ou expirado.');
  }
};

// ── Gestão de usuários (papel admin) ─────────────────────────

const criarUsuario = async ({ nome, email, senha, papel = 'editor' }, autor, ip) => {
  const campos = {};
  if (!nome) campos.nome = 'Obrigatório.';
  if (!email) campos.email = 'Obrigatório.';
  if (!senha || String(senha).length < 10) campos.senha = 'Mínimo de 10 caracteres.';
  if (!PAPEIS.includes(papel)) campos.papel = `Valores aceitos: ${PAPEIS.join(', ')}.`;
  if (Object.keys(campos).length) throw validacao(campos);

  const normalizado = String(email).trim().toLowerCase();
  if (await userRepo.buscarPorEmail(normalizado)) throw conflito('Já existe um usuário com este e-mail.');

  const criado = await userRepo.criar({
    nome,
    email: normalizado,
    senha_hash: await hash(String(senha), 10),
    papel,
  });

  await auditRepo.registrar({ usuario: autor, acao: 'criar', entidade: 'usuario', entidadeId: criado.id, ip });
  return usuarioPublico(criado);
};

const listarUsuarios = () => userRepo.listar();

const alterarUsuario = async (id, { nome, senha, papel, ativo }, autor, ip) => {
  const alvo = await userRepo.buscarPorId(Number(id));
  if (!alvo) throw naoEncontrado('Usuário não encontrado.');

  const data = {};
  if (nome !== undefined) data.nome = nome;
  if (ativo !== undefined) data.ativo = Boolean(ativo);
  if (papel !== undefined) {
    if (!PAPEIS.includes(papel)) throw validacao({ papel: `Valores aceitos: ${PAPEIS.join(', ')}.` });
    data.papel = papel;
  }
  if (senha !== undefined) {
    if (String(senha).length < 10) throw validacao({ senha: 'Mínimo de 10 caracteres.' });
    data.senha_hash = await hash(String(senha), 10);
  }

  const atualizado = await userRepo.atualizar(alvo.id, data);

  // Troca de senha ou desativação derruba as sessões abertas.
  if (data.senha_hash || data.ativo === false) await userRepo.revogarTodosDoUsuario(alvo.id);

  await auditRepo.registrar({
    usuario: autor,
    acao: 'editar',
    entidade: 'usuario',
    entidadeId: alvo.id,
    detalhes: { campos: Object.keys(data) },
    ip,
  });

  return usuarioPublico(atualizado);
};

module.exports = {
  login,
  refresh,
  logout,
  verificarAccessToken,
  criarUsuario,
  listarUsuarios,
  alterarUsuario,
  ACCESS_TTL_SEC,
  PAPEIS,
};
