const express = require("express");
const faturaController = require("../controllers/fatura");
const router = express.Router();

/**
 * @swagger
 * /fatura/segunda-via/{id}/{boleta}:
 *   get:
 *     summary: Obter a 2ª via da fatura
 *     tags: [Fatura]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: boleta
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Link da 2ª via retornado com sucesso
 */
router.get("/segunda-via/:id/:boleta", faturaController.getSecondCopyLinkController);

/**
 * @swagger
 * /fatura/historico/{id}:
 *   get:
 *     summary: Obter histórico das últimas 6 faturas
 *     tags: [Fatura]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Histórico retornado com sucesso
 */
router.get("/historico/:id", faturaController.getLastSixInvoicesController);

/**
 * @swagger
 * /fatura/pix/{id}:
 *   get:
 *     summary: Obter PIX da última fatura em aberto
 *     tags: [Fatura]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: PIX retornado com sucesso
 */
router.get("/pix/:id", faturaController.getPixFromLastOpenInternetInvoiceController);

/**
 * @swagger
 * /fatura/status/{id}:
 *   get:
 *     summary: Verificar status da fatura atual
 *     tags: [Fatura]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Status retornado com sucesso
 */
router.get("/status/:id", faturaController.checkCurrentInvoiceStatusController);

/**
 * @swagger
 * /fatura/atual/{id}:
 *   get:
 *     summary: Obter fatura atual
 *     tags: [Fatura]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Fatura atual retornada com sucesso
 */
router.get("/atual/:id", faturaController.getCurrentInvoiceController);

/**
 * @swagger
 * /fatura/digital/{id}:
 *   post:
 *     summary: Atualizar configuração de fatura digital
 *     tags: [Fatura]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Configuração atualizada com sucesso
 */
router.post("/digital/:id", faturaController.setFaturaDigitalController);

/**
 * @swagger
 * /fatura/libtemp:
 *   post:
 *     summary: Cadastrar liberação temporária
 *     tags: [Libtemp]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               codcliente:
 *                 type: string
 *               prazo:
 *                 type: string
 *     responses:
 *       200:
 *         description: Liberação cadastrada com sucesso
 */
router.post("/libtemp", faturaController.cadastrarLibtempController);

/**
 * @swagger
 * /fatura/libtemp/cliente/{codcliente}:
 *   get:
 *     summary: Consultar liberação temporária por cliente
 *     tags: [Libtemp]
 *     parameters:
 *       - in: path
 *         name: codcliente
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Consulta realizada com sucesso
 */
router.get("/libtemp/cliente/:codcliente", faturaController.consultarLibtempPorClienteController);

/**
 * @swagger
 * /fatura/libtemp/{id}:
 *   delete:
 *     summary: Deletar liberação temporária por ID
 *     tags: [Libtemp]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Liberação deletada com sucesso
 */
router.delete("/libtemp/:id", faturaController.deletarLibtempController);

module.exports = router;