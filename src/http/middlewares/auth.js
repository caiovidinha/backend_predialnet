const jwt = require('jsonwebtoken');
const userRepo = require('../../infrastructure/repositories/userRepository');

const jwtEnabled = () => process.env.ENABLE_JWT === 'true';

const validateJWT = (req, res, next) => {
  if (!jwtEnabled()) return next();

  const token = req.headers['x-access-token'];

  if (process.env.ADMIN_BYPASS_TOKEN && token === process.env.ADMIN_BYPASS_TOKEN) {
    req.userId = 'admin-dashboard';
    req.cpf = null;
    return next();
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, async (err, decoded) => {
    if (err) return res.status(401).end();

    const user = await userRepo.findById(decoded.userId);
    if (!user) return res.status(401).end();

    req.userId = user.id;
    req.cpf = user.cpf;
    next();
  });
};

// Restringe a rota ao dashboard do operador (ADMIN_BYPASS_TOKEN).
// Em ambientes sem JWT (ENABLE_JWT != 'true') libera, para dev.
const requireAdmin = (req, res, next) => {
  if (!jwtEnabled()) return next();
  if (req.userId === 'admin-dashboard') return next();
  return res.status(403).end();
};

module.exports = { validateJWT, requireAdmin };
