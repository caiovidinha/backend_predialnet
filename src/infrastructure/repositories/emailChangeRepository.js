const { client } = require('../../prisma/client');

// Uma pendência de troca de e-mail por usuário (userId único): novo pedido
// substitui o anterior.
const upsert = (userId, { newEmail, code, expiresIn }) =>
  client.emailChange.upsert({
    where: { userId },
    update: { newEmail, code, expiresIn },
    create: { userId, newEmail, code, expiresIn },
  });

const findByUserId = (userId) => client.emailChange.findUnique({ where: { userId } });

const deleteByUserId = (userId) => client.emailChange.deleteMany({ where: { userId } });

module.exports = { upsert, findByUserId, deleteByUserId };
