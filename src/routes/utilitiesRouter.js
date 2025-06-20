// const { validateJWT } = require("../models/auth");
const utilitiesController = require("../controllers/utilities")
const express = require("express");

const utilitiesRouter = express.Router();
// utilitiesRouter.use(validateJWT);

/**
 * @swagger
 * /utils/toggle-ad/{cpf}:
 *   get:
 *     summary: Alterna exibição de anúncio (show_ad) para um CPF
 *     tags: [Utilitários]
 *     parameters:
 *       - in: path
 *         name: cpf
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Estado de exibição retornado com sucesso
 *       400:
 *         description: CPF não fornecido
 *       500:
 *         description: Erro interno
 */
utilitiesRouter.get("/toggle-ad/:cpf", utilitiesController.toggleShowAd);

/**
 * @swagger
 * /utils/cliente/{id}:
 *   get:
 *     summary: Busca dados do cliente por ID
 *     tags: [Utilitários]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Dados do cliente retornados com sucesso
 *       500:
 *         description: Erro ao buscar cliente
 */
utilitiesRouter.get("/cliente/:id", utilitiesController.getUserByID);

/**
 * @swagger
 * /utils/seradicional:
 *   post:
 *     summary: Atualiza configurações de serviço adicional
 *     tags: [Controle]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *               - requerido
 *               - serPonto
 *             properties:
 *               id:
 *                 type: string
 *               requerido:
 *                 type: boolean
 *               serPonto:
 *                 type: string
 *     responses:
 *       200:
 *         description: Serviço adicional atualizado
 *       400:
 *         description: Parâmetros inválidos
 *       500:
 *         description: Erro interno
 */
utilitiesRouter.post("/seradicional", utilitiesController.updateSerAdicionalController);

/**
 * @swagger
 * /utils/controle-parental:
 *   post:
 *     summary: Atualiza controle parental do cliente
 *     tags: [Controle]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *               - controle_parental
 *             properties:
 *               id:
 *                 type: string
 *               controle_parental:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Controle parental atualizado
 *       500:
 *         description: Erro interno
 */
utilitiesRouter.post("/controle-parental", utilitiesController.updateControleParentalController);


module.exports = utilitiesRouter;