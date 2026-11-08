const { client } = require('../../prisma/client');

const create = (s) => client.healthSnapshot.create({
  data: {
    redisOk: s.redis.ok,
    redisMs: s.redis.ms,
    dbOk: s.banco.ok,
    dbMs: s.banco.ms,
    queueWaiting: s.fila.waiting ?? null,
    queueActive: s.fila.active ?? null,
    queueCompleted: s.fila.completed ?? null,
    queueFailed: s.fila.failed ?? null,
    queueDelayed: s.fila.delayed ?? null,
    memRssMb: s.processo.memRssMb,
    memHeapUsedMb: s.processo.memHeapUsedMb,
    uptimeS: s.processo.uptimeS,
    pm2: s.pm2,
    logFiles: s.logs.arquivos,
    alerts: s.alertas,
  },
});

const listSince = (desde) => client.healthSnapshot.findMany({
  where: { createdAt: { gte: desde } },
  orderBy: { createdAt: 'asc' },
});

module.exports = { create, listSince };
