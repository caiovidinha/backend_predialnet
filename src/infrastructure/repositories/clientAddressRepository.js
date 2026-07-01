const { client } = require('../../prisma/client');

const BATCH_SIZE = 500;

const findByCpf = (cpf) =>
  client.clientAddress.findUnique({ where: { cpf: String(cpf) } });

const upsertBatch = async (cpfs, fields) => {
  const filtered = Object.fromEntries(
    Object.entries(fields).filter(([, v]) => v != null && v !== '')
  );
  if (!Object.keys(filtered).length || !cpfs.length) return;

  for (let i = 0; i < cpfs.length; i += BATCH_SIZE) {
    const batch = cpfs.slice(i, i + BATCH_SIZE).map(String);
    await client.clientAddress.updateMany({ where: { cpf: { in: batch } }, data: filtered });
    await client.clientAddress.createMany({
      data: batch.map(cpf => ({ cpf, ...filtered })),
      skipDuplicates: true,
    });
  }
};

module.exports = { findByCpf, upsertBatch };
