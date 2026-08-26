const authService = require('../../application/blog/BlogAuthService');
const { naoAutenticado, semPermissao } = require('../../domain/blog/errors');

// Toda rota /blog/admin/* passa por aqui — inclusive as de leitura (seção 9).
// O painel estar numa URL não divulgada não conta como proteção.

const autenticar = (req, _res, next) => {
  const header = req.headers.authorization || '';
  const [esquema, token] = header.split(' ');

  if (!token || esquema.toLowerCase() !== 'bearer')
    return next(naoAutenticado('Token ausente, inválido ou expirado.'));

  try {
    req.blogUsuario = authService.verificarAccessToken(token);
    return next();
  } catch (err) {
    return next(err);
  }
};

const exigirPapel = (...papeis) => (req, _res, next) => {
  if (!req.blogUsuario) return next(naoAutenticado());
  if (!papeis.includes(req.blogUsuario.papel)) return next(semPermissao());
  return next();
};

module.exports = { autenticar, exigirPapel };
