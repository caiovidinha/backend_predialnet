const messagesService = require('../../application/messages/MessagesService');
const logger = require('../../utils/logger');

const { VALID_TARGETING_TYPES, VALID_FILTER_TYPES } = messagesService;

const createMessageController = async (req, res) => {
  const { title, msg_cliente, timeout_sec, targets } = req.body;
  if (!title || !msg_cliente) return res.status(400).json({ error: 'Os campos title e msg_cliente são obrigatórios.' });

  if (targets !== undefined) {
    if (!Array.isArray(targets)) return res.status(400).json({ error: 'targets deve ser um array.' });
    for (const t of targets) {
      if (!VALID_TARGETING_TYPES.includes(t.targeting_type))
        return res.status(400).json({ error: `targeting_type inválido. Aceitos: ${VALID_TARGETING_TYPES.join(', ')}.` });
      if (t.targeting_type !== 'GLOBAL' && !t.targeting_value)
        return res.status(400).json({ error: `targeting_value obrigatório para ${t.targeting_type}.` });
      if (t.targeting_type === 'BAIRRO_CIDADE' && !t.targeting_value.includes(':'))
        return res.status(400).json({ error: 'BAIRRO_CIDADE requer formato "bairro:cidade".' });
    }
  }

  try {
    const message = await messagesService.createMessage({ title, msg_cliente, timeout_sec, targets });
    return res.status(201).json(message);
  } catch (err) {
    logger.error('createMessage error', { error: err.message });
    return res.status(500).json({ error: 'Erro ao criar mensagem.' });
  }
};

const listMessagesController = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(Math.max(1, parseInt(req.query.limit) || 20), 100);
  const includeInactive = req.query.includeInactive === 'true';
  try {
    const result = await messagesService.listMessages({ page, limit, includeInactive });
    return res.status(200).json(result);
  } catch (err) {
    logger.error('listMessages error', { error: err.message });
    return res.status(500).json({ error: 'Erro ao listar mensagens.' });
  }
};

const getMessageController = async (req, res) => {
  try {
    const message = await messagesService.getMessageById(req.params.id);
    if (!message) return res.status(404).json({ error: 'Mensagem não encontrada.' });
    return res.status(200).json(message);
  } catch (err) {
    logger.error('getMessage error', { error: err.message });
    return res.status(500).json({ error: 'Erro ao buscar mensagem.' });
  }
};

const updateMessageController = async (req, res) => {
  try {
    const existing = await messagesService.getMessageById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Mensagem não encontrada.' });
    const updated = await messagesService.updateMessage(req.params.id, req.body);
    return res.status(200).json(updated);
  } catch (err) {
    logger.error('updateMessage error', { error: err.message });
    return res.status(500).json({ error: 'Erro ao atualizar mensagem.' });
  }
};

const deleteMessageController = async (req, res) => {
  try {
    const existing = await messagesService.getMessageById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Mensagem não encontrada.' });
    await messagesService.deleteMessage(req.params.id);
    return res.status(200).json({ message: 'Mensagem removida com sucesso.' });
  } catch (err) {
    logger.error('deleteMessage error', { error: err.message });
    return res.status(500).json({ error: 'Erro ao remover mensagem.' });
  }
};

const addTargetController = async (req, res) => {
  const { targeting_type, targeting_value } = req.body;
  if (!VALID_TARGETING_TYPES.includes(targeting_type))
    return res.status(400).json({ error: `targeting_type inválido. Aceitos: ${VALID_TARGETING_TYPES.join(', ')}.` });
  if (targeting_type !== 'GLOBAL' && !targeting_value)
    return res.status(400).json({ error: 'targeting_value obrigatório para tipos não-GLOBAL.' });
  if (targeting_type === 'BAIRRO_CIDADE' && !targeting_value.includes(':'))
    return res.status(400).json({ error: 'BAIRRO_CIDADE requer formato "bairro:cidade".' });

  try {
    const existing = await messagesService.getMessageById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Mensagem não encontrada.' });
    const result = await messagesService.addTarget(req.params.id, { targeting_type, targeting_value });
    return res.status(201).json(result);
  } catch (err) {
    logger.error('addTarget error', { error: err.message });
    return res.status(500).json({ error: 'Erro ao adicionar target.' });
  }
};

const removeTargetController = async (req, res) => {
  try {
    await messagesService.removeTarget(req.params.targetId);
    return res.status(200).json({ message: 'Target removido com sucesso.' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Target não encontrado.' });
    logger.error('removeTarget error', { error: err.message });
    return res.status(500).json({ error: 'Erro ao remover target.' });
  }
};

const assignByAddressController = async (req, res) => {
  const { filter_type, cpfs, cidade, bairro, cep, numero } = req.body;
  if (!filter_type || !VALID_FILTER_TYPES.includes(filter_type))
    return res.status(400).json({ error: `filter_type inválido. Aceitos: ${VALID_FILTER_TYPES.join(', ')}.` });

  try {
    const existing = await messagesService.getMessageById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Mensagem não encontrada.' });
    const result = await messagesService.assignByAddress(req.params.id, { filter_type, cpfs, cidade, bairro, cep, numero });
    return res.status(200).json(result);
  } catch (err) {
    logger.error('assignByAddress error', { error: err.message });
    return res.status(500).json({ error: 'Erro ao atribuir mensagem.' });
  }
};

module.exports = {
  createMessageController, listMessagesController, getMessageController,
  updateMessageController, deleteMessageController, addTargetController,
  removeTargetController, assignByAddressController,
};
