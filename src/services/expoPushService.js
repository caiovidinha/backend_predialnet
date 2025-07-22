// services/expoPushService.js
const { Expo } = require("expo-server-sdk");

const expo = new Expo();

/**
 * Dispara push notifications usando o Expo.
 * @param {Array} messages Lista de mensagens no formato:
 *  { to, title, body, data?, sound? }
 * @returns {Promise<Array>} tickets retornados pelo Expo
 */
const sendPushNotifications = async (messages) => {
  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];

  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (error) {
      console.error("Erro ao enviar chunk de push:", chunk, error);
    }
  }

  return tickets;
};

/**
 * Busca os receipts detalhados para um array de ticketIds.
 * @param {string[]} ticketIds
 * @returns {Promise<Object>} mapeamento ticketId → receipt
 */
const getPushNotificationReceipts = async (ticketIds) => {
  try {
    const receipts = await expo.getPushNotificationReceiptsAsync(ticketIds);
    return receipts;
  } catch (error) {
    console.error("Erro ao buscar receipts do Expo:", error);
    return {};
  }
};

module.exports = {
  sendPushNotifications,
  getPushNotificationReceipts,
};
