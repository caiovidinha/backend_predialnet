const { Prisma } = require('@prisma/client');
const { client } = require('../../prisma/client');

// Funil das parcerias do Assine Já. A gravação é um insert por evento; a
// leitura é sempre agregada — o dashboard conta sessões, não lista pessoas.
//
// Mesmo cuidado do statsRepository: COUNT() em $queryRaw volta BigInt no
// MySQL, e BigInt quebra o JSON.stringify. Tudo passa por num().

const num = (v) => (v === null || v === undefined ? 0 : Number(v));

// O createdAt é gravado em UTC. Sem converter, o "dia" vira às 21h de
// Brasília e o evento das 22h aparece no dia seguinte. Offset fixo porque o
// Brasil não tem horário de verão desde 2019 e o CONVERT_TZ com nome de fuso
// depende das tabelas de timezone do MySQL, que nem sempre estão carregadas.
const DIA_BRT = Prisma.sql`DATE(CONVERT_TZ(createdAt, '+00:00', '-03:00'))`;

// Cada etapa conta SESSÕES distintas: quem consulta três CEPs é um visitante
// que consultou, não três. É o que faz o funil fechar (etapa n ≤ etapa n-1).
const COLUNAS_DO_FUNIL = Prisma.sql`
  COUNT(DISTINCT CASE WHEN evento = 'acesso' THEN sessao END) AS visitantes,
  COUNT(DISTINCT CASE WHEN evento = 'consulta' THEN sessao END) AS consultas,
  COUNT(DISTINCT CASE WHEN evento = 'consulta' AND detalhe IN ('com_planos', 'plano_indisponivel', 'so_regiao') THEN sessao END) AS com_cobertura,
  COUNT(DISTINCT CASE WHEN evento = 'consulta' AND detalhe = 'sem_cobertura' THEN sessao END) AS sem_cobertura,
  COUNT(DISTINCT CASE WHEN evento = 'consulta' AND detalhe = 'a_confirmar' THEN sessao END) AS cobertura_a_confirmar,
  COUNT(DISTINCT CASE WHEN evento = 'dados' THEN sessao END) AS dados,
  COUNT(DISTINCT CASE WHEN evento = 'envio' AND detalhe IN ('registrado', 'chat') THEN sessao END) AS formularios,
  COUNT(DISTINCT CASE WHEN evento = 'envio' AND detalhe = 'chat' THEN sessao END) AS chat,
  COUNT(DISTINCT CASE WHEN evento = 'envio' AND detalhe = 'falhou' THEN sessao END) AS envio_falhou,
  COUNT(DISTINCT CASE WHEN evento = 'whatsapp' THEN sessao END) AS whatsapp`;

const CAMPOS_DO_FUNIL = [
  'visitantes', 'consultas', 'com_cobertura', 'sem_cobertura', 'cobertura_a_confirmar',
  'dados', 'formularios', 'chat', 'envio_falhou', 'whatsapp',
];

const funilDe = (linha) => Object.fromEntries(CAMPOS_DO_FUNIL.map((c) => [c, num(linha?.[c])]));

const filtro = (desde, parceria) => (parceria
  ? Prisma.sql`WHERE createdAt >= ${desde} AND parceria = ${parceria}`
  : Prisma.sql`WHERE createdAt >= ${desde}`);

const registrar = (dados) => client.parceriaEvento.create({ data: dados, select: { id: true } });

const totais = async (desde, parceria) => {
  const [linha] = await client.$queryRaw`SELECT ${COLUNAS_DO_FUNIL} FROM parceria_eventos ${filtro(desde, parceria)}`;
  return funilDe(linha);
};

const porParceria = async (desde, parceria) => {
  const linhas = await client.$queryRaw`
    SELECT parceria, ${COLUNAS_DO_FUNIL}, MAX(createdAt) AS ultimo_evento
    FROM parceria_eventos ${filtro(desde, parceria)}
    GROUP BY parceria
    ORDER BY visitantes DESC, parceria ASC`;
  return linhas.map((l) => ({
    parceria: l.parceria,
    ...funilDe(l),
    ultimo_evento: l.ultimo_evento ? new Date(l.ultimo_evento).toISOString() : null,
  }));
};

const porDia = async (desde, parceria, { separarParceria = false } = {}) => {
  const linhas = separarParceria
    ? await client.$queryRaw`
        SELECT ${DIA_BRT} AS dia, parceria, ${COLUNAS_DO_FUNIL}
        FROM parceria_eventos ${filtro(desde, parceria)}
        GROUP BY dia, parceria
        ORDER BY dia ASC, parceria ASC`
    : await client.$queryRaw`
        SELECT ${DIA_BRT} AS dia, ${COLUNAS_DO_FUNIL}
        FROM parceria_eventos ${filtro(desde, parceria)}
        GROUP BY dia
        ORDER BY dia ASC`;
  return linhas.map((l) => ({
    // DATE() volta como Date à meia-noite UTC: o slice dá o dia certo.
    dia: (l.dia instanceof Date ? l.dia : new Date(l.dia)).toISOString().slice(0, 10),
    ...(separarParceria ? { parceria: l.parceria } : {}),
    ...funilDe(l),
  }));
};

// Plano escolhido por quem concluiu o formulário (o plano do evento 'envio').
const planos = async (desde, parceria) => {
  const linhas = await client.$queryRaw`
    SELECT COALESCE(plano, 'sem_plano') AS plano, COUNT(DISTINCT sessao) AS total
    FROM parceria_eventos ${filtro(desde, parceria)}
      AND evento = 'envio' AND detalhe IN ('registrado', 'chat')
    GROUP BY plano
    ORDER BY total DESC`;
  return linhas.map((l) => ({ plano: l.plano, total: num(l.total) }));
};

const parceriasConhecidas = async () => {
  const linhas = await client.$queryRaw`SELECT DISTINCT parceria FROM parceria_eventos ORDER BY parceria ASC`;
  return linhas.map((l) => l.parceria);
};

// Exportação crua (planilha). Sem userAgent/origem completos de propósito: a
// planilha circula por e-mail, e o que interessa nela é o funil.
const eventos = (desde, parceria, limite) => client.parceriaEvento.findMany({
  where: { createdAt: { gte: desde }, ...(parceria ? { parceria } : {}) },
  orderBy: { createdAt: 'asc' },
  take: limite,
  select: { createdAt: true, parceria: true, evento: true, detalhe: true, plano: true, sessao: true },
});

module.exports = {
  registrar, totais, porParceria, porDia, planos, parceriasConhecidas, eventos, CAMPOS_DO_FUNIL,
};
