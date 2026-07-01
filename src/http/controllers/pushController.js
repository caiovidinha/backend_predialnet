const pushService = require('../../application/push/PushService');
const logger = require('../../utils/logger');

const { VALID_TARGETING_TYPES, VALID_FILTER_TYPES } = pushService;

const saveTokenController = async (req, res) => {
  const { cpf, token } = req.body;
  if (!cpf || !token) return res.status(400).json({ error: 'CPF ou token não fornecido' });
  try {
    await pushService.savePushToken(cpf, token);
    return res.status(200).json({ message: 'Token salvo com sucesso' });
  } catch (err) {
    logger.error('saveToken error', { error: err.message });
    return res.status(500).json({ error: 'Erro ao salvar token' });
  }
};

const sendNotificationController = async (req, res) => {
  const { title, body, data, authToken } = req.body;
  if (authToken !== process.env.PUSH_AUTH_TOKEN)
    return res.status(403).json({ error: 'Acesso não autorizado' });
  try {
    const result = await pushService.sendBroadcast({ title, body, data });
    return res.status(202).json({ success: true, ...result });
  } catch (err) {
    logger.error('sendBroadcast error', { error: err.message });
    return res.status(500).json({ error: 'Erro ao enfileirar notificações' });
  }
};

const sendFilteredNotificationsController = async (req, res) => {
  const { authToken, title, body, data, filters } = req.body;
  if (authToken !== process.env.PUSH_AUTH_TOKEN)
    return res.status(403).json({ error: 'Acesso não autorizado' });
  if (!title || !body || typeof filters !== 'object')
    return res.status(400).json({ error: 'Payload inválido' });
  try {
    const result = await pushService.sendFiltered({ title, body, data, filters });
    return res.status(202).json({ success: true, ...result });
  } catch (err) {
    logger.error('sendFiltered error', { error: err.message });
    return res.status(500).json({ error: 'Erro interno' });
  }
};

const webhookController = async (req, res) => {
  const { eventType, cpfs, authToken } = req.body;
  if (authToken !== process.env.PUSH_AUTH_TOKEN)
    return res.status(403).json({ error: 'Acesso não autorizado' });
  if (!eventType || !Array.isArray(cpfs) || !cpfs.length)
    return res.status(400).json({ error: 'eventType ou lista de CPFs não fornecida' });
  try {
    const result = await pushService.processWebhook({ eventType, cpfs });
    return res.status(202).json({ success: true, ...result });
  } catch (err) {
    if (err.message.startsWith('eventType inválido'))
      return res.status(400).json({ error: err.message });
    logger.error('webhook error', { error: err.message });
    return res.status(500).json({ error: 'Erro interno' });
  }
};

const getNotificationsController = async (req, res) => {
  const { cpf } = req.params;
  if (!cpf) return res.status(400).json({ error: 'CPF não fornecido' });
  try {
    const notifications = await pushService.getNotifications(cpf);
    return res.status(200).json({ notifications });
  } catch (err) {
    if (err.message === 'Usuário não encontrado')
      return res.status(404).json({ error: err.message });
    logger.error('getNotifications error', { error: err.message });
    return res.status(500).json({ error: 'Erro interno' });
  }
};

const markReadController = async (req, res) => {
  const { id } = req.params;
  const { read } = req.body;
  if (typeof read !== 'boolean') return res.status(400).json({ error: "Campo 'read' deve ser booleano" });
  try {
    const updated = await pushService.markNotificationRead(id, read);
    return res.status(200).json({ id: updated.id, read: updated.read, readAt: updated.readAt });
  } catch (err) {
    logger.error('markRead error', { error: err.message });
    return res.status(500).json({ error: 'Erro interno' });
  }
};

const sendTargetedController = async (req, res) => {
  const { title, body, data, targets } = req.body;
  if (!title || !body) return res.status(400).json({ error: 'Os campos title e body são obrigatórios.' });
  if (!Array.isArray(targets) || !targets.length)
    return res.status(400).json({ error: 'targets deve ser um array não-vazio.' });

  for (const t of targets) {
    if (!t.targeting_type || !VALID_TARGETING_TYPES.includes(t.targeting_type))
      return res.status(400).json({ error: `targeting_type inválido. Aceitos: ${VALID_TARGETING_TYPES.join(', ')}.` });
    if (t.targeting_type !== 'GLOBAL' && !t.targeting_value)
      return res.status(400).json({ error: `targeting_value é obrigatório para ${t.targeting_type}.` });
    if (t.targeting_type === 'BAIRRO_CIDADE' && !t.targeting_value.includes(':'))
      return res.status(400).json({ error: 'BAIRRO_CIDADE requer formato "bairro:cidade".' });
    if (t.targeting_type === 'CEP_NUMERO' && !t.targeting_value.includes(':'))
      return res.status(400).json({ error: 'CEP_NUMERO requer formato "cep:numero".' });
  }

  try {
    const result = await pushService.sendTargeted({ title, body, data, targets });
    if (result.queued === 0)
      return res.status(200).json({ success: true, queued: 0, message: 'Nenhum destinatário encontrado.' });
    return res.status(202).json({ success: true, ...result });
  } catch (err) {
    logger.error('sendTargeted error', { error: err.message });
    return res.status(500).json({ error: 'Erro ao enfileirar notificações.' });
  }
};

const sendByAddressController = async (req, res) => {
  const { title, body, data, filter_type, cpfs, cidade, bairro, cep, numero } = req.body;
  if (!title || !body) return res.status(400).json({ error: 'Os campos title e body são obrigatórios.' });
  if (!filter_type || !VALID_FILTER_TYPES.includes(filter_type))
    return res.status(400).json({ error: `filter_type inválido. Aceitos: ${VALID_FILTER_TYPES.join(', ')}.` });
  if (filter_type === 'CPF' && (!Array.isArray(cpfs) || !cpfs.length))
    return res.status(400).json({ error: 'cpfs deve ser um array não-vazio para filter_type CPF.' });
  if (filter_type === 'CIDADE' && !cidade)
    return res.status(400).json({ error: 'cidade é obrigatório para filter_type CIDADE.' });
  if (filter_type === 'BAIRRO' && !bairro)
    return res.status(400).json({ error: 'bairro é obrigatório para filter_type BAIRRO.' });
  if ((filter_type === 'CEP' || filter_type === 'RUA') && !cep)
    return res.status(400).json({ error: 'cep é obrigatório para filter_type CEP/RUA.' });
  if (filter_type === 'CEP_NUMERO' && (!cep || !numero))
    return res.status(400).json({ error: 'cep e numero são obrigatórios para filter_type CEP_NUMERO.' });

  try {
    const result = await pushService.sendByAddress({ title, body, data, filter_type, cpfs, cidade, bairro, cep, numero });
    if (result.queued === 0)
      return res.status(200).json({ success: true, queued: 0, message: 'Nenhum destinatário encontrado.' });
    return res.status(202).json({ success: true, ...result });
  } catch (err) {
    logger.error('sendByAddress error', { error: err.message });
    return res.status(500).json({ error: 'Erro ao enfileirar notificações.' });
  }
};

module.exports = {
  saveTokenController, sendNotificationController, sendFilteredNotificationsController,
  webhookController, getNotificationsController, markReadController,
  sendTargetedController, sendByAddressController,
};
