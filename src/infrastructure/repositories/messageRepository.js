const { client } = require('../../prisma/client');

const PRIORITY_ORDER = ['CLIENTE', 'CEP_NUMERO', 'CEP', 'RUA', 'BAIRRO_CIDADE', 'CIDADE', 'GLOBAL'];

const create = ({ title, msg_cliente, timeout_sec = 10, targets = [] }) =>
  client.appMessage.create({
    data: {
      title, msg_cliente, timeout_sec,
      targets: {
        create: targets.map(t => ({
          targeting_type: t.targeting_type,
          targeting_value: t.targeting_type === 'GLOBAL' ? '*' : (t.targeting_value ?? '*'),
        })),
      },
    },
    include: { targets: true },
  });

const list = async ({ page = 1, limit = 20, includeInactive = false } = {}) => {
  const where = { deleted_at: null, ...(includeInactive ? {} : { active: true }) };
  const [items, total] = await Promise.all([
    client.appMessage.findMany({
      where, include: { targets: true },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit, take: limit,
    }),
    client.appMessage.count({ where }),
  ]);
  return { items, total, page, limit };
};

const findById = (id) =>
  client.appMessage.findFirst({ where: { id, deleted_at: null }, include: { targets: true } });

const update = (id, data) =>
  client.appMessage.update({ where: { id }, data, include: { targets: true } });

const softDelete = (id) =>
  client.appMessage.update({ where: { id }, data: { deleted_at: new Date(), active: false } });

const addTarget = (messageId, { targeting_type, targeting_value = '*' }) =>
  client.appMessageTarget.create({
    data: {
      messageId, targeting_type,
      targeting_value: targeting_type === 'GLOBAL' ? '*' : targeting_value,
    },
  });

const removeTarget = (targetId) =>
  client.appMessageTarget.delete({ where: { id: targetId } });

const findForClient = async ({ cpf, addr }) => {
  const orConditions = [
    { targeting_type: 'GLOBAL' },
    { targeting_type: 'CLIENTE', targeting_value: String(cpf) },
  ];
  if (addr?.cidade) orConditions.push({ targeting_type: 'CIDADE', targeting_value: addr.cidade });
  if (addr?.bairro && addr?.cidade)
    orConditions.push({ targeting_type: 'BAIRRO_CIDADE', targeting_value: `${addr.bairro}:${addr.cidade}` });
  if (addr?.cep) {
    orConditions.push({ targeting_type: 'CEP', targeting_value: addr.cep });
    orConditions.push({ targeting_type: 'RUA', targeting_value: addr.cep });
  }
  if (addr?.cep && addr?.numero)
    orConditions.push({ targeting_type: 'CEP_NUMERO', targeting_value: `${addr.cep}:${addr.numero}` });

  return client.appMessage.findMany({
    where: { active: true, deleted_at: null, targets: { some: { OR: orConditions } } },
    include: { targets: true },
  });
};

module.exports = { create, list, findById, update, softDelete, addTarget, removeTarget, findForClient, PRIORITY_ORDER };
