// routes/faturaRoutes.js

const express = require("express");
const faturaController = require("../controllers/fatura");
const router = express.Router();
// router.use(validateJWT);

// Rota para obter a 2ª via da fatura
// Exemplo de requisição: GET /fatura/segunda-via/123e4567-e89b-12d3-a456-426614174000
router.get("/segunda-via/:id/:boleta", faturaController.getSecondCopyLinkController);

// Rota para obter o histórico das últimas 6 faturas
// Exemplo de requisição: GET /fatura/historico/123e4567-e89b-12d3-a456-426614174000
router.get("/historico/:id", faturaController.getLastSixInvoicesController);

// Rota para obter o PIX da última fatura em aberto do tipo "internet"
// Exemplo de requisição: GET /fatura/pix/123e4567-e89b-12d3-a456-426614174000
router.get("/pix/:id", faturaController.getPixFromLastOpenInternetInvoiceController);

// Rota para verificar o status da fatura atual
// Exemplo de requisição: GET /fatura/status/123e4567-e89b-12d3-a456-426614174000
router.get("/status/:id", faturaController.checkCurrentInvoiceStatusController);

// Rota para obter a fatura atual
// Exemplo de requisição: GET /fatura/atual/123e4567-e89b-12d3-a456-426614174000
router.get("/atual/:id", faturaController.getCurrentInvoiceController); // Adicionado

// Rota para obter a fatura atual
// Exemplo de requisição: GET /fatura/atual/123e4567-e89b-12d3-a456-426614174000
router.post("/digital/:id", faturaController.setFaturaDigitalController); // Adicionado
/**
 * Rotas de Liberação Temporária (Libtemp)
 */

// Rota para cadastrar uma liberação temporária
// Exemplo de requisição: POST /fatura/libtemp
router.post("/libtemp", faturaController.cadastrarLibtempController);

// Rota para consultar uma liberação temporária por codcliente
// Exemplo de requisição: GET /fatura/libtemp/cliente/17258
router.get("/libtemp/cliente/:codcliente", faturaController.consultarLibtempPorClienteController);

// Rota para deletar uma liberação temporária por ID
// Exemplo de requisição: DELETE /fatura/libtemp/414812
router.delete("/libtemp/:id", faturaController.deletarLibtempController);

module.exports = router;
