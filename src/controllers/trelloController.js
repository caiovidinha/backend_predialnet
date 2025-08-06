const { createCard } = require("../models/trello");
const logger = require("../utils/logger");

/**
 * POST /trello/clientes
 * Cria um card de cliente no Trello com os campos:
 *   Código Cliente, Nome, DDD + WhatsApp, Telefone para contato, Email, Plano atual, Plano alvo
 *
 * Body JSON:
 *   listId         – ID da lista Trello               (required)
 *   codcliente     – código interno do cliente        (required)
 *   nome           – nome completo do cliente         (required)
 *   whatsapp       – DDD + WhatsApp                   (optional)
 *   telefone       – Telefone para contato            (optional)
 *   email          – email do cliente                 (optional)
 *   planoAtual     – descrição do plano atual          (required)
 *   planoAlvo      – descrição do plano alvo           (required)
 */
async function sendClientToTrello(req, res) {
  const {
    listId,
    codcliente,
    nome,
    whatsapp,
    telefone,
    email,
    planoAtual,
    planoAlvo
  } = req.body;

  // validação mínima
  if (!listId || !codcliente || !nome || !whatsapp || !telefone || !email || !planoAtual || !planoAlvo) {
    return res.status(400).json({
      error: "Campos obrigatórios: listId, codcliente, nome, whatsapp, telefone, email, planoAtual, planoAlvo"
    });
  }

  // monta a descrição do card
  const desc = [
    `Código Cliente: ${codcliente}`,
    `Nome: ${nome}`,
    `DDD + WhatsApp: ${whatsapp}`,
    `Telefone para contato: ${telefone}`,
    `Email: ${email}`,
    `Plano atual: ${planoAtual}`,
    `Plano alvo: ${planoAlvo}`
  ].join("\n");

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
