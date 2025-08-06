const { client } = require("../prisma/client");

/**
 * Cria um registro de notificação genérico.
 * @param {{ title: string, body?: string, data?: object }} payload
 * @returns {Promise<Notification>}
 */
async function createNotification({ title, body, data }) {
  return client.notification.create({
    data: {
      title,
      body,
      data,
      status: "pending",
      tokens: 0,
      receipts: {}
    }
  });
}

/**
 * Atualiza quantos tokens/process attempts já tentamos enviar.
 */
async function incrementTokensCount(notificationId, count = 1) {
  return client.notification.update({
    where: { id: notificationId },
    data: { tokens: { increment: count } }
  });
}

/**
 * Grava os receipts (tickets do Expo) depois que o worker processar a fila.
 */
async function updateReceipts(notificationId, receiptsArray) {
  return client.notification.update({
    where: { id: notificationId },
    data: { receipts: receiptsArray, status: "sent" }
  });
}

module.exports = {
  createNotification,
  incrementTokensCount,
  updateReceipts
};