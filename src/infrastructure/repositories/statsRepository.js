const { Prisma } = require('@prisma/client');
const { client } = require('../../prisma/client');

// Consultas agregadas do dashboard. Tudo aqui é leitura e nada devolve dado
// pessoal: só contagem, média e distribuição.
//
// Cuidado recorrente: COUNT() e SUM() em $queryRaw voltam como BigInt no
// MySQL, e BigInt quebra o JSON.stringify do Express. Toda saída de raw passa
// por num() antes de subir.

const num = (v) => (v === null || v === undefined ? 0 : Number(v));

const arredondar = (v, casas = 2) =>
  (v === null || v === undefined ? null : Number(Number(v).toFixed(casas)));

const diaISO = (d) => {
  if (!d) return null;
  // DATE() do MySQL volta como Date; queremos só YYYY-MM-DD.
  const data = d instanceof Date ? d : new Date(d);
  return data.toISOString().slice(0, 10);
};

// ── Séries diárias ───────────────────────────────────────────
// Tabela e coluna não podem ser parâmetro de bind, então vêm de uma allowlist —
// nunca da requisição. A data, sim, é parametrizada.

const SERIES = {
  usuarios: { tabela: 'users', coluna: 'createdAt' },
  speedtests: { tabela: 'speed_tests', coluna: 'createdAt' },
  chamados: { tabela: 'tickets', coluna: 'createdAt' },
  notificacoes: { tabela: 'notifications', coluna: 'createdAt' },
  artigos: { tabela: 'blog_artigos', coluna: 'publicado_em' },
};

const serieDiaria = async (nome, desde) => {
  const def = SERIES[nome];
  if (!def) throw new Error(`Série desconhecida: ${nome}`);

  const tabela = Prisma.raw(`\`${def.tabela}\``);
  const coluna = Prisma.raw(`\`${def.coluna}\``);

  const linhas = await client.$queryRaw`
    SELECT DATE(${coluna}) AS dia, COUNT(*) AS total
    FROM ${tabela}
    WHERE ${coluna} >= ${desde}
    GROUP BY dia
    ORDER BY dia ASC`;

  return linhas.map((l) => ({ dia: diaISO(l.dia), total: num(l.total) }));
};

// ── Usuários ─────────────────────────────────────────────────

const usuarios = async (desde) => {
  const [total, novos, semData, comFaturaAberta, tokens, usuariosComPush] = await Promise.all([
    client.user.count(),
    client.user.count({ where: { createdAt: { gte: desde } } }),
    // Cadastros anteriores à coluna createdAt: aparecem para o dashboard poder
    // dizer "não sei", em vez de somar zero silenciosamente.
    client.user.count({ where: { createdAt: null } }),
    client.userMetadata.count({ where: { hasOpenBill: true } }),
    client.pushToken.count(),
    client.$queryRaw`SELECT COUNT(DISTINCT userId) AS total FROM push_tokens`,
  ]);

  return {
    total,
    novos_periodo: novos,
    sem_data_conhecida: semData,
    com_fatura_aberta: comFaturaAberta,
    com_push: num(usuariosComPush[0]?.total),
    dispositivos: tokens,
  };
};

// ── Notificações ─────────────────────────────────────────────

const notificacoes = async (desde) => {
  const [porStatus, alcance, notificacoesPeriodo] = await Promise.all([
    client.notification.groupBy({
      by: ['status'],
      where: { createdAt: { gte: desde } },
      _count: { _all: true },
    }),
    client.notification.aggregate({
      where: { createdAt: { gte: desde } },
      _sum: { tokens: true },
    }),
    client.notification.findMany({
      where: { createdAt: { gte: desde } },
      select: { id: true },
    }),
  ]);

  const status = Object.fromEntries(porStatus.map((l) => [l.status, l._count._all]));

  // Taxa de leitura via os ids do período: user_notifications é a tabela que
  // mais cresce aqui (uma linha por usuário por notificação), então filtrar
  // por notificationId aproveita o índice em vez de varrer tudo.
  const ids = notificacoesPeriodo.map((n) => n.id);
  let entregues = 0;
  let lidas = 0;

  if (ids.length) {
    const leitura = await client.userNotification.groupBy({
      by: ['read'],
      where: { notificationId: { in: ids } },
      _count: { _all: true },
    });
    for (const linha of leitura) {
      entregues += linha._count._all;
      if (linha.read) lidas = linha._count._all;
    }
  }

  return {
    enviadas: status.sent ?? 0,
    falhas: status.failed ?? 0,
    pendentes: status.pending ?? 0,
    alcance: num(alcance._sum.tokens),
    entregues,
    lidas,
    taxa_leitura: entregues ? arredondar((lidas / entregues) * 100, 1) : null,
  };
};

// ── Chamados ─────────────────────────────────────────────────

const chamados = async (desde) => {
  const vivos = { deleted_at: null };

  const [porStatus, porPrioridade, porCategoria, abertos, resolvidos, tempoMedio] = await Promise.all([
    client.ticket.groupBy({ by: ['status'], where: vivos, _count: { _all: true } }),
    client.ticket.groupBy({ by: ['priority'], where: vivos, _count: { _all: true } }),
    client.ticket.groupBy({
      by: ['category'],
      where: { ...vivos, category: { not: null } },
      _count: { _all: true },
    }),
    client.ticket.count({ where: { ...vivos, createdAt: { gte: desde } } }),
    client.ticket.count({ where: { ...vivos, closedAt: { gte: desde } } }),
    client.$queryRaw`
      SELECT AVG(TIMESTAMPDIFF(MINUTE, createdAt, closedAt)) AS minutos
      FROM tickets
      WHERE deleted_at IS NULL AND closedAt IS NOT NULL AND closedAt >= ${desde}`,
  ]);

  const status = Object.fromEntries(porStatus.map((l) => [l.status, l._count._all]));
  const minutos = tempoMedio[0]?.minutos;

  return {
    por_status: status,
    por_prioridade: Object.fromEntries(porPrioridade.map((l) => [l.priority, l._count._all])),
    por_categoria: Object.fromEntries(porCategoria.map((l) => [l.category, l._count._all])),
    abertos_periodo: abertos,
    resolvidos_periodo: resolvidos,
    // Em fila = tudo que ainda não foi resolvido nem fechado.
    em_fila: (status.ABERTO ?? 0) + (status.EM_ANDAMENTO ?? 0) + (status.AGUARDANDO ?? 0),
    tempo_medio_resolucao_horas: minutos === null || minutos === undefined
      ? null
      : arredondar(Number(minutos) / 60, 1),
  };
};

// ── Speedtest ────────────────────────────────────────────────

const speedtest = async (desde) => {
  const concluidos = { createdAt: { gte: desde }, status: 'completed' };

  const [total, medias, porPlataforma, porConexao, porStatus, porVersao] = await Promise.all([
    client.speedTest.count({ where: { createdAt: { gte: desde } } }),
    client.speedTest.aggregate({
      where: concluidos,
      _avg: { downloadMbps: true, uploadMbps: true, pingMs: true, jitterMs: true },
    }),
    client.speedTest.groupBy({
      by: ['platform'],
      where: concluidos,
      _count: { _all: true },
      _avg: { downloadMbps: true },
    }),
    client.speedTest.groupBy({
      by: ['connectionType'],
      where: concluidos,
      _count: { _all: true },
      _avg: { downloadMbps: true },
    }),
    client.speedTest.groupBy({
      by: ['status'],
      where: { createdAt: { gte: desde } },
      _count: { _all: true },
    }),
    client.speedTest.groupBy({
      by: ['appVersion'],
      where: { ...concluidos, appVersion: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const distribuir = (linhas, chave) => linhas.map((l) => ({
    [chave]: l[chave] ?? 'desconhecido',
    testes: l._count._all,
    download_medio: arredondar(l._avg?.downloadMbps),
  }));

  return {
    testes: total,
    // As médias saem só dos testes concluídos — abortado e erro sujariam tudo.
    download_medio: arredondar(medias._avg.downloadMbps),
    upload_medio: arredondar(medias._avg.uploadMbps),
    ping_medio: arredondar(medias._avg.pingMs),
    jitter_medio: arredondar(medias._avg.jitterMs),
    por_status: Object.fromEntries(porStatus.map((l) => [l.status, l._count._all])),
    por_plataforma: distribuir(porPlataforma, 'platform'),
    por_conexao: distribuir(porConexao, 'connectionType'),
    por_versao_app: porVersao
      .map((l) => ({ versao: l.appVersion, testes: l._count._all }))
      .sort((a, b) => b.testes - a.testes)
      .slice(0, 10),
  };
};

// ── Blog ─────────────────────────────────────────────────────

const blog = async (desde) => {
  const [porStatus, inscritos, publicadosPeriodo, maisLidos, categorias] = await Promise.all([
    client.blogArtigo.groupBy({ by: ['status'], _count: { _all: true } }),
    client.blogNewsletter.count({ where: { ativo: true } }),
    client.blogArtigo.count({ where: { status: 'publicado', publicado_em: { gte: desde } } }),
    client.blogArtigo.findMany({
      where: { status: 'publicado' },
      orderBy: { visualizacoes: 'desc' },
      take: 5,
      select: { slug: true, titulo: true, visualizacoes: true },
    }),
    client.blogCategoria.count(),
  ]);

  const status = Object.fromEntries(porStatus.map((l) => [l.status, l._count._all]));

  return {
    publicados: status.publicado ?? 0,
    rascunhos: status.rascunho ?? 0,
    arquivados: status.arquivado ?? 0,
    publicados_periodo: publicadosPeriodo,
    categorias,
    inscritos_newsletter: inscritos,
    mais_lidos: maisLidos,
  };
};

// ── App: mensagens e cobertura ───────────────────────────────

const mensagensApp = async () => {
  const [ativas, totalTargets] = await Promise.all([
    client.appMessage.count({ where: { active: true, deleted_at: null } }),
    client.appMessageTarget.count(),
  ]);
  return { ativas, segmentacoes: totalTargets };
};

const cobertura = async () => {
  const [porCidade, totalEnderecos] = await Promise.all([
    client.clientAddress.groupBy({
      by: ['cidade'],
      where: { cidade: { not: null } },
      _count: { _all: true },
    }),
    client.clientAddress.count(),
  ]);

  return {
    enderecos_conhecidos: totalEnderecos,
    por_cidade: porCidade
      .map((l) => ({ cidade: l.cidade, clientes: l._count._all }))
      .sort((a, b) => b.clientes - a.clientes)
      .slice(0, 15),
  };
};

module.exports = {
  serieDiaria,
  usuarios,
  notificacoes,
  chamados,
  speedtest,
  blog,
  mensagensApp,
  cobertura,
  SERIES,
};
