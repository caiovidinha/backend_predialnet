// workers/pushWorker.js
require('dotenv').config();
const pushQueue = require('../queues/pushQueue');
const { sendPushNotifications, getPushNotificationReceipts } = require('../services/expoPushService');
const { PrismaClient } = require('@prisma/client');
const { deletePushToken } = require('../models/push');
const logger = require('../utils/logger');
const prisma = new PrismaClient();

// processa até 20 jobs em paralelo
pushQueue.process(20, async job => {
  const { messages, notificationId } = job.data;
  logger.info(`🔔 Iniciando job ${job.id} (notificationId=${notificationId}) com ${messages.length} mensagens`);

  try {
    // 1) envia as notificações
    const tickets = await sendPushNotifications(messages);
    logger.info(`✅ Job ${job.id}: envio concluído, ${tickets.length} tickets recebidos`);

    // 2) atualiza o registro no banco para "sent"
    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: 'sent',
        tokens: messages.length,
        receipts: tickets
      }
    });

    // 3) busca receipts detalhados e limpa tokens inválidos
    const receiptIds = tickets.map(t => t.id).filter(Boolean);
    if (receiptIds.length) {
      const receipts = await getPushNotificationReceipts(receiptIds);
      logger.info(receipts)
      for (const [token, result] of Object.entries(receipts)) {
        if (result.status === 'error' && result.details?.error === 'DeviceNotRegistered') {
          await deletePushToken(token);
          logger.warn(`🗑  Job ${job.id}: token inválido removido (${token})`);
        }
      }
    }

    return tickets;
  } catch (err) {
    // qualquer erro não tratado cai aqui
    throw err; // delega ao listener de 'failed'
  }
});

// em caso de falha total do job
pushQueue.on('failed', async (job, err) => {
  const { notificationId } = job.data;
  logger.error(`❌ Job ${job.id} falhou: ${err.message}`, { stack: err.stack });

  try {
    await prisma.notification.update({
      where: { id: notificationId },
      data: { status: 'failed' }
    });
    logger.info(`🔄 Notification ${notificationId} marcada como failed`);
  } catch (dbErr) {
    logger.error(`💥 Erro ao atualizar status da notification ${notificationId}: ${dbErr.message}`, { stack: dbErr.stack });
  }
});

logger.info('🚀 Push worker rodando. Conectado ao Redis/Bull.');
