const { Expo } = require("expo-server-sdk");

const expo = new Expo();

/**
 * Dispara push notifications usando o Expo.
 * @param {Array} messages Lista de mensagens no formato:
 *  { to, title, body, data?, sound? }
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

module.exports = {
  sendPushNotifications,
};
