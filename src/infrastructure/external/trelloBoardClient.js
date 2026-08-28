const axios = require('axios');
const logger = require('../../utils/logger');

// Leitura do board de upgrade de planos — o mesmo que o app alimenta pelo
// POST /trello/clientes.
//
// Deliberadamente NÃO reusa src/models/trello.js: aquele módulo lança erro já
// no require quando falta credencial, o que derrubaria o /stats inteiro. Aqui
// a ausência de chave é só um domínio indisponível.

const BASE = 'https://api.trello.com/1';
const BOARD = process.env.TRELLO_UPGRADES_BOARD_ID || 'D4P4xr4H';
const TIMEOUT = Number.parseInt(process.env.TRELLO_TIMEOUT_MS, 10) || 8000;

// A API do Trello não devolve mais que 1000 cartões por chamada; o board já
// passa disso, então precisa paginar.
const POR_PAGINA = 1000;
const MAX_PAGINAS = 12; // trava de segurança: 12 mil cartões

const credenciais = () => ({
  key: process.env.TRELLO_KEY,
  token: process.env.TRELLO_TOKEN,
});

const configurado = () => {
  const { key, token } = credenciais();
  return Boolean(key && token);
};

// O id do cartão carrega a data de criação nos primeiros 8 dígitos hex
// (segundos desde a época). É assim que dá para saber quando cada lead entrou
// sem pedir campo nenhum além do id — payload mínimo.
const criadoEm = (idCartao) => {
  if (typeof idCartao !== 'string' || idCartao.length < 8) return null;
  const segundos = Number.parseInt(idCartao.slice(0, 8), 16);
  if (!Number.isFinite(segundos)) return null;
  const data = new Date(segundos * 1000);
  return Number.isNaN(data.getTime()) ? null : data;
};

const pedir = async (caminho, params = {}) => {
  const { data } = await axios.get(`${BASE}${caminho}`, {
    params: { ...credenciais(), ...params },
    timeout: TIMEOUT,
  });
  return data;
};

const buscarListas = () =>
  pedir(`/boards/${BOARD}/lists`, { fields: 'id,name', filter: 'open' });

// Pagina para trás usando o próprio id como cursor: ids do Trello crescem com o
// tempo, então `before` sempre avança para cartões mais antigos.
const buscarCartoes = async () => {
  const cartoes = [];
  let cursor;

  for (let pagina = 0; pagina < MAX_PAGINAS; pagina += 1) {
    // eslint-disable-next-line no-await-in-loop
    const lote = await pedir(`/boards/${BOARD}/cards`, {
      fields: 'idList',
      filter: 'open',
      limit: POR_PAGINA,
      ...(cursor ? { before: cursor } : {}),
    });

    if (!Array.isArray(lote) || lote.length === 0) break;
    cartoes.push(...lote);
    if (lote.length < POR_PAGINA) break;

    cursor = lote[lote.length - 1].id;
  }

  return cartoes;
};

// Devolve null quando não dá para consultar — quem chama transforma isso em
// "indisponível" sem derrubar o resto do dashboard.
const buscarBoard = async () => {
  if (!configurado()) {
    logger.warn('stats: TRELLO_KEY/TRELLO_TOKEN ausentes — funil de upgrades indisponível');
    return null;
  }

  try {
    const [listas, cartoes] = await Promise.all([buscarListas(), buscarCartoes()]);
    return { listas, cartoes };
  } catch (err) {
    const status = err.response?.status;
    logger.warn('stats: falha ao ler o board de upgrades no Trello', {
      status,
      error: err.message,
      dica: status === 401 ? 'credenciais do Trello recusadas'
        : status === 404 ? `board ${BOARD} não encontrado ou sem acesso` : undefined,
    });
    return null;
  }
};

module.exports = { buscarBoard, criadoEm, configurado, BOARD };
