const sanitizeHtml = require('sanitize-html');

// Sanitização do campo `corpo` (seção 2.3 da spec).
//
// O HTML é inserido no site sem reprocessamento, dentro do domínio principal —
// então a limpeza acontece AQUI, na escrita, e não na leitura. Tudo que não
// estiver nas listas abaixo é descartado.

const TAGS_PERMITIDAS = [
  'p', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'blockquote',
  'figure', 'figcaption', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'br', 'hr', 'code', 'pre',
];

const OPCOES = {
  allowedTags: TAGS_PERMITIDAS,
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    th: ['colspan', 'rowspan', 'scope'],
    td: ['colspan', 'rowspan'],
    // Nenhum atributo global: mata on* (onclick, onerror…), style e data-*.
    '*': [],
  },
  // javascript: e data: em href ficam de fora por não estarem aqui.
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  allowProtocolRelative: false,
  // Descarta a tag E o conteúdo de script/style — sem isso o texto do script
  // sobraria solto no corpo.
  disallowedTagsMode: 'discard',
  nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript', 'iframe', 'object', 'embed', 'form'],
  transformTags: {
    // O h1 da página é o título do artigo. Se o editor usou h1, vira h2.
    h1: 'h2',
    a: (tagName, attribs) => {
      const href = attribs.href || '';
      const externo = /^https?:\/\//i.test(href);
      return {
        tagName: 'a',
        attribs: externo
          ? { ...attribs, rel: 'noopener noreferrer' }
          : attribs,
      };
    },
  },
};

const sanitizarCorpo = (html) => sanitizeHtml(String(html ?? ''), OPCOES);

// Texto puro do corpo — usado para calcular tempo de leitura e para a busca.
const textoPuro = (html) =>
  sanitizeHtml(String(html ?? ''), { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, ' ')
    .trim();

// palavras ÷ 200, mínimo 1 (seção 5, POST /blog/admin/artigos).
const calcularTempoLeitura = (html) => {
  const palavras = textoPuro(html).split(' ').filter(Boolean).length;
  return Math.max(1, Math.round(palavras / 200));
};

module.exports = { sanitizarCorpo, textoPuro, calcularTempoLeitura, TAGS_PERMITIDAS };
