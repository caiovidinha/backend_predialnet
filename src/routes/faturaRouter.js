// routes/faturaRoutes.js

const express = require("express");
const faturaController = require("../controllers/fatura");
const router = express.Router();

// Rota para obter a 2ª via da fatura
// Exemplo de requisição: GET /api/fatura/segunda-via/123e4567-e89b-12d3-a456-426614174000
router.get("/segunda-via/:id", faturaController.getSecondCopyLinkController);

// Rota para obter o histórico das últimas 6 faturas
// Exemplo de requisição: GET /api/fatura/historico/123e4567-e89b-12d3-a456-426614174000
router.get("/historico/:id", faturaController.getLastSixInvoicesController);

// Rota para obter o PIX da última fatura em aberto do tipo "internet"
// Exemplo de requisição: GET /api/fatura/pix/123e4567-e89b-12d3-a456-426614174000
router.get("/pix/:id", faturaController.getPixFromLastOpenInternetInvoiceController);

// Rota para verificar o status da fatura atual
// Exemplo de requisição: GET /api/fatura/status/123e4567-e89b-12d3-a456-426614174000
router.get("/status/:id", faturaController.checkCurrentInvoiceStatusController);

// Rota para obter a fatura atual
// Exemplo de requisição: GET /api/fatura/atual/123e4567-e89b-12d3-a456-426614174000
router.get("/atual/:id", faturaController.getCurrentInvoiceController); // Adicionado

module.exports = router;
