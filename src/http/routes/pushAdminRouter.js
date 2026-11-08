/**
 * @swagger
 * tags:
 *   name: PushAdmin
 */

const express = require('express');
const ctrl = require('../controllers/pushAdminController');
const { requireAdminToken } = require('../middlewares/adminAuth');

const router = express.Router();
router.use(requireAdminToken);

/**
 * @swagger
 * /admin/push/campaigns:
 *   get:
 *     summary: Lista campanhas de push enviadas, com agregados por status
 *     tags: [PushAdmin]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Lista paginada de campanhas
 */
router.get('/campaigns', ctrl.listCampaigns);

/**
 * @swagger
 * /admin/push/campaigns/{id}:
 *   get:
 *     summary: Detalhe de uma campanha de push, com agregados por status
 *     tags: [PushAdmin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Campanha encontrada
 *       404:
 *         description: Campanha não encontrada
 */
router.get('/campaigns/:id', ctrl.getCampaign);

/**
 * @swagger
 * /admin/push/campaigns/{id}/deliveries:
 *   get:
 *     summary: Lista paginada dos destinatários de uma campanha
 *     tags: [PushAdmin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, sent, delivered, failed] }
 *     responses:
 *       200:
 *         description: Lista paginada de destinatários
 */
router.get('/campaigns/:id/deliveries', ctrl.listDeliveries);

module.exports = router;
