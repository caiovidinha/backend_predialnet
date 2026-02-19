/**
 * @swagger
 * tags:
 *   name: Push
 */

const express = require("express");
const router = express.Router();
const { validateJWT } = require("../models/auth");

const {
  saveTokenController,
  sendNotificationController,
  webhookController,
  sendFilteredNotificationsController,
  getNotificationsController,    // 👈 importar
  markReadController             // 👈 importar
} = require("../controllers/push");

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
 *             properties:
 *               cpf:
 *                 type: string
 *                 description: CPF do usuário
 *               token:
 *                 type: string
 *                 description: Token Expo para notificações push
 *             required:
 *               - cpf
 *               - token
 *     responses:
 *       200:
 *         description: Token salvo com sucesso
 *       400:
 *         description: CPF ou token não fornecido
 *       500:
 *         description: Erro interno ao salvar token
 */
router.post("/save-token", validateJWT, saveTokenController);

/**
 * @swagger
 * /push/send:
 *   post:
 *     summary: Envia uma notificação broadcast para todos os tokens salvos
 *     tags: [Push]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               body:
 *                 type: string
 *               data:
 *                 type: object
 *               authToken:
 *                 type: string
 *             required:
 *               - title
 *               - body
 *               - authToken
 *     responses:
 *       202:
 *         description: Notificações enfileiradas com sucesso
 *       403:
 *         description: Acesso não autorizado
 *       500:
 *         description: Erro interno ao enviar notificações
 */
router.post("/send", sendNotificationController);

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
 *                   hasOpenBill:
 *                     type: boolean
 *                   addressContains:
 *                     type: string
 *                   cpfs:
 *                     type: array
 *                     items:
 *                       type: string
 *             required:
 *               - authToken
 *               - title
 *               - body
 *               - filters
 *     responses:
 *       202:
 *         description: Notificações enfileiradas com sucesso
 *       400:
 *         description: Payload inválido
 *       403:
 *         description: Acesso não autorizado
 *       500:
 *         description: Erro interno
 */
router.post("/send-filtered", sendFilteredNotificationsController);

/**
 * @swagger
 * /push/webhook:
 *   post:
 *     summary: Envia notificação de fatura (gerada ou vencida) baseado em eventType
 *     tags: [Push]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
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
 *             required:
 *               - eventType
 *               - cpfs
 *               - authToken
 *     responses:
 *       202:
 *         description: Notificações enfileiradas com sucesso
 *       400:
 *         description: Payload inválido
 *       403:
 *         description: Acesso não autorizado
 *       500:
 *         description: Erro interno
 */
router.post("/webhook", webhookController);

/**
 * @swagger
 * /push/notifications/{cpf}:
 *   get:
 *     summary: Lista notificações de um usuário (com status read/unread)
 *     tags: [Push]
 *     parameters:
 *       - in: path
 *         name: cpf
 *         required: true
 *         schema:
 *           type: string
 *         description: CPF do usuário
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
router.get("/notifications/:cpf", getNotificationsController);

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
 *         description: ID do vínculo UserNotification
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               read:
 *                 type: boolean
 *             required:
 *               - read
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
 *         description: Campo 'read' inválido
 *       500:
 *         description: Erro interno
 */
router.patch("/notifications/:id/read", markReadController);

module.exports = router;
