const trello = require('../../infrastructure/external/trelloBoardClient');

// Funil de upgrade de planos, lido do board do Trello que o app alimenta.
//
// A classificação é por nome de lista, e não por id: id de lista muda quando
// alguém recria a coluna, e aí a estatística quebraria silenciosamente. Nome
// normalizado sobrevive a "Lead Convertido" virar "lead convertido".

const normalizar = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')  // tira os acentos separados pelo NFD
    .toLowerCase()
    .trim();

// "Lead não convertido" contém "convertido" também — por isso a negativa é
// testada primeiro.
const classificar = (nomeLista) => {
  const n = normalizar(nomeLista);
  if (/\bnao\b/.test(n) && n.includes('convertido')) return 'nao_convertido';
  if (n.includes('convertido')) return 'convertido';
  return 'em_andamento';
};

const diaISO = (data) => data.toISOString().slice(0, 10);

const montarSerie = (datas, desde) => {
  const porDia = new Map();
  for (const data of datas) {
    if (!data || data < desde) continue;
    const dia = diaISO(data);
    porDia.set(dia, (porDia.get(dia) ?? 0) + 1);
  }
  return [...porDia.entries()]
    .map(([dia, total]) => ({ dia, total }))
    .sort((a, b) => a.dia.localeCompare(b.dia));
};

const upgrades = async (desde) => {
  const board = await trello.buscarBoard();
  if (!board) return { erro: 'indisponivel' };

  const { listas, cartoes } = board;

  const porLista = new Map(listas.map((l) => [l.id, { nome: l.name, cartoes: 0, datas: [] }]));

  for (const cartao of cartoes) {
    const lista = porLista.get(cartao.idList);
    // Cartão em lista arquivada não aparece em `listas`: fica de fora da
    // contagem, que é o certo — ele não está mais no funil visível.
    if (!lista) continue;
    lista.cartoes += 1;
    lista.datas.push(trello.criadoEm(cartao.id));
  }

  const funil = [...porLista.values()].map((l) => ({
    lista: l.nome,
    cartoes: l.cartoes,
    tipo: classificar(l.nome),
  }));

  const somar = (tipo) => funil
    .filter((l) => l.tipo === tipo)
    .reduce((total, l) => total + l.cartoes, 0);

  const convertidos = somar('convertido');
  const naoConvertidos = somar('nao_convertido');
  const emAndamento = somar('em_andamento');
  const decididos = convertidos + naoConvertidos;

  const todasAsDatas = [...porLista.values()].flatMap((l) => l.datas);
  const novos = todasAsDatas.filter((d) => d && d >= desde).length;

  return {
    board: trello.BOARD,
    funil,
    total: convertidos + naoConvertidos + emAndamento,
    convertidos,
    nao_convertidos: naoConvertidos,
    em_andamento: emAndamento,
    // Denominador são só os leads já decididos: incluir quem ainda está na fila
    // afundaria a taxa sem significar perda.
    taxa_conversao: decididos
      ? Number(((convertidos / decididos) * 100).toFixed(1))
      : null,
    novos_periodo: novos,
    serie_novos: montarSerie(todasAsDatas, desde),
  };
};

module.exports = { upgrades, classificar, normalizar };
