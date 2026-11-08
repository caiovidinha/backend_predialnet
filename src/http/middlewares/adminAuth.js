// Proteção dos endpoints administrativos (envio de push por targeting/endereço,
// painéis de monitoramento/saúde). Independente de ENABLE_JWT de propósito:
// esse flag está desligado em produção, então validateJWT/requireAdmin
// (src/http/middlewares/auth.js) são no-op — isso deixaria esses endpoints
// sem nenhuma proteção. O painel de avisos e o dashboard já enviam esse
// mesmo header hoje (x-access-token: ADMIN_BYPASS_TOKEN).
const requireAdminToken = (req, res, next) => {
  const token = req.headers['x-access-token'];
  if (!process.env.ADMIN_BYPASS_TOKEN || token !== process.env.ADMIN_BYPASS_TOKEN) {
    return res.status(403).json({ error: 'Acesso não autorizado' });
  }
  next();
};

module.exports = { requireAdminToken };
