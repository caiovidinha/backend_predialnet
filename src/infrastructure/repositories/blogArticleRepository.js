const { client } = require('../../prisma/client');

const COM_CATEGORIA = { categoria: true };

// Artigo visível ao público: publicado e com data de publicação no passado.
// Agendar é só gravar `publicado_em` no futuro — some da listagem até a hora.
const filtroPublico = () => ({
  status: 'publicado',
  publicado_em: { not: null, lte: new Date() },
});

const ordenacao = (ordem) => {
  if (ordem === 'antigos') return [{ publicado_em: 'asc' }];
  if (ordem === 'populares') return [{ visualizacoes: 'desc' }, { publicado_em: 'desc' }];
  return [{ publicado_em: 'desc' }];
};

// A collation do banco é utf8mb4_unicode_ci, então `contains` já é
// case-insensitive (o modo `insensitive` do Prisma não existe no MySQL).
const filtroBusca = (busca) => {
  if (!busca) return {};
  return {
    OR: [
      { titulo: { contains: busca } },
      { resumo: { contains: busca } },
      { corpo: { contains: busca } },
    ],
  };
};

const listarPublicos = async ({ categoriaSlug, busca, pagina = 1, porPagina = 20, ordem = 'recentes' }) => {
  const where = {
    ...filtroPublico(),
    ...filtroBusca(busca),
    ...(categoriaSlug ? { categoria: { slug: categoriaSlug } } : {}),
  };

  const [items, total] = await Promise.all([
    client.blogArtigo.findMany({
      where,
      include: COM_CATEGORIA,
      orderBy: ordenacao(ordem),
      skip: (pagina - 1) * porPagina,
      take: porPagina,
    }),
    client.blogArtigo.count({ where }),
  ]);

  return { items, total };
};

const buscarPublicoPorSlug = (slug) =>
  client.blogArtigo.findFirst({
    where: { slug, ...filtroPublico() },
    include: COM_CATEGORIA,
  });

const listarAdmin = async ({ status, busca, pagina = 1, porPagina = 20, ordem = 'recentes' }) => {
  const where = {
    ...(status && status !== 'todos' ? { status } : {}),
    ...filtroBusca(busca),
  };

  const [items, total] = await Promise.all([
    client.blogArtigo.findMany({
      where,
      include: COM_CATEGORIA,
      // No painel o rascunho ainda não tem publicado_em — ordena pela edição.
      orderBy: ordem === 'antigos' ? [{ atualizado_em: 'asc' }] : [{ atualizado_em: 'desc' }],
      skip: (pagina - 1) * porPagina,
      take: porPagina,
    }),
    client.blogArtigo.count({ where }),
  ]);

  return { items, total };
};

const buscarPorId = (id) =>
  client.blogArtigo.findUnique({ where: { id }, include: COM_CATEGORIA });

const buscarPorSlug = (slug) =>
  client.blogArtigo.findUnique({ where: { slug }, include: COM_CATEGORIA });

const slugEmUso = async (slug, exceto = null) => {
  const existente = await client.blogArtigo.findUnique({ where: { slug }, select: { id: true } });
  return Boolean(existente) && existente.id !== exceto;
};

const criar = (data) => client.blogArtigo.create({ data, include: COM_CATEGORIA });

const atualizar = (id, data) =>
  client.blogArtigo.update({ where: { id }, data, include: COM_CATEGORIA });

// Só um artigo em destaque por vez (seção 2.1).
const limparDestaques = (exceto = null) =>
  client.blogArtigo.updateMany({
    where: { destaque: true, ...(exceto ? { id: { not: exceto } } : {}) },
    data: { destaque: false },
  });

// Artigos cuja hora de publicação chegou e que o blog ainda não sabe que estão
// no ar. `revalidado_em` funciona como bandeira: quem está agendado fica com
// null até o job avisar o blog, e só então recebe a data.
const pendentesDeRevalidacao = (limite = 20) =>
  client.blogArtigo.findMany({
    where: {
      status: 'publicado',
      publicado_em: { not: null, lte: new Date() },
      revalidado_em: null,
    },
    orderBy: { publicado_em: 'asc' },
    take: limite,
  });

const marcarRevalidado = (id) =>
  client.blogArtigo.update({ where: { id }, data: { revalidado_em: new Date() } });

// Devolve o artigo para a fila do job — usado quando ele fica agendado para o
// futuro e ainda vai precisar de um aviso na hora certa.
const limparRevalidado = (id) =>
  client.blogArtigo.update({ where: { id }, data: { revalidado_em: null } });

const contarPorCategoria = async () => {
  const linhas = await client.blogArtigo.groupBy({
    by: ['categoriaId'],
    where: filtroPublico(),
    _count: { _all: true },
  });
  return new Map(linhas.map((l) => [l.categoriaId, l._count._all]));
};

module.exports = {
  listarPublicos,
  buscarPublicoPorSlug,
  listarAdmin,
  buscarPorId,
  buscarPorSlug,
  slugEmUso,
  criar,
  atualizar,
  limparDestaques,
  pendentesDeRevalidacao,
  marcarRevalidado,
  limparRevalidado,
  contarPorCategoria,
};
