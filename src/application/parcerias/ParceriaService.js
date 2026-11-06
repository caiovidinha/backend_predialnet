const repo = require('../../infrastructure/repositories/parceriaRepository');

// Funil das parcerias do Assine Já (?parceria=<slug> na URL).
//
// Quem grava é o navegador do visitante, numa rota pública: tudo que chega é
// tratado como lixo até provar o contrário. Evento e detalhe vêm de allowlist;
// parceria e plano são normalizados para slug; o resto é cortado no tamanho da
// coluna. Nada de nome, celular ou CEP — o funil não precisa e a rota é aberta.

const EVENTOS = {
  acesso: [],                                   // abriu o Assine Já com ?parceria
  consulta: ['com_planos', 'plano_indisponivel', 'so_regiao', 'sem_cobertura', 'a_confirmar'],
  dados: [],                                    // chegou na etapa dos dados pessoais
  envio: ['registrado', 'chat', 'falhou'],      // enviou o formulário
  whatsapp: ['botao', 'modal'],                 // clicou para seguir pelo WhatsApp
};

const DIAS_PADRAO = 30;
const DIAS_MAX = 365;
const LIMITE_EXPORTACAO = 50_000;

const erro = (statusCode, message) => Object.assign(new Error(message), { statusCode });

const slug = (valor, max) => {
  if (valor === null || valor === undefined) return null;
  const s = String(valor)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // "Clube São João" → "clube-sao-joao"
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max);
  return s || null;
};

const normalizarParceria = (valor) => slug(valor, 40);

const SESSAO = /^[A-Za-z0-9-]{8,36}$/;

const cortar = (valor, max) => {
  if (valor === null || valor === undefined || valor === '') return null;
  return String(valor).slice(0, max);
};

// Do referrer só interessa de onde veio (site, Instagram, link da parceria);
// a query string pode carregar e-mail, token, CPF de formulário alheio.
const origemSegura = (valor) => {
  if (!valor) return null;
  try {
    const u = new URL(String(valor));
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return cortar(u.origin + u.pathname, 255);
  } catch {
    return null;
  }
};

const validarEvento = (body) => {
  const dados = body && typeof body === 'object' ? body : {};

  const parceria = normalizarParceria(dados.parceria);
  if (!parceria) throw erro(400, 'parceria obrigatória.');

  const evento = String(dados.evento || '');
  if (!Object.prototype.hasOwnProperty.call(EVENTOS, evento)) throw erro(400, 'evento desconhecido.');

  const sessao = String(dados.sessao || '');
  if (!SESSAO.test(sessao)) throw erro(400, 'sessao inválida.');

  const permitidos = EVENTOS[evento];
  const detalhe = dados.detalhe ? String(dados.detalhe) : null;
  if (detalhe && !permitidos.includes(detalhe)) throw erro(400, 'detalhe inválido para o evento.');
  if (!detalhe && permitidos.length && evento !== 'whatsapp') throw erro(400, 'detalhe obrigatório para o evento.');

  return {
    parceria,
    evento,
    sessao,
    detalhe,
    plano: slug(dados.plano, 32),
    origem: origemSegura(dados.origem),
  };
};

const registrar = async (body, contexto = {}) => {
  const dados = validarEvento(body);
  return repo.registrar({ ...dados, userAgent: cortar(contexto.userAgent, 255) });
};

// ── Leitura (dashboard) ──────────────────────────────────────

const normalizarDias = (dias) => {
  const n = Number.parseInt(dias, 10);
  if (!Number.isFinite(n) || n < 1) return DIAS_PADRAO;
  return Math.min(n, DIAS_MAX);
};

const janela = (dias) => {
  const total = normalizarDias(dias);
  const desde = new Date(Date.now() - total * 24 * 60 * 60 * 1000);
  return { desde, periodo: { dias: total, desde: desde.toISOString(), ate: new Date().toISOString() } };
};

const taxa = (parte, todo) => (todo ? Number(((parte / todo) * 100).toFixed(1)) : null);

const comTaxas = (f) => ({
  ...f,
  taxas: {
    consulta: taxa(f.consultas, f.visitantes),
    cobertura: taxa(f.com_cobertura, f.consultas),
    conversao: taxa(f.formularios, f.visitantes),
    whatsapp: taxa(f.whatsapp, f.visitantes),
  },
});

const resumo = async ({ dias, parceria } = {}) => {
  const { desde, periodo } = janela(dias);
  const filtroParceria = normalizarParceria(parceria);

  const [totais, parcerias, serie, planos, conhecidas] = await Promise.all([
    repo.totais(desde, filtroParceria),
    repo.porParceria(desde, filtroParceria),
    repo.porDia(desde, filtroParceria),
    repo.planos(desde, filtroParceria),
    repo.parceriasConhecidas(),
  ]);

  return {
    periodo,
    parceria: filtroParceria,
    parcerias_conhecidas: conhecidas,
    totais: comTaxas(totais),
    parcerias: parcerias.map(comTaxas),
    serie_diaria: serie,
    planos,
  };
};

// ── Exportação para planilha ─────────────────────────────────

// Separador ";" e BOM: é o que o Excel em pt-BR abre direto, com acento certo
// e uma coluna por campo (com "," ele joga a linha inteira na coluna A).
const celula = (v) => {
  if (v === null || v === undefined) return '';
  let s = String(v);
  // Fórmula injetada pela URL (=HYPERLINK...) não pode virar fórmula na planilha.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const paraCsv = (cabecalho, linhas) => `﻿${[cabecalho, ...linhas].map((l) => l.map(celula).join(';')).join('\r\n')}\r\n`;

const dataHoraBRT = (d) => new Date(new Date(d).getTime() - 3 * 60 * 60 * 1000)
  .toISOString().replace('T', ' ').slice(0, 19);

const exportarCsv = async ({ dias, parceria, tipo } = {}) => {
  const { desde, periodo } = janela(dias);
  const filtroParceria = normalizarParceria(parceria);
  const sufixo = `${filtroParceria || 'todas'}-${periodo.dias}d`;

  if (tipo === 'eventos') {
    const linhas = await repo.eventos(desde, filtroParceria, LIMITE_EXPORTACAO);
    return {
      nome: `parcerias-eventos-${sufixo}.csv`,
      conteudo: paraCsv(
        ['data_hora_brasilia', 'parceria', 'evento', 'detalhe', 'plano', 'sessao'],
        linhas.map((e) => [dataHoraBRT(e.createdAt), e.parceria, e.evento, e.detalhe, e.plano, e.sessao]),
      ),
    };
  }

  const linhas = await repo.porDia(desde, filtroParceria, { separarParceria: true });
  return {
    nome: `parcerias-diario-${sufixo}.csv`,
    conteudo: paraCsv(
      ['dia', 'parceria', ...repo.CAMPOS_DO_FUNIL],
      linhas.map((l) => [l.dia, l.parceria, ...repo.CAMPOS_DO_FUNIL.map((c) => l[c])]),
    ),
  };
};

module.exports = {
  EVENTOS,
  registrar,
  validarEvento,
  normalizarParceria,
  resumo,
  exportarCsv,
  paraCsv,
};
