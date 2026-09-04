jest.mock('../infrastructure/external/uaipiClient');

const uaipi = require('../infrastructure/external/uaipiClient');
const fatura = require('../application/fatura/FaturaService');
const override = require('../application/fatura/faturaOverride');

const PIX_ESPERADO = '00020101021226900014br.gov.bcb.pix2568pix.santander.com.br/qr/v2/cobv/1a5faca5-1388-4a9c-a33d-9e5670370667520400005303986540599.905802BR5925PREDILINKS%20REDE%20DE%20TELECOMU6007NITEROI62070503***6304D054';
const LINK_ESPERADO = 'https://minhaconta.predialnet.com.br/financeiro/geraBoletoPDF4C.php?CB2V=6091282626Z64800879Z1';

const ALVO = '157175';
const OUTRO = '999999';

// Cliente com a fatura toda paga: é justamente o caso que a substituição
// precisa transformar em "em aberto".
const faturasPagas = [
  {
    tipo: 'Internet', boleta: 'B1', valor: 149.9,
    dta_vencimento: '2026-09-20', dta_pagamento: '2026-09-02',
    data_emissao: '2026-09-01', cancelada: false,
    pix: 'PIX-REAL-DA-UAIPI', link: 'https://uaipi.exemplo/boleto-real.pdf',
  },
];

const responder = () => uaipi.get.mockResolvedValue({ data: faturasPagas });

beforeEach(() => {
  jest.clearAllMocks();
  responder();
  process.env.FATURA_OVERRIDE_ATIVO = 'true';
  process.env.FATURA_OVERRIDE_CODCLIENTE = ALVO;
  delete process.env.FATURA_OVERRIDE_PIX;
  delete process.env.FATURA_OVERRIDE_LINK;
});

afterAll(() => {
  delete process.env.FATURA_OVERRIDE_ATIVO;
  delete process.env.FATURA_OVERRIDE_CODCLIENTE;
});

describe('fatura: substituição do cliente alvo', () => {
  it('devolve a fatura como em aberto, mesmo estando paga na UAIPI', async () => {
    const { faturaAtual } = await fatura.getCurrentInvoice(ALVO);

    expect(faturaAtual.dta_pagamento).toBeNull();
    expect(faturaAtual.cancelada).toBe(false);
  });

  it('grava o PIX exatamente como foi informado, sem decodificar o %20', async () => {
    const { faturaAtual } = await fatura.getCurrentInvoice(ALVO);

    expect(faturaAtual.pix).toBe(PIX_ESPERADO);
    // A garantia explícita: nada de transformar %20 em espaço.
    expect(faturaAtual.pix).toContain('PREDILINKS%20REDE%20DE%20TELECOMU');
    expect(faturaAtual.pix).not.toContain('PREDILINKS REDE');
  });

  it('troca o link do boleto', async () => {
    const { faturaAtual } = await fatura.getCurrentInvoice(ALVO);
    expect(faturaAtual.link).toBe(LINK_ESPERADO);
  });

  it('preserva os demais campos da fatura real', async () => {
    const { faturaAtual } = await fatura.getCurrentInvoice(ALVO);

    expect(faturaAtual.valor).toBe(149.9);
    expect(faturaAtual.boleta).toBe('B1');
    expect(faturaAtual.dta_vencimento).toBe('2026-09-20');
  });

  it('mantém /fatura/status coerente com /fatura/atual', async () => {
    const status = await fatura.checkCurrentInvoiceStatus(ALVO);

    // Sem a substituição aqui, a tela diria "paga" ao lado de uma fatura aberta.
    expect(status.status).not.toBe('paga');
    expect(status.link).toBe(LINK_ESPERADO);
  });

  it('devolve o PIX substituído mesmo sem fatura em aberto de verdade', async () => {
    // O caminho normal lançaria "Nenhuma fatura em aberto encontrada".
    const { pix } = await fatura.getPixFromLastOpenInternetInvoice(ALVO);
    expect(pix).toBe(PIX_ESPERADO);
  });

  it('aceita o id como número, não só como string de rota', async () => {
    const { faturaAtual } = await fatura.getCurrentInvoice(157175);
    expect(faturaAtual.link).toBe(LINK_ESPERADO);
  });
});

describe('fatura: quem NÃO pode ser afetado', () => {
  it('outro cliente continua com os dados reais da UAIPI', async () => {
    const { faturaAtual } = await fatura.getCurrentInvoice(OUTRO);

    expect(faturaAtual.pix).toBe('PIX-REAL-DA-UAIPI');
    expect(faturaAtual.link).toBe('https://uaipi.exemplo/boleto-real.pdf');
    expect(faturaAtual.dta_pagamento).toBe('2026-09-02');
  });

  it('outro cliente continua vendo a fatura como paga', async () => {
    expect((await fatura.checkCurrentInvoiceStatus(OUTRO)).status).toBe('paga');
  });

  it('outro cliente sem fatura aberta continua recebendo erro no PIX', async () => {
    await expect(fatura.getPixFromLastOpenInternetInvoice(OUTRO))
      .rejects.toThrow('Nenhuma fatura do tipo internet em aberto encontrada.');
  });

  it('id parecido não casa — a comparação é exata', async () => {
    for (const parecido of ['1571750', '15717', '157175x']) {
      // eslint-disable-next-line no-await-in-loop
      const { faturaAtual } = await fatura.getCurrentInvoice(parecido);
      expect(faturaAtual.pix).toBe('PIX-REAL-DA-UAIPI');
    }
  });
});

describe('fatura: a flag desliga tudo', () => {
  it('com a flag em false, nem o cliente alvo é tocado', async () => {
    process.env.FATURA_OVERRIDE_ATIVO = 'false';

    const { faturaAtual } = await fatura.getCurrentInvoice(ALVO);
    expect(faturaAtual.pix).toBe('PIX-REAL-DA-UAIPI');
    expect(faturaAtual.dta_pagamento).toBe('2026-09-02');
  });

  it('sem a variável definida, fica desligado — padrão seguro', async () => {
    delete process.env.FATURA_OVERRIDE_ATIVO;

    const { faturaAtual } = await fatura.getCurrentInvoice(ALVO);
    expect(faturaAtual.pix).toBe('PIX-REAL-DA-UAIPI');
  });

  it('só a string "true" liga — "1" ou "sim" não valem', async () => {
    for (const valor of ['1', 'sim', 'TRUE', 'yes']) {
      process.env.FATURA_OVERRIDE_ATIVO = valor;
      expect(override.ativo()).toBe(false);
    }
  });

  it('desligar não exige deploy: a env é lida a cada chamada', async () => {
    process.env.FATURA_OVERRIDE_ATIVO = 'true';
    expect((await fatura.getCurrentInvoice(ALVO)).faturaAtual.link).toBe(LINK_ESPERADO);

    process.env.FATURA_OVERRIDE_ATIVO = 'false';
    expect((await fatura.getCurrentInvoice(ALVO)).faturaAtual.link)
      .toBe('https://uaipi.exemplo/boleto-real.pdf');
  });
});

describe('fatura: valores por env', () => {
  it('a env sobrepõe o PIX e o link embutidos', async () => {
    process.env.FATURA_OVERRIDE_PIX = 'OUTRO-PIX';
    process.env.FATURA_OVERRIDE_LINK = 'https://outro/boleto.pdf';

    const { faturaAtual } = await fatura.getCurrentInvoice(ALVO);

    expect(faturaAtual.pix).toBe('OUTRO-PIX');
    expect(faturaAtual.link).toBe('https://outro/boleto.pdf');
  });

  it('a env também troca qual cliente é o alvo', async () => {
    process.env.FATURA_OVERRIDE_CODCLIENTE = OUTRO;

    expect((await fatura.getCurrentInvoice(OUTRO)).faturaAtual.link).toBe(LINK_ESPERADO);
    expect((await fatura.getCurrentInvoice(ALVO)).faturaAtual.link)
      .toBe('https://uaipi.exemplo/boleto-real.pdf');
  });
});
