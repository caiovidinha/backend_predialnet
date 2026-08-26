const { client } = require('../../prisma/client');

const listar = () =>
  client.blogRedirecionamento.findMany({ orderBy: { criado_em: 'desc' } });

// Registra "slug antigo → slug novo" e conserta a cadeia: quem já apontava para
// o slug antigo passa a apontar direto para o novo, evitando 301 encadeado.
const registrar = async (de, para) => {
  if (!de || !para || de === para) return null;

  await client.blogRedirecionamento.deleteMany({ where: { de: para } });
  await client.blogRedirecionamento.updateMany({ where: { para: de }, data: { para } });

  return client.blogRedirecionamento.upsert({
    where: { de },
    update: { para },
    create: { de, para },
  });
};

module.exports = { listar, registrar };
