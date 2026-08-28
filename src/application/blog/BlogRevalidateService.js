const axios = require('axios');
const logger = require('../../utils/logger');

// Avisa o front (Next.js em blog.predialnet.com.br) que o conteúdo mudou.
//
// O blog cacheia as respostas da API e revalida sozinho a cada 5 minutos; este
// webhook transforma "até 5 minutos" em "imediato". Por isso falha aqui nunca
// derruba a operação que a disparou — vira warning no log e segue.
//
// Contrato combinado com o front:
//   POST https://blog.predialnet.com.br/api/revalidate
//   X-Revalidate-Secret: <segredo>
//   { "slug": "wifi6-vale-a-pena" }   // slug opcional
//
// Sem slug, o blog revalida listagem, categorias e sitemap; com slug, revalida
// também a página do artigo.

const URL = () => process.env.BLOG_REVALIDATE_URL;
const SEGREDO = () => process.env.BLOG_REVALIDATE_SECRET;

// Curto de propósito: a revalidação do Next é rápida, e o editor está esperando
// a resposta do "publicar" do outro lado da tela.
const TIMEOUT_MS = Number.parseInt(process.env.BLOG_REVALIDATE_TIMEOUT_MS, 10) || 5000;

const configurado = () => Boolean(URL());

// Uma vez só por processo: sem isso, um deploy com a variável faltando ficaria
// silencioso e o sintoma (página velha) seria indistinguível de "não avisa na
// edição". Com isso, aparece no log já na primeira tentativa.
let avisouNaoConfigurado = false;

// Devolve true só quando o blog confirmou. `motivo` explica o false para o log.
const revalidar = async ({ slug = null, origem = 'api' } = {}) => {
  if (!configurado()) {
    if (!avisouNaoConfigurado) {
      avisouNaoConfigurado = true;
      logger.warn('blog: BLOG_REVALIDATE_URL não configurado — o blog só atualiza no fallback de 5 min');
    }
    return { ok: false, motivo: 'nao_configurado' };
  }

  const headers = { 'Content-Type': 'application/json' };
  if (SEGREDO()) headers['X-Revalidate-Secret'] = SEGREDO();

  try {
    const resposta = await axios.post(URL(), slug ? { slug } : {}, { headers, timeout: TIMEOUT_MS });
    logger.info('blog: revalidação disparada', {
      slug,
      origem,
      revalidados: resposta.data?.revalidados,
    });
    return { ok: true, revalidados: resposta.data?.revalidados };
  } catch (err) {
    // 401 aqui quase sempre é segredo divergente entre os dois lados — vale
    // aparecer no log com destaque, senão ninguém descobre que parou.
    const status = err.response?.status;
    logger.warn('blog: revalidação falhou', {
      slug,
      origem,
      status,
      error: err.message,
      dica: status === 401 ? 'BLOG_REVALIDATE_SECRET diverge do REVALIDATE_SECRET do blog' : undefined,
    });
    return { ok: false, motivo: status ? `http_${status}` : 'sem_resposta' };
  }
};

// Para os casos em que a resposta ao editor não deve esperar o blog (salvar
// edição, arquivar). Dispara e segue; o resultado só vai para o log.
const revalidarEmSegundoPlano = (args) => {
  revalidar(args).catch((err) =>
    logger.warn('blog: revalidação em segundo plano falhou', { error: err.message }));
};

module.exports = { revalidar, revalidarEmSegundoPlano, configurado, TIMEOUT_MS };
