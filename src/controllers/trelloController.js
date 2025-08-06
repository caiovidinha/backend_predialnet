const { createCard } = require("../models/trello");
const logger = require("../utils/logger");

/**
 * POST /trello/clientes
 * Cria um card de cliente no Trello com:
 * - Código do cliente
 * - Nome
 * - (Opcional) DDD + WhatsApp
 * - Plano atual
 * - Plano alvo
 *
 * Body JSON:
 *   listId      – ID da lista Trello (required)
 *   codcliente  – código do cliente        (required)
 *   nome        – nome completo            (required)
 *   planoAtual  – descrição do plano atual  (required)
 *   planoAlvo   – descrição do plano alvo   (required)
 *   whatsapp    – DDD + WhatsApp            (optional)
 */
async function sendClientToTrello(req, res) {
  const {
    listId,
    codcliente,
    nome,
    planoAtual,
    planoAlvo,
    whatsapp
  } = req.body;

  // validação mínima
  if (!listId || !codcliente || !nome || !planoAtual || !planoAlvo) {
    return res.status(400).json({
      error: "Campos obrigatórios: listId, codcliente, nome, planoAtual, planoAlvo"
    });
  }

  // monta a descrição do card
  const descLines = [
    `Código Cliente: ${codcliente}`,
    `Nome: ${nome}`
  ];
  if (whatsapp) {
    descLines.push(`DDD + WhatsApp: ${whatsapp}`);
  }
  descLines.push(
    `Plano atual: ${planoAtual}`,
    `Plano alvo: ${planoAlvo}`
  );

  const desc = descLines.join("\n");

  try {
    const card = await createCard(listId, `Cliente ${codcliente} – ${nome}`, desc);
    return res.status(200).json({
      message: "Card criado com sucesso no Trello",
      cardId: card.id,
      cardUrl: card.url
    });
  } catch (err) {
    logger.error("Erro ao criar card de cliente no Trello:", err);
    return res.status(500).json({ error: "Erro interno ao enviar para Trello" });
  }
}

module.exports = {
  sendClientToTrello
};