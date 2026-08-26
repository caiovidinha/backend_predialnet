const blogService = require('../../application/blog/BlogService');
const authService = require('../../application/blog/BlogAuthService');
const mediaService = require('../../application/blog/BlogMediaService');
const revalidacao = require('../../application/blog/BlogRevalidateService');
const newsletterService = require('../../application/blog/BlogNewsletterService');
const auditRepo = require('../../infrastructure/repositories/blogAuditRepository');
const { ipDe } = require('../middlewares/rateLimit');
const { STATUS_VALIDOS } = require('../../domain/blog/artigo');

// Endpoints do painel (seção 5). Todos já passaram pelo `autenticar`, então
// req.blogUsuario está preenchido.

const inteiro = (valor, padrao) => {
  const n = Number.parseInt(valor, 10);
  return Number.isFinite(n) && n > 0 ? n : padrao;
};

const contexto = (req) => [req.blogUsuario, ipDe(req)];

// ── Artigos ──────────────────────────────────────────────────

const listarArtigos = async (req, res) => {
  const status = STATUS_VALIDOS.includes(req.query.status) ? req.query.status : 'todos';
  const resultado = await blogService.listarArtigosAdmin({
    status,
    busca: req.query.busca,
    pagina: inteiro(req.query.pagina, 1),
    porPagina: inteiro(req.query.por_pagina, 20),
  });
  return res.status(200).json(resultado);
};

const criarArtigo = async (req, res) => {
  const artigo = await blogService.criarArtigo(req.body ?? {}, ...contexto(req));
  return res.status(201).json(artigo);
};

const atualizarArtigo = async (req, res) => {
  const artigo = await blogService.atualizarArtigo(req.params.id, req.body ?? {}, ...contexto(req));
  return res.status(200).json(artigo);
};

const removerArtigo = async (req, res) => {
  await blogService.arquivarArtigo(req.params.id, ...contexto(req));
  return res.status(204).end();
};

const publicarArtigo = async (req, res) => {
  const resultado = await blogService.publicarArtigo(req.params.id, req.body ?? {}, ...contexto(req));
  return res.status(200).json(resultado);
};

// Pré-visualização: devolve o artigo em qualquer status.
const previewArtigo = async (req, res) => {
  const artigo = await blogService.obterArtigoAdmin(req.params.id);
  return res.status(200).json(artigo);
};

// ── Mídia ────────────────────────────────────────────────────

const upload = async (req, res) => {
  const resultado = await mediaService.enviar(req.file, ...contexto(req));
  return res.status(201).json(resultado);
};

// ── Revalidação manual ───────────────────────────────────────
// Escape hatch para quando o blog ficou com cache velho — o editor força o
// aviso sem precisar reeditar o artigo.

const revalidar = async (req, res) => {
  const resultado = await revalidacao.revalidar({
    slug: req.body?.slug || null,
    origem: 'manual',
  });
  return res.status(200).json({
    ok: true,
    revalidado: resultado.ok,
    revalidados: resultado.revalidados,
    motivo: resultado.motivo,
  });
};

// ── Usuários (papel admin) ───────────────────────────────────

const listarUsuarios = async (_req, res) => {
  const usuarios = await authService.listarUsuarios();
  return res.status(200).json({ usuarios });
};

const criarUsuario = async (req, res) => {
  const usuario = await authService.criarUsuario(req.body ?? {}, ...contexto(req));
  return res.status(201).json(usuario);
};

const atualizarUsuario = async (req, res) => {
  const usuario = await authService.alterarUsuario(req.params.id, req.body ?? {}, ...contexto(req));
  return res.status(200).json(usuario);
};

// ── Newsletter e auditoria ───────────────────────────────────

const listarNewsletter = async (req, res) => {
  const resultado = await newsletterService.listar({
    pagina: inteiro(req.query.pagina, 1),
    porPagina: inteiro(req.query.por_pagina, 50),
  });
  return res.status(200).json(resultado);
};

const listarAuditoria = async (req, res) => {
  const resultado = await auditRepo.listar({
    pagina: inteiro(req.query.pagina, 1),
    porPagina: inteiro(req.query.por_pagina, 50),
    entidade: req.query.entidade,
    entidadeId: req.query.entidade_id,
  });
  return res.status(200).json(resultado);
};

module.exports = {
  listarArtigos,
  criarArtigo,
  atualizarArtigo,
  removerArtigo,
  publicarArtigo,
  previewArtigo,
  upload,
  revalidar,
  listarUsuarios,
  criarUsuario,
  atualizarUsuario,
  listarNewsletter,
  listarAuditoria,
};
