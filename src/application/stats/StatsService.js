const statsRepo = require('../../infrastructure/repositories/statsRepository');
const upgradesStats = require('./UpgradesStats');
const logger = require('../../utils/logger');

// Estatísticas do app para o dashboard do operador.
//
// Tudo é agregado: contagem, média e distribuição. Nenhum endpoint daqui
// devolve CPF, e-mail ou qualquer dado que identifique uma pessoa — o que o
// dashboard precisa é de número, não de lista de gente.

const DIAS_PADRAO = 30;
const DIAS_MAX = 365;

// Dashboard é tela que fica aberta atualizando. Sem cache, cada refresh
// dispara uma dúzia de agregações no mesmo banco que atende o app.
const CACHE_TTL_MS = Number.parseInt(process.env.STATS_CACHE_TTL_MS, 10) || 60_000;
const cache = new Map();

const comCache = async (chave, produzir) => {
  const agora = Date.now();
  const guardado = cache.get(chave);
  if (guardado && agora - guardado.em < CACHE_TTL_MS) return guardado.valor;

  const valor = await produzir();
  cache.set(chave, { em: agora, valor });
  return valor;
};

const limparCache = () => cache.clear();

const normalizarDias = (dias) => {
  const n = Number.parseInt(dias, 10);
  if (!Number.isFinite(n) || n < 1) return DIAS_PADRAO;
  return Math.min(n, DIAS_MAX);
};

const janela = (dias) => {
  const total = normalizarDias(dias);
  const desde = new Date(Date.now() - total * 24 * 60 * 60 * 1000);
  return {
    dias: total,
    desde,
    periodo: { dias: total, desde: desde.toISOString(), ate: new Date().toISOString() },
  };
};

// ── Visão geral ──────────────────────────────────────────────
// O painel de cima do dashboard: os números que cabem numa linha de cards.

const visaoGeral = async (dias) => {
  const { desde, periodo } = janela(dias);

  return comCache(`overview:${periodo.dias}`, async () => {
    // Uma falha num domínio não pode apagar o dashboard inteiro — o operador
    // prefere ver cinco blocos e um erro a ver uma tela branca.
    const [usuarios, notificacoes, chamados, speedtest, blog, mensagens, upgrades] = await Promise.all([
      statsRepo.usuarios(desde).catch(erroDe('usuarios')),
      statsRepo.notificacoes(desde).catch(erroDe('notificacoes')),
      statsRepo.chamados(desde).catch(erroDe('chamados')),
      statsRepo.speedtest(desde).catch(erroDe('speedtest')),
      statsRepo.blog(desde).catch(erroDe('blog')),
      statsRepo.mensagensApp().catch(erroDe('mensagens')),
      // Único domínio que depende de serviço externo (Trello); o isolamento
      // aqui não é luxo, é o que impede a API deles de derrubar o dashboard.
      upgradesStats.upgrades(desde).catch(erroDe('upgrades')),
    ]);

    return {
      periodo, usuarios, notificacoes, chamados, speedtest, blog,
      mensagens_app: mensagens, upgrades,
    };
  });
};

function erroDe(dominio) {
  return (err) => {
    logger.error(`stats: falha ao agregar ${dominio}`, { error: err.message });
    return { erro: 'indisponivel' };
  };
}

// ── Detalhe por domínio ──────────────────────────────────────

const usuarios = async (dias) => {
  const { desde, periodo } = janela(dias);
  return comCache(`usuarios:${periodo.dias}`, async () => {
    const [resumo, serie, cobertura] = await Promise.all([
      statsRepo.usuarios(desde),
      statsRepo.serieDiaria('usuarios', desde),
      statsRepo.cobertura(),
    ]);
    return { periodo, ...resumo, serie_cadastros: serie, cobertura };
  });
};

const notificacoes = async (dias) => {
  const { desde, periodo } = janela(dias);
  return comCache(`notificacoes:${periodo.dias}`, async () => {
    const [resumo, serie] = await Promise.all([
      statsRepo.notificacoes(desde),
      statsRepo.serieDiaria('notificacoes', desde),
    ]);
    return { periodo, ...resumo, serie_envios: serie };
  });
};

const chamados = async (dias) => {
  const { desde, periodo } = janela(dias);
  return comCache(`chamados:${periodo.dias}`, async () => {
    const [resumo, serie] = await Promise.all([
      statsRepo.chamados(desde),
      statsRepo.serieDiaria('chamados', desde),
    ]);
    return { periodo, ...resumo, serie_aberturas: serie };
  });
};

const speedtest = async (dias) => {
  const { desde, periodo } = janela(dias);
  return comCache(`speedtest:${periodo.dias}`, async () => {
    const [resumo, serie] = await Promise.all([
      statsRepo.speedtest(desde),
      statsRepo.serieDiaria('speedtests', desde),
    ]);
    return { periodo, ...resumo, serie_testes: serie };
  });
};

const blog = async (dias) => {
  const { desde, periodo } = janela(dias);
  return comCache(`blog:${periodo.dias}`, async () => {
    const [resumo, serie] = await Promise.all([
      statsRepo.blog(desde),
      statsRepo.serieDiaria('artigos', desde),
    ]);
    return { periodo, ...resumo, serie_publicacoes: serie };
  });
};

// O board do Trello é fonte externa: cachear ajuda mais aqui do que nos outros,
// porque cada consulta são três chamadas HTTP para fora.
const upgrades = async (dias) => {
  const { desde, periodo } = janela(dias);
  return comCache(`upgrades:${periodo.dias}`, async () => ({
    periodo,
    ...(await upgradesStats.upgrades(desde)),
  }));
};

module.exports = {
  visaoGeral,
  usuarios,
  notificacoes,
  chamados,
  speedtest,
  blog,
  upgrades,
  limparCache,
  normalizarDias,
  DIAS_PADRAO,
  DIAS_MAX,
  CACHE_TTL_MS,
};
