const express = require('express');
const { validateJWT, requireAdmin, attachClientIdentity } = require('../middlewares/auth');
const {
  download,
  upload,
  ping,
  submitResult,
  listResults,
  getResult,
  clientSummary,
} = require('../controllers/speedtestController');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Speedtest
 *   description: Teste de velocidade nativo do app — transferência, submissão de resultado e consulta pelo operador
 */

// ── Endpoints de transferência (públicos, sem autenticação) ──────────────────

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

// ── Submissão do resultado (cliente autenticado) ─────────────────────────────

/**
 * @swagger
 * /speedtest/result:
 *   post:
 *     summary: Persiste o resultado detalhado de um teste (medido no cliente)
 *     tags: [Speedtest]
 *     description: >
 *       Envie o cpf do cliente no body para amarrar o teste (tem precedência).
 *       Como fallback, o x-access-token também é decodificado best-effort para
 *       resolver userId/cpf, independente de ENABLE_JWT. Sem nenhum dos dois, o
 *       teste é gravado como anônimo. Aceita payload achatado ou aninhado
 *       (download/upload/ping/device). IP e user-agent são capturados no
 *       servidor. Campos desconhecidos são preservados em `raw`.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cpf: { type: string, example: "12345678901", description: "CPF do cliente; tem precedência sobre o token" }
 *               userId: { type: string, description: "Opcional; fallback é o token" }
 *               downloadMbps: { type: number, example: 287.4 }
 *               uploadMbps: { type: number, example: 112.9 }
 *               pingMs: { type: number, example: 8.2 }
 *               jitterMs: { type: number, example: 1.1 }
 *               packetLoss: { type: number, example: 0 }
 *               download:
 *                 type: object
 *                 properties:
 *                   bytes: { type: number, example: 287309824 }
 *                   durationMs: { type: integer, example: 8000 }
 *                   connections: { type: integer, example: 4 }
 *               upload:
 *                 type: object
 *                 properties:
 *                   bytes: { type: number }
 *                   durationMs: { type: integer }
 *                   connections: { type: integer }
 *               ping:
 *                 type: object
 *                 properties:
 *                   avg: { type: number }
 *                   jitter: { type: number }
 *                   samples: { type: array, items: { type: number } }
 *               device:
 *                 type: object
 *                 properties:
 *                   appVersion: { type: string }
 *                   platform: { type: string, example: "ios" }
 *                   osVersion: { type: string }
 *                   model: { type: string }
 *                   connectionType: { type: string, example: "wifi" }
 *                   carrier: { type: string }
 *               serverHost: { type: string }
 *               status: { type: string, enum: [completed, aborted, error] }
 *               startedAt: { type: string, format: date-time }
 *               finishedAt: { type: string, format: date-time }
 *               config: { type: object }
 *     responses:
 *       201:
 *         description: Resultado salvo
 *       400:
 *         description: Payload inválido
 */
router.post('/result', attachClientIdentity, submitResult);

// ── Consulta pelo operador (admin) ───────────────────────────────────────────

/**
 * @swagger
 * /speedtest/results:
 *   get:
 *     summary: Lista testes com filtros e paginação (operador)
 *     tags: [Speedtest]
 *     parameters:
 *       - in: query
 *         name: cpf
 *         schema: { type: string }
 *       - in: query
 *         name: userId
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [completed, aborted, error] }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200:
 *         description: Lista paginada de testes
 *       403:
 *         description: Acesso restrito ao operador
 */
router.get('/results', validateJWT, requireAdmin, listResults);

/**
 * @swagger
 * /speedtest/results/{id}:
 *   get:
 *     summary: Detalhe completo de um teste (operador)
 *     tags: [Speedtest]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Teste encontrado
 *       404:
 *         description: Não encontrado
 */
router.get('/results/:id', validateJWT, requireAdmin, getResult);

/**
 * @swagger
 * /speedtest/clients/{cpf}/summary:
 *   get:
 *     summary: Resumo agregado dos testes de um cliente (operador)
 *     tags: [Speedtest]
 *     parameters:
 *       - in: path
 *         name: cpf
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Médias, melhor/pior resultado, total e último teste
 */
router.get('/clients/:cpf/summary', validateJWT, requireAdmin, clientSummary);

module.exports = router;
