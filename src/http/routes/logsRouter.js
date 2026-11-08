/**
 * @swagger
 * tags:
 *   name: Logs
 */

const express = require('express');
const ctrl = require('../controllers/logsController');
const { requireAdminToken } = require('../middlewares/adminAuth');

const router = express.Router();
router.use(requireAdminToken);

/**
 * @swagger
 * /admin/logs:
 *   get:
 *     summary: Lista os arquivos de log do pm2 (nome, tamanho, última modificação)
 *     tags: [Logs]
 *     responses:
 *       200:
 *         description: Lista de arquivos
 */
router.get('/', ctrl.listar);

/**
 * @swagger
 * /admin/logs/{nome}:
 *   get:
 *     summary: Lê o final de um arquivo de log (nunca o arquivo inteiro), com busca opcional
 *     tags: [Logs]
 *     parameters:
 *       - in: path
 *         name: nome
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: linhas
 *         schema: { type: integer }
 *       - in: query
 *         name: busca
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Linhas encontradas
 *       404:
 *         description: Arquivo não encontrado
 */
router.get('/:nome', ctrl.ler);

module.exports = router;
