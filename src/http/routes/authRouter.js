const express = require('express');
const cors = require('cors');
const ctrl = require('../controllers/authController');
const { validateJWT, attachClientIdentity } = require('../middlewares/auth');

const router = express.Router();

/**
 * @swagger
 * /ping:
 *   get:
 *     summary: Verifica se o servidor está online (ping)
 *     tags: [Sistema]
 *     responses:
 *       200:
 *         description: API está online
 */
router.get('/ping', cors(), ctrl.getOk);

/**
 * @swagger
 * /newUser:
 *   post:
 *     summary: Inicia criação de usuário a partir do CPF
 *     tags: [Usuário]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userCredential:
 *                 type: string
 *     responses:
 *       201:
 *         description: Retorna e-mails encontrados para confirmação
 */
router.post('/newUser', ctrl.newUser);

/**
 * @swagger
 * /createUser:
 *   post:
 *     summary: Cria um novo usuário e envia e-mail com senha
 *     tags: [Usuário]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cpf:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       201:
 *         description: Usuário criado e senha enviada
 */
router.post('/createUser', ctrl.createUser);

/**
 * @swagger
 * /login:
 *   post:
 *     summary: Login do usuário
 *     tags: [Autenticação]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               credential:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: Login bem-sucedido com tokens e dados do cliente
 */
router.post('/login', ctrl.login);

/**
 * @swagger
 * /refresh-token:
 *   post:
 *     summary: Gera novo token de acesso com refresh token
 *     tags: [Autenticação]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refresh_token:
 *                 type: string
 *     responses:
 *       201:
 *         description: Novo token gerado
 */
router.post('/refresh-token', ctrl.renewToken);

/**
 * @swagger
 * /forgot-password:
 *   post:
 *     summary: Solicita e-mail de redefinição de senha
 *     tags: [Senha]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userCredential
 *             properties:
 *               userCredential:
 *                 type: string
 *               insideApp:
 *                 type: boolean
 *                 description: Se true, retorna o link diretamente no response
 *     responses:
 *       200:
 *         description: Link enviado por e-mail ou retornado diretamente
 */
router.post('/forgot-password', ctrl.forgotPassword);

/**
 * @swagger
 * /reset-password:
 *   post:
 *     summary: Redefine a senha do usuário
 *     tags: [Senha]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               token:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Senha redefinida com sucesso
 */
router.post('/reset-password', ctrl.resetPassword);

/**
 * @swagger
 * /emails:
 *   post:
 *     summary: Envia e-mail manual (interno/admin)
 *     tags: [Sistema]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               to:
 *                 type: string
 *               subject:
 *                 type: string
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: E-mail enviado com sucesso
 */
router.post('/emails', ctrl.handleEmail);

/**
 * @swagger
 * /must-change-password/{cpf}:
 *   get:
 *     summary: Verifica se o usuário precisa trocar a senha
 *     tags: [Senha]
 *     parameters:
 *       - in: path
 *         name: cpf
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Resultado da verificação
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mustChangePassword:
 *                   type: boolean
 *       404:
 *         description: Usuário não encontrado
 */
router.get('/must-change-password/:cpf', validateJWT, ctrl.mustChangePasswordCheck);

/**
 * @swagger
 * /update-email:
 *   post:
 *     summary: Atualiza o e-mail do cliente na base da Predialnet
 *     tags: [Usuário]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - codcliente
 *               - inscricao
 *             properties:
 *               email:
 *                 type: string
 *               codcliente:
 *                 type: string
 *               inscricao:
 *                 type: string
 *     responses:
 *       200:
 *         description: E-mail atualizado com sucesso
 */
router.post('/update-email', validateJWT, ctrl.updateEmail);

/**
 * @swagger
 * /update-email-censored:
 *   post:
 *     summary: Atualiza o e-mail do usuário a partir do CPF e e-mail censurado
 *     tags: [Usuário]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cpf
 *               - censoredEmail
 *             properties:
 *               cpf:
 *                 type: string
 *               censoredEmail:
 *                 type: string
 *     responses:
 *       200:
 *         description: E-mail atualizado com sucesso
 *       400:
 *         description: Parâmetros inválidos
 *       404:
 *         description: Usuário ou e-mail não encontrado
 */
router.post('/update-email-censored', validateJWT, ctrl.updateEmailCensored);

/**
 * @swagger
 * /account/email:
 *   get:
 *     summary: Consulta o e-mail cadastrado da conta do app (usuário logado)
 *     tags: [Usuário]
 *     description: Identidade resolvida pelo x-access-token do próprio usuário.
 *     responses:
 *       200: { description: "{ cpf, email, censoredEmail }" }
 *       401: { description: Não autenticado }
 *       404: { description: Conta do app não encontrada }
 */
router.get('/account/email', attachClientIdentity, ctrl.getMyEmail);

/**
 * @swagger
 * /account/email/change-request:
 *   post:
 *     summary: Solicita troca do e-mail (envia código ao novo e-mail)
 *     tags: [Usuário]
 *     description: >
 *       Passo 1. Gera um código de 6 dígitos, guarda a pendência e envia o
 *       código para o NOVO e-mail. Nada é alterado até a confirmação. Identidade
 *       pelo x-access-token do usuário.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, codcliente]
 *             properties:
 *               email: { type: string, description: Novo e-mail desejado }
 *               codcliente: { type: string, description: Contrato a atualizar na Predialnet }
 *     responses:
 *       200: { description: "{ message, email (censurado) } — código enviado" }
 *       400: { description: E-mail inválido/igual ao atual, ou codcliente ausente/inválido }
 *       401: { description: Não autenticado }
 *       502: { description: Falha ao enviar o e-mail do código }
 */
router.post('/account/email/change-request', attachClientIdentity, ctrl.requestMyEmailChange);

/**
 * @swagger
 * /account/email/change-confirm:
 *   post:
 *     summary: Confirma a troca do e-mail com o código recebido
 *     tags: [Usuário]
 *     description: Passo 2. Valida o código e aplica a troca (semeia no map censurado).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code: { type: string, example: "482913" }
 *     responses:
 *       200: { description: "{ message, cpf, email, censoredEmail }" }
 *       401: { description: Não autenticado }
 *       403: { description: Código inválido ou expirado }
 *       404: { description: Nenhuma troca pendente }
 */
router.post('/account/email/change-confirm', attachClientIdentity, ctrl.confirmMyEmailChange);

module.exports = router;
