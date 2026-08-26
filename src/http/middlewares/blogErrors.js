const { BlogError } = require('../../domain/blog/errors');
const logger = require('../../utils/logger');

// Envolve handlers async para que uma promise rejeitada caia no tratador
// abaixo em vez de virar unhandledRejection.
const envolver = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

// Tradução de erro do Prisma para o vocabulário da seção 7.
const doPrisma = (err) => {
  if (err.code === 'P2002') return { status: 409, erro: 'conflito', mensagem: 'Já existe um registro com este valor.' };
  if (err.code === 'P2025') return { status: 404, erro: 'nao_encontrado', mensagem: 'Recurso não encontrado.' };
  if (err.code === 'P2003') return { status: 422, erro: 'validacao', mensagem: 'Referência inválida.' };
  return null;
};

// Tratador de erros do blog. Mantém o formato único { erro, mensagem, campos? }
// e nunca vaza stack trace para o cliente.
// eslint-disable-next-line no-unused-vars
const tratarErros = (err, req, res, _next) => {
  if (err instanceof BlogError) {
    if (err.retryAfter) res.set('Retry-After', String(err.retryAfter));
    return res.status(err.status).json(err.toBody());
  }

  // JSON malformado vindo do express.json().
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError)
    return res.status(400).json({ erro: 'requisicao_invalida', mensagem: 'O corpo da requisição não é um JSON válido.' });

  if (err.type === 'entity.too.large')
    return res.status(413).json({ erro: 'requisicao_invalida', mensagem: 'Corpo da requisição grande demais.' });

  const prisma = doPrisma(err);
  if (prisma) {
    const { status, ...body } = prisma;
    return res.status(status).json(body);
  }

  logger.error('blog: erro interno', {
    path: req.originalUrl,
    method: req.method,
    error: err.message,
    stack: err.stack,
  });

  return res.status(500).json({ erro: 'erro_interno', mensagem: 'Erro interno. Tente novamente em instantes.' });
};

module.exports = { envolver, tratarErros };
