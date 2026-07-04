const ticketRepo = require('../../infrastructure/repositories/ticketRepository');
const uaipi = require('../../infrastructure/external/uaipiClient');
const logger = require('../../utils/logger');
const { ValidationError, NotFoundError } = require('../../domain/errors/AppError');

const STATUSES = ['ABERTO', 'EM_ANDAMENTO', 'AGUARDANDO', 'RESOLVIDO', 'FECHADO'];
const PRIORITIES = ['BAIXA', 'MEDIA', 'ALTA', 'URGENTE'];
const CLOSED_STATUSES = ['RESOLVIDO', 'FECHADO'];

// Para onde vai a notificação de novo chamado.
const NOTIFY_EMAIL = process.env.SUPPORT_NOTIFY_EMAIL || 'caiomdavidinha@gmail.com';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clampStr = (v, max = 191) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length > max ? s.slice(0, max) : s;
};

const newTicketEmailTemplate = (t) => `
  <div style="max-width:600px;margin:0 auto;background:#fff;padding:20px;border-radius:8px;box-shadow:0 4px 8px rgba(0,0,0,.1)">
    <div style="text-align:center;padding:20px;background:#9c0004;color:#fff;border-radius:8px 8px 0 0">
      <img src="https://www.predialnet.com.br/download/logo_predialnet_branca.png" alt="Logo Predialnet" style="max-width:150px;margin-bottom:10px">
      <h1 style="margin:0;font-size:20px">Novo chamado de suporte #${t.number}</h1>
    </div>
    <div style="padding:20px">
      <p><strong>Assunto:</strong> ${t.subject}</p>
      <p><strong>Prioridade:</strong> ${t.priority} &nbsp;·&nbsp; <strong>Status:</strong> ${t.status}</p>
      ${t.category ? `<p><strong>Categoria:</strong> ${t.category}</p>` : ''}
      <p><strong>Solicitante:</strong> ${t.requesterName || '—'} ${t.requesterEmail ? `(${t.requesterEmail})` : ''} ${t.requesterPhone ? `· ${t.requesterPhone}` : ''}</p>
      ${t.cpf ? `<p><strong>CPF:</strong> ${t.cpf} ${t.codcliente ? `· <strong>Contrato:</strong> ${t.codcliente}` : ''}</p>` : ''}
      <hr style="border:none;border-top:1px solid #eee;margin:16px 0">
      <p style="white-space:pre-wrap">${t.description}</p>
    </div>
    <div style="text-align:center;padding:16px;font-size:12px;color:#888">
      Chamado aberto em ${new Date(t.createdAt).toLocaleString('pt-BR')}
    </div>
  </div>`;

async function createTicket(payload = {}, context = {}) {
  const subject = clampStr(payload.subject);
  const description = payload.description ? String(payload.description).trim() : '';
  if (!subject) throw new ValidationError('subject é obrigatório.');
  if (!description) throw new ValidationError('description é obrigatória.');

  const priority = PRIORITIES.includes(payload.priority) ? payload.priority : 'MEDIA';
  const requesterEmail = clampStr(payload.requesterEmail);
  if (requesterEmail && !EMAIL_REGEX.test(requesterEmail))
    throw new ValidationError('requesterEmail inválido.');

  const ticket = await ticketRepo.create({
    subject,
    description,
    priority,
    category: clampStr(payload.category),
    requesterName: clampStr(payload.requesterName),
    requesterEmail,
    requesterPhone: clampStr(payload.requesterPhone),
    cpf: payload.cpf ? String(payload.cpf).replace(/\D/g, '') || null : null,
    codcliente: clampStr(payload.codcliente),
    assignee: clampStr(payload.assignee ?? context.assignee),
  });

  // Notificação por e-mail (best-effort — não derruba a criação).
  try {
    const res = await uaipi.sendEmail(NOTIFY_EMAIL, `Novo chamado #${ticket.number} — ${ticket.subject}`, newTicketEmailTemplate(ticket));
    if (res?.error) logger.warn('Falha ao notificar novo chamado por e-mail', { number: ticket.number });
  } catch (err) {
    logger.warn('Erro ao enviar e-mail de novo chamado', { number: ticket.number, error: err.message });
  }

  logger.info('Chamado criado', { number: ticket.number });
  return ticket;
}

async function listTickets(filters) {
  return ticketRepo.list(filters);
}

// Board kanban: todas as colunas (mesmo vazias), cada uma com seus tickets.
async function getBoard() {
  const all = await ticketRepo.findAllActive();
  const columns = STATUSES.map((status) => ({
    status,
    tickets: all.filter((t) => t.status === status),
  }));
  return { columns, total: all.length };
}

async function getTicket(id) {
  const ticket = await ticketRepo.findById(id);
  if (!ticket) throw new NotFoundError('Chamado não encontrado.');
  return ticket;
}

async function updateTicket(id, payload = {}) {
  const existing = await ticketRepo.findById(id);
  if (!existing) throw new NotFoundError('Chamado não encontrado.');

  const data = {};
  if (payload.subject !== undefined) {
    const s = clampStr(payload.subject);
    if (!s) throw new ValidationError('subject não pode ser vazio.');
    data.subject = s;
  }
  if (payload.description !== undefined) {
    const d = String(payload.description).trim();
    if (!d) throw new ValidationError('description não pode ser vazia.');
    data.description = d;
  }
  if (payload.status !== undefined) {
    if (!STATUSES.includes(payload.status)) throw new ValidationError(`status inválido. Aceitos: ${STATUSES.join(', ')}.`);
    data.status = payload.status;
    // Marca/limpa closedAt ao entrar/sair de status finalizados.
    if (CLOSED_STATUSES.includes(payload.status)) data.closedAt = existing.closedAt ?? new Date();
    else data.closedAt = null;
  }
  if (payload.priority !== undefined) {
    if (!PRIORITIES.includes(payload.priority)) throw new ValidationError(`priority inválida. Aceitas: ${PRIORITIES.join(', ')}.`);
    data.priority = payload.priority;
  }
  if (payload.category !== undefined) data.category = clampStr(payload.category);
  if (payload.assignee !== undefined) data.assignee = clampStr(payload.assignee);
  if (payload.position !== undefined) {
    const p = Number.parseInt(payload.position, 10);
    if (!Number.isNaN(p)) data.position = p;
  }

  if (!Object.keys(data).length) return existing;
  return ticketRepo.update(id, data);
}

async function addComment(id, { author, body, internal }) {
  if (!body || !String(body).trim()) throw new ValidationError('body do comentário é obrigatório.');
  const existing = await ticketRepo.findById(id);
  if (!existing) throw new NotFoundError('Chamado não encontrado.');
  return ticketRepo.addComment(id, { author: clampStr(author), body: String(body).trim(), internal: internal === true });
}

async function deleteTicket(id) {
  const existing = await ticketRepo.findById(id);
  if (!existing) throw new NotFoundError('Chamado não encontrado.');
  await ticketRepo.softDelete(id);
  return { deleted: true, id };
}

module.exports = {
  createTicket,
  listTickets,
  getBoard,
  getTicket,
  updateTicket,
  addComment,
  deleteTicket,
  STATUSES,
  PRIORITIES,
};
