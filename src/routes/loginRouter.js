const express = require("express");
const cors = require("cors");
const constrollerAuth = require("../controllers/auth");
const controllerRefreshToken = require("../controllers/refreshToken");
// const { validateJWT } = require("../models/auth");
const loginRouter = express.Router();

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
loginRouter.get("/ping", cors(), constrollerAuth.getOk);

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
loginRouter.post("/newUser", constrollerAuth.newUser);

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
loginRouter.post("/createUser", constrollerAuth.createUser);

/**
 * @swagger
 * /update-email:
 *   post:
 *     summary: Atualiza o e-mail do cliente
 *     tags: [Usuário]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
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
loginRouter.post("/update-email", constrollerAuth.updateEmail);

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
loginRouter.post("/login", constrollerAuth.login);

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
 *       200:
 *         description: Novo token gerado
 */
loginRouter.post("/refresh-token", controllerRefreshToken.renewToken);

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
 *             properties:
 *               userCredential:
 *                 type: string
 *     responses:
 *       200:
 *         description: E-mail enviado com link de redefinição
 */
loginRouter.post("/forgot-password", constrollerAuth.forgotPassword);

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
loginRouter.post("/reset-password", constrollerAuth.resetPassword);

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
loginRouter.post('/emails', constrollerAuth.handleEmail);


module.exports = loginRouter;
