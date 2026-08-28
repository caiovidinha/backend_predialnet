const statsService = require('../../application/stats/StatsService');
const logger = require('../../utils/logger');

// Todos os handlers seguem o mesmo desenho: leem `dias` da query, delegam ao
// serviço e devolvem JSON. O tratamento de erro é comum porque nenhum deles
// tem caso de negócio próprio — ou agrega, ou falha.

const responder = (nome, executar) => async (req, res) => {
  try {
    return res.status(200).json(await executar(req.query.dias));
  } catch (err) {
    logger.error(`stats ${nome} error`, { error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Erro ao calcular estatísticas.' });
  }
};

const overview = responder('overview', statsService.visaoGeral);
const usuarios = responder('usuarios', statsService.usuarios);
const notificacoes = responder('notificacoes', statsService.notificacoes);
const chamados = responder('chamados', statsService.chamados);
const speedtest = responder('speedtest', statsService.speedtest);
const blog = responder('blog', statsService.blog);
const upgrades = responder('upgrades', statsService.upgrades);

// Escape hatch para quando o operador acabou de mexer em algo e quer o número
// novo sem esperar o TTL.
const limparCache = async (_req, res) => {
  statsService.limparCache();
  return res.status(200).json({ ok: true, mensagem: 'Cache de estatísticas limpo.' });
};

module.exports = { overview, usuarios, notificacoes, chamados, speedtest, blog, upgrades, limparCache };
