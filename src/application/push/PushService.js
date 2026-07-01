const { client } = require('../../prisma/client');
const pushTokenRepo = require('../../infrastructure/repositories/pushTokenRepository');
const notificationRepo = require('../../infrastructure/repositories/notificationRepository');
const userNotifRepo = require('../../infrastructure/repositories/userNotificationRepository');
const pushQueue = require('../../queues/pushQueue');
const { getAllUserCpfs, getClientsByAddress } = require('../utilities/UtilitiesService');
const logger = require('../../utils/logger');

const VALID_TARGETING_TYPES = ['GLOBAL', 'CLIENTE', 'CIDADE', 'BAIRRO_CIDADE', 'RUA', 'CEP', 'CEP_NUMERO'];
const VALID_FILTER_TYPES = ['GERAL', 'CPF', 'CIDADE', 'BAIRRO', 'RUA', 'CEP', 'CEP_NUMERO'];

async function _enqueuePushForCpfs({ cpfs, title, body, data }) {
  const users = await client.user.findMany({
    where: { cpf: { in: cpfs.map(String) } },
    select: { id: true },
  });
  const userIds = users.map(u => u.id);
  if (!userIds.length) return { queued: 0, notificationId: null };

  const tokens = await pushTokenRepo.findManyByUserIds(userIds);
  if (!tokens.length) return { queued: 0, notificationId: null };

  const note = await notificationRepo.create({ title, body, data });
  await userNotifRepo.createMany(userIds, note.id);

  const messages = tokens.map(({ token }) => ({ to: token, title, body, sound: 'default', data }));
  await pushQueue.add({ messages, notificationId: note.id }, { attempts: 3, backoff: 5000 });
  return { queued: messages.length, notificationId: note.id };
}

async function _resolveTargetsToCpfs(targets) {
  const cpfSet = new Set();
  for (const t of targets) {
    let cpfs = [];
    if (t.targeting_type === 'GLOBAL') cpfs = await getAllUserCpfs();
    else if (t.targeting_type === 'CLIENTE') cpfs = [t.targeting_value];
    else if (t.targeting_type === 'CIDADE') cpfs = await getClientsByAddress({ cidade: t.targeting_value });
    else if (t.targeting_type === 'BAIRRO_CIDADE') {
      const [bairro, cidade] = t.targeting_value.split(':');
      cpfs = await getClientsByAddress({ bairro, cidade });
    } else if (t.targeting_type === 'RUA' || t.targeting_type === 'CEP') {
      cpfs = await getClientsByAddress({ cep: t.targeting_value });
    } else if (t.targeting_type === 'CEP_NUMERO') {
      const [cep, numero] = t.targeting_value.split(':');
      cpfs = await getClientsByAddress({ cep, numero });
    }
    cpfs.forEach(c => cpfSet.add(String(c)));
  }
  return Array.from(cpfSet);
}

const savePushToken = async (cpf, token) => {
  const user = await client.user.findUnique({ where: { cpf } });
  if (!user) throw new Error('Usuário não encontrado para o CPF fornecido');
  return pushTokenRepo.upsert(user.id, token);
};

const getNotifications = async (cpf) => {
  const user = await client.user.findUnique({ where: { cpf } });
  if (!user) throw new Error('Usuário não encontrado');
  const items = await userNotifRepo.findByUserId(user.id);
  return items.map(i => ({
    id: i.id,
    title: i.notification.title,
    body: i.notification.body,
    data: i.notification.data,
    createdAt: i.notification.createdAt,
    read: i.read,
    readAt: i.readAt,
  }));
};

const markNotificationRead = (id, read) => userNotifRepo.markRead(id, read);

const sendBroadcast = async ({ title, body, data }) => {
  const allTokens = await pushTokenRepo.findAll();
  if (!allTokens.length) return { queued: 0 };

  const note = await notificationRepo.create({ title, body, data });
  const userIds = allTokens.map(t => t.userId);
  await userNotifRepo.createMany(userIds, note.id);

  const messages = allTokens.map(({ token }) => ({ to: token, title, body, sound: 'default', data }));
  await pushQueue.add({ messages, notificationId: note.id }, { attempts: 3, backoff: 5000 });
  return { queued: messages.length, notificationId: note.id };
};

const sendFiltered = async ({ title, body, data, filters }) => {
  let idsByCpf = null, idsByMeta = null;

  if (Array.isArray(filters.cpfs) && filters.cpfs.length) {
    const users = await client.user.findMany({ where: { cpf: { in: filters.cpfs } }, select: { id: true } });
    idsByCpf = users.map(u => u.id);
  }

  const hasMeta = filters.hasOpenBill !== undefined || filters.addressContains;
  if (hasMeta) {
    const where = {};
    if (filters.hasOpenBill !== undefined) where.hasOpenBill = filters.hasOpenBill;
    if (filters.addressContains) where.address = { contains: filters.addressContains };
    const metas = await client.userMetadata.findMany({ where, select: { userId: true } });
    idsByMeta = metas.map(m => m.userId);
  }

  let finalIds = idsByCpf && !hasMeta ? idsByCpf
    : idsByCpf && idsByMeta ? idsByMeta.filter(id => new Set(idsByCpf).has(id))
    : idsByMeta;

  if (!finalIds?.length) return { queued: 0 };

  const tokens = await pushTokenRepo.findManyByUserIds(finalIds);
  if (!tokens.length) return { queued: 0 };

  const note = await notificationRepo.create({ title, body, data });
  await userNotifRepo.createMany(finalIds, note.id);

  const messages = tokens.map(({ token }) => ({ to: token, title, body, sound: 'default', data }));
  await pushQueue.add({ messages, notificationId: note.id }, { attempts: 3, backoff: 5000 });
  return { queued: messages.length, notificationId: note.id };
};

const sendTargeted = async ({ title, body, data, targets }) => {
  const cpfs = await _resolveTargetsToCpfs(targets);
  if (!cpfs.length) return { queued: 0 };
  return _enqueuePushForCpfs({ cpfs, title, body, data });
};

const sendByAddress = async ({ title, body, data, filter_type, cpfs, cidade, bairro, cep, numero }) => {
  let targetCpfs;
  if (filter_type === 'GERAL') targetCpfs = await getAllUserCpfs();
  else if (filter_type === 'CPF') targetCpfs = cpfs.map(String);
  else {
    const params = {};
    if (filter_type === 'CIDADE') params.cidade = cidade;
    else if (filter_type === 'BAIRRO') { params.bairro = bairro; if (cidade) params.cidade = cidade; }
    else if (filter_type === 'CEP' || filter_type === 'RUA') params.cep = cep;
    else if (filter_type === 'CEP_NUMERO') { params.cep = cep; params.numero = numero; }
    targetCpfs = await getClientsByAddress(params);
  }
  if (!targetCpfs.length) return { queued: 0 };
  return _enqueuePushForCpfs({ cpfs: targetCpfs, title, body, data });
};

const processWebhook = async ({ eventType, cpfs }) => {
  const events = {
    'fatura-gerada': { title: 'Fatura disponível', body: 'Sua fatura já está disponível no app para pagamento.', url: 'predialnet://fatura' },
    'fatura-vencida': { title: 'Fatura vencida', body: 'Sua fatura está vencida. Pague agora para evitar bloqueios!', url: 'predialnet://fatura' },
  };
  const ev = events[eventType];
  if (!ev) throw new Error(`eventType inválido: ${eventType}`);
  return _enqueuePushForCpfs({ cpfs, title: ev.title, body: ev.body, data: { url: ev.url } });
};

module.exports = {
  savePushToken,
  getNotifications,
  markNotificationRead,
  sendBroadcast,
  sendFiltered,
  sendTargeted,
  sendByAddress,
  processWebhook,
  VALID_TARGETING_TYPES,
  VALID_FILTER_TYPES,
};
