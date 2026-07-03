const express = require('express');
const { validateJWT, requireAdmin } = require('../middlewares/auth');
const ctrl = require('../controllers/supportController');

const router = express.Router();

// Todo o dashboard de suporte é restrito ao operador (ADMIN_BYPASS_TOKEN).
router.use(validateJWT, requireAdmin);

/**
 * @swagger
 * tags:
 *   name: Support
 *   description: Dashboard de suporte do operador (consulta de cliente, conta, faturas e ações)
 */

/**
 * @swagger
 * /support/clients/{credential}/overview:
 *   get:
 *     summary: Visão agregada do cliente (é cliente + conta do app + dados cadastrais)
 *     tags: [Support]
 *     parameters:
 *       - in: path
 *         name: credential
 *         required: true
 *         schema: { type: string }
 *         description: CPF ou codcliente
 *     responses:
 *       200: { description: Visão agregada (partes falham isoladamente) }
 */
router.get('/clients/:credential/overview', ctrl.overview);

/**
 * @swagger
 * /support/clients/{credential}/is-client:
 *   get:
 *     summary: Verifica se é cliente Predialnet (UAIPI)
 *     tags: [Support]
 *     parameters:
 *       - in: path
 *         name: credential
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: "{ isClient, cpf, nome, email, contratos }" }
 */
router.get('/clients/:credential/is-client', ctrl.isClient);

/**
 * @swagger
 * /support/clients/{cpf}/app-account:
 *   get:
 *     summary: Situação da conta do app (existe, e-mail, precisa trocar senha)
 *     tags: [Support]
 *     parameters:
 *       - in: path
 *         name: cpf
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: "{ exists, cpf, userId, email, mustChangePassword }" }
 *       400: { description: CPF inválido }
 */
router.get('/clients/:cpf/app-account', ctrl.appAccount);

/**
 * @swagger
 * /support/clients/{credential}/contracts:
 *   get:
 *     summary: Lista os contratos (números de cliente) de um CPF
 *     tags: [Support]
 *     parameters:
 *       - in: path
 *         name: credential
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: "{ isClient, cpf, nome, total, contratos[] } — cada contrato traz codcliente, endereço, serpontos e o objeto cru"
 */
router.get('/clients/:credential/contracts', ctrl.contracts);

/**
 * @swagger
 * /support/clients/{credential}/account:
 *   get:
 *     summary: Dados cadastrais completos do cliente (UAIPI)
 *     tags: [Support]
 *     parameters:
 *       - in: path
 *         name: credential
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Objeto do cliente (contratos, endereço, serpontos, plano) }
 *       404: { description: Cliente não encontrado }
 */
router.get('/clients/:credential/account', ctrl.account);

/**
 * @swagger
 * /support/clients/{codcliente}/status:
 *   get:
 *     summary: Status de conexão (por serponto) + pagamento + liberação temporária
 *     tags: [Support]
 *     parameters:
 *       - in: path
 *         name: codcliente
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: "{ service_status[], payment_status, libtemp_status }" }
 */
router.get('/clients/:codcliente/status', ctrl.status);

/**
 * @swagger
 * /support/clients/{codcliente}/invoices:
 *   get:
 *     summary: Faturas (últimas 6 de internet) + fatura atual + contagem de pendências
 *     tags: [Support]
 *     parameters:
 *       - in: path
 *         name: codcliente
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: "{ history[], current, pastStatus }" }
 */
router.get('/clients/:codcliente/invoices', ctrl.invoices);

/**
 * @swagger
 * /support/clients/{codcliente}/invoices/current:
 *   get:
 *     summary: Fatura atual + outras pendentes
 *     tags: [Support]
 *     parameters:
 *       - in: path
 *         name: codcliente
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: "{ faturaAtual, outrasPendentes[] }" }
 */
router.get('/clients/:codcliente/invoices/current', ctrl.currentInvoice);

/**
 * @swagger
 * /support/clients/{codcliente}/libtemp:
 *   get:
 *     summary: Consulta liberação temporária do cliente
 *     tags: [Support]
 *     parameters:
 *       - in: path
 *         name: codcliente
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Situação da liberação temporária }
 *   post:
 *     summary: Cadastra liberação temporária (prazo em dias)
 *     tags: [Support]
 *     parameters:
 *       - in: path
 *         name: codcliente
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [prazo]
 *             properties:
 *               prazo: { type: integer, example: 2 }
 *     responses:
 *       201: { description: Liberação criada }
 *       400: { description: prazo obrigatório }
 */
router.get('/clients/:codcliente/libtemp', ctrl.getLibtemp);
router.post('/clients/:codcliente/libtemp', ctrl.createLibtemp);

/**
 * @swagger
 * /support/libtemp/{id}:
 *   delete:
 *     summary: Remove uma liberação temporária
 *     tags: [Support]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Liberação removida }
 */
router.delete('/libtemp/:id', ctrl.deleteLibtemp);

/**
 * @swagger
 * /support/clients/{cpf}/password-reset:
 *   post:
 *     summary: Gera link de redefinição de senha (opcionalmente envia por e-mail)
 *     tags: [Support]
 *     parameters:
 *       - in: path
 *         name: cpf
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sendEmail: { type: boolean, description: Se true, envia o e-mail em vez de só retornar o link }
 *     responses:
 *       200: { description: "{ url } ou { message, url }" }
 *       409: { description: E-mail do app diverge do cadastro (retorna availableEmails) }
 *       403: { description: Usuário do app não existe }
 */
router.post('/clients/:cpf/password-reset', ctrl.passwordReset);

/**
 * @swagger
 * /support/clients/{credential}/available-emails:
 *   get:
 *     summary: E-mails (censurados) disponíveis para criar conta do app
 *     tags: [Support]
 *     parameters:
 *       - in: path
 *         name: credential
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: "{ emails[], inscricao }" }
 *       404: { description: Não é cliente ou conta já existe }
 */
router.get('/clients/:credential/available-emails', ctrl.availableEmails);

/**
 * @swagger
 * /support/clients/create-account:
 *   post:
 *     summary: Cria a conta do app e envia a senha por e-mail
 *     tags: [Support]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [cpf, email]
 *             properties:
 *               cpf: { type: string }
 *               email: { type: string, description: E-mail censurado escolhido em available-emails }
 *     responses:
 *       201: { description: Conta criada e senha enviada }
 *       400: { description: Campos obrigatórios ausentes }
 */
router.post('/clients/create-account', ctrl.createAppAccount);

module.exports = router;
