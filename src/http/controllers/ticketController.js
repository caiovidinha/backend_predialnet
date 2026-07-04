const ticketService = require('../../application/tickets/TicketService');
const logger = require('../../utils/logger');

const errStatus = (err) => err.statusCode || err.status || 500;

const create = async (req, res) => {
  try {
    const ticket = await ticketService.createTicket(req.body, { assignee: req.body.assignee });
    return res.status(201).json(ticket);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    logger.error('ticket create error', { error: err.message });
    return res.status(500).json({ error: 'Erro ao criar chamado.' });
  }
};

const list = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 20), 100);
    const result = await ticketService.listTickets({
      page,
      limit,
      status: req.query.status,
      priority: req.query.priority,
      assignee: req.query.assignee,
      cpf: req.query.cpf,
      q: req.query.q,
    });
    return res.status(200).json(result);
  } catch (err) {
    logger.error('ticket list error', { error: err.message });
    return res.status(500).json({ error: 'Erro ao listar chamados.' });
  }
};

const board = async (_req, res) => {
  try {
    const result = await ticketService.getBoard();
    return res.status(200).json(result);
  } catch (err) {
    logger.error('ticket board error', { error: err.message });
    return res.status(500).json({ error: 'Erro ao montar o board.' });
  }
};

const get = async (req, res) => {
  try {
    const ticket = await ticketService.getTicket(req.params.id);
    return res.status(200).json(ticket);
  } catch (err) {
    return res.status(errStatus(err)).json({ error: err.message });
  }
};

const update = async (req, res) => {
  try {
    const ticket = await ticketService.updateTicket(req.params.id, req.body);
    return res.status(200).json(ticket);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    logger.error('ticket update error', { error: err.message });
    return res.status(500).json({ error: 'Erro ao atualizar chamado.' });
  }
};

const comment = async (req, res) => {
  try {
    const result = await ticketService.addComment(req.params.id, {
      author: req.body.author,
      body: req.body.body,
      internal: req.body.internal,
    });
    return res.status(201).json(result);
  } catch (err) {
    return res.status(errStatus(err)).json({ error: err.message });
  }
};

const remove = async (req, res) => {
  try {
    const result = await ticketService.deleteTicket(req.params.id);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(errStatus(err)).json({ error: err.message });
  }
};

const uploadAttachment = async (req, res) => {
  try {
    const att = await ticketService.addAttachment(req.params.id, req.file, req.body.uploadedBy);
    return res.status(201).json(att);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    logger.error('ticket attachment upload error', { error: err.message });
    return res.status(500).json({ error: 'Erro ao anexar arquivo.' });
  }
};

const listAttachments = async (req, res) => {
  try {
    const items = await ticketService.listAttachments(req.params.id);
    return res.status(200).json({ items });
  } catch (err) {
    return res.status(errStatus(err)).json({ error: err.message });
  }
};

const attachmentUrl = async (req, res) => {
  try {
    const result = await ticketService.getAttachmentUrl(req.params.attId);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(errStatus(err)).json({ error: err.message });
  }
};

const deleteAttachment = async (req, res) => {
  try {
    const result = await ticketService.deleteAttachment(req.params.attId);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(errStatus(err)).json({ error: err.message });
  }
};

module.exports = {
  create, list, board, get, update, comment, remove,
  uploadAttachment, listAttachments, attachmentUrl, deleteAttachment,
};
