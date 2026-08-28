jest.mock('../infrastructure/external/trelloBoardClient', () => {
  const real = jest.requireActual('../infrastructure/external/trelloBoardClient');
  return { ...real, buscarBoard: jest.fn() };
});

const trello = require('../infrastructure/external/trelloBoardClient');
const { upgrades, classificar } = require('../application/stats/UpgradesStats');

// Id de cartão do Trello carrega a data de criação nos 8 primeiros dígitos hex.
const idEm = (data, sufixo = '0000000000000000') =>
  Math.floor(data.getTime() / 1000).toString(16).padStart(8, '0') + sufixo;

const LISTAS = [
  { id: 'l1', name: 'Novos Leads' },
  { id: 'l2', name: 'Primeiro contato' },
  { id: 'l3', name: 'Instalação Agendada' },
  { id: 'l4', name: 'Lead convertido' },
  { id: 'l5', name: 'Lead não convertido' },
];

const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);
const anoPassado = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
const desde30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

const cartoes = (idList, quantos, data) =>
  Array.from({ length: quantos }, (_, i) => ({
    id: idEm(data, String(i).padStart(16, '0')),
    idList,
  }));

describe('upgrades: classificação das listas', () => {
  it('separa convertido de não convertido, apesar do prefixo comum', () => {
    expect(classificar('Lead convertido')).toBe('convertido');
    expect(classificar('Lead não convertido')).toBe('nao_convertido');
  });

  it('não se perde com acento nem caixa', () => {
    expect(classificar('LEAD NÃO CONVERTIDO')).toBe('nao_convertido');
    expect(classificar('lead nao convertido')).toBe('nao_convertido');
  });

  it('trata as demais colunas como etapas do funil', () => {
    for (const nome of ['Novos Leads', 'Primeiro contato', 'Instalação Agendada']) {
      expect(classificar(nome)).toBe('em_andamento');
    }
  });
});

describe('upgrades: agregação do board', () => {
  afterEach(() => jest.clearAllMocks());

  it('conta os cartões por lista e soma o funil', async () => {
    trello.buscarBoard.mockResolvedValue({
      listas: LISTAS,
      cartoes: [
        ...cartoes('l1', 93, ontem),
        ...cartoes('l2', 3, ontem),
        ...cartoes('l4', 1222, anoPassado),
        ...cartoes('l5', 145, anoPassado),
      ],
    });

    const r = await upgrades(desde30);

    expect(r.total).toBe(1463);
    expect(r.convertidos).toBe(1222);
    expect(r.nao_convertidos).toBe(145);
    expect(r.em_andamento).toBe(96);
    expect(r.funil.find((l) => l.lista === 'Novos Leads').cartoes).toBe(93);
    // Lista vazia continua no funil — sumir dela esconderia uma etapa parada.
    expect(r.funil.find((l) => l.lista === 'Instalação Agendada').cartoes).toBe(0);
  });

  it('calcula a taxa só sobre os leads já decididos', async () => {
    trello.buscarBoard.mockResolvedValue({
      listas: LISTAS,
      cartoes: [
        ...cartoes('l1', 900, ontem), // fila enorme não deve afundar a taxa
        ...cartoes('l4', 1222, anoPassado),
        ...cartoes('l5', 145, anoPassado),
      ],
    });

    const r = await upgrades(desde30);

    // 1222 / (1222 + 145) = 89,4% — os 900 em andamento ficam de fora.
    expect(r.taxa_conversao).toBe(89.4);
  });

  it('devolve taxa nula quando ninguém foi decidido ainda', async () => {
    trello.buscarBoard.mockResolvedValue({
      listas: LISTAS,
      cartoes: cartoes('l1', 10, ontem),
    });

    expect((await upgrades(desde30)).taxa_conversao).toBeNull();
  });

  it('conta como novos só os cartões criados dentro do período', async () => {
    trello.buscarBoard.mockResolvedValue({
      listas: LISTAS,
      cartoes: [...cartoes('l1', 5, ontem), ...cartoes('l4', 800, anoPassado)],
    });

    const r = await upgrades(desde30);

    expect(r.novos_periodo).toBe(5);
    expect(r.serie_novos).toHaveLength(1);
    expect(r.serie_novos[0].total).toBe(5);
  });

  it('ignora cartão de lista arquivada — não está mais no funil visível', async () => {
    trello.buscarBoard.mockResolvedValue({
      listas: LISTAS,
      cartoes: [...cartoes('l1', 4, ontem), ...cartoes('lista-arquivada', 50, ontem)],
    });

    expect((await upgrades(desde30)).total).toBe(4);
  });

  it('marca indisponível quando o Trello não responde', async () => {
    trello.buscarBoard.mockResolvedValue(null);
    expect(await upgrades(desde30)).toEqual({ erro: 'indisponivel' });
  });
});

describe('upgrades: data derivada do id do cartão', () => {
  it('extrai a criação dos 8 primeiros dígitos hex', () => {
    const alvo = new Date('2026-08-01T12:00:00Z');
    const extraida = trello.criadoEm(idEm(alvo));
    // Precisão de segundo: o id guarda segundos, não milissegundos.
    expect(Math.abs(extraida.getTime() - alvo.getTime())).toBeLessThan(1000);
  });

  it('devolve null para id malformado em vez de quebrar', () => {
    for (const id of [null, undefined, '', 'abc', 123]) {
      expect(trello.criadoEm(id)).toBeNull();
    }
  });
});
