const express = require('express');
const multer = require('multer');

const ctrl = require('../controllers/blogController');
const admin = require('../controllers/blogAdminController');
const auth = require('../controllers/blogAuthController');
const { autenticar, exigirPapel } = require('../middlewares/blogAuth');
const { criarRateLimit, ipDe } = require('../middlewares/rateLimit');
const { envolver, tratarErros } = require('../middlewares/blogErrors');
const { BlogError } = require('../../domain/blog/errors');

const router = express.Router();

// ── CORS (seção 8) ───────────────────────────────────────────
// Origem refletida a partir de uma allowlist, nunca "*": as rotas /admin/*
// carregam credenciais, e "*" abriria a API para qualquer site.
//
// Só importa para chamada feita do navegador — o painel e o formulário de
// newsletter. O que o Next.js busca no servidor (SSR/ISR) não manda Origin e
// nem passa por aqui.

const ORIGENS_PADRAO = [
  'https://blog.predialnet.com.br', // front do blog (Next.js) e o painel
  'https://www.predialnet.com.br', // formulários do site institucional
  'https://predialnet.com.br',
];

// Portas de desenvolvimento: 3100 é o blog (Next), 4321 é o site (Astro). O
// 127.0.0.1 entra junto porque o navegador trata os dois hostnames como
// origens distintas.
const ORIGENS_DEV = [
  'http://localhost:3100', 'http://127.0.0.1:3100',
  'http://localhost:4321', 'http://127.0.0.1:4321',
];

const listar = (valor) => String(valor).split(',').map((o) => o.trim()).filter(Boolean);

const ORIGENS = (process.env.BLOG_CORS_ORIGINS ? listar(process.env.BLOG_CORS_ORIGINS) : ORIGENS_PADRAO)
  .concat(process.env.NODE_ENV === 'development' ? ORIGENS_DEV : []);

// Entradas com `*` viram padrão, para os previews da Vercel
// (BLOG_CORS_ORIGINS=...,https://*.vercel.app). O curinga cobre um nível de
// subdomínio e não atravessa ponto, então `https://*.vercel.app` não libera
// `https://evil.com/x.vercel.app` nem `https://a.b.vercel.app`.
const PADROES = ORIGENS.filter((o) => o.includes('*')).map((o) =>
  new RegExp(`^${o.split('*').map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^.]+')}$`));

const EXATAS = new Set(ORIGENS.filter((o) => !o.includes('*')));

const permitida = (origem) => EXATAS.has(origem) || PADROES.some((re) => re.test(origem));

const cors = (req, res, next) => {
  const origem = req.headers.origin;

  // Vary sempre: sem isso um cache intermediário serviria a resposta de uma
  // origem para outra.
  res.set('Vary', 'Origin');

  if (origem && permitida(origem)) {
    res.set('Access-Control-Allow-Origin', origem);
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Access-Control-Max-Age', '86400');
  }

  if (req.method === 'OPTIONS') return res.status(204).end();
  return next();
};

router.use(cors);
// Parser próprio: assim JSON malformado cai no tratador de erros do blog e sai
// no formato { erro, mensagem } em vez do HTML padrão do Express.
router.use(express.json({ limit: '2mb' }));

// ── Upload ───────────────────────────────────────────────────

const MAX_UPLOAD_MB = Number.parseInt(process.env.BLOG_UPLOAD_MAX_MB, 10) || 8;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
});

const receberArquivo = (req, res, next) =>
  upload.single('arquivo')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE')
      return next(new BlogError(413, 'arquivo_grande', `O arquivo excede ${MAX_UPLOAD_MB} MB.`));
    return next(new BlogError(400, 'requisicao_invalida', 'Falha no upload do arquivo.'));
  });

// ── Rate limits (seções 3 e 4) ───────────────────────────────

const limiteLogin = criarRateLimit({
  janelaMs: 15 * 60 * 1000,
  maximo: 5,
  progressivo: true,
  chave: (req) => `${ipDe(req)}|${String(req.body?.usuario ?? '').toLowerCase()}`,
  mensagem: 'Muitas tentativas de login. Aguarde antes de tentar novamente.',
});

const limiteNewsletter = criarRateLimit({
  janelaMs: 10 * 60 * 1000,
  maximo: 5,
  mensagem: 'Muitas inscrições a partir deste endereço. Tente mais tarde.',
});

/**
 * @swagger
 * tags:
 *   name: Blog
 *   description: Blog da Predialnet — consumido pelo front em blog.predialnet.com.br (Next.js)
 */

// ── Público ──────────────────────────────────────────────────

/**
 * @swagger
 * /blog/artigos:
 *   get:
 *     summary: Lista artigos publicados
 *     tags: [Blog]
 *     security: []
 *     parameters:
 *       - { in: query, name: categoria, schema: { type: string }, description: Slug da categoria }
 *       - { in: query, name: busca, schema: { type: string }, description: Busca em título, resumo e corpo }
 *       - { in: query, name: pagina, schema: { type: integer, default: 1 } }
 *       - { in: query, name: por_pagina, schema: { type: integer, default: 20, maximum: 100 } }
 *       - { in: query, name: ordem, schema: { type: string, enum: [recentes, antigos, populares] } }
 *       - { in: query, name: corpo, schema: { type: boolean, default: false }, description: Inclui o HTML do artigo (o build usa true) }
 *     responses:
 *       200: { description: "{ artigos: [], paginacao: {} }" }
 */
router.get('/artigos', envolver(ctrl.listarArtigos));

/**
 * @swagger
 * /blog/artigos/{slug}:
 *   get:
 *     summary: Artigo publicado, sempre com o corpo
 *     tags: [Blog]
 *     security: []
 *     parameters: [{ in: path, name: slug, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Artigo }
 *       404: { description: Slug inexistente ou não publicado }
 */
router.get('/artigos/:slug', envolver(ctrl.obterArtigo));

/**
 * @swagger
 * /blog/categorias:
 *   get:
 *     summary: Categorias com a contagem de artigos publicados
 *     tags: [Blog]
 *     security: []
 *     responses:
 *       200: { description: "{ categorias: [] }" }
 */
router.get('/categorias', envolver(ctrl.listarCategorias));

/**
 * @swagger
 * /blog/redirecionamentos:
 *   get:
 *     summary: Slugs antigos → novos, para o site emitir 301
 *     tags: [Blog]
 *     security: []
 *     responses:
 *       200: { description: "{ redirecionamentos: [{ de, para }] }" }
 */
router.get('/redirecionamentos', envolver(ctrl.listarRedirecionamentos));

/**
 * @swagger
 * /blog/newsletter:
 *   post:
 *     summary: Inscreve um e-mail na newsletter (rate limit por IP)
 *     tags: [Blog]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string }
 *               origem: { type: string }
 *     responses:
 *       201: { description: Inscrição confirmada }
 *       409: { description: Já inscrito (o site trata como sucesso) }
 *       422: { description: E-mail inválido }
 *       429: { description: Rate limit }
 */
router.post('/newsletter', limiteNewsletter, envolver(ctrl.inscreverNewsletter));

/**
 * @swagger
 * /blog/midia/{arquivo}:
 *   get:
 *     summary: Serve uma imagem enviada pelo painel
 *     tags: [Blog]
 *     security: []
 *     parameters: [{ in: path, name: arquivo, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Conteúdo da imagem }
 *       404: { description: Imagem não encontrada }
 */
router.get('/midia/:arquivo', envolver(ctrl.servirMidia));

// ── Autenticação do painel ───────────────────────────────────

/**
 * @swagger
 * /blog/auth/login:
 *   post:
 *     summary: Login do painel (5 tentativas por usuário/IP a cada 15 min)
 *     tags: [Blog]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [usuario, senha]
 *             properties:
 *               usuario: { type: string, description: E-mail do editor }
 *               senha: { type: string }
 *     responses:
 *       200: { description: "{ access_token, refresh_token, expira_em, usuario }" }
 *       401: { description: Credenciais inválidas }
 *       429: { description: Rate limit com bloqueio progressivo }
 */
router.post('/auth/login', limiteLogin, envolver(auth.login));

/**
 * @swagger
 * /blog/auth/refresh:
 *   post:
 *     summary: Renova a sessão (o refresh usado é revogado e um novo é emitido)
 *     tags: [Blog]
 *     security: []
 *     responses:
 *       200: { description: Mesmo formato do login }
 *       401: { description: Refresh inválido ou expirado }
 */
router.post('/auth/refresh', envolver(auth.refresh));

/**
 * @swagger
 * /blog/auth/logout:
 *   post:
 *     summary: Invalida o refresh token
 *     tags: [Blog]
 *     security: []
 *     responses:
 *       204: { description: Sem conteúdo }
 */
router.post('/auth/logout', envolver(auth.logout));

// ── Painel (tudo daqui para baixo exige Bearer) ──────────────

router.use('/admin', autenticar);

/**
 * @swagger
 * /blog/admin/eu:
 *   get:
 *     summary: Dados do usuário autenticado
 *     tags: [Blog]
 *     responses:
 *       200: { description: "{ usuario }" }
 *       401: { description: Token ausente, inválido ou expirado }
 */
router.get('/admin/eu', envolver(auth.eu));

/**
 * @swagger
 * /blog/admin/artigos:
 *   get:
 *     summary: Lista artigos incluindo rascunhos e arquivados
 *     tags: [Blog]
 *     parameters:
 *       - { in: query, name: status, schema: { type: string, enum: [rascunho, publicado, arquivado, todos] } }
 *       - { in: query, name: busca, schema: { type: string } }
 *       - { in: query, name: pagina, schema: { type: integer, default: 1 } }
 *       - { in: query, name: por_pagina, schema: { type: integer, default: 20, maximum: 100 } }
 *       - { in: query, name: corpo, schema: { type: boolean, default: false }, description: Inclui o HTML do artigo — o editor do painel usa true }
 *     responses:
 *       200: { description: "{ artigos: [], paginacao: {} }" }
 *   post:
 *     summary: Cria um artigo (slug e tempo de leitura são gerados se ausentes)
 *     tags: [Blog]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [titulo, resumo, categoria, corpo]
 *             properties:
 *               titulo: { type: string }
 *               slug: { type: string }
 *               resumo: { type: string }
 *               categoria: { type: string, description: Slug ou nome da categoria }
 *               autor: { type: string }
 *               corpo: { type: string, description: HTML — sanitizado no servidor }
 *               status: { type: string, enum: [rascunho, publicado, arquivado] }
 *               publicado_em: { type: string, format: date-time }
 *               destaque: { type: boolean }
 *               tempo_leitura: { type: integer }
 *               capa: { type: object, description: "Card da listagem e Open Graph (16:9) — { url, alt, largura, altura }" }
 *               capa_interna: { type: object, description: "Topo da página do post, tamanho original — mesmo formato da capa" }
 *               seo: { type: object }
 *     responses:
 *       201: { description: Artigo criado }
 *       422: { description: Validação }
 */
router.get('/admin/artigos', envolver(admin.listarArtigos));
router.post('/admin/artigos', envolver(admin.criarArtigo));

/**
 * @swagger
 * /blog/admin/artigos/{id}:
 *   put:
 *     summary: Atualiza o artigo (parcial — só os campos enviados)
 *     tags: [Blog]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: Artigo atualizado }
 *       404: { description: Não encontrado }
 *       409: { description: Slug duplicado }
 *   delete:
 *     summary: Exclusão lógica (o artigo passa para arquivado)
 *     tags: [Blog]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       204: { description: Sem conteúdo }
 *       404: { description: Não encontrado }
 */
router.put('/admin/artigos/:id', envolver(admin.atualizarArtigo));
router.delete('/admin/artigos/:id', envolver(admin.removerArtigo));

/**
 * @swagger
 * /blog/admin/artigos/{id}/publicar:
 *   post:
 *     summary: Publica agora ou agenda, e avisa o blog para revalidar o cache
 *     tags: [Blog]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               publicado_em: { type: string, format: date-time }
 *     responses:
 *       200: { description: "{ ok, artigo, revalidado }" }
 *       404: { description: Não encontrado }
 *       422: { description: Artigo incompleto para publicação }
 */
router.post('/admin/artigos/:id/publicar', envolver(admin.publicarArtigo));

/**
 * @swagger
 * /blog/admin/preview/{id}:
 *   get:
 *     summary: Artigo em qualquer status, para pré-visualização no painel
 *     tags: [Blog]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: Artigo }
 *       404: { description: Não encontrado }
 */
router.get('/admin/preview/:id', envolver(admin.previewArtigo));

/**
 * @swagger
 * /blog/admin/upload:
 *   post:
 *     summary: Envia uma imagem (multipart, campo "arquivo")
 *     tags: [Blog]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [arquivo]
 *             properties:
 *               arquivo: { type: string, format: binary }
 *     responses:
 *       201: { description: "{ url, largura, altura, tamanho }" }
 *       413: { description: Arquivo acima do limite }
 *       422: { description: Formato não aceito }
 */
router.post('/admin/upload', receberArquivo, envolver(admin.upload));

/**
 * @swagger
 * /blog/admin/revalidar:
 *   post:
 *     summary: Força a revalidação do cache do blog (slug opcional no corpo)
 *     tags: [Blog]
 *     responses:
 *       200: { description: "{ ok, revalidado, revalidados }" }
 */
router.post('/admin/revalidar', envolver(admin.revalidar));

/**
 * @swagger
 * /blog/admin/newsletter:
 *   get:
 *     summary: Lista os inscritos na newsletter
 *     tags: [Blog]
 *     responses:
 *       200: { description: "{ items, total }" }
 */
router.get('/admin/newsletter', envolver(admin.listarNewsletter));

/**
 * @swagger
 * /blog/admin/auditoria:
 *   get:
 *     summary: Log de auditoria (quem criou, editou, publicou e excluiu)
 *     tags: [Blog]
 *     parameters:
 *       - { in: query, name: entidade, schema: { type: string, enum: [artigo, usuario, midia] } }
 *       - { in: query, name: entidade_id, schema: { type: string } }
 *     responses:
 *       200: { description: "{ items, total }" }
 */
router.get('/admin/auditoria', envolver(admin.listarAuditoria));

/**
 * @swagger
 * /blog/admin/usuarios:
 *   get:
 *     summary: Lista os usuários do painel (papel admin)
 *     tags: [Blog]
 *     responses:
 *       200: { description: "{ usuarios: [] }" }
 *       403: { description: Papel insuficiente }
 *   post:
 *     summary: Cria um usuário do painel (papel admin)
 *     tags: [Blog]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nome, email, senha]
 *             properties:
 *               nome: { type: string }
 *               email: { type: string }
 *               senha: { type: string, description: Mínimo de 10 caracteres }
 *               papel: { type: string, enum: [admin, editor] }
 *     responses:
 *       201: { description: Usuário criado }
 *       403: { description: Papel insuficiente }
 *       409: { description: E-mail já cadastrado }
 */
router.get('/admin/usuarios', exigirPapel('admin'), envolver(admin.listarUsuarios));
router.post('/admin/usuarios', exigirPapel('admin'), envolver(admin.criarUsuario));

/**
 * @swagger
 * /blog/admin/usuarios/{id}:
 *   put:
 *     summary: Atualiza nome, senha, papel ou situação de um usuário (papel admin)
 *     tags: [Blog]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: Usuário atualizado }
 *       403: { description: Papel insuficiente }
 *       404: { description: Não encontrado }
 */
router.put('/admin/usuarios/:id', exigirPapel('admin'), envolver(admin.atualizarUsuario));

// Rota inexistente dentro de /blog responde no formato de erro do blog.
router.use((req, res) =>
  res.status(404).json({ erro: 'nao_encontrado', mensagem: 'Endpoint inexistente.' }));

router.use(tratarErros);

module.exports = router;
