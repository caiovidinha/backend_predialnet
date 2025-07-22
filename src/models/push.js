const { client } = require("../prisma/client");

/**
 * Salva ou atualiza o token de push de um usuário.
 */
const savePushToken = async (cpf, token) => {
  // 1) Encontrar o usuário pelo CPF
  const user = await client.user.findUnique({
    where: { cpf }
  });
  if (!user) {
    throw new Error("Usuário não encontrado para o CPF fornecido");
  }
  const userId = user.id;

  // 2) Verificar se já existe um token para esse userId
  const existing = await client.pushToken.findFirst({
    where: { userId },
  });

  if (existing) {
    return client.pushToken.update({
      where: { id: existing.id },
      data: { token },
    });
  }

  // 3) Criar novo registro
  return client.pushToken.create({
    data: { userId, token },
  });
};

/**
 * Retorna todos os tokens de push.
 */
const getAllTokens = async () => {
  return client.pushToken.findMany();
};

/**
 * Retorna o token de push de um usuário específico.
 */
const getTokenByUserId = async (userId) => {
  return client.pushToken.findFirst({
    where: { userId },
  });
};

/**
 * Retorna os tokens de push de uma lista de usuários.
 */
const getTokensByUserIds = async (userIds) => {
  return client.pushToken.findMany({
    where: { userId: { in: userIds } },
  });
};

/**
 * Remove um token de push inválido.
 */
const deletePushToken = async (tokenValue) => {
  return client.pushToken.delete({
    where: { token: tokenValue },
  });
};

module.exports = {
  savePushToken,
  getAllTokens,
  getTokenByUserId,
  getTokensByUserIds,
  deletePushToken,
};
