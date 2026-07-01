const express = require('express');
const { sendClientToTrello } = require('../../controllers/trelloController');
const { validateJWT } = require('../middlewares/auth');

const router = express.Router();

router.post('/clientes', validateJWT, sendClientToTrello);

module.exports = router;
