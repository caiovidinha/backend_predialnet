const { client } = require('../../prisma/client');
const pushDeliveryRepo = require('../../infrastructure/repositories/pushDeliveryRepository');
const logger = require('../../utils/logger');

const STATUS_VALIDOS = ['pending', 'sent', 'delivered', 'failed'];

const paginar = (req) => {
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Number.parseInt(req.query.limit, 10) || 20, 100);
  return { page, limit, skip: (page - 1) * limit, take: limit };
};

// Nunca sem `select`: Notification.receipts guarda o array bruto de tickets
// do Expo (um por destinatário) — numa campanha grande isso é uma coluna
// gigante, e paginar a tabela inteira trazendo esse blob em toda linha já
// derrubou o MySQL por memória de sort numa campanha grande. A listagem não
// usa `data`/`receipts`, então nem pedimos.
const CAMPANHA_SELECT = { id: true, title: true, body: true, status: true, tokens: true, createdAt: true };

const listCampaigns = async (req, res) => {
  const { page, limit, skip, take } = paginar(req);
  try {
    const [rows, total] = await Promise.all([
      client.notification.findMany({ select: CAMPANHA_SELECT, orderBy: { createdAt: 'desc' }, skip, take }),
      client.notification.count(),
    ]);
    const items = await Promise.all(rows.map(async (n) => ({
      ...n,
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
    // Aqui sim inclui `data` (útil pra inspecionar o payload de uma campanha
    // específica) — mas `receipts` continua de fora, idem acima.
    const n = await client.notification.findUnique({ where: { id }, select: { ...CAMPANHA_SELECT, data: true } });
    if (!n) return res.status(404).json({ error: 'Campanha não encontrada.' });
    const stats = await pushDeliveryRepo.aggregateForNotification(id);
    return res.status(200).json({ ...n, stats });
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
