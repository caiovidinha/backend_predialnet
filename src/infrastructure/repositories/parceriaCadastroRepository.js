const { client } = require('../../prisma/client');

// Cadastro dos influencers/parceiros (tabela `parcerias`). Volume pequeno —
// dezenas, talvez centenas —, então listar tudo de uma vez é o certo.

const listar = () => client.parceria.findMany({ orderBy: [{ ativo: 'desc' }, { nome: 'asc' }] });

const buscarPorId = (id) => client.parceria.findUnique({ where: { id } });

const buscarPorSlug = (slug) => client.parceria.findUnique({ where: { slug } });

const criar = (dados) => client.parceria.create({ data: dados });

const atualizar = (id, dados) => client.parceria.update({ where: { id }, data: dados });

module.exports = {
  listar, buscarPorId, buscarPorSlug, criar, atualizar,
};
