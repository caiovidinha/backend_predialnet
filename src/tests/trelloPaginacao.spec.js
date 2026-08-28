// Paginação do board do Trello: o risco aqui não é perder cartão, é contar
// duas vezes — foi o que inflou o total de convertidos em produção.
jest.mock('axios');

const axios = require('axios');

const idEm = (segundos, sufixo) =>
  segundos.toString(16).padStart(8, '0') + String(sufixo).padStart(16, '0');

// Cartões com id decrescente no tempo: o mais novo primeiro.
const gerar = (quantos, deslocamento = 0, idList = 'l4') =>
  Array.from({ length: quantos }, (_, i) => ({
    id: idEm(1_700_000_000 - (deslocamento + i), deslocamento + i),
    idList,
  }));

// Sem jest.resetModules() de propósito: o reset faria o módulo sob teste
// receber uma instância diferente do mock do axios, e o mockImplementation
// daqui não chegaria nele.
const cliente = require('../infrastructure/external/trelloBoardClient');

describe('trello: paginação do board', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TRELLO_KEY = 'k';
    process.env.TRELLO_TOKEN = 't';
  });

  it('não conta o mesmo cartão duas vezes quando as páginas se sobrepõem', async () => {
    const pagina1 = gerar(1000, 0);
    // O que a API devolvia de fato: a segunda página repetindo 380 cartões da
    // primeira, mais 463 inéditos.
    const pagina2 = [...pagina1.slice(620), ...gerar(463, 1000)];

    axios.get.mockImplementation((url) => {
      if (url.includes('/lists')) return Promise.resolve({ data: [{ id: 'l4', name: 'Lead convertido' }] });
      const chamada = axios.get.mock.calls.filter((c) => c[0].includes('/cards')).length;
      return Promise.resolve({ data: chamada === 1 ? pagina1 : chamada === 2 ? pagina2 : [] });
    });

    const board = await cliente.buscarBoard();

    // 1000 + 463 únicos. Sem a deduplicação viriam 1843.
    expect(board.cartoes).toHaveLength(1463);
    const ids = new Set(board.cartoes.map((c) => c.id));
    expect(ids.size).toBe(board.cartoes.length);
  });

  it('usa o menor id do lote como cursor, não o último', async () => {
    // Lote deliberadamente fora de ordem: o último elemento NÃO é o mais antigo.
    const fora = gerar(1000, 0);
    const embaralhado = [...fora.slice(500), ...fora.slice(0, 500)];
    const menorId = fora.reduce((min, c) => (c.id < min ? c.id : min), fora[0].id);

    axios.get.mockImplementation((url) => {
      if (url.includes('/lists')) return Promise.resolve({ data: [{ id: 'l4', name: 'Lead convertido' }] });
      const chamada = axios.get.mock.calls.filter((c) => c[0].includes('/cards')).length;
      return Promise.resolve({ data: chamada === 1 ? embaralhado : [] });
    });

    await cliente.buscarBoard();

    const segunda = axios.get.mock.calls.filter((c) => c[0].includes('/cards'))[1];
    expect(segunda[1].params.before).toBe(menorId);
    // O último do lote embaralhado é mais NOVO que o menor — usá-lo releria
    // o intervalo já coberto.
    expect(segunda[1].params.before).not.toBe(embaralhado[embaralhado.length - 1].id);
  });

  it('para quando uma página inteira é repetida, sem laço infinito', async () => {
    const pagina = gerar(1000, 0);

    axios.get.mockImplementation((url) => {
      if (url.includes('/lists')) return Promise.resolve({ data: [{ id: 'l4', name: 'Lead convertido' }] });
      return Promise.resolve({ data: pagina }); // sempre a mesma
    });

    const board = await cliente.buscarBoard();

    expect(board.cartoes).toHaveLength(1000);
    // Duas chamadas de cards: a primeira e a que revelou a repetição.
    expect(axios.get.mock.calls.filter((c) => c[0].includes('/cards'))).toHaveLength(2);
  });

  it('encerra na primeira página quando o board é pequeno', async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes('/lists')) return Promise.resolve({ data: [{ id: 'l4', name: 'Lead convertido' }] });
      return Promise.resolve({ data: gerar(42, 0) });
    });

    const board = await cliente.buscarBoard();

    expect(board.cartoes).toHaveLength(42);
    expect(axios.get.mock.calls.filter((c) => c[0].includes('/cards'))).toHaveLength(1);
  });
});
