const repo = require('../../infrastructure/repositories/parceriaCadastroRepository');
const { normalizarParceria } = require('./ParceriaService');

// Cadastro dos influencers/parceiros. O que importa aqui é o SLUG: ele vai no
// link divulgado (assineja?parceria=<slug>) e é por ele que os eventos são
// contados. Por isso o slug não muda depois de criado — trocar quebraria o
// link que o influencer já postou e separaria o histórico em dois.

const erro = (statusCode, message) => Object.assign(new Error(message), { statusCode });

const texto = (valor, max) => {
  if (valor === null || valor === undefined) return null;
  const s = String(valor).trim();
  return s ? s.slice(0, max) : null;
};

// "@fulana", "instagram.com/fulana/", "https://www.instagram.com/fulana?igsh=…" → "fulana"
const usuarioDoInstagram = (valor) => {
  const s = texto(valor, 200);
  if (!s) return null;
  const semUrl = s.replace(/^https?:\/\//i, '').replace(/^(www\.)?instagram\.com\//i, '');
  const usuario = semUrl.split(/[/?#]/)[0].replace(/^@+/, '');
  return /^[A-Za-z0-9._]{1,30}$/.test(usuario) ? usuario.toLowerCase() : null;
};

const ehDuplicado = (err) => err && err.code === 'P2002';

const listar = () => repo.listar();

const criar = async (body = {}) => {
  const nome = texto(body.nome, 120);
  if (!nome) throw erro(400, 'Informe o nome.');

  // O slug pode vir digitado; se não vier, nasce do nome.
  const slug = normalizarParceria(body.slug || nome);
  if (!slug) throw erro(400, 'Não foi possível gerar o identificador do link. Use letras ou números.');

  if (body.instagram && !usuarioDoInstagram(body.instagram)) throw erro(400, 'Instagram inválido.');

  try {
    return await repo.criar({
      slug,
      nome,
      instagram: usuarioDoInstagram(body.instagram),
      contato: texto(body.contato, 120),
      observacao: texto(body.observacao, 2000),
    });
  } catch (err) {
    if (ehDuplicado(err)) throw erro(409, `Já existe uma parceria com o link "${slug}".`);
    throw err;
  }
};

const atualizar = async (id, body = {}) => {
  const atual = await repo.buscarPorId(String(id || ''));
  if (!atual) throw erro(404, 'Parceria não encontrada.');

  if (body.slug !== undefined && normalizarParceria(body.slug) !== atual.slug) {
    throw erro(400, 'O link de uma parceria não muda depois de criado.');
  }

  const dados = {};
  if (body.nome !== undefined) {
    const nome = texto(body.nome, 120);
    if (!nome) throw erro(400, 'Informe o nome.');
    dados.nome = nome;
  }
  if (body.instagram !== undefined) {
    if (body.instagram && !usuarioDoInstagram(body.instagram)) throw erro(400, 'Instagram inválido.');
    dados.instagram = usuarioDoInstagram(body.instagram);
  }
  if (body.contato !== undefined) dados.contato = texto(body.contato, 120);
  if (body.observacao !== undefined) dados.observacao = texto(body.observacao, 2000);
  if (body.ativo !== undefined) dados.ativo = body.ativo === true || body.ativo === 'true';

  return repo.atualizar(atual.id, dados);
};

module.exports = {
  listar, criar, atualizar, usuarioDoInstagram,
};
