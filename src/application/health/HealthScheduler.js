const healthService = require('./HealthService');
const snapshotRepo = require('../../infrastructure/repositories/healthSnapshotRepository');
const logger = require('../../utils/logger');

// Job de snapshot periódico de saúde. Espelha BlogScheduler.js: setInterval
// iniciado em server.js (nunca em app.js, pra não subir timer em teste, e
// nunca no pushWorker, pra não coletar em dobro com 2 processos pm2 ativos).

const INTERVALO_MS = Number.parseInt(process.env.HEALTH_SCHEDULER_INTERVALO_MS, 10) || 60_000;

let timer = null;
let rodando = false;

const tick = async () => {
  if (rodando) return;
  rodando = true;
  try {
    const snapshot = await healthService.coletar();
    await snapshotRepo.create(snapshot);
    if (snapshot.alertas.length) logger.warn('health: alerta(s) detectado(s)', { alertas: snapshot.alertas });
  } catch (err) {
    logger.warn('health: job de coleta falhou', { error: err.message });
  } finally {
    rodando = false;
  }
};

const iniciar = () => {
  if (timer) return timer;

  if (process.env.HEALTH_SCHEDULER_ATIVO === 'false') {
    logger.info('health: job de coleta desligado por env');
    return null;
  }

  timer = setInterval(tick, INTERVALO_MS);
  if (typeof timer.unref === 'function') timer.unref();
  logger.info('health: job de coleta ativo', { intervalo_ms: INTERVALO_MS });
  return timer;
};

const parar = () => {
  if (timer) clearInterval(timer);
  timer = null;
};

module.exports = { iniciar, parar, tick, INTERVALO_MS };
