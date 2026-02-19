const express = require("express");
const cors = require("cors");
const { rateLimit } = require("express-rate-limit");
const constrollerAuth = require("../controllers/auth");
const controllerRefreshToken = require("../controllers/refreshToken");
const { validateJWT } = require("../models/auth");
const loginRouter = express.Router();

// Rate limiter para rotas sensíveis (login, recuperação de senha, criação de usuário)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Muitas tentativas. Tente novamente em 15 minutos." },
});

// Middleware de autorização para endpoints administrativos internos
const requireAdminToken = (req, res, next) => {
    const token = req.headers["x-admin-token"];
    if (!token || token !== process.env.ADMIN_SECRET_TOKEN) {
        return res.status(403).json({ error: "Acesso não autorizado" });
    }
    next();
};

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
loginRouter.post("/newUser", authLimiter, constrollerAuth.newUser);

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
loginRouter.post("/createUser", authLimiter, constrollerAuth.createUser);

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
loginRouter.post("/update-email", authLimiter, constrollerAuth.updateEmail);

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
loginRouter.post("/login", authLimiter, constrollerAuth.login);

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
 *             required:
 *               - userCredential
 *             properties:
 *               userCredential:
 *                 type: string
 *               insideApp:
 *                 type: boolean
 *                 description: Define se a requisição foi feita pelo app. Se true, retorna o link diretamente no response.
 *     responses:
 *       200:
 *         description: Link de redefinição enviado por e-mail ou retornado diretamente se insideApp for true
 */

loginRouter.post("/forgot-password", authLimiter, constrollerAuth.forgotPassword);

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
loginRouter.post('/emails', requireAdminToken, constrollerAuth.handleEmail);

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
 *         description: CPF do usuário
 *     responses:
 *       200:
 *         description: Resultado da verificação retornado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mustChangePassword:
 *                   type: boolean
 *       400:
 *         description: CPF não fornecido
 *       404:
 *         description: Usuário não encontrado
 *       500:
 *         description: Erro interno no servidor
 */
loginRouter.get("/must-change-password/:cpf", constrollerAuth.mustChangePasswordCheck);


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
 *       500:
 *         description: Erro interno no servidor
 */
loginRouter.post("/update-email-censored", validateJWT, constrollerAuth.updateUserEmail);

module.exports = loginRouter;
