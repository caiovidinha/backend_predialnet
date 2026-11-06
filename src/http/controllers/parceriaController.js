const parceriaService = require('../../application/parcerias/ParceriaService');
const logger = require('../../utils/logger');

// POST /parcerias/eventos — público, chamado pelo navegador no Assine Já.
//
// O Assine Já manda com navigator.sendBeacon (Content-Type text/plain): é uma
// requisição "simples", sem preflight de CORS, e sobrevive ao fechamento da
// aba — o clique no WhatsApp abre outra página e o fetch comum morreria no
// meio. Por isso o corpo pode chegar como string e é lido aqui.
const lerCorpo = (body) => {
  if (typeof body !== 'string') return body;
  try { return JSON.parse(body); } catch { return null; }
};

async function registrarEvento(req, res) {
  try {
    await parceriaService.registrar(lerCorpo(req.body), { userAgent: req.headers['user-agent'] });
    // 204: o beacon não lê resposta, e não há nada útil para devolver.
    return res.status(204).end();
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    logger.error('parcerias registrarEvento error', { error: err.message });
    return res.status(500).json({ error: 'Erro ao registrar evento.' });
  }
}

// GET /stats/parcerias (operador)
async function resumo(req, res) {
  try {
    return res.status(200).json(await parceriaService.resumo({
      dias: req.query.dias,
      parceria: req.query.parceria,
    }));
  } catch (err) {
    logger.error('stats parcerias error', { error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Erro ao calcular estatísticas das parcerias.' });
  }
}

// GET /stats/parcerias/csv (operador) — a "planilha"
async function exportarCsv(req, res) {
  try {
    const { nome, conteudo } = await parceriaService.exportarCsv({
      dias: req.query.dias,
      parceria: req.query.parceria,
      tipo: req.query.tipo,
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nome}"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(conteudo);
  } catch (err) {
    logger.error('stats parcerias csv error', { error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Erro ao exportar as parcerias.' });
  }
}

module.exports = { registrarEvento, resumo, exportarCsv, lerCorpo };
