const { client } = require('../../prisma/client');

const create = (data) => client.speedTest.create({ data });

const findById = (id) => client.speedTest.findUnique({ where: { id } });

const buildWhere = ({ cpf, userId, status, from, to } = {}) => {
  const where = {};
  if (cpf) where.cpf = String(cpf);
  if (userId) where.userId = String(userId);
  if (status) where.status = status;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = from;
    if (to) where.createdAt.lte = to;
  }
  return where;
};

const list = async ({ page = 1, limit = 20, cpf, userId, status, from, to } = {}) => {
  const where = buildWhere({ cpf, userId, status, from, to });
  const [items, total] = await Promise.all([
    client.speedTest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    client.speedTest.count({ where }),
  ]);
  return { items, total, page, limit };
};

// Estatísticas agregadas de um cliente (por CPF) para a visão do operador.
const summaryByCpf = async (cpf) => {
  const where = { cpf: String(cpf), status: 'completed' };
  const [agg, count, last] = await Promise.all([
    client.speedTest.aggregate({
      where,
      _avg: { downloadMbps: true, uploadMbps: true, pingMs: true, jitterMs: true },
      _max: { downloadMbps: true, uploadMbps: true },
      _min: { downloadMbps: true, uploadMbps: true, pingMs: true },
    }),
    client.speedTest.count({ where: { cpf: String(cpf) } }),
    client.speedTest.findFirst({
      where: { cpf: String(cpf) },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  return { agg, count, last };
};

module.exports = { create, findById, list, summaryByCpf };
