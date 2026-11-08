// workers/pushWorker.js
require('dotenv').config();
const pushQueue = require('../queues/pushQueue');
const { sendPushNotifications, getPushNotificationReceipts } = require('../services/expoPushService');
const { PrismaClient } = require('@prisma/client');
const { deleteByToken } = require('../infrastructure/repositories/pushTokenRepository');
const pushDeliveryRepo = require('../infrastructure/repositories/pushDeliveryRepository');
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
    // `receipts` guarda só um resumo, não o array de tickets inteiro: numa
    // campanha grande (milhares de destinatários) o array bruto virava uma
    // coluna gigante nessa única linha, e paginar a tabela de campanhas
    // (mesmo sem usar esse campo) já derrubou o MySQL por memória de sort.
    // O detalhe por destinatário já está no PushDelivery.
    const resumoTickets = tickets.reduce((acc, t) => {
      acc[t.status === 'ok' ? 'ok' : 'error'] += 1;
      return acc;
    }, { ok: 0, error: 0 });
    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: 'sent',
        tokens: messages.length,
        receipts: resumoTickets
      }
    });

    // 2.1) marca PushDelivery por destinatário — só quando o pareamento por
    // índice é confiável (mesma condição usada pra limpeza de token abaixo).
    // Agrupado por status/mensagem de erro em vez de 1 update por linha: um
    // broadcast GLOBAL com milhares de tokens gera só um punhado de updateMany.
    if (tickets.length === messages.length) {
      const okTokens = [];
      const falhasPorMensagem = new Map();
      tickets.forEach((t, i) => {
        if (t.status === 'ok') okTokens.push(messages[i].to);
        else {
          const chave = t.message || 'erro desconhecido';
          if (!falhasPorMensagem.has(chave)) falhasPorMensagem.set(chave, []);
          falhasPorMensagem.get(chave).push(messages[i].to);
        }
      });
      if (okTokens.length) await pushDeliveryRepo.markSentBulk(notificationId, okTokens);
      for (const [mensagem, tokensComErro] of falhasPorMensagem) {
        await pushDeliveryRepo.markFailedBulk(notificationId, tokensComErro, mensagem);
      }
    } else {
      logger.warn(`⚠️  Job ${job.id}: pareamento tickets/mensagens inconsistente — PushDelivery segue 'pending'`);
    }

    // 3) busca receipts detalhados e limpa tokens inválidos
    const receiptIds = tickets.map(t => t.id).filter(Boolean);
    if (receiptIds.length) {
      // Os receipts vêm indexados por ticketId, não por token. Para saber qual
      // token remover é preciso parear ticket com a mensagem que o gerou: o
      // Expo devolve os tickets na mesma ordem das mensagens enviadas.
      // Se algum chunk falhou no envio, vêm menos tickets que mensagens e o
      // pareamento por índice deixa de valer — aí é melhor não remover nada do
      // que remover o token de outra pessoa.
      const tokenPorTicket = new Map();
      if (tickets.length === messages.length) {
        tickets.forEach((t, i) => { if (t.id) tokenPorTicket.set(t.id, messages[i].to); });
      } else {
        logger.warn(`⚠️  Job ${job.id}: ${tickets.length} tickets para ${messages.length} mensagens — limpeza de tokens ignorada`);
      }

      const receipts = await getPushNotificationReceipts(receiptIds);

      // 3.1) marca PushDelivery por receipt — mesma lógica de agrupamento,
      // dessa vez por ticketId (não precisa resolver token aqui).
      const gruposPorChave = new Map(); // "ok" | "error:<detail>" -> ticketIds[]
      for (const [ticketId, result] of Object.entries(receipts)) {
        const chave = result.status === 'ok' ? 'ok' : `error:${result.details?.error || 'desconhecido'}`;
        if (!gruposPorChave.has(chave)) gruposPorChave.set(chave, []);
        gruposPorChave.get(chave).push(ticketId);
      }
      for (const [chave, ticketIdsDoGrupo] of gruposPorChave) {
        if (chave === 'ok') {
          await pushDeliveryRepo.markDeliveredBulkByTicket(ticketIdsDoGrupo);
        } else {
          await pushDeliveryRepo.markFailedBulkByTicket(ticketIdsDoGrupo, chave.slice('error:'.length));
        }
      }

      for (const [ticketId, result] of Object.entries(receipts)) {
        if (result.status !== 'error' || result.details?.error !== 'DeviceNotRegistered') continue;

        const token = tokenPorTicket.get(ticketId);
        if (!token) continue;

        try {
          await deleteByToken(token);
          logger.warn(`🗑  Job ${job.id}: token inválido removido (${token})`);
        } catch (err) {
          // P2025: já tinha sido removido. Não é motivo para falhar o job —
          // o push em si foi entregue.
          logger.warn(`Job ${job.id}: token ${token} já não estava no banco`, { error: err.message });
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
    await pushDeliveryRepo.markAllPendingFailed(notificationId);
    logger.info(`🔄 Notification ${notificationId} marcada como failed`);
  } catch (dbErr) {
    logger.error(`💥 Erro ao atualizar status da notification ${notificationId}: ${dbErr.message}`, { stack: dbErr.stack });
  }
});

logger.info('🚀 Push worker rodando. Conectado ao Redis/Bull.');
