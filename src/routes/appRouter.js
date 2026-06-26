const express = require("express");
const appController = require("../controllers/bdc");

const appRouter = express.Router();

// As rotas do BDC servem apenas LAYOUT (sem dado sensível), por isso são
// públicas. Dados sensíveis continuam nas rotas autenticadas existentes.

/**
 * @swagger
 * /app/version-check:
 *   get:
 *     summary: Gate de versão do app (força atualização quando necessário)
 *     tags: [BDC]
 *     parameters:
 *       - in: query
 *         name: platform
 *         schema: { type: string, enum: [ios, android] }
 *       - in: query
 *         name: version
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: minVersion, latestVersion, force, updateUrl, message
 */
appRouter.get("/version-check", appController.getVersionCheck);

/**
 * @swagger
 * /app/content:
 *   get:
 *     summary: Conteúdo/flags globais (ads, featureFlags, support, planUpgrade)
 *     tags: [BDC]
 *     responses:
 *       200:
 *         description: Objeto de configuração
 */
appRouter.get("/content", appController.getContent);

/**
 * @swagger
 * /app/screen/{name}:
 *   get:
 *     summary: Árvore Server-Driven UI de uma tela
 *     tags: [BDC]
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema: { type: string }
 *         description: home | fatura | suporte | settings | perfil | ...
 *     responses:
 *       200:
 *         description: "{ schemaVersion, screen, tree }"
 *       404:
 *         description: Tela não encontrada
 */
appRouter.get("/screen/:name", appController.getScreen);

module.exports = appRouter;
