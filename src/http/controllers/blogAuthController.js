const authService = require('../../application/blog/BlogAuthService');
const { ipDe } = require('../middlewares/rateLimit');

// Autenticação do painel (seção 4). O refresh token vai no corpo da resposta —
// o painel guarda o access em memória e o refresh em sessionStorage.

const login = async (req, res) => {
  const sessao = await authService.login({
    usuario: req.body?.usuario,
    senha: req.body?.senha,
    ip: ipDe(req),
  });

  // Login que deu certo não consome cota do rate limit: o limite existe para
  // travar força bruta, não para atrapalhar quem digita a senha certa.
  if (typeof req.consumirRateLimit === 'function') req.consumirRateLimit();

  return res.status(200).json(sessao);
};

const refresh = async (req, res) => {
  const sessao = await authService.refresh({ refreshToken: req.body?.refresh_token });
  return res.status(200).json(sessao);
};

const logout = async (req, res) => {
  await authService.logout({ refreshToken: req.body?.refresh_token });
  return res.status(204).end();
};

const eu = async (req, res) => res.status(200).json({ usuario: req.blogUsuario });

module.exports = { login, refresh, logout, eu };
