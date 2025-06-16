const { client } = require("../prisma/client");

const savePushToken = async (userId, token) => {
  const existing = await client.pushToken.findFirst({
    where: { userId },
  });

  if (existing) {
    return client.pushToken.update({
      where: { id: existing.id },
      data: { token },
    });
  }

  return client.pushToken.create({
    data: { userId, token },
  });
};

const getAllTokens = async () => {
  return client.pushToken.findMany();
};

const getTokenByUserId = async (userId) => {
  return client.pushToken.findUnique({
    where: { userId },
  });
};

module.exports = {
  savePushToken,
  getAllTokens,
  getTokenByUserId,
};
