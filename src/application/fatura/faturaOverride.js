const logger = require('../../utils/logger');

// Substituição pontual da fatura atual de UM cliente específico.
//
// Existe para atender um caso operacional isolado: o cliente precisa enxergar
// uma fatura em aberto, com um PIX e um boleto determinados, independente do
// que a UAIPI devolve.
//
// Três decisões deliberadas:
//
// 1. Desligado por padrão. Isto devolve instrumento de pagamento fabricado;
//    ligar precisa ser um ato explícito, nunca o comportamento herdado por um
//    deploy novo ou por um clone do repositório.
// 2. As variáveis são lidas a cada chamada, não no require. Assim
//    `pm2 restart --update-env` desliga na hora, sem precisar de deploy.
// 3. Toda substituição vai para o log. Quando alguém for investigar por que
//    este cliente vê uma fatura diferente, a resposta está no log.
//
// Para desativar: FATURA_OVERRIDE_ATIVO=false (ou remover a linha) e reiniciar.

const PIX_PADRAO = '00020101021226900014br.gov.bcb.pix2568pix.santander.com.br/qr/v2/cobv/1a5faca5-1388-4a9c-a33d-9e5670370667520400005303986540599.905802BR5925PREDILINKS%20REDE%20DE%20TELECOMU6007NITEROI62070503***6304D054';

const LINK_PADRAO = 'https://minhaconta.predialnet.com.br/financeiro/geraBoletoPDF4C.php?CB2V=6091282626Z64800879Z1';

const ativo = () => process.env.FATURA_OVERRIDE_ATIVO === 'true';

const codcliente = () => String(process.env.FATURA_OVERRIDE_CODCLIENTE ?? '157175').trim();

const pix = () => process.env.FATURA_OVERRIDE_PIX || PIX_PADRAO;

const link = () => process.env.FATURA_OVERRIDE_LINK || LINK_PADRAO;

// O id chega ora como número, ora como string de rota — compara normalizado.
const aplicavel = (id) => ativo() && String(id ?? '').trim() === codcliente();

// Devolve a fatura como "em aberto": sem pagamento, não cancelada, com o PIX e
// o boleto informados. O resto dos campos (valor, vencimento, boleta) vem da
// fatura real, para a tela não ficar com dado inventado além do necessário.
const comoAberta = (fatura, origem) => {
  logger.info('fatura: substituição aplicada', {
    codcliente: codcliente(),
    origem,
    boleta_original: fatura?.boleta ?? null,
    tinha_pagamento: Boolean(fatura?.dta_pagamento),
  });

  return {
    ...fatura,
    pix: pix(),
    link: link(),
    dta_pagamento: null,
    cancelada: false,
  };
};

module.exports = { aplicavel, comoAberta, ativo, codcliente, pix, link };
