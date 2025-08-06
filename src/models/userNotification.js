const { client } = require("../prisma/client");

/**
 * Cria vários registros user-notification (inicialmente all unread).
 * @param {string[]} userIds
 * @param {string} notificationId
 */
async function createMany(userIds, notificationId) {
  const data = userIds.map(userId => ({
    userId,
    notificationId,
    read: false
  }));
  return client.userNotification.createMany({ data });
}

/**
 * Busca notificações de um usuário, já incluindo o payload.
 * @param {string} userId
 */
async function getByUserId(userId) {
  return client.userNotification.findMany({
    where: { userId },
    include: { notification: true },
    orderBy: { createdAt: "desc" }
  });
}

/**
 * Marca uma notificação como lida ou não lida.
 * @param {string} id – id do UserNotification
 * @param {boolean} read
 */
async function markRead(id, read) {
  return client.userNotification.update({
    where: { id },
    data: { read, readAt: read ? new Date() : null }
  });
}

module.exports = {
  createMany,
  getByUserId,
  markRead
};
