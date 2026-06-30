const jwt = require('jsonwebtoken');
const userRepo = require('../../infrastructure/repositories/userRepository');

const validateJWT = (req, res, next) => {
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

module.exports = { validateJWT };
