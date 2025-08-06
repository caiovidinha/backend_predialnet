// controllers/push.js

const { savePushToken, getAllTokens, getTokensByUserIds } = require("../models/push");
const { createNotification } = require("../models/notifications");
const {
  createMany: createUserNotifications,
  getByUserId,
  markRead
} = require("../models/userNotification");
const pushQueue = require("../queues/pushQueue");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const logger = require("../utils/logger");


/**
 * POST /push/save-token
 */
async function saveTokenController(req, res) {
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
}


/**
 * POST /push/send
 * Broadcast para todos os tokens salvos
 */
async function sendNotificationController(req, res) {
  const { title, body, data, authToken } = req.body;
  if (authToken !== process.env.PUSH_AUTH_TOKEN) {
    return res.status(403).json({ error: "Acesso não autorizado" });
  }

  try {
    const allTokens = await getAllTokens(); // [{ userId, token }, ...]
    if (allTokens.length === 0) {
      logger.info("Nenhum token encontrado para broadcast");
      return res.status(200).json({ success: true, queued: 0 });
    }

    // 1) Cria registro Notification
    const note = await createNotification({ title, body, data });

    // 2) Cria UserNotification (todos unread)
    const userIds = allTokens.map(t => t.userId);
    await createUserNotifications(userIds, note.id);

    // 3) Monta e enfileira mensagens
    const messages = allTokens.map(({ token }) => ({
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

    return res.status(202).json({
      success: true,
      queued: messages.length,
      notificationId: note.id
    });
  } catch (err) {
    logger.error("Erro ao enfileirar notificações broadcast:", err);
    return res.status(500).json({ error: "Erro ao enfileirar notificações" });
  }
}


/**
 * POST /push/send-filtered
 * Envia notificações para usuários filtrados por metadata e/ou lista de CPFs
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
    let idsByCpf = null;
    let idsByMeta = null;

    // filtra por CPFs
    if (Array.isArray(filters.cpfs) && filters.cpfs.length) {
      const users = await prisma.user.findMany({
        where: { cpf: { in: filters.cpfs } },
        select: { id: true }
      });
      idsByCpf = users.map(u => u.id);
    }

    // filtra por metadata
    const hasMeta = filters.hasOpenBill !== undefined || filters.addressContains;
    if (hasMeta) {
      const whereMeta = {};
      if (filters.hasOpenBill !== undefined) {
        whereMeta.hasOpenBill = filters.hasOpenBill;
      }
      if (filters.addressContains) {
        whereMeta.address = { contains: filters.addressContains };
      }
      const metas = await prisma.userMetadata.findMany({
        where: whereMeta,
        select: { userId: true }
      });
      idsByMeta = metas.map(m => m.userId);
    }

    // combinação lógica
    let finalIds = null;
    if (idsByCpf && !hasMeta) {
      finalIds = idsByCpf;
    } else if (idsByCpf && idsByMeta) {
      const set = new Set(idsByCpf);
      finalIds = idsByMeta.filter(id => set.has(id));
    } else {
      finalIds = idsByMeta;
    }

    if (!finalIds || finalIds.length === 0) {
      return res.status(200).json({ success: true, queued: 0 });
    }

    // tokens e usuário
    const tokens = await getTokensByUserIds(finalIds);
    if (tokens.length === 0) {
      return res.status(200).json({ success: true, queued: 0 });
    }

    // cria registro Notification + vincula UserNotification
    const note = await createNotification({ title, body, data });
    await createUserNotifications(finalIds, note.id);

    // monta/enfileira
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


/**
 * POST /push/webhook
 * Webhook genérico para fatura-gerada / fatura-vencida
 */
async function webhookController(req, res) {
  const { eventType, cpfs, authToken } = req.body;
  if (authToken !== process.env.PUSH_AUTH_TOKEN) {
    return res.status(403).json({ error: "Acesso não autorizado" });
  }
  if (!eventType || !Array.isArray(cpfs) || cpfs.length === 0) {
    return res.status(400).json({ error: "eventType ou lista de CPFs não fornecida" });
  }

  let title, message, urlPath;
  switch (eventType) {
    case "fatura-gerada":
      title = "Fatura disponível";
      message = "Sua fatura já está disponível no app para pagamento.";
      urlPath = "predialnet://fatura";
      break;
    case "fatura-vencida":
      title = "Fatura vencida";
      message = "Sua fatura está vencida. Pague agora para evitar bloqueios!";
      urlPath = "predialnet://fatura";
      break;
    default:
      return res.status(400).json({ error: `eventType inválido: ${eventType}` });
  }

  try {
    // busca usuários
    const users = await prisma.user.findMany({
      where: { cpf: { in: cpfs } },
      select: { id: true, cpf: true }
    });
    const validIds = users.map(u => u.id);
    if (validIds.length === 0) {
      return res.status(200).json({ success: true, queued: 0 });
    }

    // busca tokens
    const tokens = await getTokensByUserIds(validIds);
    if (tokens.length === 0) {
      return res.status(200).json({ success: true, queued: 0 });
    }

    // cria registro + vincula leitura
    const note = await createNotification({ title, body: message, data: { url: urlPath } });
    await createUserNotifications(validIds, note.id);

    // monta/enfileira
    const messages = tokens.map(({ token }) => ({
      to: token,
      title,
      body: message,
      sound: "default",
      data: { url: urlPath }
    }));
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
    logger.error(`Erro ao processar webhook ${eventType}:`, err);
    return res.status(500).json({ error: "Erro interno" });
  }
}


/**
 * GET /push/notifications/:cpf
 * Lista notificações (com status de leitura) de um usuário
 */
async function getNotificationsController(req, res) {
  const { cpf } = req.params;
  if (!cpf) {
    return res.status(400).json({ error: "CPF não fornecido" });
  }
  try {
    const user = await prisma.user.findUnique({ where: { cpf } });
    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    const items = await getByUserId(user.id);
    const list = items.map(i => ({
      id: i.id,
      title: i.notification.title,
      body: i.notification.body,
      data: i.notification.data,
      createdAt: i.notification.createdAt,
      read: i.read,
      readAt: i.readAt
    }));

    return res.status(200).json({ notifications: list });
  } catch (err) {
    logger.error("Erro ao buscar notificações:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
}


/**
 * PATCH /push/notifications/:id/read
 * Marca uma notificação como lida / não lida
 */
async function markReadController(req, res) {
  const { id } = req.params;
  const { read } = req.body;
  if (typeof read !== "boolean") {
    return res.status(400).json({ error: "Campo 'read' deve ser booleano" });
  }
  try {
    const updated = await markRead(id, read);
    return res.status(200).json({
      id: updated.id,
      read: updated.read,
      readAt: updated.readAt
    });
  } catch (err) {
    logger.error("Erro ao atualizar status de leitura:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
}


module.exports = {
  saveTokenController,
  sendNotificationController,
  sendFilteredNotificationsController,
  webhookController,
  getNotificationsController,
  markReadController
};
