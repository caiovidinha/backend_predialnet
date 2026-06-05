const express = require("express");
const { ehCliente } = require("../controllers/ehClienteController");

const ehClienteRouter = express.Router();

const ACTIVATION_SITE_ORIGIN = "https://www.predialnet.com.br";

function ehClienteCors(req, res, next) {
  const requestOrigin = req.headers.origin;

  if (requestOrigin && requestOrigin !== ACTIVATION_SITE_ORIGIN) {
    return res.status(403).json({ message: "Origem não permitida." });
  }

  if (requestOrigin) {
    res.setHeader("Access-Control-Allow-Origin", ACTIVATION_SITE_ORIGIN);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  return next();
}

ehClienteRouter.options("/eh-cliente", ehClienteCors);
ehClienteRouter.post("/eh-cliente", ehClienteCors, ehCliente);

module.exports = ehClienteRouter;
