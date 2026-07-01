const express = require('express');
const { ehCliente } = require('../../controllers/ehClienteController');

const router = express.Router();

function ehClienteCors(req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  return next();
}

router.options('/eh-cliente', ehClienteCors);
router.post('/eh-cliente', ehClienteCors, ehCliente);

module.exports = router;
