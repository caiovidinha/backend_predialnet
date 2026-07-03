const authService = require('../auth/AuthService');
const faturaService = require('../fatura/FaturaService');
const utilitiesService = require('../utilities/UtilitiesService');
const userRepo = require('../../infrastructure/repositories/userRepository');
const tokenRepo = require('../../infrastructure/repositories/tokenRepository');
const logger = require('../../utils/logger');
const { ValidationError } = require('../../domain/errors/AppError');

const onlyDigits = (v) => String(v ?? '').replace(/\D/g, '');

// ── Conta do app (base local / Prisma) ───────────────────────────────────────

// Se o cliente tem conta no app, e-mail cadastrado e se ainda precisa trocar senha.
const getAppAccount = async (cpf) => {
  const c = onlyDigits(cpf);
  if (c.length !== 11) throw new ValidationError('CPF inválido. Informe 11 dígitos.');

  const user = await userRepo.findByCpf(c);
  if (!user) return { exists: false, cpf: c };

  const passToken = await tokenRepo.findPasswordToken(user.id);
  return {
    exists: true,
    cpf: c,
    userId: user.id,
    email: user.email,
    mustChangePassword: !passToken,
  };
};

// ── Consultas na base da Predialnet (UAIPI) ──────────────────────────────────

// É cliente Predialnet? Aceita CPF ou codcliente como credential.
const isClient = async (credential) => {
  const cliente = await authService.getUsersFromUAIPI(credential);
  if (!cliente) return { isClient: false };
  return {
    isClient: true,
    cpf: cliente.cpf,
    nome: cliente.nome,
    email: cliente.email,
    contratos: cliente.users.length,
  };
};

// Dados completos do cliente (contratos, endereço, serpontos, plano...).
const getAccount = (credential) => utilitiesService.getClientData(credential);

// Status de conexão por serponto + situação de pagamento + liberação temporária.
const getStatus = (codcliente) => utilitiesService.getClientStatus(codcliente);

// ── Faturas ──────────────────────────────────────────────────────────────────

const getInvoices = async (codcliente) => {
  const [history, current, pastStatus] = await Promise.all([
    faturaService.getLastSixInvoices(codcliente).then((r) => r.faturas).catch(() => []),
    faturaService.checkCurrentInvoiceStatus(codcliente).catch(() => null),
    faturaService.getPastInvoicesStatus(codcliente).catch(() => ({ open: 0, overdue: 0 })),
  ]);
  return { history, current, pastStatus };
};

const getCurrentInvoice = (codcliente) => faturaService.getCurrentInvoice(codcliente);

// ── Liberação temporária (libtemp) ───────────────────────────────────────────

const getLibtemp = (codcliente) => faturaService.consultarLibtempPorCliente(codcliente);
const createLibtemp = (codcliente, prazo) => faturaService.cadastrarLibtemp(codcliente, prazo);
const deleteLibtemp = (id) => faturaService.deletarLibtemp(id);

// ── Ações de conta ───────────────────────────────────────────────────────────

// Gera link de redefinição de senha (mesma mecânica do "esqueci a senha").
// Retorna { url } ou { needsEmailUpdate, censoredEmails } quando o e-mail do
// app diverge do cadastro da Predialnet.
const generatePasswordReset = async (cpf, { sendEmail = false } = {}) => {
  const c = onlyDigits(cpf);
  return authService.forgotPassword({ userCredential: c, insideApp: !sendEmail });
};

// E-mails (censurados) disponíveis para criar conta do app / atualizar e-mail.
const getAvailableEmails = (credential) =>
  authService.newUser({ userCredential: credential });

// Cria a conta do app e envia a senha por e-mail (escolhendo um e-mail censurado).
const createAppAccount = ({ cpf, censoredEmail }) =>
  authService.createUser({ cpf: onlyDigits(cpf), email: censoredEmail });

// ── Visão agregada (carga inicial do dashboard) ──────────────────────────────
// Resiliente: cada parte falha de forma isolada, sem derrubar o conjunto.
const getOverview = async (credential) => {
  const [isClientRes, account] = await Promise.all([
    isClient(credential).catch((e) => ({ isClient: false, error: e.message })),
    getAccount(credential).catch((e) => {
      logger.warn('support overview getAccount', { credential, error: e.message });
      return null;
    }),
  ]);

  const cpf =
    isClientRes?.cpf ??
    account?.cliente?.inscricao ??
    (onlyDigits(credential).length === 11 ? onlyDigits(credential) : null);

  const appAccount = cpf
    ? await getAppAccount(cpf).catch(() => ({ exists: false, cpf }))
    : { exists: false };

  return { credential: String(credential), isClient: isClientRes, appAccount, account };
};

module.exports = {
  getAppAccount,
  isClient,
  getAccount,
  getStatus,
  getInvoices,
  getCurrentInvoice,
  getLibtemp,
  createLibtemp,
  deleteLibtemp,
  generatePasswordReset,
  getAvailableEmails,
  createAppAccount,
  getOverview,
};
