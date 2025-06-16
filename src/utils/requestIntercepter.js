const logger = require('./logger'); // já tá em utils também, então caminho relativo direto

const requestIntercepter = (req, res, next) => {
  res.on('finish', () => {
    logger.info(`${res.statusCode} ${req.method} ${req.originalUrl}`, {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      body: req.body,
      query: req.query,
      userId: req.userId, // opcional se tiver auth
    });
  });

  next();
};

module.exports = requestIntercepter;
