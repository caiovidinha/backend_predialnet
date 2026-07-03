const express = require('express');
const { download, upload, ping } = require('../controllers/speedtestController');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Speedtest
 *   description: Endpoints públicos do teste de velocidade nativo do app
 */

/**
 * @swagger
 * /speedtest/download:
 *   get:
 *     summary: Devolve N bytes de conteúdo aleatório para medir download
 *     tags: [Speedtest]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *         required: false
 *         description: Quantidade de bytes desejada (padrão 12 MB, máximo 100 MB)
 *         example: 12582912
 *     responses:
 *       200:
 *         description: Fluxo binário sem cache e sem compressão
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/download', download);

/**
 * @swagger
 * /speedtest/upload:
 *   post:
 *     summary: Consome o corpo binário enviado e responde 200 (medição de upload)
 *     tags: [Speedtest]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/octet-stream:
 *           schema:
 *             type: string
 *             format: binary
 *     responses:
 *       200:
 *         description: Corpo consumido com sucesso
 */
router.post('/upload', upload);

/**
 * @swagger
 * /speedtest/ping:
 *   get:
 *     summary: Resposta mínima sem cache para medir latência e jitter
 *     tags: [Speedtest]
 *     security: []
 *     responses:
 *       204:
 *         description: Sem conteúdo
 */
router.get('/ping', ping);

module.exports = router;
