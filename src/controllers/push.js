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

  // 1) Autorização
  if (authToken !== process.env.PUSH_AUTH_TOKEN) {
    return res.status(403).json({ error: "Acesso não autorizado" });
  }

  try {
    // 2) Cria o registro da notificação
    const note = await prisma.notification.create({
      data: { title, body, data, status: "pending" }
    });

    // 3) Busca todos os tokens
    const tokens = await getAllTokens();

    // 4) Se não houver nenhum token, retornamos sem enfileirar
    if (!tokens.length) {
      logger.info("Nenhum token encontrado para broadcast");
      return res.status(200).json({ success: true, queued: 0, notificationId: note.id });
    }

    // 5) Monta as mensagens
    const messages = tokens.map(({ token }) => ({
      to: token,
      title,
      body,
      sound: "default",
      data
    }));

    // 6) Enfileira no worker
    await pushQueue.add(
      { messages, notificationId: note.id },
      { attempts: 3, backoff: 5000 }
    );

    // 7) Retorna sucesso de enfileiramento
    return res.status(202).json({
      success: true,
      queued: messages.length,
      notificationId: note.id
    });

  } catch (err) {
    logger.error("Erro ao enfileirar notificações broadcast:", err);
    return res.status(500).json({ error: "Erro ao enfileirar notificações" });
  }
};



async function notifyFaturaGerada(req, res) {
  const { cpfs } = req.body;
  if (!Array.isArray(cpfs) || cpfs.length === 0) {
    return res.status(400).json({ error: "Lista de CPFs não fornecida" });
  }

  try {
    // 1) Buscar em lote os usuários que existem
    const users = await prisma.user.findMany({
      where: { cpf: { in: cpfs } },
      select: { id: true, cpf: true }
    });
    const foundCpfs = users.map(u => u.cpf);
    const missing = cpfs.filter(c => !foundCpfs.includes(c));
    if (missing.length) {
      logger.warn(`Usuários não encontrados para CPFs: ${missing.join(", ")}`);
    }

    if (users.length === 0) {
      return res.status(200).json({ success: true, queued: 0 });
    }

    // 2) Buscar em lote tokens dos usuários válidos
    const userIds = users.map(u => u.id);
    const tokens = await getTokensByUserIds(userIds);
    const tokenMap = new Map(tokens.map(t => [t.userId, t.token]));

    // 3) Montar mensagens somente para quem tem token
    const messages = [];
    for (const { id: userId, cpf } of users) {
      const token = tokenMap.get(userId);
      if (!token) {
        logger.warn(`Token não encontrado para CPF ${cpf} (usuário ${userId})`);
        continue;
      }
      messages.push({
        to: token,
        title: "Fatura disponível",
        body: "Sua fatura já está disponível no app para pagamento.",
        sound: "default",
        data: { url: "predialnet://fatura" }
      });
    }

    // 4) Se não houver mensagens, encerra
    if (messages.length === 0) {
      return res.status(200).json({ success: true, queued: 0 });
    }

    // 5) Criar registro e enfileirar
    const note = await prisma.notification.create({
      data: {
        title: "Fatura disponível",
        body: "Sua fatura já está disponível no app para pagamento.",
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
}

async function notifyFaturaVencida(req, res) {
  const { cpfs } = req.body;
  if (!Array.isArray(cpfs) || cpfs.length === 0) {
    return res.status(400).json({ error: "Lista de CPFs não fornecida" });
  }

  try {
    // 1) Buscar usuários existentes
    const users = await prisma.user.findMany({
      where: { cpf: { in: cpfs } },
      select: { id: true, cpf: true }
    });
    const foundCpfs = users.map(u => u.cpf);
    const missing = cpfs.filter(c => !foundCpfs.includes(c));
    if (missing.length) {
      logger.warn(`Usuários não encontrados para CPFs: ${missing.join(", ")}`);
    }
    if (users.length === 0) {
      return res.status(200).json({ success: true, queued: 0 });
    }

    // 2) Buscar tokens
    const userIds = users.map(u => u.id);
    const tokens = await getTokensByUserIds(userIds);
    const tokenMap = new Map(tokens.map(t => [t.userId, t.token]));

    // 3) Montar mensagens
    const messages = [];
    for (const { id: userId, cpf } of users) {
      const token = tokenMap.get(userId);
      if (!token) {
        logger.warn(`Token não encontrado para CPF ${cpf} (usuário ${userId})`);
        continue;
      }
      messages.push({
        to: token,
        title: "Fatura vencida",
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
        title: "Fatura vencida",
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
}

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
