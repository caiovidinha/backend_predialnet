const artigoRepo = require('../../infrastructure/repositories/blogArticleRepository');
const revalidacao = require('./BlogRevalidateService');
const logger = require('../../utils/logger');

// Job dos artigos agendados.
//
// Artigo com `publicado_em` no futuro some dos endpoints públicos até a hora
// chegar — isso o filtro do repositório já garante sozinho. O que ninguém faz
// sozinho é avisar o blog: sem este job o artigo agendado só apareceria na
// revalidação automática do Next (até 5 min depois).
//
// A idempotência vem da coluna `revalidado_em`: pendente é quem está publicado,
// com a data no passado, e ainda com a bandeira limpa. Avisar duas vezes o mesmo
// artigo seria inofensivo, mas assim nem isso acontece.

const INTERVALO_MS = Number.parseInt(process.env.BLOG_SCHEDULER_INTERVALO_MS, 10) || 60_000;
const LOTE = 20;

let timer = null;
let rodando = false;

// Uma passada. Exportada para dar para chamar no teste e na mão.
const processarAgendados = async () => {
  const pendentes = await artigoRepo.pendentesDeRevalidacao(LOTE);
  if (!pendentes.length) return { processados: 0, avisados: 0 };

  let avisados = 0;
  for (const artigo of pendentes) {
    // Sequencial de propósito: são poucos, e uma rajada de revalidação em
    // paralelo é justamente o que o segredo do webhook existe para evitar.
    // eslint-disable-next-line no-await-in-loop
    const resultado = await revalidacao.revalidar({ slug: artigo.slug, origem: 'agendado' });
    if (!resultado.ok) continue; // fica pendente e tenta no próximo ciclo

    // eslint-disable-next-line no-await-in-loop
    await artigoRepo.marcarRevalidado(artigo.id);
    avisados += 1;
    logger.info('blog: artigo agendado entrou no ar', { id: artigo.id, slug: artigo.slug });
  }

  return { processados: pendentes.length, avisados };
};

const tick = async () => {
  // Guarda contra sobreposição: se um ciclo demorar mais que o intervalo, o
  // próximo espera em vez de rodar por cima.
  if (rodando) return;
  rodando = true;
  try {
    await processarAgendados();
  } catch (err) {
    logger.warn('blog: job de agendados falhou', { error: err.message });
  } finally {
    rodando = false;
  }
};

const iniciar = () => {
  if (timer) return timer;

  if (process.env.BLOG_SCHEDULER_ATIVO === 'false') {
    logger.info('blog: job de agendados desligado por env');
    return null;
  }

  // Sem webhook configurado o job não teria a quem avisar.
  if (!revalidacao.configurado()) {
    logger.info('blog: job de agendados não iniciado (BLOG_REVALIDATE_URL ausente)');
    return null;
  }

  timer = setInterval(tick, INTERVALO_MS);
  if (typeof timer.unref === 'function') timer.unref();
  logger.info('blog: job de agendados ativo', { intervalo_ms: INTERVALO_MS });
  return timer;
};

const parar = () => {
  if (timer) clearInterval(timer);
  timer = null;
};

module.exports = { iniciar, parar, processarAgendados, INTERVALO_MS };
