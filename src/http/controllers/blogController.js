const blogService = require('../../application/blog/BlogService');
const newsletterService = require('../../application/blog/BlogNewsletterService');
const mediaService = require('../../application/blog/BlogMediaService');

// Endpoints públicos do blog (seção 3). Sem autenticação, e só com artigos
// publicados. Quem chama é o servidor do Next (SSR/ISR), não o navegador do
// visitante — daí o cache curto, que absorve rajadas de renderização.

const CACHE_LISTAGEM = 'public, max-age=60';
const CACHE_MIDIA = 'public, max-age=31536000, immutable';

const inteiro = (valor, padrao) => {
  const n = Number.parseInt(valor, 10);
  return Number.isFinite(n) && n > 0 ? n : padrao;
};

const ORDENS = ['recentes', 'antigos', 'populares'];

const listarArtigos = async (req, res) => {
  const resultado = await blogService.listarArtigosPublicos({
    categoria: req.query.categoria,
    busca: req.query.busca,
    pagina: inteiro(req.query.pagina, 1),
    porPagina: inteiro(req.query.por_pagina, 20),
    ordem: ORDENS.includes(req.query.ordem) ? req.query.ordem : 'recentes',
    incluirCorpo: req.query.corpo === 'true' || req.query.corpo === '1',
  });

  res.set('Cache-Control', CACHE_LISTAGEM);
  return res.status(200).json(resultado);
};

const obterArtigo = async (req, res) => {
  const artigo = await blogService.obterArtigoPublico(req.params.slug);
  res.set('Cache-Control', CACHE_LISTAGEM);
  return res.status(200).json(artigo);
};

const listarCategorias = async (_req, res) => {
  const resultado = await blogService.listarCategorias();
  res.set('Cache-Control', CACHE_LISTAGEM);
  return res.status(200).json(resultado);
};

const listarRedirecionamentos = async (_req, res) => {
  const resultado = await blogService.listarRedirecionamentos();
  res.set('Cache-Control', CACHE_LISTAGEM);
  return res.status(200).json(resultado);
};

const inscreverNewsletter = async (req, res) => {
  const { status, body } = await newsletterService.inscrever({
    email: req.body?.email,
    origem: req.body?.origem,
  });
  return res.status(status).json(body);
};

// Serve a imagem gravada em uploads/blog. O nome é validado contra o padrão que
// nós mesmos geramos, e o Content-Type sai da nossa tabela — o que estiver no
// disco nunca é interpretado, só devolvido.
const servirMidia = async (req, res) => {
  const { conteudo, mime } = await mediaService.obter(req.params.arquivo);
  res.set('Content-Type', mime);
  res.set('Cache-Control', CACHE_MIDIA);
  res.set('X-Content-Type-Options', 'nosniff');
  return res.status(200).send(conteudo);
};

module.exports = {
  listarArtigos,
  obterArtigo,
  listarCategorias,
  listarRedirecionamentos,
  inscreverNewsletter,
  servirMidia,
};
