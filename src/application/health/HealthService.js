const os = require('os');
const { exec } = require('child_process');
const Redis = require('ioredis');
const { client: prisma } = require('../../prisma/client');
const pushQueue = require('../../queues/pushQueue');
const logsService = require('./LogsService');

const LOG_SIZE_ALERT_MB = Number.parseInt(process.env.HEALTH_LOG_SIZE_ALERT_MB, 10) || 50;

// Ping direto via ioredis, não via Bull — precisa detectar Redis caído mesmo
// que a fila não tenha sido usada recentemente (foi assim que o container do
// Redis ficou 5 semanas fora do ar sem ninguém notar: nada pingava).
const medirRedis = async () => {
  const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    lazyConnect: true,
    connectTimeout: 2000,
    maxRetriesPerRequest: 1,
  });
  const inicio = Date.now();
  try {
    await redis.connect();
    await redis.ping();
    return { ok: true, ms: Date.now() - inicio };
  } catch (err) {
    return { ok: false, ms: null, erro: err.message };
  } finally {
    redis.disconnect();
  }
};

const medirBanco = async () => {
  const inicio = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, ms: Date.now() - inicio };
  } catch (err) {
    return { ok: false, ms: null, erro: err.message };
  }
};

const medirFila = async () => {
  try {
    const counts = await pushQueue.getJobCounts();
    return { ok: true, ...counts };
  } catch (err) {
    return { ok: false, erro: err.message };
  }
};

const medirProcesso = () => ({
  memRssMb: process.memoryUsage().rss / 1024 / 1024,
  memHeapUsedMb: process.memoryUsage().heapUsed / 1024 / 1024,
  uptimeS: Math.round(process.uptime()),
  loadAvg: os.loadavg(),
  freeMemMb: os.freemem() / 1024 / 1024,
});

const medirPm2 = () => new Promise((resolve) => {
  exec('pm2 jlist', { timeout: 3000 }, (err, stdout) => {
    if (err) return resolve({ ok: false, erro: err.message, processos: [] });
    try {
      const processos = JSON.parse(stdout).map(p => ({
        nome: p.name,
        status: p.pm2_env?.status,
        restarts: p.pm2_env?.restart_time,
        memMb: p.monit?.memory ? p.monit.memory / 1024 / 1024 : null,
        cpu: p.monit?.cpu,
        uptimeMs: p.pm2_env?.pm_uptime ? Date.now() - p.pm2_env.pm_uptime : null,
      }));
      resolve({ ok: true, processos });
    } catch (parseErr) {
      resolve({ ok: false, erro: parseErr.message, processos: [] });
    }
  });
});

// Log de 100+ MB crescendo sem ninguém notar foi exatamente o que aconteceu
// com o pushWorker-error.log antes desse serviço existir.
const medirLogs = () => {
  try {
    const arquivos = logsService.listarArquivos()
      .filter(f => f.tamanhoMb >= 1)
      .sort((a, b) => b.tamanhoMb - a.tamanhoMb);
    return { ok: true, arquivos };
  } catch (err) {
    return { ok: false, erro: err.message, arquivos: [] };
  }
};

const coletar = async () => {
  const [redis, banco, fila] = await Promise.all([medirRedis(), medirBanco(), medirFila()]);
  const pm2 = await medirPm2();
  const logs = medirLogs();
  const processo = medirProcesso();

  const alertas = [];
  if (!redis.ok) alertas.push('Redis indisponível');
  if (!banco.ok) alertas.push('Banco de dados indisponível');
  if (fila.ok && fila.failed > 0) alertas.push(`${fila.failed} job(s) com falha na fila`);
  if (fila.ok && fila.waiting > 100) alertas.push(`Fila acumulando: ${fila.waiting} jobs esperando`);
  pm2.processos?.forEach(p => {
    if (p.status !== 'online') alertas.push(`Processo pm2 "${p.nome}" está "${p.status}"`);
  });
  logs.arquivos?.forEach(f => {
    if (f.tamanhoMb >= LOG_SIZE_ALERT_MB) alertas.push(`Log "${f.arquivo}" com ${f.tamanhoMb.toFixed(0)} MB`);
  });

  return { redis, banco, fila, pm2, logs, processo, alertas, coletadoEm: new Date().toISOString() };
};

module.exports = { coletar };
