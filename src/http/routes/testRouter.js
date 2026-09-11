const express = require('express');
const { loading, isTestCpf } = require('../../controllers/test');

const router = express.Router();

router.get('/loading/:time', loading);

// Temporário — remover junto com TEST_CPF quando não for mais necessário.
router.get('/cpf/:cpf', isTestCpf);

module.exports = router;
