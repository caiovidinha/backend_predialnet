const supportService = require('../../application/support/SupportService');
const logger = require('../../utils/logger');

// Mapeia erros dos services (AppError.statusCode ou erro da UAIPI com .status).
const errStatus = (err) => err.statusCode || err.status || 500;

const overview = async (req, res) => {
  try {
    const result = await supportService.getOverview(req.params.credential);
    return res.status(200).json(result);
  } catch (err) {
    logger.error('support overview error', { error: err.message });
    return res.status(errStatus(err)).json({ error: err.message });
  }
};

const appAccount = async (req, res) => {
  try {
    const result = await supportService.getAppAccount(req.params.cpf);
    return res.status(200).json(result);
  } catch (err) {
    logger.warn('support appAccount error', { error: err.message });
    return res.status(errStatus(err)).json({ error: err.message });
  }
};

const isClient = async (req, res) => {
  try {
    const result = await supportService.isClient(req.params.credential);
    return res.status(200).json(result);
  } catch (err) {
    logger.warn('support isClient error', { error: err.message });
    return res.status(errStatus(err)).json({ error: err.message });
  }
};

const deleteAppAccount = async (req, res) => {
  try {
    const result = await supportService.deleteAppAccount(req.params.cpf);
    return res.status(200).json(result);
  } catch (err) {
    logger.warn('support deleteAppAccount error', { error: err.message });
    return res.status(errStatus(err)).json({ error: err.message });
  }
};

const getEmail = async (req, res) => {
  try {
    const result = await supportService.getRegisteredEmail(req.params.cpf);
    return res.status(200).json(result);
  } catch (err) {
    logger.warn('support getEmail error', { error: err.message });
    return res.status(errStatus(err)).json({ error: err.message });
  }
};

const updateEmail = async (req, res) => {
  try {
    const result = await supportService.changeRegisteredEmail(req.params.cpf, req.body.email, req.body.codcliente);
    return res.status(200).json(result);
  } catch (err) {
    logger.warn('support updateEmail error', { error: err.message });
    return res.status(errStatus(err)).json({ error: err.message });
  }
};

const notifications = async (req, res) => {
  try {
    const result = await supportService.getNotifications(req.params.cpf);
    return res.status(200).json(result);
  } catch (err) {
    logger.warn('support notifications error', { error: err.message });
    return res.status(errStatus(err)).json({ error: err.message });
  }
};

const contracts = async (req, res) => {
  try {
    const result = await supportService.getContracts(req.params.credential);
    return res.status(200).json(result);
  } catch (err) {
    logger.error('support contracts error', { error: err.message });
    return res.status(errStatus(err)).json({ error: err.message });
  }
};

const account = async (req, res) => {
  try {
    const result = await supportService.getAccount(req.params.credential);
    if (!result) return res.status(404).json({ error: 'Cliente não encontrado.' });
    return res.status(200).json(result);
  } catch (err) {
    logger.error('support account error', { error: err.message });
    return res.status(errStatus(err)).json({ error: err.message });
  }
};

const status = async (req, res) => {
  try {
    const result = await supportService.getStatus(req.params.codcliente);
    return res.status(200).json(result);
  } catch (err) {
    logger.error('support status error', { error: err.message });
    return res.status(errStatus(err)).json({ error: err.message });
  }
};

const invoices = async (req, res) => {
  try {
    const result = await supportService.getInvoices(req.params.codcliente);
    return res.status(200).json(result);
  } catch (err) {
    logger.error('support invoices error', { error: err.message });
    return res.status(errStatus(err)).json({ error: err.message });
  }
};

const currentInvoice = async (req, res) => {
  try {
    const result = await supportService.getCurrentInvoice(req.params.codcliente);
    return res.status(200).json(result);
  } catch (err) {
    logger.error('support currentInvoice error', { error: err.message });
    return res.status(errStatus(err)).json({ error: err.message });
  }
};

const getLibtemp = async (req, res) => {
  try {
    const result = await supportService.getLibtemp(req.params.codcliente);
    return res.status(200).json(result);
  } catch (err) {
    logger.warn('support getLibtemp error', { error: err.message });
    return res.status(errStatus(err)).json({ error: err.message });
  }
};

const createLibtemp = async (req, res) => {
  const { prazo } = req.body;
  if (!prazo) return res.status(400).json({ error: 'prazo é obrigatório.' });
  try {
    const result = await supportService.createLibtemp(req.params.codcliente, prazo);
    return res.status(201).json(result);
  } catch (err) {
    logger.error('support createLibtemp error', { error: err.message });
    return res.status(errStatus(err)).json({ error: err.message });
  }
};

const deleteLibtemp = async (req, res) => {
  try {
    const result = await supportService.deleteLibtemp(req.params.id);
    return res.status(200).json(result ?? { message: 'Liberação removida.' });
  } catch (err) {
    logger.error('support deleteLibtemp error', { error: err.message });
    return res.status(errStatus(err)).json({ error: err.message });
  }
};

const passwordReset = async (req, res) => {
  try {
    const result = await supportService.generatePasswordReset(req.params.cpf, {
      sendEmail: req.body?.sendEmail === true,
    });
    if (result.needsEmailUpdate) {
      return res.status(409).json({
        error: 'E-mail do app diverge do cadastro da Predialnet.',
        availableEmails: result.censoredEmails,
      });
    }
    return res.status(200).json(result);
  } catch (err) {
    logger.warn('support passwordReset error', { error: err.message });
    return res.status(errStatus(err)).json({ error: err.message });
  }
};

const availableEmails = async (req, res) => {
  try {
    const result = await supportService.getAvailableEmails(req.params.credential);
    return res.status(200).json(result);
  } catch (err) {
    logger.warn('support availableEmails error', { error: err.message });
    return res.status(errStatus(err)).json({ error: err.message });
  }
};

const createAppAccount = async (req, res) => {
  const { cpf, email } = req.body;
  if (!cpf || !email) return res.status(400).json({ error: 'cpf e email (censurado) são obrigatórios.' });
  try {
    const result = await supportService.createAppAccount({ cpf, censoredEmail: email });
    return res.status(201).json(result);
  } catch (err) {
    logger.error('support createAppAccount error', { error: err.message });
    return res.status(errStatus(err)).json({ error: err.message });
  }
};

module.exports = {
  overview,
  appAccount,
  deleteAppAccount,
  getEmail,
  updateEmail,
  notifications,
  isClient,
  contracts,
  account,
  status,
  invoices,
  currentInvoice,
  getLibtemp,
  createLibtemp,
  deleteLibtemp,
  passwordReset,
  availableEmails,
  createAppAccount,
};
