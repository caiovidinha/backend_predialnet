const express = require('express');
const ctrl = require('../controllers/utilitiesController');
const { validateJWT } = require('../middlewares/auth');

const router = express.Router();

// Todas as rotas de utilitários requerem autenticação
router.use(validateJWT);

router.get('/toggle-ad/:cpf', ctrl.toggleShowAd);
router.get('/cliente/:id', ctrl.getUserByID);
router.get('/seradicional/:id', ctrl.getSerAdicionalController);
router.post('/seradicional', ctrl.updateSerAdicionalController);
router.get('/controle-parental/:id', ctrl.getControleParentalController);
router.post('/controle-parental', ctrl.updateControleParentalController);
router.get('/status/:codcliente', ctrl.getClientStatusController);
router.get('/monitoramento/:codcliente', ctrl.getAlertMessageController);

module.exports = router;
