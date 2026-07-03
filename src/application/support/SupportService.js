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

// O identificador de contrato (codcliente) é `cliente.id` na UAIPI — é o que vai
// para /faturas/:id, /clientes/:id, libtemp, etc.
const pickCodcliente = (c) => {
  if (c?.id != null) return String(c.id);
  if (c?.codcliente != null) return String(c.codcliente);
  return null;
};

// Resumo por serponto (ponto de serviço): status de conexão e plano.
const mapPlanos = (serpontos = []) =>
  serpontos.map((sp) => ({
    serponto_id: sp.id ?? null,
    status: sp.dados_conexao?.status ?? null,
    plano: sp.plano?.plano_apelido ?? null,
    velocidade: sp.plano ? `${sp.plano.velocidade ?? ''} ${sp.plano.unidade ?? ''}`.trim() : null,
  }));

// Lista os contratos (números de cliente) de um CPF, para o operador escolher
// um e então consultar status/faturas/libtemp daquele contrato específico.
const getContracts = async (credential) => {
  const cliente = await authService.getUsersFromUAIPI(credential);
  if (!cliente) return { isClient: false, contratos: [] };

  const contratos = cliente.users.map((u) => {
    const c = u.cliente ?? {};
    const e = c.endereco ?? {};
    return {
      codcliente: pickCodcliente(c),
      inscricao: c.inscricao ?? null,
      nome: c.nome ?? null,
      email: c.email ?? null,
      situacao: c.situacao ?? null,
      permiteLiberacao: c.permite_liberacao ?? null,
      endereco: {
        logradouro: e.endereco ?? null,
        numero: e.numero ?? null,
        complemento: e.complemento ?? null,
        bairro: e.bairro ?? null,
        cidade: e.cidade ?? null,
        uf: e.uf ?? null,
        cep: e.cep ?? null,
      },
      planos: mapPlanos(c.serpontos),
      cliente: c, // objeto cru completo do contrato
    };
  });

  return {
    isClient: true,
    cpf: cliente.cpf,
    nome: cliente.nome,
    total: contratos.length,
    contratos,
  };
};

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
  getContracts,
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
