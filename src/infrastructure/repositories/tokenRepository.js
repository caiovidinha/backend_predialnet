const { client } = require('../../prisma/client');
const dayjs = require('dayjs');

const createRefreshToken = (userId) => {
  const expiresIn = dayjs().add(15, 'sec').unix();
  return client.refreshToken.create({ data: { userId, expiresIn } });
};

const deleteRefreshTokensByUser = (userId) =>
  client.refreshToken.deleteMany({ where: { userId } });

const findRefreshToken = (id) =>
  client.refreshToken.findFirst({ where: { id } });

const createPasswordToken = async (userId) => {
  await client.passwordToken.deleteMany({ where: { userId } });
  const expiresIn = new Date();
  expiresIn.setHours(expiresIn.getHours() + 1);
  return client.passwordToken.create({ data: { userId, expiresIn } });
};

const findPasswordToken = (userId) =>
  client.passwordToken.findFirst({ where: { userId } });

module.exports = {
  createRefreshToken,
  deleteRefreshTokensByUser,
  findRefreshToken,
  createPasswordToken,
  findPasswordToken,
};
