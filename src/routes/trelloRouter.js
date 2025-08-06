const express = require("express");
const { sendClientToTrello } = require("../controllers/trelloController");
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Trello
 */

/**
 * @swagger
 * /trello/clientes:
 *   post:
 *     summary: Cria um card de cliente no Trello
 *     tags: [Trello]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               listId:
 *                 type: string
 *                 description: ID da lista no Trello
 *               codcliente:
 *                 type: string
 *                 description: Código interno do cliente
 *               nome:
 *                 type: string
 *                 description: Nome completo do cliente
 *               planoAtual:
 *                 type: string
 *                 description: Descrição do plano atual
 *               planoAlvo:
 *                 type: string
 *                 description: Descrição do plano alvo
 *               whatsapp:
 *                 type: string
 *                 description: DDD + WhatsApp (opcional)
 *             required:
 *               - listId
 *               - codcliente
 *               - nome
 *               - planoAtual
 *               - planoAlvo
 *     responses:
 *       '200':
 *         description: Card criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Card criado com sucesso no Trello
 *                 cardId:
 *                   type: string
 *                 cardUrl:
 *                   type: string
 *       '400':
 *         description: Dados inválidos
 *       '500':
 *         description: Erro interno
 */
router.post("/clientes", sendClientToTrello);

module.exports = router;