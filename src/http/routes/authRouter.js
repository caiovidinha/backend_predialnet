const express = require('express');
const cors = require('cors');
const ctrl = require('../controllers/authController');
const { validateJWT } = require('../middlewares/auth');

const router = express.Router();

// ── Públicas ──────────────────────────────────────────────────
router.get('/ping', cors(), ctrl.getOk);
router.post('/newUser', ctrl.newUser);
router.post('/createUser', ctrl.createUser);
router.post('/login', ctrl.login);
router.post('/refresh-token', ctrl.renewToken);
router.post('/forgot-password', ctrl.forgotPassword);
router.post('/reset-password', ctrl.resetPassword);
router.post('/emails', ctrl.handleEmail);

// ── Autenticadas ──────────────────────────────────────────────
router.get('/must-change-password/:cpf', validateJWT, ctrl.mustChangePasswordCheck);
router.post('/update-email', validateJWT, ctrl.updateEmail);
router.post('/update-email-censored', validateJWT, ctrl.updateEmailCensored);

module.exports = router;
