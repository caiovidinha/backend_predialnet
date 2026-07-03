const authService = require('../../application/auth/AuthService');
const logger = require('../../utils/logger');

const getOk = (_req, res) => res.status(200).json({ pong: 'true' });

const newUser = async (req, res) => {
  try {
    const result = await authService.newUser({ userCredential: req.body.userCredential });
    return res.status(201).json(result);
  } catch (err) {
    logger.warn('newUser falhou', { error: err.message });
    return res.status(err.statusCode || 404).json({ error: err.message });
  }
};

const createUser = async (req, res) => {
  try {
    const result = await authService.createUser({ cpf: req.body.cpf, email: req.body.email });
    return res.status(201).json(result);
  } catch (err) {
    logger.error('createUser falhou', { error: err.message });
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
};

const login = async (req, res) => {
  try {
    const result = await authService.login({ credential: req.body.credential, password: req.body.password });
    return res.status(201).json(result);
  } catch (err) {
    logger.warn('login falhou', { error: err.message });
    return res.status(err.statusCode || 403).json({ error: err.message });
  }
};

const renewToken = async (req, res) => {
  try {
    const token = await authService.renewToken({ refresh_token: req.body.refresh_token });
    return res.status(201).json(token);
  } catch (err) {
    return res.status(401).end();
  }
};

const forgotPassword = async (req, res) => {
  try {
    const result = await authService.forgotPassword({
      userCredential: req.body.userCredential,
      insideApp: req.body.insideApp,
    });
    if (result.needsEmailUpdate) {
      return res.status(400).json({
        error: 'E-mail desatualizado. Atualize seu e-mail na base da Predialnet.',
        availableEmails: result.censoredEmails,
      });
    }
    return res.status(200).json(result);
  } catch (err) {
    logger.error('forgotPassword falhou', { error: err.message });
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const result = await authService.resetPassword({
      email: req.body.email,
      token: req.body.token,
      newPassword: req.body.newPassword,
    });
    return res.status(200).json(result);
  } catch (err) {
    logger.warn('resetPassword falhou', { error: err.message });
    return res.status(err.statusCode || 400).json({ error: err.message });
  }
};

const updateEmail = async (req, res) => {
  try {
    const result = await authService.updateEmail({
      email: req.body.email,
      codcliente: req.body.codcliente,
      inscricao: req.body.inscricao,
    });
    return res.status(200).json(result);
  } catch (err) {
    logger.error('updateEmail falhou', { error: err.message });
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
};

const updateEmailCensored = async (req, res) => {
  try {
    const result = await authService.updateEmailCensored({
      cpf: req.body.cpf,
      censoredEmail: req.body.censoredEmail,
    });
    return res.status(200).json(result);
  } catch (err) {
    logger.error('updateEmailCensored falhou', { error: err.message });
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
};

const mustChangePasswordCheck = async (req, res) => {
  try {
    const result = await authService.mustChangePasswordCheck({ cpf: req.params.cpf });
    return res.status(200).json(result);
  } catch (err) {
    logger.warn('mustChangePasswordCheck falhou', { error: err.message });
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
};

// Usuário logado consulta o próprio e-mail cadastrado (identidade via token).
const getMyEmail = async (req, res) => {
  if (!req.cpf) return res.status(401).json({ error: 'Não autenticado.' });
  try {
    const result = await authService.getRegisteredEmail({ cpf: req.cpf });
    return res.status(200).json(result);
  } catch (err) {
    logger.warn('getMyEmail falhou', { error: err.message });
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
};

// Usuário logado altera o próprio e-mail cadastrado (semeia no map censurado).
const updateMyEmail = async (req, res) => {
  if (!req.cpf) return res.status(401).json({ error: 'Não autenticado.' });
  try {
    const result = await authService.changeRegisteredEmail({ cpf: req.cpf, email: req.body.email });
    return res.status(200).json(result);
  } catch (err) {
    logger.warn('updateMyEmail falhou', { error: err.message });
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
};

const handleEmail = async (req, res) => {
  try {
    const result = await authService.sendEmail({
      to: req.body.to,
      subject: req.body.subject,
      content: req.body.content,
    });
    return res.status(200).json(result);
  } catch (err) {
    logger.error('handleEmail falhou', { error: err.message });
    return res.status(400).json({ error: 'Erro ao enviar e-mail' });
  }
};

module.exports = {
  getOk, newUser, createUser, login, renewToken, forgotPassword,
  resetPassword, updateEmail, updateEmailCensored, mustChangePasswordCheck, handleEmail,
  getMyEmail, updateMyEmail,
};
