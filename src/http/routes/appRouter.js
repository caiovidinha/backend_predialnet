const express = require('express');
const { versionCheck } = require('../controllers/appController');

const router = express.Router();

/**
 * @swagger
 * /app/version-check:
 *   get:
 *     summary: Verifica se a versão do app é compatível
 *     tags: [App]
 *     parameters:
 *       - in: query
 *         name: version
 *         schema: { type: string }
 *         description: Versão do app instalado (ex. 1.2.0)
 *     responses:
 *       200:
 *         description: Resultado da verificação de versão
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 updateRequired:
 *                   type: boolean
 *                 minimumVersion:
 *                   type: string
 *                 latestVersion:
 *                   type: string
 */
router.get('/version-check', versionCheck);

module.exports = router;
