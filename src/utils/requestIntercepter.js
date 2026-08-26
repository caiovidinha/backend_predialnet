const logger = require('./logger'); // já tá em utils também, então caminho relativo direto

// Campos que nunca podem ir para o log. O interceptador roda no 'finish', ou
// seja, depois do body parser — sem isso, um POST de login gravaria a senha em
// texto puro no Winston/Datadog.
const CAMPOS_SENSIVEIS = [
  'senha', 'password', 'novaSenha', 'newPassword', 'confirmarSenha',
  'token', 'access_token', 'refresh_token', 'accessToken', 'refreshToken',
  'authorization', 'code', 'codigo',
];

const censurar = (valor) => {
  if (!valor || typeof valor !== 'object') return valor;
  if (Array.isArray(valor)) return valor.map(censurar);

  return Object.fromEntries(
    Object.entries(valor).map(([chave, v]) =>
      (CAMPOS_SENSIVEIS.includes(chave) ? [chave, '[oculto]'] : [chave, censurar(v)])),
  );
};

const requestIntercepter = (req, res, next) => {
  res.on('finish', () => {
    logger.info(`${res.statusCode} ${req.method} ${req.originalUrl}`, {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      body: censurar(req.body),
      query: censurar(req.query),
    });
  });

  next();
};

module.exports = requestIntercepter;
