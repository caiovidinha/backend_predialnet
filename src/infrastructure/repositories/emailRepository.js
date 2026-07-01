const { client } = require('../../prisma/client');

const findByCensored = (censoredEmail) =>
  client.emails.findFirst({ where: { censoredEmail } });

const findByEmail = (email) =>
  client.emails.findFirst({ where: { email } });

const create = (email, censoredEmail) =>
  client.emails.create({ data: { email, censoredEmail } });

module.exports = { findByCensored, findByEmail, create };
