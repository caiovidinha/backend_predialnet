const revalidacao = require('./BlogRevalidateService');
const artigoRepo = require('../../infrastructure/repositories/blogArticleRepository');
const categoriaRepo = require('../../infrastructure/repositories/blogCategoryRepository');
const redirectRepo = require('../../infrastructure/repositories/blogRedirectRepository');
const auditRepo = require('../../infrastructure/repositories/blogAuditRepository');

const { sanitizarCorpo, calcularTempoLeitura, textoPuro } = require('../../domain/blog/sanitize');
const { gerarSlugUnico, gerarSlug } = require('../../domain/blog/slug');
const { serializarArtigo, serializarCategoria, validarArtigo } = require('../../domain/blog/artigo');
const { naoEncontrado, validacao, conflito } = require('../../domain/blog/errors');
const logger = require('../../utils/logger');

const POR_PAGINA_MAX = 100;

const montarPaginacao = (pagina, porPagina, total) => ({
  pagina,
  por_pagina: porPagina,
  total,
  total_paginas: Math.max(1, Math.ceil(total / porPagina)),
});

// ── Público ──────────────────────────────────────────────────

const listarArtigosPublicos = async ({
  categoria, busca, pagina = 1, porPagina = 20, ordem = 'recentes', incluirCorpo = false,
}) => {
  const limite = Math.min(Math.max(1, porPagina), POR_PAGINA_MAX);
  const { items, total } = await artigoRepo.listarPublicos({
    categoriaSlug: categoria || undefined,
    busca: busca || undefined,
    pagina,
    porPagina: limite,
    ordem,
  });

  return {
    artigos: items.map((a) => serializarArtigo(a, { incluirCorpo })),
    paginacao: montarPaginacao(pagina, limite, total),
  };
};

const obterArtigoPublico = async (slug) => {
  const artigo = await artigoRepo.buscarPublicoPorSlug(slug);
  if (!artigo) throw naoEncontrado('Artigo não encontrado.');
  return serializarArtigo(artigo, { incluirCorpo: true });
};

const listarCategorias = async () => {
  const [categorias, totais] = await Promise.all([
    categoriaRepo.listar(),
    artigoRepo.contarPorCategoria(),
  ]);
  return { categorias: categorias.map((c) => serializarCategoria(c, totais.get(c.id) ?? 0)) };
};

const listarRedirecionamentos = async () => {
  const linhas = await redirectRepo.listar();
  return { redirecionamentos: linhas.map((r) => ({ de: r.de, para: r.para })) };
};

// ── Painel ───────────────────────────────────────────────────

const listarArtigosAdmin = async ({
  status = 'todos', busca, pagina = 1, porPagina = 20, incluirCorpo = false,
}) => {
  const limite = Math.min(Math.max(1, porPagina), POR_PAGINA_MAX);
  const { items, total } = await artigoRepo.listarAdmin({
    status,
    busca: busca || undefined,
    pagina,
    porPagina: limite,
  });

  return {
    artigos: items.map((a) => serializarArtigo(a, { incluirCorpo })),
    paginacao: montarPaginacao(pagina, limite, total),
  };
};

const obterArtigoAdmin = async (id) => {
  const artigo = await artigoRepo.buscarPorId(Number(id));
  if (!artigo) throw naoEncontrado('Artigo não encontrado.');
  return serializarArtigo(artigo, { incluirCorpo: true });
};

// Converte o formato aninhado da API nas colunas achatadas do banco.
// `parcial` liga o modo PUT: só mexe no que veio no corpo da requisição.
const montarDados = async (entrada) => {
  const dados = {};

  if (entrada.titulo !== undefined) dados.titulo = String(entrada.titulo).trim();
  if (entrada.resumo !== undefined) dados.resumo = String(entrada.resumo).trim();
  if (entrada.autor !== undefined) dados.autor = String(entrada.autor).trim() || 'Predialnet';
  if (entrada.destaque !== undefined) dados.destaque = Boolean(entrada.destaque);
  if (entrada.status !== undefined) dados.status = entrada.status;

  if (entrada.corpo !== undefined) {
    dados.corpo = sanitizarCorpo(entrada.corpo);
    if (!textoPuro(dados.corpo)) throw validacao({ corpo: 'O conteúdo ficou vazio após a limpeza do HTML.' });
  }

  if (entrada.categoria !== undefined) {
    const categoria = await categoriaRepo.resolver(entrada.categoria);
    if (!categoria) throw validacao({ categoria: 'Categoria inexistente. Consulte GET /blog/categorias.' });
    dados.categoriaId = categoria.id;
  }

  if (entrada.publicado_em !== undefined)
    dados.publicado_em = entrada.publicado_em ? new Date(entrada.publicado_em) : null;

  // capa e capa_interna são independentes: mandar uma não mexe na outra, e
  // mandar null remove só aquela.
  for (const campo of ['capa', 'capa_interna']) {
    if (entrada[campo] === undefined) continue;
    dados[`${campo}_url`] = entrada[campo]?.url ?? null;
    dados[`${campo}_alt`] = entrada[campo]?.alt ?? null;
    dados[`${campo}_largura`] = entrada[campo]?.largura ?? null;
    dados[`${campo}_altura`] = entrada[campo]?.altura ?? null;
  }

  if (entrada.seo !== undefined) {
    dados.seo_titulo = entrada.seo?.titulo ?? null;
    dados.seo_descricao = entrada.seo?.descricao ?? null;
    dados.seo_noindex = Boolean(entrada.seo?.noindex);
  }

  // tempo_leitura: respeita o que o painel mandou; senão calcula do corpo.
  if (entrada.tempo_leitura) dados.tempo_leitura = Number(entrada.tempo_leitura);
  else if (dados.corpo !== undefined) dados.tempo_leitura = calcularTempoLeitura(dados.corpo);

  return dados;
};

const criarArtigo = async (entrada, autor, ip) => {
  const campos = validarArtigo(entrada);
  if (Object.keys(campos).length) throw validacao(campos);

  const dados = await montarDados(entrada);

  dados.slug = await gerarSlugUnico(
    entrada.slug || entrada.titulo,
    (candidato) => artigoRepo.slugEmUso(candidato),
  );

  if (!dados.status) dados.status = 'rascunho';
  // Publicar sem data explícita significa "agora".
  if (dados.status === 'publicado' && !dados.publicado_em) dados.publicado_em = new Date();

  const criado = await artigoRepo.criar(dados);
  if (criado.destaque) await artigoRepo.limparDestaques(criado.id);

  await auditRepo.registrar({
    usuario: autor,
    acao: 'criar',
    entidade: 'artigo',
    entidadeId: criado.id,
    detalhes: { slug: criado.slug, status: criado.status },
    ip,
  });

  return serializarArtigo(criado, { incluirCorpo: true });
};

const atualizarArtigo = async (id, entrada, autor, ip) => {
  const atual = await artigoRepo.buscarPorId(Number(id));
  if (!atual) throw naoEncontrado('Artigo não encontrado.');

  const campos = validarArtigo(entrada, { parcial: true });
  if (Object.keys(campos).length) throw validacao(campos);

  const dados = await montarDados(entrada);

  // Troca de slug: a URL antiga vira 301 se o artigo já esteve publicado.
  let slugAntigo = null;
  if (entrada.slug !== undefined && entrada.slug) {
    const novo = gerarSlug(entrada.slug);
    if (novo !== atual.slug) {
      if (await artigoRepo.slugEmUso(novo, atual.id)) throw conflito('Já existe um artigo com este slug.');
      dados.slug = novo;
      if (atual.status === 'publicado') slugAntigo = atual.slug;
    }
  }

  if (dados.status === 'publicado' && !dados.publicado_em && !atual.publicado_em)
    dados.publicado_em = new Date();

  const atualizado = await artigoRepo.atualizar(atual.id, dados);
  if (atualizado.destaque) await artigoRepo.limparDestaques(atualizado.id);
  if (slugAntigo) await redirectRepo.registrar(slugAntigo, atualizado.slug);

  await auditRepo.registrar({
    usuario: autor,
    acao: 'editar',
    entidade: 'artigo',
    entidadeId: atualizado.id,
    detalhes: { campos: Object.keys(dados), slug_antigo: slugAntigo },
    ip,
  });

  // Editar rascunho não muda nada no ar; editar publicado sim, mesmo que seja
  // uma vírgula. Em segundo plano porque salvar é ação frequente — o editor não
  // pode esperar o blog a cada Ctrl+S.
  const noArAgora = atualizado.status === 'publicado'
    && atualizado.publicado_em && atualizado.publicado_em <= new Date();
  const saiuDoAr = atual.status === 'publicado' && atualizado.status !== 'publicado';

  if (noArAgora || saiuDoAr) {
    revalidacao.revalidarEmSegundoPlano({ slug: atualizado.slug, origem: 'editar' });
    // Slug trocado deixa a página antiga no cache do blog: revalida as duas.
    if (slugAntigo) revalidacao.revalidarEmSegundoPlano({ slug: slugAntigo, origem: 'editar-slug-antigo' });
    if (noArAgora) artigoRepo.marcarRevalidado(atualizado.id).catch(() => {});
  } else if (atualizado.status === 'publicado') {
    // Continua agendado para o futuro: volta para a fila do job, que avisa o
    // blog quando a hora chegar.
    artigoRepo.limparRevalidado(atualizado.id).catch(() => {});
  }

  return serializarArtigo(atualizado, { incluirCorpo: true });
};

// Exclusão é lógica: o artigo vira `arquivado` e some do público.
const arquivarArtigo = async (id, autor, ip) => {
  const atual = await artigoRepo.buscarPorId(Number(id));
  if (!atual) throw naoEncontrado('Artigo não encontrado.');

  await artigoRepo.atualizar(atual.id, { status: 'arquivado', destaque: false });
  await auditRepo.registrar({
    usuario: autor,
    acao: 'excluir',
    entidade: 'artigo',
    entidadeId: atual.id,
    detalhes: { slug: atual.slug },
    ip,
  });

  // Só faz diferença se estava no ar — arquivar rascunho não muda nada para o
  // visitante. Passa o slug para o blog derrubar a página do cache.
  if (atual.status === 'publicado')
    revalidacao.revalidarEmSegundoPlano({ slug: atual.slug, origem: 'arquivar' });
};

const publicarArtigo = async (id, { publicado_em: quando }, autor, ip) => {
  const atual = await artigoRepo.buscarPorId(Number(id));
  if (!atual) throw naoEncontrado('Artigo não encontrado.');

  if (quando && Number.isNaN(new Date(quando).getTime()))
    throw validacao({ publicado_em: 'Data inválida. Use ISO 8601.' });

  // O que já está no banco precisa bancar uma publicação — os campos podem ter
  // sido salvos aos poucos enquanto o artigo era rascunho.
  const faltando = {};
  if (!atual.titulo) faltando.titulo = 'Obrigatório.';
  if (!atual.resumo) faltando.resumo = 'Obrigatório.';
  if (!atual.corpo) faltando.corpo = 'Obrigatório.';
  if (!atual.categoriaId) faltando.categoria = 'Obrigatório.';
  if (Object.keys(faltando).length) throw validacao(faltando, 'O artigo não está pronto para publicação.');

  const publicado = await artigoRepo.atualizar(atual.id, {
    status: 'publicado',
    publicado_em: quando ? new Date(quando) : (atual.publicado_em ?? new Date()),
  });

  await auditRepo.registrar({
    usuario: autor,
    acao: 'publicar',
    entidade: 'artigo',
    entidadeId: publicado.id,
    detalhes: { slug: publicado.slug, publicado_em: publicado.publicado_em },
    ip,
  });

  // Agendamento não avisa o front agora — o artigo ainda não está no ar, e os
  // endpoints públicos continuam escondendo ele até a data chegar. Quem avisa
  // na hora certa é o job de agendados (BlogScheduler).
  const agendado = publicado.publicado_em > new Date();

  // Aqui a revalidação é esperada, e não disparada em segundo plano: publicar é
  // uma ação deliberada e o editor merece saber se o blog foi avisado. O
  // timeout curto do serviço garante que isso não vira espera.
  let revalidado = false;
  if (agendado) {
    // Bandeira limpa: é assim que o job de agendados sabe que este ainda deve
    // um aviso ao blog.
    await artigoRepo.limparRevalidado(publicado.id);
  } else {
    const resultado = await revalidacao.revalidar({ slug: publicado.slug, origem: 'publicar' });
    revalidado = resultado.ok;
    // Só marca se o blog confirmou. Falhou? A bandeira fica limpa e o job de
    // agendados tenta de novo no próximo ciclo.
    if (revalidado) await artigoRepo.marcarRevalidado(publicado.id);
  }

  return { ok: true, artigo: serializarArtigo(publicado, { incluirCorpo: true }), revalidado };
};

module.exports = {
  listarArtigosPublicos,
  obterArtigoPublico,
  listarCategorias,
  listarRedirecionamentos,
  listarArtigosAdmin,
  obterArtigoAdmin,
  criarArtigo,
  atualizarArtigo,
  arquivarArtigo,
  publicarArtigo,
  POR_PAGINA_MAX,
};
