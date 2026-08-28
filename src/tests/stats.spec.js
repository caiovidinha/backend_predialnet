jest.mock('../infrastructure/repositories/statsRepository');

const statsRepo = require('../infrastructure/repositories/statsRepository');
const statsService = require('../application/stats/StatsService');

const vazio = () => ({});

beforeEach(() => {
  jest.clearAllMocks();
  statsService.limparCache();

  statsRepo.usuarios.mockResolvedValue({ total: 10, novos_periodo: 2 });
  statsRepo.notificacoes.mockResolvedValue({ enviadas: 5 });
  statsRepo.chamados.mockResolvedValue({ em_fila: 3 });
  statsRepo.speedtest.mockResolvedValue({ testes: 100 });
  statsRepo.blog.mockResolvedValue({ publicados: 4 });
  statsRepo.mensagensApp.mockResolvedValue({ ativas: 1 });
  statsRepo.cobertura.mockResolvedValue(vazio());
  statsRepo.serieDiaria.mockResolvedValue([{ dia: '2026-08-01', total: 3 }]);
});

describe('stats: janela de período', () => {
  it('usa 30 dias quando nada é informado', async () => {
    const r = await statsService.visaoGeral(undefined);
    expect(r.periodo.dias).toBe(30);
  });

  it('respeita o valor informado', async () => {
    expect((await statsService.visaoGeral(7)).periodo.dias).toBe(7);
  });

  it('limita a 365 dias — período aberto viraria varredura de tabela inteira', () => {
    expect(statsService.normalizarDias(9999)).toBe(365);
  });

  it('ignora lixo e volta para o padrão', () => {
    for (const entrada of ['abc', '', null, undefined, -5, 0]) {
      expect(statsService.normalizarDias(entrada)).toBe(30);
    }
  });

  it('calcula `desde` a partir dos dias pedidos', async () => {
    await statsService.visaoGeral(10);
    const desde = statsRepo.usuarios.mock.calls[0][0];
    const diasAtras = (Date.now() - desde.getTime()) / (24 * 60 * 60 * 1000);
    expect(diasAtras).toBeCloseTo(10, 1);
  });
});

describe('stats: cache', () => {
  it('não repete a consulta dentro do TTL', async () => {
    await statsService.visaoGeral(30);
    await statsService.visaoGeral(30);
    expect(statsRepo.usuarios).toHaveBeenCalledTimes(1);
  });

  it('separa o cache por período — 7 dias não serve para 30', async () => {
    await statsService.visaoGeral(7);
    await statsService.visaoGeral(30);
    expect(statsRepo.usuarios).toHaveBeenCalledTimes(2);
  });

  it('limparCache força a próxima consulta', async () => {
    await statsService.visaoGeral(30);
    statsService.limparCache();
    await statsService.visaoGeral(30);
    expect(statsRepo.usuarios).toHaveBeenCalledTimes(2);
  });
});

describe('stats: isolamento de falha', () => {
  it('um domínio quebrado não derruba o dashboard inteiro', async () => {
    statsRepo.speedtest.mockRejectedValue(new Error('tabela travada'));

    const r = await statsService.visaoGeral(30);

    expect(r.speedtest).toEqual({ erro: 'indisponivel' });
    // Os outros continuam com número de verdade.
    expect(r.usuarios.total).toBe(10);
    expect(r.chamados.em_fila).toBe(3);
    expect(r.blog.publicados).toBe(4);
  });
});

describe('stats: detalhe por domínio', () => {
  it('usuarios junta resumo, série e cobertura', async () => {
    const r = await statsService.usuarios(30);
    expect(r.total).toBe(10);
    expect(r.serie_cadastros).toEqual([{ dia: '2026-08-01', total: 3 }]);
    expect(r.cobertura).toBeDefined();
    expect(statsRepo.serieDiaria).toHaveBeenCalledWith('usuarios', expect.any(Date));
  });

  it('cada domínio pede a sua própria série', async () => {
    await statsService.speedtest(30);
    expect(statsRepo.serieDiaria).toHaveBeenCalledWith('speedtests', expect.any(Date));

    await statsService.chamados(30);
    expect(statsRepo.serieDiaria).toHaveBeenCalledWith('chamados', expect.any(Date));

    await statsService.blog(30);
    expect(statsRepo.serieDiaria).toHaveBeenCalledWith('artigos', expect.any(Date));
  });

  it('propaga a falha no detalhe — aqui não tem o que isolar', async () => {
    statsRepo.chamados.mockRejectedValue(new Error('banco fora'));
    await expect(statsService.chamados(30)).rejects.toThrow('banco fora');
  });
});
