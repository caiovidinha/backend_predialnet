const express = require('express');
const { validateJWT, requireAdmin } = require('../middlewares/auth');
const ctrl = require('../controllers/ticketController');

const router = express.Router();

// Todos os endpoints de chamados são do painel de suporte (operador).
router.use(validateJWT, requireAdmin);

/**
 * @swagger
 * tags:
 *   name: Tickets
 *   description: Chamados de suporte (kanban) — abertura, board, atualização e comentários
 */

/**
 * @swagger
 * /tickets:
 *   post:
 *     summary: Abre um chamado (envia notificação por e-mail ao suporte)
 *     tags: [Tickets]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subject, description]
 *             properties:
 *               subject: { type: string }
 *               description: { type: string }
 *               priority: { type: string, enum: [BAIXA, MEDIA, ALTA, URGENTE] }
 *               category: { type: string }
 *               requesterName: { type: string }
 *               requesterEmail: { type: string }
 *               requesterPhone: { type: string }
 *               cpf: { type: string }
 *               codcliente: { type: string }
 *               assignee: { type: string }
 *     responses:
 *       201: { description: Chamado criado }
 *       400: { description: Campos obrigatórios ausentes }
 *   get:
 *     summary: Lista chamados (filtros + paginação)
 *     tags: [Tickets]
 *     parameters:
 *       - { in: query, name: status, schema: { type: string, enum: [ABERTO, EM_ANDAMENTO, AGUARDANDO, RESOLVIDO, FECHADO] } }
 *       - { in: query, name: priority, schema: { type: string, enum: [BAIXA, MEDIA, ALTA, URGENTE] } }
 *       - { in: query, name: assignee, schema: { type: string } }
 *       - { in: query, name: cpf, schema: { type: string } }
 *       - { in: query, name: q, schema: { type: string }, description: Busca em assunto/descrição/solicitante }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20, maximum: 100 } }
 *     responses:
 *       200: { description: "{ items, total, page, limit }" }
 */
router.post('/', ctrl.create);
router.get('/', ctrl.list);

/**
 * @swagger
 * /tickets/board:
 *   get:
 *     summary: Board kanban — chamados agrupados por coluna (status)
 *     tags: [Tickets]
 *     responses:
 *       200:
 *         description: "{ columns: [{ status, tickets[] }], total } — todas as colunas, mesmo vazias"
 */
router.get('/board', ctrl.board);

/**
 * @swagger
 * /tickets/{id}:
 *   get:
 *     summary: Detalhe do chamado (com comentários)
 *     tags: [Tickets]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Chamado + comentários }
 *       404: { description: Não encontrado }
 *   patch:
 *     summary: Atualiza o chamado (mover coluna, prioridade, responsável, etc.)
 *     tags: [Tickets]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string, enum: [ABERTO, EM_ANDAMENTO, AGUARDANDO, RESOLVIDO, FECHADO] }
 *               priority: { type: string, enum: [BAIXA, MEDIA, ALTA, URGENTE] }
 *               assignee: { type: string }
 *               position: { type: integer, description: Ordem dentro da coluna (kanban) }
 *               subject: { type: string }
 *               description: { type: string }
 *               category: { type: string }
 *     responses:
 *       200: { description: Chamado atualizado }
 *       400: { description: Valor inválido }
 *       404: { description: Não encontrado }
 *   delete:
 *     summary: Remove (soft delete) o chamado
 *     tags: [Tickets]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: "{ deleted: true, id }" }
 *       404: { description: Não encontrado }
 */
router.get('/:id', ctrl.get);
router.patch('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

/**
 * @swagger
 * /tickets/{id}/comments:
 *   post:
 *     summary: Adiciona um comentário/andamento ao chamado
 *     tags: [Tickets]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [body]
 *             properties:
 *               body: { type: string }
 *               author: { type: string }
 *               internal: { type: boolean, description: Comentário interno (não visível ao cliente) }
 *     responses:
 *       201: { description: Comentário criado }
 *       400: { description: body obrigatório }
 *       404: { description: Chamado não encontrado }
 */
router.post('/:id/comments', ctrl.comment);

module.exports = router;
