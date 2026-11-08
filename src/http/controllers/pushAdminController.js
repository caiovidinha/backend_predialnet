const { client } = require('../../prisma/client');
const pushDeliveryRepo = require('../../infrastructure/repositories/pushDeliveryRepository');
const logger = require('../../utils/logger');

const STATUS_VALIDOS = ['pending', 'sent', 'delivered', 'failed'];

const paginar = (req) => {
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Number.parseInt(req.query.limit, 10) || 20, 100);
  return { page, limit, skip: (page - 1) * limit, take: limit };
};

const listCampaigns = async (req, res) => {
  const { page, limit, skip, take } = paginar(req);
  try {
    const [rows, total] = await Promise.all([
      client.notification.findMany({ orderBy: { createdAt: 'desc' }, skip, take }),
      client.notification.count(),
    ]);
    const items = await Promise.all(rows.map(async (n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      status: n.status,
      tokens: n.tokens,
      createdAt: n.createdAt,
      stats: await pushDeliveryRepo.aggregateForNotification(n.id),
    })));
    return res.status(200).json({ items, total, page, limit });
  } catch (err) {
    logger.error('admin listCampaigns error', { error: err.message });
    return res.status(500).json({ error: 'Erro ao listar campanhas.' });
  }
};

const getCampaign = async (req, res) => {
  const { id } = req.params;
  try {
    const n = await client.notification.findUnique({ where: { id } });
    if (!n) return res.status(404).json({ error: 'Campanha não encontrada.' });
    const stats = await pushDeliveryRepo.aggregateForNotification(id);
    return res.status(200).json({
      id: n.id, title: n.title, body: n.body, data: n.data, status: n.status, tokens: n.tokens, createdAt: n.createdAt, stats,
    });
  } catch (err) {
    logger.error('admin getCampaign error', { error: err.message });
    return res.status(500).json({ error: 'Erro interno.' });
  }
};

const listDeliveries = async (req, res) => {
  const { id } = req.params;
  const { page, limit, skip, take } = paginar(req);
  const status = STATUS_VALIDOS.includes(req.query.status) ? req.query.status : undefined;
  try {
    const [rows, total] = await Promise.all([
      pushDeliveryRepo.listByNotification(id, { skip, take, status }),
      pushDeliveryRepo.countByNotification(id, { status }),
    ]);
    const items = rows.map(d => ({
      id: d.id,
      cpf: d.user.cpf,
      token: d.token,
      status: d.status,
      errorCode: d.errorCode,
      sentAt: d.sentAt,
      deliveredAt: d.deliveredAt,
      openedAt: d.openedAt,
    }));
    return res.status(200).json({ items, total, page, limit });
  } catch (err) {
    logger.error('admin listDeliveries error', { error: err.message });
    return res.status(500).json({ error: 'Erro interno.' });
  }
};

module.exports = { listCampaigns, getCampaign, listDeliveries };
