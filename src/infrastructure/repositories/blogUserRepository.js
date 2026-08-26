const { client } = require('../../prisma/client');

// ── Usuários do painel ───────────────────────────────────────

const buscarPorEmail = (email) => client.blogUsuario.findUnique({ where: { email } });

const buscarPorId = (id) => client.blogUsuario.findUnique({ where: { id } });

const listar = () =>
  client.blogUsuario.findMany({
    orderBy: { criado_em: 'asc' },
    select: { id: true, nome: true, email: true, papel: true, ativo: true, ultimo_login: true, criado_em: true },
  });

const criar = ({ nome, email, senha_hash, papel = 'editor' }) =>
  client.blogUsuario.create({ data: { nome, email, senha_hash, papel } });

const atualizar = (id, data) => client.blogUsuario.update({ where: { id }, data });

const marcarLogin = (id) =>
  client.blogUsuario.update({ where: { id }, data: { ultimo_login: new Date() } });

// ── Refresh tokens ───────────────────────────────────────────
// Guardamos só o sha256; o valor emitido nunca fica no banco.

const criarRefresh = ({ usuarioId, tokenHash, expiraEm }) =>
  client.blogRefreshToken.create({
    data: { usuarioId, token_hash: tokenHash, expira_em: expiraEm },
  });

const buscarRefresh = (tokenHash) =>
  client.blogRefreshToken.findUnique({
    where: { token_hash: tokenHash },
    include: { usuario: true },
  });

const revogarRefresh = (id) =>
  client.blogRefreshToken.update({ where: { id }, data: { revogado_em: new Date() } });

const revogarTodosDoUsuario = (usuarioId) =>
  client.blogRefreshToken.updateMany({
    where: { usuarioId, revogado_em: null },
    data: { revogado_em: new Date() },
  });

// Higiene: some com o que já venceu ou foi revogado há mais de 30 dias.
const limparExpirados = () =>
  client.blogRefreshToken.deleteMany({
    where: {
      OR: [
        { expira_em: { lt: new Date() } },
        { revogado_em: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      ],
    },
  });

module.exports = {
  buscarPorEmail,
  buscarPorId,
  listar,
  criar,
  atualizar,
  marcarLogin,
  criarRefresh,
  buscarRefresh,
  revogarRefresh,
  revogarTodosDoUsuario,
  limparExpirados,
};
