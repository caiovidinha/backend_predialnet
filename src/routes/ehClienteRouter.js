const express = require("express");
const { ehCliente } = require("../controllers/ehClienteController");

require("dotenv").config();

const ehClienteRouter = express.Router();

function ehClienteCors(req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  return next();
}

/**
 * @swagger
 * /eh-cliente:
 *   post:
 *     summary: Verifica se a inscrição é cliente via proxy APISAPO
 *     tags: [Público]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - inscricao
 *             properties:
 *               inscricao:
 *                 type: string
 *                 example: "12345678901"
 *     responses:
 *       200:
 *         description: Consulta realizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 cliente:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Entrada inválida
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Inscrição inválida. Informe 11 ou 14 dígitos."
 *       502:
 *         description: Erro de rede ao consultar serviço externo
 *       504:
 *         description: Timeout na consulta ao serviço externo
 */
ehClienteRouter.options("/eh-cliente", ehClienteCors);
ehClienteRouter.post("/eh-cliente", ehClienteCors, ehCliente);

module.exports = ehClienteRouter;
