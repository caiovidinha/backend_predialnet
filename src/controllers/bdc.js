// controllers/bdc.js — endpoints do Server-Driven UI (BDC).
const logger = require("../utils/logger");
const bdc = require("../models/bdc");

/** GET /app/screen/:name — árvore SDUI da tela (apenas layout, sem dado sensível). */
const getScreen = async (req, res) => {
  const { name } = req.params;
  try {
    const data = bdc.getScreen(name);
    if (!data) {
      return res.status(404).json({ error: `Tela não encontrada: ${name}` });
    }
    return res.status(200).json(data);
  } catch (error) {
    logger.error("Erro em BDC getScreen", { name, error: error.message });
    return res.status(500).json({ error: error.message });
  }
};

/** GET /app/content — flags/config globais. */
const getContent = async (req, res) => {
  try {
    return res.status(200).json(bdc.getContent());
  } catch (error) {
    logger.error("Erro em BDC getContent", { error: error.message });
    return res.status(500).json({ error: error.message });
  }
};

/** GET /app/version-check — gate de versão por plataforma. */
const getVersionCheck = async (req, res) => {
  try {
    const platform = String(req.query.platform || "android");
    return res.status(200).json(bdc.getVersion(platform));
  } catch (error) {
    logger.error("Erro em BDC getVersionCheck", { error: error.message });
    return res.status(500).json({ error: error.message });
  }
};

module.exports = { getScreen, getContent, getVersionCheck };
