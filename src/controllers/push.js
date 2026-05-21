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
const { getClientsByAddressModel, getAllUserCpfsModel } = require("../models/utilities");

const VALID_PUSH_TARGETING_TYPES = ['GLOBAL', 'CLIENTE', 'CIDADE', 'BAIRRO_CIDADE', 'RUA', 'CEP', 'CEP_NUMERO'];
const VALID_PUSH_FILTER_TYPES = ['GERAL', 'CPF', 'CIDADE', 'BAIRRO', 'RUA', 'CEP', 'CEP_NUMERO'];

/**
 * Resolves a targets[] array (same structure as messages) to a deduplicated array of CPF strings.
 */
const resolveTargetsToCpfs = async (targets) => {
  const cpfSet = new Set();
  for (const t of targets) {
    if (t.targeting_type === 'GLOBAL') {
      const cpfs = await getAllUserCpfsModel();
      cpfs.forEach(c => cpfSet.add(String(c)));
    } else if (t.targeting_type === 'CLIENTE') {
      cpfSet.add(String(t.targeting_value));
    } else if (t.targeting_type === 'CIDADE') {
      const cpfs = await getClientsByAddressModel({ cidade: t.targeting_value });
      cpfs.forEach(c => cpfSet.add(String(c)));
    } else if (t.targeting_type === 'BAIRRO_CIDADE') {
      const [bairro, cidade] = t.targeting_value.split(':');
      const cpfs = await getClientsByAddressModel({ bairro, cidade });
      cpfs.forEach(c => cpfSet.add(String(c)));
    } else if (t.targeting_type === 'RUA' || t.targeting_type === 'CEP') {
      const cpfs = await getClientsByAddressModel({ cep: t.targeting_value });
      cpfs.forEach(c => cpfSet.add(String(c)));
    } else if (t.targeting_type === 'CEP_NUMERO') {
      const [cep, numero] = t.targeting_value.split(':');
      const cpfs = await getClientsByAddressModel({ cep, numero });
      cpfs.forEach(c => cpfSet.add(String(c)));
    }
  }
  return Array.from(cpfSet);
};

/**
 * Shared helper: given a list of CPF strings, fetches tokens, creates Notification/UserNotification
 * records and enqueues the push messages.
 * Returns { queued, notificationId } or throws.
 */
const enqueuePushForCpfs = async ({ cpfs, title, body, data }) => {
  const users = await prisma.user.findMany({
    where: { cpf: { in: cpfs.map(String) } },
    select: { id: true },
  });
  const userIds = users.map(u => u.id);
  if (userIds.length === 0) return { queued: 0, notificationId: null };

  const tokens = await getTokensByUserIds(userIds);
  if (tokens.length === 0) return { queued: 0, notificationId: null };

  const note = await createNotification({ title, body, data });
  await createUserNotifications(userIds, note.id);

  const messages = tokens.map(({ token }) => ({
    to: token,
    title,
    body,
    sound: "default",
    data,
  }));
  await pushQueue.add({ messages, notificationId: note.id }, { attempts: 3, backoff: 5000 });

  return { queued: messages.length, notificationId: note.id };
};


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


/**
 * POST /push/send-targeted
 * Sends push notifications to users resolved from a targets[] array.
 * Uses the same targeting_type / targeting_value structure as the messages system.
 * Requires JWT authentication.
 */
async function sendTargetedController(req, res) {
  const { title, body, data, targets } = req.body;

  if (!title || !body) {
    return res.status(400).json({ error: "Os campos title e body são obrigatórios." });
  }
  if (!Array.isArray(targets) || targets.length === 0) {
    return res.status(400).json({ error: "targets deve ser um array não-vazio." });
  }

  for (const t of targets) {
    if (!t.targeting_type || !VALID_PUSH_TARGETING_TYPES.includes(t.targeting_type)) {
      return res.status(400).json({
        error: `targeting_type inválido. Valores aceitos: ${VALID_PUSH_TARGETING_TYPES.join(", ")}.`,
      });
    }
    if (t.targeting_type !== "GLOBAL" && !t.targeting_value) {
      return res.status(400).json({
        error: `targeting_value é obrigatório para o tipo ${t.targeting_type}.`,
      });
    }
    if (t.targeting_type === "BAIRRO_CIDADE" && !t.targeting_value.includes(":")) {
      return res.status(400).json({
        error: 'BAIRRO_CIDADE requer targeting_value no formato "bairro:cidade". Ex: "Icaraí:NITERÓI".',
      });
    }
    if (t.targeting_type === "CEP_NUMERO" && !t.targeting_value.includes(":")) {
      return res.status(400).json({
        error: 'CEP_NUMERO requer targeting_value no formato "cep:numero". Ex: "24220-230:100".',
      });
    }
  }

  try {
    logger.info("Resolvendo targets para push direcionado", { targetsCount: targets.length });
    const cpfs = await resolveTargetsToCpfs(targets);
    logger.info("CPFs resolvidos para push direcionado", { cpfsCount: cpfs.length });

    if (cpfs.length === 0) {
      return res.status(200).json({ success: true, queued: 0, message: "Nenhum cliente encontrado para os targets informados." });
    }

    const { queued, notificationId } = await enqueuePushForCpfs({ cpfs, title, body, data });
    if (queued === 0) {
      return res.status(200).json({ success: true, queued: 0, message: "Nenhum token de push encontrado para os usuários resolvidos." });
    }

    logger.info("Push direcionado enfileirado", { notificationId, queued });
    return res.status(202).json({ success: true, queued, notificationId });
  } catch (err) {
    logger.error("Erro ao enfileirar push direcionado:", err);
    return res.status(500).json({ error: "Erro ao enfileirar notificações." });
  }
}

/**
 * POST /push/send-by-address
 * Sends push notifications to users filtered by address using filter_type.
 * Uses the same filter_type / address-field structure as /messages/{id}/assign-by-address.
 * Requires JWT authentication.
 */
async function sendByAddressController(req, res) {
  const { title, body, data, filter_type, cpfs, cidade, bairro, cep, numero } = req.body;

  if (!title || !body) {
    return res.status(400).json({ error: "Os campos title e body são obrigatórios." });
  }
  if (!filter_type || !VALID_PUSH_FILTER_TYPES.includes(filter_type)) {
    return res.status(400).json({
      error: `filter_type inválido. Valores aceitos: ${VALID_PUSH_FILTER_TYPES.join(", ")}.`,
    });
  }

  if (filter_type === "CPF" && (!Array.isArray(cpfs) || cpfs.length === 0))
    return res.status(400).json({ error: "cpfs deve ser um array não-vazio para filter_type CPF." });
  if (filter_type === "CIDADE" && !cidade)
    return res.status(400).json({ error: "cidade é obrigatório para filter_type CIDADE." });
  if (filter_type === "BAIRRO" && !bairro)
    return res.status(400).json({ error: "bairro é obrigatório para filter_type BAIRRO." });
  if ((filter_type === "CEP" || filter_type === "RUA") && !cep)
    return res.status(400).json({ error: "cep é obrigatório para filter_type CEP/RUA." });
  if (filter_type === "CEP_NUMERO" && (!cep || !numero))
    return res.status(400).json({ error: "cep e numero são obrigatórios para filter_type CEP_NUMERO." });

  try {
    let targetCpfs;

    if (filter_type === "GERAL") {
      targetCpfs = await getAllUserCpfsModel();
    } else if (filter_type === "CPF") {
      targetCpfs = cpfs.map(String);
    } else {
      const params = {};
      if (filter_type === "CIDADE") params.cidade = cidade;
      else if (filter_type === "BAIRRO") { params.bairro = bairro; if (cidade) params.cidade = cidade; }
      else if (filter_type === "CEP" || filter_type === "RUA") params.cep = cep;
      else if (filter_type === "CEP_NUMERO") { params.cep = cep; params.numero = numero; }
      targetCpfs = await getClientsByAddressModel(params);
    }

    logger.info("CPFs resolvidos para push por endereço", { filter_type, cpfsCount: targetCpfs.length });

    if (targetCpfs.length === 0) {
      return res.status(200).json({ success: true, queued: 0, message: "Nenhum cliente encontrado para o filtro informado." });
    }

    const { queued, notificationId } = await enqueuePushForCpfs({ cpfs: targetCpfs, title, body, data });
    if (queued === 0) {
      return res.status(200).json({ success: true, queued: 0, message: "Nenhum token de push encontrado para os usuários resolvidos." });
    }

    logger.info("Push por endereço enfileirado", { notificationId, queued, filter_type });
    return res.status(202).json({ success: true, queued, notificationId });
  } catch (err) {
    logger.error("Erro ao enfileirar push por endereço:", err);
    return res.status(500).json({ error: "Erro ao enfileirar notificações." });
  }
}

module.exports = {
  saveTokenController,
  sendNotificationController,
  sendFilteredNotificationsController,
  webhookController,
  getNotificationsController,
  markReadController,
  sendTargetedController,
  sendByAddressController,
};
