const logsService = require('../../application/health/LogsService');
const logger = require('../../utils/logger');

const listar = (req, res) => {
  try {
    return res.status(200).json({ arquivos: logsService.listarArquivos() });
  } catch (err) {
    logger.error('logs listar error', { error: err.message });
    return res.status(500).json({ error: 'Erro ao listar logs.' });
  }
};

const ler = (req, res) => {
  const { nome } = req.params;
  const { linhas, busca } = req.query;
  try {
    return res.status(200).json(logsService.lerArquivo(nome, { linhas, busca }));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    logger.error('logs ler error', { error: err.message });
    return res.status(500).json({ error: 'Erro ao ler log.' });
  }
};

module.exports = { listar, ler };
