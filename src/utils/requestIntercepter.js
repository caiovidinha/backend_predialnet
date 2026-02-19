const logger = require('./logger');

// Campos sensíveis que nunca devem aparecer em logs
const SENSITIVE_FIELDS = new Set([
  'password', 'newPassword', 'token', 'refresh_token',
  'access_token', 'secret', 'authorization',
]);

const sanitizeBody = (body) => {
  if (!body || typeof body !== 'object') return body;
  return Object.fromEntries(
    Object.entries(body).map(([k, v]) =>
      SENSITIVE_FIELDS.has(k.toLowerCase()) ? [k, '[REDACTED]'] : [k, v]
    )
  );
};

const requestIntercepter = (req, res, next) => {
  res.on('finish', () => {
    logger.info(`${res.statusCode} ${req.method} ${req.originalUrl}`, {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      body: sanitizeBody(req.body),
      query: req.query,
    });
  });

  next();
};

module.exports = requestIntercepter;
