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

// Pagina para trás com o id como cursor: ids do Trello crescem com o tempo,
// então `before` avança para cartões mais antigos.
//
// Duas proteções que não são paranoia — a ausência delas inflava a contagem:
//
// 1. O cursor é o MENOR id do lote, não o último. A API não garante ordem por
//    id, e usar o último faria a página seguinte cobrir de novo um pedaço do
//    intervalo já lido.
// 2. Deduplicação por id. Mesmo com o cursor certo, cartão movido de lista
//    durante a paginação pode reaparecer. Contar duas vezes é pior que demorar.
const buscarCartoes = async () => {
  const porId = new Map();
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

    const antes = porId.size;
    let menorId = null;
    for (const cartao of lote) {
      if (!cartao?.id) continue;
      porId.set(cartao.id, cartao);
      if (menorId === null || cartao.id < menorId) menorId = cartao.id;
    }

    const novos = porId.size - antes;
    if (novos !== lote.length) {
      logger.warn('stats: Trello devolveu cartões repetidos na paginação', {
        pagina, no_lote: lote.length, novos,
      });
    }

    // Lote inteiro repetido significa que o cursor parou de avançar — sair aqui
    // evita laço infinito até o teto de páginas.
    if (novos === 0) break;
    if (lote.length < POR_PAGINA) break;

    cursor = menorId;
  }

  return [...porId.values()];
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
