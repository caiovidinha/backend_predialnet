const { client } = require('../../prisma/client');

const findByUserId = (userId) =>
  client.pushToken.findFirst({ where: { userId } });

const findManyByUserIds = (userIds) =>
  client.pushToken.findMany({ where: { userId: { in: userIds } } });

const findAll = () => client.pushToken.findMany();

const upsert = async (userId, token) => {
  const existing = await client.pushToken.findFirst({ where: { userId } });
  if (existing) {
    return client.pushToken.update({ where: { id: existing.id }, data: { token } });
  }
  return client.pushToken.create({ data: { userId, token } });
};

const deleteByToken = (token) => client.pushToken.delete({ where: { token } });

module.exports = { findByUserId, findManyByUserIds, findAll, upsert, deleteByToken };
