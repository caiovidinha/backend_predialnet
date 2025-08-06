const express = require("express");
const { upload, processAgendamento, sendAgendamentoToTrello } = require("../controllers/agendamentoController");

const router = express.Router();

/**
 * @swagger
 * /agendamento:
 *   post:
 *     summary: Processa o agendamento a partir de um arquivo enviado
 *     tags:
 *       - Agendamento
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Agendamento processado com sucesso
 *       400:
 *         description: Requisição inválida
 *       500:
 *         description: Erro interno ao processar agendamento
 */
router.post("/", upload.single("file"), processAgendamento);

/**
 * @swagger
 * /agendamento/trello:
 *   post:
 *     summary: Envia agendamentos somente para o Trello
 *     tags: [Agendamento]
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
 *               date:
 *                 type: string
 *               appointments:
 *                 type: integer
 *             required:
 *               - listId
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               listId:
 *                 type: string
 *             required:
 *               - listId
 *     responses:
 *       200:
 *         description: Cards criados com sucesso no Trello
 *       400:
 *         description: Dados inválidos (falta listId, date ou appointments)
 *       500:
 *         description: Erro interno ao enviar para Trello
 */
router.post(
  "/trello",
  upload.single("file"),
  sendAgendamentoToTrello
);

module.exports = router;
