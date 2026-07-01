const { client } = require('../../prisma/client');

const createMany = (userIds, notificationId) =>
  client.userNotification.createMany({
    data: userIds.map(userId => ({ userId, notificationId, read: false })),
  });

const findByUserId = (userId) =>
  client.userNotification.findMany({
    where: { userId },
    include: { notification: true },
    orderBy: { createdAt: 'desc' },
  });

const markRead = (id, read) =>
  client.userNotification.update({
    where: { id },
    data: { read, readAt: read ? new Date() : null },
  });

module.exports = { createMany, findByUserId, markRead };
