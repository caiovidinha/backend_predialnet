require('dd-trace').init({
  logInjection: true
});

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const requestIntercepter = require("./utils/requestIntercepter");
const loginRouter = require("./routes/loginRouter");
const testRouter = require("./routes/testRouter");
const faturaRouter = require("./routes/faturaRouter");
const utilitiesRouter = require("./routes/utilitiesRouter");
const agendamentoRouter = require("./routes/agendamentoRouter");
const pushRouter = require("./routes/pushRouter");
const trelloRouter = require("./routes/trelloRouter");

const { swaggerUi, specs } = require("./utils/swagger");
const swaggerAuthMiddleware = require("./middlewares/authSwagger");

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "https://predialnet.com.br").split(",");

const app = express();

// Security headers
app.use(helmet());

// Restrict CORS to known origins
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl in dev)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS bloqueado para origem: ${origin}`));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-access-token"],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.all("*", requestIntercepter);
app.use("/", loginRouter);
app.use("/test", testRouter);
app.use("/fatura", faturaRouter);
app.use("/utils", utilitiesRouter);
app.use("/agendamento", agendamentoRouter);
app.use("/push", pushRouter);
app.use("/trello", trelloRouter);

// Proteger só a rota principal do Swagger UI
app.get("/docs", swaggerAuthMiddleware, (req, res, next) => {
  swaggerUi.setup(specs)(req, res, next);
});

// Servir os assets normalmente (sem proteção)
app.use("/docs", swaggerUi.serve);

module.exports = app;
