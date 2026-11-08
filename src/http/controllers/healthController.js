const healthService = require('../../application/health/HealthService');
const snapshotRepo = require('../../infrastructure/repositories/healthSnapshotRepository');
const logger = require('../../utils/logger');

// Tempo real, não lê snapshot salvo — o dashboard faz polling de 30s e quer o
// estado agora, não o de até 60s atrás (intervalo do HealthScheduler).
const atual = async (req, res) => {
  try {
    return res.status(200).json(await healthService.coletar());
  } catch (err) {
    logger.error('health atual error', { error: err.message });
    return res.status(500).json({ error: 'Erro ao coletar saúde dos sistemas.' });
  }
};

const historico = async (req, res) => {
  const horas = Math.min(Number.parseInt(req.query.horas, 10) || 24, 24 * 14);
  const desde = new Date(Date.now() - horas * 60 * 60 * 1000);
  try {
    return res.status(200).json({ snapshots: await snapshotRepo.listSince(desde) });
  } catch (err) {
    logger.error('health historico error', { error: err.message });
    return res.status(500).json({ error: 'Erro ao buscar histórico.' });
  }
};

module.exports = { atual, historico };
