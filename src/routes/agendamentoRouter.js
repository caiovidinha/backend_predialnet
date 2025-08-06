const express = require("express");
const { upload, processAgendamento } = require("../controllers/agendamentoController");

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

module.exports = router;
