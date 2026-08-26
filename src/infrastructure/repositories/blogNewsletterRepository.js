const { client } = require('../../prisma/client');

const buscarPorEmail = (email) => client.blogNewsletter.findUnique({ where: { email } });

const inscrever = ({ email, origem }) =>
  client.blogNewsletter.create({ data: { email, origem } });

// Reinscrição de quem já tinha cancelado.
const reativar = (id, origem) =>
  client.blogNewsletter.update({ where: { id }, data: { ativo: true, origem } });

const listar = async ({ pagina = 1, porPagina = 50 } = {}) => {
  const where = { ativo: true };
  const [items, total] = await Promise.all([
    client.blogNewsletter.findMany({
      where,
      orderBy: { criado_em: 'desc' },
      skip: (pagina - 1) * porPagina,
      take: porPagina,
    }),
    client.blogNewsletter.count({ where }),
  ]);
  return { items, total };
};

module.exports = { buscarPorEmail, inscrever, reativar, listar };
