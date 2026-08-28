const express = require('express');
const { validateJWT, requireAdmin } = require('../middlewares/auth');
const ctrl = require('../controllers/statsController');

const router = express.Router();

// Mesma proteção do board de chamados: é tela de operador, não do app.
// Nenhum endpoint daqui devolve dado pessoal — só agregado —, mas número de
// cliente e volume de chamado também não são informação pública.
router.use(validateJWT, requireAdmin);

/**
 * @swagger
 * tags:
 *   name: Stats
 *   description: Estatísticas agregadas do app para o dashboard do operador
 */

/**
 * @swagger
 * /stats/overview:
 *   get:
 *     summary: Visão geral — os números de topo do dashboard
 *     tags: [Stats]
 *     parameters:
 *       - { in: query, name: dias, schema: { type: integer, default: 30, maximum: 365 }, description: Janela do período }
 *     responses:
 *       200:
 *         description: "{ periodo, usuarios, notificacoes, chamados, speedtest, blog, mensagens_app }"
 */
router.get('/overview', ctrl.overview);

/**
 * @swagger
 * /stats/usuarios:
 *   get:
 *     summary: Base de usuários, cadastros por dia e distribuição por cidade
 *     tags: [Stats]
 *     parameters:
 *       - { in: query, name: dias, schema: { type: integer, default: 30, maximum: 365 } }
 *     responses:
 *       200:
 *         description: "Total, novos no período, com push, com fatura aberta, série diária e cobertura"
 */
router.get('/usuarios', ctrl.usuarios);

/**
 * @swagger
 * /stats/notificacoes:
 *   get:
 *     summary: Envios, alcance e taxa de leitura das notificações push
 *     tags: [Stats]
 *     parameters:
 *       - { in: query, name: dias, schema: { type: integer, default: 30, maximum: 365 } }
 *     responses:
 *       200: { description: "Enviadas, falhas, alcance, taxa de leitura e série diária" }
 */
router.get('/notificacoes', ctrl.notificacoes);

/**
 * @swagger
 * /stats/chamados:
 *   get:
 *     summary: Chamados por status, prioridade e categoria, com tempo de resolução
 *     tags: [Stats]
 *     parameters:
 *       - { in: query, name: dias, schema: { type: integer, default: 30, maximum: 365 } }
 *     responses:
 *       200: { description: "Distribuições, fila atual, resolvidos no período e série de aberturas" }
 */
router.get('/chamados', ctrl.chamados);

/**
 * @swagger
 * /stats/speedtest:
 *   get:
 *     summary: Qualidade de conexão medida pelo app
 *     tags: [Stats]
 *     parameters:
 *       - { in: query, name: dias, schema: { type: integer, default: 30, maximum: 365 } }
 *     responses:
 *       200: { description: "Médias de download/upload/ping, quebra por plataforma, conexão e versão do app" }
 */
router.get('/speedtest', ctrl.speedtest);

/**
 * @swagger
 * /stats/blog:
 *   get:
 *     summary: Artigos, categorias, inscritos e mais lidos
 *     tags: [Stats]
 *     parameters:
 *       - { in: query, name: dias, schema: { type: integer, default: 30, maximum: 365 } }
 *     responses:
 *       200: { description: "Artigos por status, publicados no período, newsletter e top 5 mais lidos" }
 */
router.get('/blog', ctrl.blog);

/**
 * @swagger
 * /stats/upgrades:
 *   get:
 *     summary: Funil de upgrade de planos (board do Trello alimentado pelo app)
 *     tags: [Stats]
 *     parameters:
 *       - { in: query, name: dias, schema: { type: integer, default: 30, maximum: 365 } }
 *     responses:
 *       200: { description: "Funil por lista, convertidos, taxa de conversão e novos leads por dia" }
 */
router.get('/upgrades', ctrl.upgrades);

/**
 * @swagger
 * /stats/cache:
 *   delete:
 *     summary: Limpa o cache das estatísticas (TTL padrão de 60 s)
 *     tags: [Stats]
 *     responses:
 *       200: { description: "{ ok: true }" }
 */
router.delete('/cache', ctrl.limparCache);

module.exports = router;
