const { muitasRequisicoes } = require('../../domain/blog/errors');

// Rate limit em memória, sem dependência externa.
//
// Limitação conhecida: o contador vive no processo. Com mais de uma instância
// atrás de load balancer, o limite efetivo é (maximo × nº de instâncias). Para
// o volume do blog isso é aceitável; se um dia virar problema, o lugar de
// trocar por Redis é só este arquivo (o REDIS_URL já existe por causa do Bull).

const CINCO_MINUTOS = 5 * 60 * 1000;

const ipDe = (req) =>
  (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  || req.ip
  || req.socket?.remoteAddress
  || 'desconhecido';

const criarRateLimit = ({
  janelaMs,
  maximo,
  chave = ipDe,
  progressivo = false,
  mensagem,
}) => {
  const registros = new Map();

  // Varre o mapa de tempos em tempos para não crescer sem fim.
  const limpeza = setInterval(() => {
    const agora = Date.now();
    for (const [k, reg] of registros) {
      const inativo = reg.tentativas.every((t) => agora - t > janelaMs);
      if (inativo && (!reg.bloqueadoAte || reg.bloqueadoAte < agora)) registros.delete(k);
    }
  }, CINCO_MINUTOS);
  if (typeof limpeza.unref === 'function') limpeza.unref();

  return (req, res, next) => {
    const k = String(chave(req));
    const agora = Date.now();
    const reg = registros.get(k) ?? { tentativas: [], bloqueadoAte: 0, violacoes: 0 };

    if (reg.bloqueadoAte > agora) {
      const espera = Math.ceil((reg.bloqueadoAte - agora) / 1000);
      return next(muitasRequisicoes(espera, mensagem));
    }

    reg.tentativas = reg.tentativas.filter((t) => agora - t < janelaMs);

    if (reg.tentativas.length >= maximo) {
      reg.violacoes += 1;
      // Bloqueio progressivo: 1× a janela, depois 2×, 4×… até 8×.
      const fator = progressivo ? Math.min(2 ** (reg.violacoes - 1), 8) : 1;
      reg.bloqueadoAte = agora + janelaMs * fator;
      registros.set(k, reg);
      return next(muitasRequisicoes(Math.ceil((janelaMs * fator) / 1000), mensagem));
    }

    reg.tentativas.push(agora);
    registros.set(k, reg);

    // Permite que o handler descarte a tentativa quando a requisição deu certo
    // (é o caso do login: só tentativa falha deve contar para o limite).
    req.consumirRateLimit = () => {
      const atual = registros.get(k);
      if (!atual) return;
      atual.tentativas.pop();
      atual.violacoes = 0;
      registros.set(k, atual);
    };

    return next();
  };
};

module.exports = { criarRateLimit, ipDe };
