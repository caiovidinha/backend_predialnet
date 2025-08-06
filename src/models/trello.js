const axios = require("axios");

const TRELLO_KEY   = process.env.TRELLO_KEY;
const TRELLO_TOKEN = process.env.TRELLO_TOKEN;
if (!TRELLO_KEY || !TRELLO_TOKEN) {
  throw new Error("TRELLO_KEY e TRELLO_TOKEN devem estar definidos no .env");
}

/**
 * Cria um card numa lista qualquer.
 * @param {string} listId – ID da lista do Trello
 * @param {string} name   – título do card
 * @param {string} desc   – descrição do card
 */
async function createCard(listId, name, desc) {
  const res = await axios.post("https://api.trello.com/1/cards", null, {
    params: {
      idList: listId,
      name,
      desc,
      key: TRELLO_KEY,
      token: TRELLO_TOKEN
    }
  });
  return res.data;
}

module.exports = {
  createCard
};