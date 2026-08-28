require('dd-trace').init({ logInjection: true });

const express = require('express');
const cors = require('cors');

const requestIntercepter = require('./utils/requestIntercepter');
const { swaggerUi, specs } = require('./utils/swagger');
const swaggerAuthMiddleware = require('./middlewares/authSwagger');

// ── Rotas (nova estrutura hexagonal) ─────────────────────────
const authRouter = require('./http/routes/authRouter');
const appRouter = require('./http/routes/appRouter');
const faturaRouter = require('./http/routes/faturaRouter');
const utilitiesRouter = require('./http/routes/utilitiesRouter');
const pushRouter = require('./http/routes/pushRouter');
const messagesRouter = require('./http/routes/messagesRouter');
const trelloRouter = require('./http/routes/trelloRouter');
const agendamentoRouter = require('./http/routes/agendamentoRouter');
const ehClienteRouter = require('./http/routes/ehClienteRouter');
const testRouter = require('./http/routes/testRouter');
const speedtestRouter = require('./http/routes/speedtestRouter');
const supportRouter = require('./http/routes/supportRouter');
const ticketRouter = require('./http/routes/ticketRouter');
const blogRouter = require('./http/routes/blogRouter');
const statsRouter = require('./http/routes/statsRouter');

const app = express();

app.use((req, res, next) => {
  try { decodeURIComponent(req.path); } catch { return res.status(400).send('Bad Request'); }
  next();
});

// O blog traz CORS e parser de JSON próprios: a origem vem de uma allowlist
// (nunca "*", por causa das rotas /blog/admin/*) e o JSON malformado precisa
// sair no formato de erro da spec. Por isso fica fora dos middlewares globais.
const doBlog = (req) => req.path === '/blog' || req.path.startsWith('/blog/');

app.use((req, res, next) => {
  if (req.path === '/eh-cliente' || doBlog(req)) return next();
  return cors()(req, res, next);
});

const jsonParser = express.json();
app.use((req, res, next) => {
  if (doBlog(req)) return next();
  return jsonParser(req, res, next);
});
app.use(express.urlencoded({ extended: true }));
app.all('*', requestIntercepter);

app.use('/', authRouter);
app.use('/app', appRouter);
app.use('/fatura', faturaRouter);
app.use('/utils', utilitiesRouter);
app.use('/push', pushRouter);
app.use('/messages', messagesRouter);
app.use('/trello', trelloRouter);
app.use('/agendamento', agendamentoRouter);
app.use('/test', testRouter);
app.use('/speedtest', speedtestRouter);
app.use('/support', supportRouter);
app.use('/tickets', ticketRouter);
app.use('/blog', blogRouter);
app.use('/stats', statsRouter);
app.use('/', ehClienteRouter);

app.get('/docs', swaggerAuthMiddleware, (req, res, next) => {
  swaggerUi.setup(specs)(req, res, next);
});
app.use('/docs', swaggerUi.serve);

app.use((err, req, res, next) => {
  if (err instanceof URIError) return res.status(400).send('Malformed URI');
  next(err);
});

module.exports = app;
