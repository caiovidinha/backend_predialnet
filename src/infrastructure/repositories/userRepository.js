const { client } = require('../../prisma/client');

const findByCpf = (cpf) => client.user.findFirst({ where: { cpf } });
const findById = (id) => client.user.findUnique({ where: { id } });
const findManyByEmail = (email) => client.user.findMany({ where: { email } });
const findAllCpfs = () => client.user.findMany({ select: { cpf: true } }).then(rows => rows.map(r => r.cpf));

const create = (data) => client.user.create({ data });

const updatePassword = (email, hashedPassword) =>
  client.user.updateMany({ where: { email }, data: { password: hashedPassword } });

const updateEmail = (id, email) =>
  client.user.update({ where: { id }, data: { email } });

const findManyByCpfs = (cpfs) =>
  client.user.findMany({ where: { cpf: { in: cpfs.map(String) } }, select: { id: true } });

const findPasswordToken = (userId) =>
  client.passwordToken.findFirst({ where: { userId } });

module.exports = {
  findByCpf,
  findById,
  findManyByEmail,
  findAllCpfs,
  create,
  updatePassword,
  updateEmail,
  findManyByCpfs,
  findPasswordToken,
};
