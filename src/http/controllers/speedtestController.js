const crypto = require('crypto');

// Máximo de bytes servidos pelo download, para evitar abuso.
const MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024; // 100 MB
const DEFAULT_DOWNLOAD_BYTES = 12 * 1024 * 1024; // 12 MB
const DOWNLOAD_CHUNK_BYTES = 256 * 1024; // 256 KB por escrita

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
      const chunk = crypto.randomBytes(chunkSize);
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

module.exports = {
  download,
  upload,
  ping,
};
