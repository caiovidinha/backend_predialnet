const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const logger = require('../../utils/logger');

// Armazenamento das imagens do blog em disco local (uploads/blog por padrão).
// A API serve os arquivos em GET /blog/midia/:arquivo — o diretório não é
// executável por nada: só devolvemos o conteúdo com o Content-Type da tabela
// abaixo, então um .php renomeado para .jpg não vira código.

const DIRETORIO = process.env.BLOG_MEDIA_DIR
  ? path.resolve(process.env.BLOG_MEDIA_DIR)
  : path.resolve(process.cwd(), 'uploads', 'blog');

const MAX_BYTES = (Number.parseInt(process.env.BLOG_UPLOAD_MAX_MB, 10) || 8) * 1024 * 1024;
const LARGURA_MAXIMA = Number.parseInt(process.env.BLOG_IMAGE_MAX_WIDTH, 10) || 1600;

const TIPOS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

const EXTENSOES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif' };

// Só nomes que nós mesmos geramos passam — corta path traversal na raiz.
const NOME_VALIDO = /^[a-f0-9]{16}\.(jpg|png|webp|avif)$/;

// sharp é opcional: se estiver instalado, redimensionamos e convertemos para
// WebP; se não, o arquivo original é gravado depois de validado.
let sharp = null;
try {
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  sharp = require('sharp');
} catch {
  sharp = null;
}

const temSharp = () => Boolean(sharp);

// ── Detecção de tipo por magic bytes ─────────────────────────
// A extensão e o Content-Type do multipart vêm do cliente; nenhum dos dois
// serve como prova. O que vale é o conteúdo.

const detectarTipo = (buf) => {
  if (!Buffer.isBuffer(buf) || buf.length < 16) return null;

  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';

  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return 'image/png';

  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP')
    return 'image/webp';

  // AVIF/HEIF: caixa ftyp com a marca no offset 8.
  if (buf.subarray(4, 8).toString('ascii') === 'ftyp') {
    const marca = buf.subarray(8, 12).toString('ascii');
    if (marca === 'avif' || marca === 'avis') return 'image/avif';
  }

  return null;
};

// ── Dimensões sem sharp ──────────────────────────────────────
// Leitura direta do cabeçalho. AVIF fica de fora (exige percorrer as caixas
// ISOBMFF); nesse caso devolvemos null e o site usa a proporção do CSS.

const dimensoesPng = (buf) => ({
  largura: buf.readUInt32BE(16),
  altura: buf.readUInt32BE(20),
});

const dimensoesJpeg = (buf) => {
  let off = 2;
  while (off + 9 < buf.length) {
    if (buf[off] !== 0xff) { off += 1; continue; }
    const marcador = buf[off + 1];
    // SOF0–SOF15, menos DHT (C4), JPG (C8) e DAC (CC), trazem o tamanho.
    if (marcador >= 0xc0 && marcador <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marcador))
      return { altura: buf.readUInt16BE(off + 5), largura: buf.readUInt16BE(off + 7) };
    off += 2 + buf.readUInt16BE(off + 2);
  }
  return { largura: null, altura: null };
};

const dimensoesWebp = (buf) => {
  const formato = buf.subarray(12, 16).toString('ascii');

  if (formato === 'VP8 ' && buf.length > 29)
    return { largura: buf.readUInt16LE(26) & 0x3fff, altura: buf.readUInt16LE(28) & 0x3fff };

  if (formato === 'VP8L' && buf.length > 25) {
    const bits = buf.readUInt32LE(21);
    return { largura: (bits & 0x3fff) + 1, altura: ((bits >> 14) & 0x3fff) + 1 };
  }

  if (formato === 'VP8X' && buf.length > 30)
    return { largura: buf.readUIntLE(24, 3) + 1, altura: buf.readUIntLE(27, 3) + 1 };

  return { largura: null, altura: null };
};

const medir = (buf, mime) => {
  try {
    if (mime === 'image/png') return dimensoesPng(buf);
    if (mime === 'image/jpeg') return dimensoesJpeg(buf);
    if (mime === 'image/webp') return dimensoesWebp(buf);
  } catch {
    // cabeçalho truncado ou fora do padrão: segue sem dimensões
  }
  return { largura: null, altura: null };
};

// ── Gravação ─────────────────────────────────────────────────

const garantirDiretorio = () => fs.mkdir(DIRETORIO, { recursive: true });

const caminhoDe = (arquivo) => path.join(DIRETORIO, arquivo);

const processar = async (buffer, mime) => {
  if (!sharp) return { buffer, mime, ...medir(buffer, mime) };

  try {
    const imagem = sharp(buffer, { failOn: 'none' });
    const meta = await imagem.metadata();
    const precisaEncolher = meta.width && meta.width > LARGURA_MAXIMA;

    const saida = await (precisaEncolher
      ? imagem.resize({ width: LARGURA_MAXIMA, withoutEnlargement: true })
      : imagem
    ).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });

    return {
      buffer: saida.data,
      mime: 'image/webp',
      largura: saida.info.width,
      altura: saida.info.height,
    };
  } catch (err) {
    // Falha no processamento não deve impedir o upload: grava o original.
    logger.warn('blog: sharp falhou, gravando imagem original', { error: err.message });
    return { buffer, mime, ...medir(buffer, mime) };
  }
};

// Recebe o buffer cru do multer e devolve os metadados já gravados.
const salvar = async (buffer) => {
  const mimeOriginal = detectarTipo(buffer);
  if (!mimeOriginal) return { erro: 'tipo_invalido' };
  if (buffer.length > MAX_BYTES) return { erro: 'muito_grande' };

  const processada = await processar(buffer, mimeOriginal);
  const extensao = TIPOS[processada.mime] ?? 'bin';
  const arquivo = `${crypto.randomBytes(8).toString('hex')}.${extensao}`;

  await garantirDiretorio();
  await fs.writeFile(caminhoDe(arquivo), processada.buffer);

  return {
    arquivo,
    mime: processada.mime,
    tamanho: processada.buffer.length,
    largura: processada.largura ?? null,
    altura: processada.altura ?? null,
  };
};

const ler = async (arquivo) => {
  if (!NOME_VALIDO.test(arquivo)) return null;
  try {
    const conteudo = await fs.readFile(caminhoDe(arquivo));
    const extensao = arquivo.split('.').pop();
    return { conteudo, mime: EXTENSOES[extensao] ?? 'application/octet-stream' };
  } catch {
    return null;
  }
};

module.exports = {
  salvar,
  ler,
  detectarTipo,
  medir,
  temSharp,
  NOME_VALIDO,
  DIRETORIO,
  MAX_BYTES,
  LARGURA_MAXIMA,
  TIPOS,
};
