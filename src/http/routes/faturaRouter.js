const express = require('express');
const ctrl = require('../controllers/faturaController');
const { validateJWT } = require('../middlewares/auth');

const router = express.Router();

// Todas as rotas de fatura requerem autenticação
router.use(validateJWT);

/**
 * @swagger
 * /fatura/segunda-via/{id}/{boleta}:
 *   get:
 *     summary: Obter a 2ª via da fatura
 *     tags: [Fatura]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: boleta
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Link retornado com sucesso
 *       401:
 *         description: Não autenticado
 */
router.get('/segunda-via/:id/:boleta', ctrl.getSecondCopyLinkController);

/**
 * @swagger
 * /fatura/historico/{id}:
 *   get:
 *     summary: Obter histórico das últimas 6 faturas
 *     tags: [Fatura]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Histórico retornado com sucesso
 *       401:
 *         description: Não autenticado
 */
router.get('/historico/:id', ctrl.getLastSixInvoicesController);

/**
 * @swagger
 * /fatura/pix/{id}:
 *   get:
 *     summary: Obter PIX da última fatura em aberto
 *     tags: [Fatura]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: PIX retornado com sucesso
 *       401:
 *         description: Não autenticado
 */
router.get('/pix/:id', ctrl.getPixFromLastOpenInternetInvoiceController);

/**
 * @swagger
 * /fatura/status/{id}:
 *   get:
 *     summary: Verificar status da fatura atual
 *     tags: [Fatura]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Status retornado com sucesso
 *       401:
 *         description: Não autenticado
 */
router.get('/status/:id', ctrl.checkCurrentInvoiceStatusController);

/**
 * @swagger
 * /fatura/atual/{id}:
 *   get:
 *     summary: Obter fatura atual
 *     tags: [Fatura]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Fatura atual retornada com sucesso
 *       401:
 *         description: Não autenticado
 */
router.get('/atual/:id', ctrl.getCurrentInvoiceController);

/**
 * @swagger
 * /fatura/past-status/{id}:
 *   get:
 *     summary: Conta faturas passadas em aberto e vencidas
 *     tags: [Fatura]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Contagem retornada com sucesso
 *       401:
 *         description: Não autenticado
 */
router.get('/past-status/:id', ctrl.getPastInvoicesStatusController);

/**
 * @swagger
 * /fatura/digital/{id}:
 *   post:
 *     summary: Atualizar configuração de fatura digital
 *     tags: [Fatura]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object }
 *     responses:
 *       200:
 *         description: Atualizado com sucesso
 *       401:
 *         description: Não autenticado
 */
router.post('/digital/:id', ctrl.setFaturaDigitalController);

/**
 * @swagger
 * /fatura/libtemp:
 *   post:
 *     summary: Cadastrar liberação temporária
 *     tags: [Libtemp]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               codcliente: { type: string }
 *               prazo: { type: string }
 *     responses:
 *       200:
 *         description: Liberação cadastrada
 *       401:
 *         description: Não autenticado
 */
router.post('/libtemp', ctrl.cadastrarLibtempController);

/**
 * @swagger
 * /fatura/libtemp/cliente/{codcliente}:
 *   get:
 *     summary: Consultar liberação temporária por cliente
 *     tags: [Libtemp]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: codcliente
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Consulta realizada com sucesso
 *       401:
 *         description: Não autenticado
 */
router.get('/libtemp/cliente/:codcliente', ctrl.consultarLibtempPorClienteController);

/**
 * @swagger
 * /fatura/libtemp/{id}:
 *   delete:
 *     summary: Deletar liberação temporária por ID
 *     tags: [Libtemp]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Liberação deletada
 *       401:
 *         description: Não autenticado
 */
router.delete('/libtemp/:id', ctrl.deletarLibtempController);

module.exports = router;
