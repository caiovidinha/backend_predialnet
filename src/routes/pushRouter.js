// routes/push.js

/**
 * @swagger
 * tags:
 *   name: Push
 */

const express = require("express");
const router = express.Router();
const {
  saveTokenController,
  sendNotificationController,
  notifyFaturaGerada,
  notifyFaturaVencida,
  sendFilteredNotificationsController
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Token salvo com sucesso
 *       400:
 *         description: CPF ou token não fornecido
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: CPF ou token não fornecido
 *       500:
 *         description: Erro interno ao salvar token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Erro ao salvar token
 */
router.post("/save-token", saveTokenController);

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
 *                 description: Título da notificação
 *               body:
 *                 type: string
 *                 description: Corpo da notificação
 *               data:
 *                 type: object
 *                 description: Dados adicionais enviados na notificação
 *               authToken:
 *                 type: string
 *                 description: Token de autenticação para uso deste endpoint
 *             required:
 *               - title
 *               - body
 *               - authToken
 *     responses:
 *       202:
 *         description: Notificações enfileiradas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 queued:
 *                   type: integer
 *                   description: Número de mensagens enfileiradas
 *                 notificationId:
 *                   type: string
 *                   description: ID da notificação criada
 *       403:
 *         description: Acesso não autorizado (token inválido)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Acesso não autorizado
 *       500:
 *         description: Erro interno ao enviar notificações
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Erro ao enfileirar notificações
 */
router.post("/send", sendNotificationController);

/**
 * @swagger
 * /push/send-filtered:
 *   post:
 *     summary: Envia notificações para usuários filtrados por metadata e/ou lista de CPFs
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
 *                 description: Token de autenticação para uso deste endpoint
 *               title:
 *                 type: string
 *                 description: Título da notificação
 *               body:
 *                 type: string
 *                 description: Corpo da notificação
 *               data:
 *                 type: object
 *                 description: Dados adicionais enviados na notificação
 *               filters:
 *                 type: object
 *                 description: Filtros condicionais para envio
 *                 properties:
 *                   hasOpenBill:
 *                     type: boolean
 *                     description: Se o usuário possui fatura em aberto
 *                   addressContains:
 *                     type: string
 *                     description: Trecho do endereço para filtrar
 *                   cpfs:
 *                     type: array
 *                     description: Lista de CPFs a serem notificados
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 queued:
 *                   type: integer
 *                   description: Número de notificações enfileiradas
 *                 notificationId:
 *                   type: string
 *                   description: ID da notificação criada
 *       400:
 *         description: Payload inválido
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Payload inválido
 *       403:
 *         description: Acesso não autorizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Acesso não autorizado
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Erro interno
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
 *                 description: Tipo de evento para notificação
 *               cpfs:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Lista de CPFs dos usuários a notificar
 *             required:
 *               - eventType
 *               - cpfs
 *     responses:
 *       202:
 *         description: Notificações enfileiradas com sucesso
 *       400:
 *         description: Payload inválido
 *       500:
 *         description: Erro interno
 */
router.post("/webhook", webhookController);

module.exports = router;
