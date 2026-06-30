const faturaService = require('../../application/fatura/FaturaService');
const logger = require('../../utils/logger');

const wrap = (fn) => async (req, res) => {
  try {
    const result = await fn(req);
    return res.status(200).json(result);
  } catch (err) {
    logger.error(`faturaController error: ${err.message}`);
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
};

const getSecondCopyLinkController = wrap((req) =>
  faturaService.getSecondCopyLink(req.params.id, req.params.boleta));

const getLastSixInvoicesController = wrap((req) =>
  faturaService.getLastSixInvoices(req.params.id));

const getPixFromLastOpenInternetInvoiceController = wrap((req) =>
  faturaService.getPixFromLastOpenInternetInvoice(req.params.id));

const checkCurrentInvoiceStatusController = wrap((req) =>
  faturaService.checkCurrentInvoiceStatus(req.params.id));

const getCurrentInvoiceController = wrap((req) =>
  faturaService.getCurrentInvoice(req.params.id));

const setFaturaDigitalController = wrap((req) =>
  faturaService.setFaturaDigital(req.params.id, req.body));

const getPastInvoicesStatusController = wrap((req) =>
  faturaService.getPastInvoicesStatus(req.params.id));

const cadastrarLibtempController = async (req, res) => {
  const { codcliente, prazo } = req.body;
  if (!codcliente || !prazo) {
    return res.status(400).json({ error: 'codcliente e prazo são obrigatórios.' });
  }
  try {
    const result = await faturaService.cadastrarLibtemp(codcliente, prazo);
    return res.status(result.status || 200).json(result);
  } catch (err) {
    if (err.message.includes('não elegível')) return res.status(403).json({ error: err.message });
    logger.error('cadastrarLibtemp error', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
};

const consultarLibtempPorClienteController = async (req, res) => {
  try {
    const result = await faturaService.consultarLibtempPorCliente(req.params.codcliente);
    return res.status(result.status || 200).json(result);
  } catch (err) {
    logger.error('consultarLibtemp error', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
};

const deletarLibtempController = async (req, res) => {
  try {
    const result = await faturaService.deletarLibtemp(req.params.id);
    return res.status(result.status || 200).json(result);
  } catch (err) {
    logger.error('deletarLibtemp error', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getSecondCopyLinkController,
  getLastSixInvoicesController,
  getPixFromLastOpenInternetInvoiceController,
  checkCurrentInvoiceStatusController,
  getCurrentInvoiceController,
  setFaturaDigitalController,
  getPastInvoicesStatusController,
  cadastrarLibtempController,
  consultarLibtempPorClienteController,
  deletarLibtempController,
};
