const crypto = require('crypto');
const speedtestService = require('../../application/speedtest/SpeedtestService');
const logger = require('../../utils/logger');

// Máximo de bytes servidos pelo download, para evitar abuso.
const MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024; // 100 MB
const DEFAULT_DOWNLOAD_BYTES = 12 * 1024 * 1024; // 12 MB
const DOWNLOAD_CHUNK_BYTES = 256 * 1024; // 256 KB por escrita

// Buffer aleatório pré-gerado uma única vez no load do módulo. Reescrevê-lo em
// todas as respostas de download evita gastar CPU e bloquear o event loop com
// crypto.randomBytes por request. Como forçamos Content-Encoding: identity (e
// não há compressão no app), repetir o mesmo bloco não infla a vazão medida.
const RANDOM_CHUNK = crypto.randomBytes(DOWNLOAD_CHUNK_BYTES);

function parseSize(value) {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_DOWNLOAD_BYTES;
  }

  return Math.min(parsed, MAX_DOWNLOAD_BYTES);
}

// GET /speedtest/download?size=<bytes>
// Devolve exatamente `size` bytes de conteúdo aleatório, sem cache e sem
// compressão, para o app medir a vazão de download.
function download(req, res) {
  const size = parseSize(req.query.size);

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', String(size));
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  // Bytes aleatórios não comprimem; ainda assim forçamos identity para não
  // deixar nenhum middleware/proxy inflar a vazão medida.
  res.setHeader('Content-Encoding', 'identity');

  let remaining = size;

  function writeChunk() {
    if (res.destroyed) {
      return;
    }

    while (remaining > 0) {
      const chunkSize = Math.min(remaining, DOWNLOAD_CHUNK_BYTES);
      // Reutiliza o buffer pré-gerado; fatia só quando o resto é menor que ele.
      const chunk = chunkSize === DOWNLOAD_CHUNK_BYTES
        ? RANDOM_CHUNK
        : RANDOM_CHUNK.subarray(0, chunkSize);
      remaining -= chunkSize;

      const ok = res.write(chunk);

      if (!ok) {
        // Buffer cheio: espera esvaziar antes de continuar.
        res.once('drain', writeChunk);
        return;
      }
    }

    res.end();
  }

  writeChunk();
}

// POST /speedtest/upload
// Consome o corpo binário inteiro (descartando) e responde 200. Precisa
// drenar todo o stream antes de responder para não cortar a medição.
function upload(req, res) {
  req.on('data', () => {
    // descarta os chunks recebidos
  });

  req.on('end', () => {
    res.status(200).end();
  });

  req.on('error', () => {
    if (!res.headersSent) {
      res.status(400).end();
    }
  });
}

// GET /speedtest/ping
// Resposta mínima (204 No Content) e sem cache, para medir latência/jitter.
function ping(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.status(204).end();
}

// Extrai o IP real do cliente, respeitando o proxy reverso (X-Forwarded-For).
function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || null;
}

const parseDate = (v) => {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

// POST /speedtest/result
// O app envia o resultado detalhado do teste (medido no cliente) para persistir.
async function submitResult(req, res) {
  try {
    const context = {
      userId: req.userId ?? null,
      cpf: req.cpf ?? null,
      clientIp: getClientIp(req),
      userAgent: req.headers['user-agent'] || null,
      serverHost: req.headers['x-speedtest-host'] || null,
    };
    const saved = await speedtestService.submitResult(req.body, context);
    return res.status(201).json({ id: saved.id, createdAt: saved.createdAt });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    logger.error('speedtest submitResult error', { error: err.message });
    return res.status(500).json({ error: 'Erro ao salvar resultado do teste.' });
  }
}

// GET /speedtest/results  (operador)
// Lista testes com filtros (cpf, userId, status, from, to) e paginação.
async function listResults(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 20), 100);
    const result = await speedtestService.listResults({
      page,
      limit,
      cpf: req.query.cpf,
      userId: req.query.userId,
      status: req.query.status,
      from: parseDate(req.query.from),
      to: parseDate(req.query.to),
    });
    return res.status(200).json(result);
  } catch (err) {
    logger.error('speedtest listResults error', { error: err.message });
    return res.status(500).json({ error: 'Erro ao listar testes.' });
  }
}

// GET /speedtest/results/:id  (operador)
async function getResult(req, res) {
  try {
    const test = await speedtestService.getResult(req.params.id);
    if (!test) return res.status(404).json({ error: 'Teste não encontrado.' });
    return res.status(200).json(test);
  } catch (err) {
    logger.error('speedtest getResult error', { error: err.message });
    return res.status(500).json({ error: 'Erro ao buscar teste.' });
  }
}

// GET /speedtest/clients/:cpf/summary  (operador)
// Estatísticas agregadas + último teste de um cliente.
async function clientSummary(req, res) {
  try {
    const summary = await speedtestService.getClientSummary(req.params.cpf);
    return res.status(200).json(summary);
  } catch (err) {
    logger.error('speedtest clientSummary error', { error: err.message });
    return res.status(500).json({ error: 'Erro ao gerar resumo do cliente.' });
  }
}

module.exports = {
  download,
  upload,
  ping,
  submitResult,
  listResults,
  getResult,
  clientSummary,
};
