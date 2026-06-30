const express = require('express');
const { loading } = require('../../controllers/test');

const router = express.Router();

router.get('/loading/:time', loading);

module.exports = router;
