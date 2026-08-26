// Slug do artigo: minúsculas, sem acentos, hífens (seção 5 da spec).

const gerarSlug = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // tira os acentos separados pelo NFD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
    .replace(/-+$/g, '');

const slugValido = (slug) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(String(slug ?? ''));

// Acrescenta -2, -3… até achar um slug livre. `existe` é async (slug) => bool.
const gerarSlugUnico = async (base, existe) => {
  const raiz = gerarSlug(base) || 'artigo';
  if (!(await existe(raiz))) return raiz;

  for (let n = 2; n < 1000; n += 1) {
    const candidato = `${raiz}-${n}`;
    if (!(await existe(candidato))) return candidato;
  }
  // Fallback improvável: sufixo temporal em vez de estourar o laço.
  return `${raiz}-${Date.now()}`;
};

module.exports = { gerarSlug, slugValido, gerarSlugUnico };
