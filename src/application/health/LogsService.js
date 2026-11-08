const fs = require('fs');
const path = require('path');

const LOG_DIR = process.env.PM2_LOG_DIR || '/root/.pm2/logs';

// Nunca lê o arquivo inteiro: tem log nesse servidor passando de 700 MB, e
// carregar isso em memória de uma vez derrubaria o processo. Lê só o final.
const MAX_READ_BYTES = 5 * 1024 * 1024; // 5 MB

const listarArquivos = () => fs.readdirSync(LOG_DIR)
  .filter(f => f.endsWith('.log'))
  .map(f => {
    const stat = fs.statSync(path.join(LOG_DIR, f));
    return { arquivo: f, tamanhoMb: stat.size / 1024 / 1024, modificadoEm: stat.mtime };
  })
  .sort((a, b) => b.modificadoEm - a.modificadoEm);

// `nome` tem que bater exatamente com um arquivo listado acima — é assim que
// a validação impede ler qualquer outro arquivo do servidor (path traversal).
const lerArquivo = (nome, { linhas = 200, busca } = {}) => {
  const disponiveis = listarArquivos().map(a => a.arquivo);
  if (!disponiveis.includes(nome)) {
    const err = new Error('Arquivo não encontrado.');
    err.status = 404;
    throw err;
  }

  const caminho = path.join(LOG_DIR, nome);
  const { size } = fs.statSync(caminho);
  const inicio = Math.max(0, size - MAX_READ_BYTES);
  const tamanhoLido = size - inicio;

  const fd = fs.openSync(caminho, 'r');
  let bruto;
  try {
    const buffer = Buffer.alloc(tamanhoLido);
    fs.readSync(fd, buffer, 0, tamanhoLido, inicio);
    bruto = buffer.toString('utf8');
  } finally {
    fs.closeSync(fd);
  }

  let todasLinhas = bruto.split('\n').filter(Boolean);
  // Começamos no meio do arquivo (size - MAX_READ_BYTES): a primeira linha
  // pode ter sido cortada ao meio, então descartamos ela.
  if (inicio > 0) todasLinhas.shift();

  if (busca) {
    const termo = busca.toLowerCase();
    todasLinhas = todasLinhas.filter(l => l.toLowerCase().includes(termo));
  }

  const limite = Math.min(Math.max(Number.parseInt(linhas, 10) || 200, 1), 2000);

  return {
    arquivo: nome,
    tamanhoTotalMb: size / 1024 / 1024,
    truncado: inicio > 0, // true = não lemos o arquivo inteiro, só o final
    linhas: todasLinhas.slice(-limite),
  };
};

module.exports = { listarArquivos, lerArquivo };
