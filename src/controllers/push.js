// controllers/push.js

const { savePushToken, getAllTokens, getTokensByUserIds } = require("../models/push");
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



async function webhookController(req, res) {
  const { eventType, cpfs } = req.body;
  if (!eventType || !Array.isArray(cpfs) || cpfs.length === 0) {
    return res.status(400).json({ error: "eventType ou lista de CPFs não fornecida" });
  }

  // Define conteúdo da notificação
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

    // 2) Buscar tokens dos usuários válidos
    const userIds = users.map(u => u.id);
    const tokens = await getTokensByUserIds(userIds);
    const tokenMap = new Map(tokens.map(t => [t.userId, t.token]));

    // 3) Montar mensagens
    const messages = users
      .map(({ id: userId, cpf }) => {
        const token = tokenMap.get(userId);
        if (!token) {
          logger.warn(`Token não encontrado para CPF ${cpf} (usuário ${userId})`);
          return null;
        }
        return {
          to: token,
          title,
          body: message,
          sound: "default",
          data: { url: urlPath }
        };
      })
      .filter(Boolean);

    if (messages.length === 0) {
      return res.status(200).json({ success: true, queued: 0 });
    }

    // 4) Criar registro de notificação
    const note = await prisma.notification.create({
      data: {
        title,
        body: message,
        data: { url: urlPath },
        status: "pending"
      }
    });

    // 5) Enfileirar no worker
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
    let userIdsFromCpfs = null;
    let userIdsFromMeta = null;

    // 1) Filtra por CPF se informado
    if (Array.isArray(filters.cpfs) && filters.cpfs.length > 0) {
      const users = await prisma.user.findMany({
        where: { cpf: { in: filters.cpfs } },
        select: { id: true }
      });
      userIdsFromCpfs = users.map((u) => u.id);
    }
    logger.info(`Usuários filtrados por CPF: ${userIdsFromCpfs ? userIdsFromCpfs : 0}`);

    // 2) Filtra por metadata se informado
    const hasOtherFilters = filters.hasOpenBill !== undefined || filters.addressContains;
    if (hasOtherFilters) {
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
      userIdsFromMeta = metaRecords.map((m) => m.userId);
    }

    // 3) Combina os filtros
    let finalUserIds = null;
    
    // Se só tiver filtro de CPF, usa direto a lista de IDs dos CPFs
    if (userIdsFromCpfs && !hasOtherFilters) {
      finalUserIds = userIdsFromCpfs;
    } 
    // Se tiver ambos os filtros, faz a interseção
    else if (userIdsFromCpfs && userIdsFromMeta) {
      const set = new Set(userIdsFromCpfs);
      finalUserIds = userIdsFromMeta.filter((id) => set.has(id));
    } 
    // Se só tiver filtro de metadata, usa a lista de IDs da metadata
    else {
      finalUserIds = userIdsFromMeta;
    }

    if (!finalUserIds || finalUserIds.length === 0) {
      return res.status(200).json({ success: true, queued: 0 });
    }

    // 4) Busca tokens
    const tokens = await getTokensByUserIds(finalUserIds);
    logger.info(`Tokens encontrados: ${tokens.length}`);
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

    // 5) Cria notificação
    const note = await prisma.notification.create({
      data: { title, body, data, status: "pending" }
    });

    // 6) Enfileira
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
  webhookController,
  sendFilteredNotificationsController
};
