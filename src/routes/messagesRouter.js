const express = require('express');
const { validateJWT } = require('../models/auth');
const messagesController = require('../controllers/messagesController');

const messagesRouter = express.Router();

messagesRouter.use(validateJWT);

/**
 * @swagger
 * tags:
 *   name: Mensagens
 *   description: Gerenciamento de avisos exibidos no app para os clientes
 */

/**
 * @swagger
 * /messages:
 *   post:
 *     summary: Cria uma nova mensagem de aviso
 *     tags: [Mensagens]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - msg_cliente
 *             properties:
 *               title:
 *                 type: string
 *                 description: Rótulo interno para identificar a mensagem
 *               msg_cliente:
 *                 type: string
 *                 description: Texto exibido ao cliente no app
 *               timeout_sec:
 *                 type: integer
 *                 default: 10
 *                 description: Tempo (segundos) de exibição do aviso
 *               targets:
 *                 type: array
 *                 description: Regras de segmentação (opcional). Se omitido, a mensagem ficará sem destinatários até adicionar targets.
 *                 items:
 *                   type: object
 *                   required:
 *                     - targeting_type
 *                   properties:
 *                     targeting_type:
 *                       type: string
 *                       enum: [GLOBAL, CLIENTE, CEP, BAIRRO]
 *                     targeting_value:
 *                       type: string
 *                       description: Obrigatório para tipos CLIENTE, CEP e BAIRRO. Ignorado para GLOBAL.
 *     responses:
 *       201:
 *         description: Mensagem criada com sucesso
 *       400:
 *         description: Parâmetros inválidos
 *       500:
 *         description: Erro interno
 */
messagesRouter.post('/', messagesController.createMessageController);

/**
 * @swagger
 * /messages:
 *   get:
 *     summary: Lista mensagens de aviso
 *     tags: [Mensagens]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Inclui mensagens inativas (não excluídas)
 *     responses:
 *       200:
 *         description: Lista paginada de mensagens
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *       500:
 *         description: Erro interno
 */
messagesRouter.get('/', messagesController.listMessagesController);

/**
 * @swagger
 * /messages/{id}:
 *   get:
 *     summary: Busca uma mensagem pelo ID
 *     tags: [Mensagens]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Mensagem encontrada
 *       404:
 *         description: Mensagem não encontrada
 *       500:
 *         description: Erro interno
 */
messagesRouter.get('/:id', messagesController.getMessageController);

/**
 * @swagger
 * /messages/{id}:
 *   patch:
 *     summary: Atualiza campos de uma mensagem
 *     tags: [Mensagens]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               msg_cliente:
 *                 type: string
 *               timeout_sec:
 *                 type: integer
 *               active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Mensagem atualizada
 *       404:
 *         description: Mensagem não encontrada
 *       500:
 *         description: Erro interno
 */
messagesRouter.patch('/:id', messagesController.updateMessageController);

/**
 * @swagger
 * /messages/{id}:
 *   delete:
 *     summary: Remove (soft delete) uma mensagem
 *     tags: [Mensagens]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Mensagem removida com sucesso
 *       404:
 *         description: Mensagem não encontrada
 *       500:
 *         description: Erro interno
 */
messagesRouter.delete('/:id', messagesController.deleteMessageController);

/**
 * @swagger
 * /messages/{id}/targets:
 *   post:
 *     summary: Adiciona uma regra de segmentação a uma mensagem
 *     tags: [Mensagens]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - targeting_type
 *             properties:
 *               targeting_type:
 *                 type: string
 *                 enum: [GLOBAL, CLIENTE, CEP, BAIRRO]
 *               targeting_value:
 *                 type: string
 *                 description: Obrigatório para tipos CLIENTE, CEP e BAIRRO
 *     responses:
 *       201:
 *         description: Target adicionado
 *       400:
 *         description: Parâmetros inválidos
 *       404:
 *         description: Mensagem não encontrada
 *       500:
 *         description: Erro interno
 */
messagesRouter.post('/:id/targets', messagesController.addTargetController);

/**
 * @swagger
 * /messages/{id}/targets/{targetId}:
 *   delete:
 *     summary: Remove uma regra de segmentação
 *     tags: [Mensagens]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: targetId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Target removido
 *       404:
 *         description: Target não encontrado
 *       500:
 *         description: Erro interno
 */
messagesRouter.delete('/:id/targets/:targetId', messagesController.removeTargetController);

/**
 * @swagger
 * /messages/{id}/assign-by-address:
 *   post:
 *     summary: Atribui uma mensagem a clientes por filtro de endereço ou CPF
 *     tags: [Mensagens]
 *     description: |
 *       Escolha um `filter_type` e forneça os campos correspondentes:
 *       - **GERAL**: todos os usuários do app (nenhum campo extra necessário)
 *       - **CPF**: lista direta de CPFs (`cpfs[]`)
 *       - **CIDADE**: clientes na cidade (`cidade`)
 *       - **BAIRRO**: clientes no bairro (`bairro`)
 *       - **RUA**: clientes na rua identificada pelo CEP (`cep`)
 *       - **CEP**: clientes com o CEP fornecido (`cep`)
 *       - **CEP_NUMERO**: clientes no endereço exato (`cep` + `numero`)
 *
 *       Todos os clientes encontrados são adicionados como targets do tipo CLIENTE (CPF).
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da mensagem
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - filter_type
 *             properties:
 *               filter_type:
 *                 type: string
 *                 enum: [GERAL, CPF, CIDADE, BAIRRO, RUA, CEP, CEP_NUMERO]
 *               cpfs:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Obrigatório para filter_type CPF
 *               cidade:
 *                 type: string
 *                 description: Obrigatório para filter_type CIDADE
 *               bairro:
 *                 type: string
 *                 description: Obrigatório para filter_type BAIRRO
 *               cep:
 *                 type: string
 *                 description: Obrigatório para filter_type RUA, CEP e CEP_NUMERO
 *               numero:
 *                 type: string
 *                 description: Obrigatório para filter_type CEP_NUMERO
 *     responses:
 *       200:
 *         description: Resultado da atribuição
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 assigned:
 *                   type: integer
 *                 failed:
 *                   type: integer
 *       400:
 *         description: Parâmetros inválidos
 *       404:
 *         description: Mensagem não encontrada
 *       500:
 *         description: Erro interno
 */
messagesRouter.post('/:id/assign-by-address', messagesController.assignByAddressController);

module.exports = messagesRouter;
