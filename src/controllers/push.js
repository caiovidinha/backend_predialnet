// controllers/push.js

const { savePushToken, getAllTokens, getTokenByUserId, getTokensByUserIds } = require("../models/push");
const pushQueue = require("../queues/pushQueue");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const logger = require("../utils/logger");

const saveTokenController = async (req, res) => {
  const { cpf, token } = req.body;
  if (!cpf || !token) {
    return res.status(400).json({ error: "CPF ou token não fornecido" });
  }

  try {
    await savePushToken(cpf, token);
    return res.status(200).json({ message: "Token salvo com sucesso" });
  } catch (err) {
    logger.error("Erro ao salvar token de push:", err);
    return res.status(500).json({ error: "Erro ao salvar token" });
  }
};

const sendNotificationController = async (req, res) => {
  const { title, body, data, authToken } = req.body;
  if (authToken !== process.env.PUSH_AUTH_TOKEN) {
    return res.status(403).json({ error: "Acesso não autorizado" });
  }

  try {
    const note = await prisma.notification.create({
      data: { title, body, data, status: "pending" }
    });

    const tokens = await getAllTokens();
    const messages = tokens.map(({ token }) => ({
      to: token,
      title,
      body,
      sound: "default",
      data
    }));

    await pushQueue.add(
      { messages, notificationId: note.id },
      { attempts: 3, backoff: 5000 }
    );

    return res.status(202).json({ success: true, queued: messages.length, notificationId: note.id });
  } catch (err) {
    logger.error("Erro ao enfileirar notificações broadcast:", err);
    return res.status(500).json({ error: "Erro ao enfileirar notificações" });
  }
};

const notifyFaturaGerada = async (req, res) => {
  const { cpfs } = req.body;
  if (!Array.isArray(cpfs) || cpfs.length === 0) {
    return res.status(400).json({ error: "Lista de CPFs não fornecida" });
  }

  try {
    const messages = [];

    for (const cpf of cpfs) {
      const user = await prisma.user.findUnique({ where: { cpf } });
      if (!user) {
        logger.warn(`Usuário não encontrado para CPF ${cpf}`);
        continue;
      }

      const tokenEntry = await getTokenByUserId(user.id);
      if (!tokenEntry) {
        logger.warn(`Token não encontrado para usuário ID ${user.id}`);
        continue;
      }

      messages.push({
        to: tokenEntry.token,
        title: "📬 Fatura disponível",
        body: "Sua nova fatura está disponível no app.",
        sound: "default",
        data: { url: "predialnet://fatura" }
      });
    }

    if (messages.length === 0) {
      return res.status(200).json({ success: true, queued: 0 });
    }

    const note = await prisma.notification.create({
      data: {
        title: "📬 Fatura disponível",
        body: "Sua nova fatura está disponível no app.",
        data: { url: "predialnet://fatura" },
        status: "pending"
      }
    });

    await pushQueue.add(
      { messages, notificationId: note.id },
      { attempts: 3, backoff: 5000 }
    );

    return res.status(202).json({
      success: true,
      queued: messages.length,
      notificationId: note.id
    });
  } catch (err) {
    logger.error("Erro ao enfileirar push de fatura gerada:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
};

const notifyFaturaVencida = async (req, res) => {
  const { cpfs } = req.body;
  if (!Array.isArray(cpfs) || cpfs.length === 0) {
    return res.status(400).json({ error: "Lista de CPFs não fornecida" });
  }

  try {
    const messages = [];

    for (const cpf of cpfs) {
      const user = await prisma.user.findUnique({ where: { cpf } });
      if (!user) {
        logger.warn(`Usuário não encontrado para CPF ${cpf}`);
        continue;
      }

      const tokenEntry = await getTokenByUserId(user.id);
      if (!tokenEntry) {
        logger.warn(`Token não encontrado para usuário ID ${user.id}`);
        continue;
      }

      messages.push({
        to: tokenEntry.token,
        title: "💸 Fatura vencida",
        body: "Sua fatura está vencida. Pague agora para evitar bloqueios!",
        sound: "default",
        data: { url: "predialnet://fatura" }
      });
    }

    if (messages.length === 0) {
      return res.status(200).json({ success: true, queued: 0 });
    }

    const note = await prisma.notification.create({
      data: {
        title: "💸 Fatura vencida",
        body: "Sua fatura está vencida. Pague agora para evitar bloqueios!",
        data: { url: "predialnet://fatura" },
        status: "pending"
      }
    });

    await pushQueue.add(
      { messages, notificationId: note.id },
      { attempts: 3, backoff: 5000 }
    );

    return res.status(202).json({
      success: true,
      queued: messages.length,
      notificationId: note.id
    });
  } catch (err) {
    logger.error("Erro ao enfileirar push de fatura vencida:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
};

/**
 * Envia notificações apenas para usuários que batem nos filtros de metadata.
 */
async function sendFilteredNotificationsController(req, res) {
  const { authToken, title, body, data, filters } = req.body;

  if (authToken !== process.env.PUSH_AUTH_TOKEN) {
    return res.status(403).json({ error: "Acesso não autorizado" });
  }
  if (!title || !body || typeof filters !== "object") {
    return res.status(400).json({ error: "Payload inválido" });
  }

  try {
    // 1) Busca na tabela user_metadata
    const whereMeta = {};
    if (filters.hasOpenBill !== undefined) {
      whereMeta.hasOpenBill = filters.hasOpenBill;
    }
    if (filters.addressContains) {
      whereMeta.address = { contains: filters.addressContains };
    }

    const metaRecords = await prisma.userMetadata.findMany({
      where: whereMeta,
      select: { userId: true }
    });
    const userIds = metaRecords.map(m => m.userId);

    if (userIds.length === 0) {
      return res.status(200).json({ success: true, queued: 0 });
    }

    // 2) Carrega tokens desses usuários
    const tokens = await getTokensByUserIds(userIds);
    const messages = tokens.map(({ token }) => ({
      to: token,
      title,
      body,
      sound: "default",
      data
    }));

    if (messages.length === 0) {
      return res.status(200).json({ success: true, queued: 0 });
    }

    // 3) Cria registro de notification
    const note = await prisma.notification.create({
      data: { title, body, data, status: "pending" }
    });

    // 4) Enfileira no worker
    await pushQueue.add(
      { messages, notificationId: note.id },
      { attempts: 3, backoff: 5000 }
    );

    return res.status(202).json({
      success: true,
      queued: messages.length,
      notificationId: note.id
    });
  } catch (err) {
    logger.error("Erro ao enfileirar notificações filtradas:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
}


module.exports = {
  saveTokenController,
  sendNotificationController,
  notifyFaturaGerada,
  notifyFaturaVencida,
  sendFilteredNotificationsController
};
