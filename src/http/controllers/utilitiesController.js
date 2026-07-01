const utilitiesService = require('../../application/utilities/UtilitiesService');
const logger = require('../../utils/logger');

const toggleShowAd = async (req, res) => {
  const { cpf } = req.params;
  if (!cpf) return res.status(400).json({ error: 'CPF não fornecido.' });
  try {
    const result = await utilitiesService.toggleShowAd(cpf);
    return res.status(200).json(result);
  } catch (err) {
    logger.error('toggleShowAd error', { cpf, error: err.message });
    return res.status(500).json({ error: err.message });
  }
};

const getUserByID = async (req, res) => {
  try {
    const response = await utilitiesService.getClientData(req.params.id);
    return res.status(200).json({ data: response });
  } catch (err) {
    logger.error('getUserByID error', { error: err.message });
    return res.status(500).json({ error: 'Erro ao pegar usuário' });
  }
};

const getClientStatusController = async (req, res) => {
  const { codcliente } = req.params;
  if (!codcliente) return res.status(400).json({ error: 'codcliente não fornecido.' });
  try {
    const status = await utilitiesService.getClientStatus(codcliente);
    return res.status(200).json(status);
  } catch (err) {
    logger.error('getClientStatus error', { codcliente, error: err.message });
    return res.status(500).json({ error: 'Erro ao consultar status do cliente.' });
  }
};

const updateSerAdicionalController = async (req, res) => {
  const { id, requerido, serPonto } = req.body;
  if (!id || requerido === undefined || !serPonto)
    return res.status(400).json({ error: 'Parâmetros inválidos' });
  try {
    const data = await utilitiesService.updateSerAdicional(id, { requerido, serPonto });
    return res.status(200).json({ message: 'ser_adicional atualizado com sucesso', data });
  } catch (err) {
    logger.error('updateSerAdicional error', { error: err.message });
    return res.status(500).json({ error: 'Erro ao atualizar ser_adicional' });
  }
};

const updateControleParentalController = async (req, res) => {
  try {
    const data = await utilitiesService.updateControleParental(req.body.id, { controle_parental: req.body.controle_parental });
    return res.status(200).json({ message: 'Controle Parental atualizado com sucesso', data });
  } catch (err) {
    logger.error('updateControleParental error', { error: err.message });
    return res.status(500).json({ error: 'Erro ao atualizar Controle Parental' });
  }
};

const getSerAdicionalController = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await utilitiesService.getSerAdicionais(id);
    return res.status(200).json({ serpontos: result });
  } catch (err) {
    logger.error('getSerAdicionais error', { id, error: err.message });
    return res.status(500).json({ error: 'Erro ao buscar serviços adicionais.' });
  }
};

const getControleParentalController = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await utilitiesService.getControleParental(id);
    return res.status(200).json({ serpontos: result });
  } catch (err) {
    logger.error('getControleParental error', { id, error: err.message });
    return res.status(500).json({ error: 'Erro ao buscar controle parental.' });
  }
};

const getAlertMessageController = async (req, res) => {
  const { codcliente } = req.params;
  if (!codcliente) return res.status(400).json({ error: 'codcliente não fornecido.' });
  try {
    const msg = await utilitiesService.getAlertMessage(codcliente);
    return res.status(200).json(msg);
  } catch (err) {
    logger.error('getAlertMessage error', { codcliente, error: err.message });
    return res.status(500).json({ error: 'Erro ao consultar status do cliente.' });
  }
};

module.exports = {
  toggleShowAd,
  getUserByID,
  getClientStatusController,
  getSerAdicionalController,
  getControleParentalController,
  updateSerAdicionalController,
  updateControleParentalController,
  getAlertMessageController,
};
