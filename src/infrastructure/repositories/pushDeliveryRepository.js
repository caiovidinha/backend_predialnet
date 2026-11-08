const { client } = require('../../prisma/client');

const createMany = (rows) =>
  client.pushDelivery.createMany({ data: rows.map(r => ({ ...r, status: 'pending' })) });

const markSentBulk = (notificationId, tokens) =>
  client.pushDelivery.updateMany({
    where: { notificationId, token: { in: tokens } },
    data: { status: 'sent', sentAt: new Date() },
  });

const markFailedBulk = (notificationId, tokens, errorCode) =>
  client.pushDelivery.updateMany({
    where: { notificationId, token: { in: tokens } },
    data: { status: 'failed', errorCode, sentAt: new Date() },
  });

const markDeliveredBulkByTicket = (ticketIds) =>
  client.pushDelivery.updateMany({
    where: { ticketId: { in: ticketIds } },
    data: { status: 'delivered', deliveredAt: new Date() },
  });

const markFailedBulkByTicket = (ticketIds, errorCode) =>
  client.pushDelivery.updateMany({
    where: { ticketId: { in: ticketIds } },
    data: { status: 'failed', errorCode },
  });

const markAllPendingFailed = (notificationId) =>
  client.pushDelivery.updateMany({
    where: { notificationId, status: 'pending' },
    data: { status: 'failed', errorCode: 'job failed' },
  });

const markOpenedByUser = (notificationId, userId) =>
  client.pushDelivery.updateMany({ where: { notificationId, userId }, data: { openedAt: new Date() } });

const aggregateForNotification = async (notificationId) => {
  const porStatus = await client.pushDelivery.groupBy({ by: ['status'], where: { notificationId }, _count: true });
  const abertos = await client.pushDelivery.count({ where: { notificationId, openedAt: { not: null } } });
  const base = { pending: 0, sent: 0, delivered: 0, failed: 0, opened: abertos };
  porStatus.forEach(r => { base[r.status] = r._count; });
  return base;
};

const listByNotification = (notificationId, { skip, take, status }) =>
  client.pushDelivery.findMany({
    where: { notificationId, ...(status ? { status } : {}) },
    include: { user: { select: { cpf: true } } },
    orderBy: { createdAt: 'asc' },
    skip,
    take,
  });

const countByNotification = (notificationId, { status }) =>
  client.pushDelivery.count({ where: { notificationId, ...(status ? { status } : {}) } });

module.exports = {
  createMany,
  markSentBulk,
  markFailedBulk,
  markDeliveredBulkByTicket,
  markFailedBulkByTicket,
  markAllPendingFailed,
  markOpenedByUser,
  aggregateForNotification,
  listByNotification,
  countByNotification,
};
