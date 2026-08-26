const { client } = require('../../prisma/client');

const listar = () =>
  client.blogCategoria.findMany({ orderBy: [{ ordem: 'asc' }, { nome: 'asc' }] });

const buscarPorSlug = (slug) => client.blogCategoria.findUnique({ where: { slug } });

const buscarPorId = (id) => client.blogCategoria.findUnique({ where: { id } });

// O painel manda "Tecnologia" ou "tecnologia" — aceita os dois. A collation do
// banco é case-insensitive, então a comparação por nome não precisa de lower().
const resolver = async (valor) => {
  const termo = String(valor ?? '').trim();
  if (!termo) return null;
  return (
    (await client.blogCategoria.findUnique({ where: { slug: termo } }))
    ?? (await client.blogCategoria.findFirst({ where: { nome: termo } }))
  );
};

const criar = ({ slug, nome, descricao, ordem = 0 }) =>
  client.blogCategoria.create({ data: { slug, nome, descricao, ordem } });

module.exports = { listar, buscarPorSlug, buscarPorId, resolver, criar };
