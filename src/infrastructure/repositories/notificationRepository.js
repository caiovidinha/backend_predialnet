const { client } = require('../../prisma/client');

const create = ({ title, body, data }) =>
  client.notification.create({
    data: { title, body, data, status: 'pending', tokens: 0, receipts: {} },
  });

const updateReceipts = (id, receipts) =>
  client.notification.update({
    where: { id },
    data: { receipts, status: 'sent' },
  });

const incrementTokens = (id, count = 1) =>
  client.notification.update({
    where: { id },
    data: { tokens: { increment: count } },
  });

module.exports = { create, updateReceipts, incrementTokens };
