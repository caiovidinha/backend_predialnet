/**
 * @swagger
 * tags:
 *   name: Health
 */

const express = require('express');
const ctrl = require('../controllers/healthController');
const { requireAdminToken } = require('../middlewares/adminAuth');

const router = express.Router();
router.use(requireAdminToken);

/**
 * @swagger
 * /admin/health:
 *   get:
 *     summary: Saúde atual dos sistemas (Redis, banco, fila, processo, pm2, logs)
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Snapshot de saúde coletado agora
 */
router.get('/', ctrl.atual);

/**
 * @swagger
 * /admin/health/history:
 *   get:
 *     summary: Histórico de snapshots de saúde
 *     tags: [Health]
 *     parameters:
 *       - in: query
 *         name: horas
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Lista de snapshots no período
 */
router.get('/history', ctrl.historico);

module.exports = router;
