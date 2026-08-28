const { slugValido } = require('./slug');

// ── Serialização ─────────────────────────────────────────────
// A linha do banco é achatada (capa_url, seo_titulo…); a API entrega o formato
// aninhado da seção 2.1 da spec.

const iso = (data) => (data ? new Date(data).toISOString() : null);

// As duas imagens do artigo têm o mesmo formato; muda só o prefixo da coluna.
// Sem url não há imagem — devolve null em vez de um objeto com campos vazios.
const montarImagem = (row, prefixo) => {
  const url = row[`${prefixo}_url`];
  if (!url) return null;
  return {
    url,
    alt: row[`${prefixo}_alt`] ?? '',
    largura: row[`${prefixo}_largura`] ?? null,
    altura: row[`${prefixo}_altura`] ?? null,
  };
};

const serializarArtigo = (row, { incluirCorpo = true } = {}) => {
  if (!row) return null;

  const artigo = {
    id: row.id,
    slug: row.slug,
    titulo: row.titulo,
    resumo: row.resumo,
    categoria: row.categoria?.nome ?? null,
    categoria_slug: row.categoria?.slug ?? null,
    autor: row.autor,
    // capa: card da listagem, categorias e Open Graph (16:9).
    capa: montarImagem(row, 'capa'),
    // capa_interna: topo da página do post, no tamanho original.
    capa_interna: montarImagem(row, 'capa_interna'),
    destaque: row.destaque,
    status: row.status,
    publicado_em: iso(row.publicado_em),
    atualizado_em: iso(row.atualizado_em),
    tempo_leitura: row.tempo_leitura,
    visualizacoes: row.visualizacoes,
    seo: {
      titulo: row.seo_titulo ?? null,
      descricao: row.seo_descricao ?? null,
      noindex: row.seo_noindex,
    },
  };

  if (incluirCorpo) artigo.corpo = row.corpo;
  return artigo;
};

const serializarCategoria = (row, total = 0) => ({
  slug: row.slug,
  nome: row.nome,
  descricao: row.descricao ?? '',
  total,
});

// ── Validação ────────────────────────────────────────────────
// Devolve o mapa `campos` da seção 7 (vazio = tudo certo). `parcial` liga o
// modo PUT, em que só o que veio no corpo é checado.

const STATUS_VALIDOS = ['rascunho', 'publicado', 'arquivado'];
const MAX_TITULO = 191;
const MAX_RESUMO = 300;

const dataValida = (valor) => !Number.isNaN(new Date(valor).getTime());
const vazio = (v) => v === undefined || v === null || String(v).trim() === '';

const validarArtigo = (dados, { parcial = false } = {}) => {
  const campos = {};
  const informado = (chave) => dados[chave] !== undefined;
  const exigido = (chave) => (parcial ? informado(chave) : true);

  if (exigido('titulo')) {
    if (vazio(dados.titulo)) campos.titulo = 'Obrigatório.';
    else if (String(dados.titulo).length > MAX_TITULO) campos.titulo = `No máximo ${MAX_TITULO} caracteres.`;
  }

  if (exigido('resumo')) {
    if (vazio(dados.resumo)) campos.resumo = 'Obrigatório.';
    else if (String(dados.resumo).length > MAX_RESUMO) campos.resumo = `No máximo ${MAX_RESUMO} caracteres.`;
  }

  if (exigido('categoria') && vazio(dados.categoria)) campos.categoria = 'Obrigatório.';

  if (exigido('corpo') && vazio(dados.corpo)) campos.corpo = 'Obrigatório.';

  // Slug é opcional na criação (gerado do título), mas se vier tem que prestar.
  if (informado('slug') && !vazio(dados.slug) && !slugValido(dados.slug))
    campos.slug = 'Use apenas letras minúsculas, números e hífens.';

  if (informado('status') && !STATUS_VALIDOS.includes(dados.status))
    campos.status = `Valores aceitos: ${STATUS_VALIDOS.join(', ')}.`;

  if (informado('publicado_em') && !vazio(dados.publicado_em) && !dataValida(dados.publicado_em))
    campos.publicado_em = 'Data inválida. Use ISO 8601.';

  if (informado('destaque') && typeof dados.destaque !== 'boolean')
    campos.destaque = 'Deve ser true ou false.';

  if (informado('tempo_leitura') && dados.tempo_leitura !== null) {
    const n = Number(dados.tempo_leitura);
    if (!Number.isInteger(n) || n < 1) campos.tempo_leitura = 'Deve ser um inteiro maior que zero.';
  }

  // As duas imagens seguem a mesma regra: ou vem null (remove), ou vem objeto
  // com url. Enviar `{}` sem url é quase sempre engano do painel.
  for (const campo of ['capa', 'capa_interna']) {
    if (!informado(campo) || dados[campo] === null) continue;
    if (typeof dados[campo] !== 'object' || Array.isArray(dados[campo]))
      campos[campo] = 'Deve ser um objeto.';
    else if (vazio(dados[campo].url)) campos[campo] = 'Precisa de uma url.';
  }

  if (informado('seo') && dados.seo !== null) {
    if (typeof dados.seo !== 'object' || Array.isArray(dados.seo)) campos.seo = 'Deve ser um objeto.';
    else if (dados.seo.noindex !== undefined && typeof dados.seo.noindex !== 'boolean')
      campos.seo = 'O campo noindex deve ser true ou false.';
  }

  return campos;
};

module.exports = {
  serializarArtigo,
  serializarCategoria,
  validarArtigo,
  STATUS_VALIDOS,
};
