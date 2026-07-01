const express = require('express');
const ctrl = require('../controllers/utilitiesController');
const { validateJWT } = require('../middlewares/auth');

const router = express.Router();

router.use(validateJWT);

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
router.get('/toggle-ad/:cpf', ctrl.toggleShowAd);

/**
 * @swagger
 * /utils/cliente/{id}:
 *   get:
 *     summary: Busca dados completos do cliente por código
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
router.get('/cliente/:id', ctrl.getUserByID);

/**
 * @swagger
 * /utils/seradicional/{id}:
 *   get:
 *     summary: Lista serviços adicionais do cliente por código
 *     tags: [Controle]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Código do cliente (codcliente)
 *     responses:
 *       200:
 *         description: Serviços adicionais agrupados por serponto
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 serpontos:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       serponto_id:
 *                         type: number
 *                       ser_adicionais:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: number
 *                             nome_servico:
 *                               type: string
 *                             requerido:
 *                               type: number
 *       500:
 *         description: Erro ao buscar serviços adicionais
 */
router.get('/seradicional/:id', ctrl.getSerAdicionalController);

/**
 * @swagger
 * /utils/seradicional:
 *   post:
 *     summary: Ativa ou desativa um serviço adicional
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
 *                 type: number
 *                 description: ID do ser_adicional
 *               requerido:
 *                 type: number
 *                 description: "1 para ativar, 0 para desativar"
 *               serPonto:
 *                 type: number
 *                 description: ID do serponto
 *     responses:
 *       200:
 *         description: Serviço adicional atualizado
 *       400:
 *         description: Parâmetros inválidos
 *       500:
 *         description: Erro interno
 */
router.post('/seradicional', ctrl.updateSerAdicionalController);

/**
 * @swagger
 * /utils/controle-parental/{id}:
 *   get:
 *     summary: Lista horários bloqueados do controle parental por código do cliente
 *     tags: [Controle]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Código do cliente (codcliente)
 *     responses:
 *       200:
 *         description: Controle parental agrupado por serponto
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 serpontos:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       serponto_id:
 *                         type: number
 *                       controle_parental:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             serPonto:
 *                               type: number
 *                             diaSemana:
 *                               type: string
 *                             hora:
 *                               type: number
 *       500:
 *         description: Erro ao buscar controle parental
 */
router.get('/controle-parental/:id', ctrl.getControleParentalController);

/**
 * @swagger
 * /utils/controle-parental:
 *   post:
 *     summary: Substitui a lista de horários bloqueados do controle parental
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
 *                 type: number
 *                 description: ID do serponto
 *               controle_parental:
 *                 type: array
 *                 description: Lista completa de bloqueios (sobrescreve o atual; [] remove tudo)
 *                 items:
 *                   type: object
 *                   properties:
 *                     serPonto:
 *                       type: number
 *                     diaSemana:
 *                       type: string
 *                       enum: [Segunda, Terca, Quarta, Quinta, Sexta, Sabado, Domingo]
 *                     hora:
 *                       type: number
 *                       description: 0 a 23
 *     responses:
 *       200:
 *         description: Controle parental atualizado
 *       500:
 *         description: Erro interno
 */
router.post('/controle-parental', ctrl.updateControleParentalController);

/**
 * @swagger
 * /utils/status/{codcliente}:
 *   get:
 *     summary: Retorna status geral do cliente (serviços, fatura, liberação temporária)
 *     tags: [Utilitários]
 *     parameters:
 *       - in: path
 *         name: codcliente
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Status retornado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 service_status:
 *                   type: array
 *                   items:
 *                     type: object
 *                 payment_status:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                     valor:
 *                       type: string
 *                     vencimento:
 *                       type: string
 *                 libtemp_status:
 *                   type: boolean
 *       400:
 *         description: Código do cliente não fornecido
 *       500:
 *         description: Erro interno
 */
router.get('/status/:codcliente', ctrl.getClientStatusController);

/**
 * @swagger
 * /utils/monitoramento/{codcliente}:
 *   get:
 *     summary: Retorna mensagem de monitoramento/alerta do cliente
 *     tags: [Utilitários]
 *     parameters:
 *       - in: path
 *         name: codcliente
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Mensagem de monitoramento retornada
 *       400:
 *         description: Código do cliente não fornecido
 *       500:
 *         description: Erro interno
 */
router.get('/monitoramento/:codcliente', ctrl.getAlertMessageController);

module.exports = router;
