const express = require('express');
const ctrl = require('../controllers/pushController');
const { validateJWT } = require('../middlewares/auth');

const router = express.Router();

// ── Autenticadas (app do cliente) ─────────────────────────────
router.post('/save-token', validateJWT, ctrl.saveTokenController);
router.get('/notifications/:cpf', validateJWT, ctrl.getNotificationsController);
router.patch('/notifications/:id/read', validateJWT, ctrl.markReadController);

// ── Protegidas por PUSH_AUTH_TOKEN (uso interno/webhook) ──────
router.post('/send', ctrl.sendNotificationController);
router.post('/send-filtered', ctrl.sendFilteredNotificationsController);
router.post('/webhook', ctrl.webhookController);
router.post('/send-targeted', ctrl.sendTargetedController);
router.post('/send-by-address', ctrl.sendByAddressController);

module.exports = router;
