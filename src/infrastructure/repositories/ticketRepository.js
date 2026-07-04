const { client } = require('../../prisma/client');

const create = (data) => client.ticket.create({ data });

const buildWhere = ({ status, priority, assignee, cpf, q } = {}) => {
  const where = { deleted_at: null };
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (assignee) where.assignee = assignee;
  if (cpf) where.cpf = String(cpf);
  if (q) {
    where.OR = [
      { subject: { contains: q } },
      { description: { contains: q } },
      { requesterName: { contains: q } },
      { requesterEmail: { contains: q } },
    ];
  }
  return where;
};

const list = async ({ page = 1, limit = 20, ...filters } = {}) => {
  const where = buildWhere(filters);
  const [items, total] = await Promise.all([
    client.ticket.findMany({
      where,
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    client.ticket.count({ where }),
  ]);
  return { items, total, page, limit };
};

// Todos os tickets ativos (para montar o board kanban no serviço).
const findAllActive = () =>
  client.ticket.findMany({
    where: { deleted_at: null },
    orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
  });

const findById = (id) =>
  client.ticket.findFirst({
    where: { id, deleted_at: null },
    include: { comments: { orderBy: { createdAt: 'asc' } } },
  });

const update = (id, data) => client.ticket.update({ where: { id }, data });

const softDelete = (id) =>
  client.ticket.update({ where: { id }, data: { deleted_at: new Date() } });

const addComment = (ticketId, { author, body, internal = false }) =>
  client.ticketComment.create({ data: { ticketId, author, body, internal } });

module.exports = { create, list, findAllActive, findById, update, softDelete, addComment };
