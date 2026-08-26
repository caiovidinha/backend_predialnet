const midia = require('../../infrastructure/storage/blogMedia');
const auditRepo = require('../../infrastructure/repositories/blogAuditRepository');
const { validacao, naoEncontrado, BlogError } = require('../../domain/blog/errors');

// Upload de imagem do painel (seção 5) e leitura pública em /blog/midia/:arquivo.

const BASE_PUBLICA = (process.env.BLOG_PUBLIC_BASE_URL || 'https://appgw.predialnet.com.br')
  .replace(/\/+$/, '');

const urlDe = (arquivo) => `${BASE_PUBLICA}/blog/midia/${arquivo}`;

const enviar = async (arquivo, autor, ip) => {
  if (!arquivo?.buffer?.length) throw validacao({ arquivo: 'Envie um arquivo no campo "arquivo".' });

  const resultado = await midia.salvar(arquivo.buffer);

  if (resultado.erro === 'tipo_invalido')
    throw validacao({ arquivo: 'Formato não aceito. Use JPEG, PNG, WebP ou AVIF.' });

  if (resultado.erro === 'muito_grande')
    throw new BlogError(413, 'arquivo_grande', `O arquivo excede ${midia.MAX_BYTES / (1024 * 1024)} MB.`);

  await auditRepo.registrar({
    usuario: autor,
    acao: 'upload',
    entidade: 'midia',
    entidadeId: resultado.arquivo,
    detalhes: { mime: resultado.mime, tamanho: resultado.tamanho },
    ip,
  });

  return {
    url: urlDe(resultado.arquivo),
    largura: resultado.largura,
    altura: resultado.altura,
    tamanho: resultado.tamanho,
  };
};

const obter = async (nomeArquivo) => {
  const conteudo = await midia.ler(nomeArquivo);
  if (!conteudo) throw naoEncontrado('Imagem não encontrada.');
  return conteudo;
};

module.exports = { enviar, obter, urlDe };
