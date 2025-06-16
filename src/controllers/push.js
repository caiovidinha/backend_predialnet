const { savePushToken, getAllTokens, getTokenByUserId } = require("../models/push");
const { sendPushNotifications } = require("../services/expoPushService");
const { getPixFromLastOpenInternetInvoice } = require("../models/fatura"); // já existente

const saveTokenController = async (req, res) => {
  const { userId } = req;
  const { token } = req.body;

  if (!token) return res.status(400).json({ error: "Token não fornecido" });

  try {
    await savePushToken(userId, token);
    return res.status(200).json({ message: "Token salvo com sucesso" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao salvar token" });
  }
};

const sendNotificationController = async (req, res) => {
  const { title, body, data } = req.body;

  try {
    const tokens = await getAllTokens();
    const messages = tokens.map(({ token }) => ({
      to: token,
      title,
      body,
      sound: "default",
      data,
    }));

    const response = await sendPushNotifications(messages);
    return res.status(200).json(response);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao enviar notificações" });
  }
};

// webhook: fatura gerada
const notifyFaturaGerada = async (req, res) => {
  const { userId } = req.body;

  try {
    const token = await getTokenByUserId(userId);
    if (!token) return res.status(404).json({ error: "Token não encontrado" });

    const response = await sendPushNotifications([
      {
        to: token.token,
        title: "📬 Fatura disponível",
        body: "Sua nova fatura está disponível no app.",
        sound: "default",
      },
    ]);

    return res.status(200).json(response);
  } catch (err) {
    console.error("Erro ao enviar push da fatura:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
};

// segmentado: quem tem fatura em aberto
const notifyUsersWithOpenInvoice = async (req, res) => {
  try {
    const users = await client.user.findMany();
    const messages = [];

    for (const user of users) {
      const fatura = await getPixFromLastOpenInternetInvoice(user.id);
      if (fatura && fatura.pix) {
        const token = await getTokenByUserId(user.id);
        if (token) {
          messages.push({
            to: token.token,
            title: "💸 Fatura em aberto",
            body: "Pague sua fatura para evitar o corte!",
            sound: "default",
          });
        }
      }
    }

    const response = await sendPushNotifications(messages);
    return res.status(200).json({ success: true, count: messages.length, response });
  } catch (err) {
    console.error("Erro no disparo segmentado:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
};

module.exports = {
  saveTokenController,
  sendNotificationController,
  notifyFaturaGerada,
  notifyUsersWithOpenInvoice,
};
