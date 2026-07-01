/**
 * @swagger
 * tags:
 *   name: Push
 */

const express = require('express');
const ctrl = require('../controllers/pushController');
const { validateJWT } = require('../middlewares/auth');

const router = express.Router();

/**
 * @swagger
 * /push/save-token:
 *   post:
 *     summary: Salva o token do dispositivo Expo do usuário
 *     tags: [Push]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cpf
 *               - token
 *             properties:
 *               cpf:
 *                 type: string
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token salvo com sucesso
 *       400:
 *         description: CPF ou token não fornecido
 *       500:
 *         description: Erro interno
 */
router.post('/save-token', validateJWT, ctrl.saveTokenController);

/**
 * @swagger
 * /push/notifications/{cpf}:
 *   get:
 *     summary: Lista notificações de um usuário
 *     tags: [Push]
 *     parameters:
 *       - in: path
 *         name: cpf
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de notificações
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 notifications:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       title:
 *                         type: string
 *                       body:
 *                         type: string
 *                       data:
 *                         type: object
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       read:
 *                         type: boolean
 *                       readAt:
 *                         type: string
 *                         format: date-time
 *       404:
 *         description: Usuário não encontrado
 *       500:
 *         description: Erro interno
 */
router.get('/notifications/:cpf', validateJWT, ctrl.getNotificationsController);

/**
 * @swagger
 * /push/notifications/{id}/read:
 *   patch:
 *     summary: Marca uma notificação como lida ou não lida
 *     tags: [Push]
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
 *             required:
 *               - read
 *             properties:
 *               read:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Status de leitura atualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 read:
 *                   type: boolean
 *                 readAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Campo read inválido
 *       500:
 *         description: Erro interno
 */
router.patch('/notifications/:id/read', validateJWT, ctrl.markReadController);

/**
 * @swagger
 * /push/send:
 *   post:
 *     summary: Envia notificação broadcast para todos os tokens
 *     tags: [Push]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - body
 *               - authToken
 *             properties:
 *               title:
 *                 type: string
 *               body:
 *                 type: string
 *               data:
 *                 type: object
 *               authToken:
 *                 type: string
 *     responses:
 *       202:
 *         description: Notificações enfileiradas
 *       403:
 *         description: Acesso não autorizado
 *       500:
 *         description: Erro interno
 */
router.post('/send', ctrl.sendNotificationController);

/**
 * @swagger
 * /push/send-filtered:
 *   post:
 *     summary: Envia notificações filtradas por metadata e/ou lista de CPFs
 *     tags: [Push]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - authToken
 *               - title
 *               - body
 *               - filters
 *             properties:
 *               authToken:
 *                 type: string
 *               title:
 *                 type: string
 *               body:
 *                 type: string
 *               data:
 *                 type: object
 *               filters:
 *                 type: object
 *                 properties:
 *                   cpfs:
 *                     type: array
 *                     items:
 *                       type: string
 *                   hasOpenBill:
 *                     type: boolean
 *                   addressContains:
 *                     type: string
 *     responses:
 *       202:
 *         description: Notificações enfileiradas
 *       400:
 *         description: Payload inválido
 *       403:
 *         description: Acesso não autorizado
 *       500:
 *         description: Erro interno
 */
router.post('/send-filtered', ctrl.sendFilteredNotificationsController);

/**
 * @swagger
 * /push/webhook:
 *   post:
 *     summary: Dispara notificação de fatura (gerada ou vencida) por lista de CPFs
 *     tags: [Push]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - eventType
 *               - cpfs
 *               - authToken
 *             properties:
 *               eventType:
 *                 type: string
 *                 enum: [fatura-gerada, fatura-vencida]
 *               cpfs:
 *                 type: array
 *                 items:
 *                   type: string
 *               authToken:
 *                 type: string
 *     responses:
 *       202:
 *         description: Notificações enfileiradas
 *       400:
 *         description: Payload inválido
 *       403:
 *         description: Acesso não autorizado
 *       500:
 *         description: Erro interno
 */
router.post('/webhook', ctrl.webhookController);

/**
 * @swagger
 * /push/send-targeted:
 *   post:
 *     summary: Envia notificação por targeting (GLOBAL, CLIENTE, CIDADE, CEP, etc.)
 *     tags: [Push]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - body
 *               - targets
 *             properties:
 *               title:
 *                 type: string
 *               body:
 *                 type: string
 *               data:
 *                 type: object
 *               targets:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     targeting_type:
 *                       type: string
 *                       enum: [GLOBAL, CLIENTE, CIDADE, BAIRRO_CIDADE, RUA, CEP, CEP_NUMERO]
 *                     targeting_value:
 *                       type: string
 *     responses:
 *       202:
 *         description: Notificações enfileiradas
 *       400:
 *         description: Payload inválido
 *       500:
 *         description: Erro interno
 */
router.post('/send-targeted', ctrl.sendTargetedController);

/**
 * @swagger
 * /push/send-by-address:
 *   post:
 *     summary: Envia notificação por endereço (cidade, bairro, CEP, etc.)
 *     tags: [Push]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - body
 *               - filter_type
 *             properties:
 *               title:
 *                 type: string
 *               body:
 *                 type: string
 *               data:
 *                 type: object
 *               filter_type:
 *                 type: string
 *                 enum: [GERAL, CPF, CIDADE, BAIRRO, RUA, CEP, CEP_NUMERO]
 *               cpfs:
 *                 type: array
 *                 items:
 *                   type: string
 *               cidade:
 *                 type: string
 *               bairro:
 *                 type: string
 *               cep:
 *                 type: string
 *               numero:
 *                 type: string
 *     responses:
 *       202:
 *         description: Notificações enfileiradas
 *       400:
 *         description: Payload inválido
 *       500:
 *         description: Erro interno
 */
router.post('/send-by-address', ctrl.sendByAddressController);

module.exports = router;
