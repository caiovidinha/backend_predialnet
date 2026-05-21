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
  webhookController,
  sendFilteredNotificationsController,
  getNotificationsController,
  markReadController,
  sendTargetedController,
  sendByAddressController,
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

/**
 * @swagger
 * /push/send-targeted:
 *   post:
 *     summary: Envia push para usuários segmentados por targets (mesma estrutura que mensagens)
 *     tags: [Push]
 *     description: |
 *       Resolve os targets para CPFs e envia push notifications.
 *       `targeting_type` aceitos:
 *       - **GLOBAL**: todos os usuários cadastrados no app
 *       - **CLIENTE**: CPF direto (`targeting_value` = CPF)
 *       - **CIDADE**: todos os clientes na cidade (`targeting_value` = nome da cidade)
 *       - **BAIRRO_CIDADE**: clientes no bairro+cidade (`targeting_value` = "bairro:cidade")
 *       - **RUA**: clientes na rua identificada pelo CEP (`targeting_value` = CEP)
 *       - **CEP**: clientes com o CEP fornecido (`targeting_value` = CEP)
 *       - **CEP_NUMERO**: clientes no endereço exato (`targeting_value` = "cep:numero")
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
 *                 description: Título da notificação push
 *               body:
 *                 type: string
 *                 description: Texto da notificação push
 *               data:
 *                 type: object
 *                 description: Payload extra enviado junto à notificação (opcional)
 *               targets:
 *                 type: array
 *                 description: Regras de segmentação
 *                 items:
 *                   type: object
 *                   required:
 *                     - targeting_type
 *                   properties:
 *                     targeting_type:
 *                       type: string
 *                       enum: [GLOBAL, CLIENTE, CIDADE, BAIRRO_CIDADE, RUA, CEP, CEP_NUMERO]
 *                     targeting_value:
 *                       type: string
 *                       description: Obrigatório para todos os tipos exceto GLOBAL
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
 *                 queued:
 *                   type: integer
 *                 notificationId:
 *                   type: string
 *       200:
 *         description: Nenhum destinatário encontrado (queued = 0)
 *       400:
 *         description: Parâmetros inválidos
 *       401:
 *         description: Não autenticado
 *       500:
 *         description: Erro interno
 */
router.post("/send-targeted", sendTargetedController);

/**
 * @swagger
 * /push/send-by-address:
 *   post:
 *     summary: Envia push para usuários filtrados por endereço ou CPF
 *     tags: [Push]
 *     description: |
 *       Escolha um `filter_type` e forneça os campos correspondentes:
 *       - **GERAL**: todos os usuários do app (nenhum campo extra necessário)
 *       - **CPF**: lista direta de CPFs (`cpfs[]`)
 *       - **CIDADE**: clientes na cidade (`cidade`)
 *       - **BAIRRO**: clientes no bairro (`bairro`; `cidade` é opcional para refinar)
 *       - **RUA**: clientes na rua identificada pelo CEP (`cep`)
 *       - **CEP**: clientes com o CEP fornecido (`cep`)
 *       - **CEP_NUMERO**: clientes no endereço exato (`cep` + `numero`)
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
 *                 description: Título da notificação push
 *               body:
 *                 type: string
 *                 description: Texto da notificação push
 *               data:
 *                 type: object
 *                 description: Payload extra enviado junto à notificação (opcional)
 *               filter_type:
 *                 type: string
 *                 enum: [GERAL, CPF, CIDADE, BAIRRO, RUA, CEP, CEP_NUMERO]
 *               cpfs:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Obrigatório para filter_type CPF
 *               cidade:
 *                 type: string
 *                 description: Obrigatório para filter_type CIDADE; opcional para BAIRRO
 *               bairro:
 *                 type: string
 *                 description: Obrigatório para filter_type BAIRRO
 *               cep:
 *                 type: string
 *                 description: Obrigatório para filter_type RUA, CEP e CEP_NUMERO
 *               numero:
 *                 type: string
 *                 description: Obrigatório para filter_type CEP_NUMERO
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
 *                 queued:
 *                   type: integer
 *                 notificationId:
 *                   type: string
 *       200:
 *         description: Nenhum destinatário encontrado (queued = 0)
 *       400:
 *         description: Parâmetros inválidos
 *       401:
 *         description: Não autenticado
 *       500:
 *         description: Erro interno
 */
router.post("/send-by-address", sendByAddressController);

module.exports = router;
