const http = require('http');

// Sobe um "blog" de mentira para conferir o que a API manda no webhook.
// Sem mock de axios: o que interessa aqui é o contrato na rede.
let servidor;
let recebidas = [];
let respostaStatus = 200;

const revalidacao = require('../application/blog/BlogRevalidateService');

beforeAll(async () => {
  servidor = http.createServer((req, res) => {
    let corpo = '';
    req.on('data', (c) => { corpo += c; });
    req.on('end', () => {
      recebidas.push({
        metodo: req.method,
        url: req.url,
        segredo: req.headers['x-revalidate-secret'],
        autorizacao: req.headers.authorization,
        contentType: req.headers['content-type'],
        corpo: corpo ? JSON.parse(corpo) : null,
      });
      res.writeHead(respostaStatus, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(
        respostaStatus === 200
          ? { ok: true, revalidados: ['tag:artigos', '/'], em: new Date().toISOString() }
          : { erro: 'nao_autorizado' },
      ));
    });
  });

  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  process.env.BLOG_REVALIDATE_URL = `http://127.0.0.1:${servidor.address().port}/api/revalidate`;
  process.env.BLOG_REVALIDATE_SECRET = 'segredo-combinado';
});

afterAll(() => servidor.close());

beforeEach(() => {
  recebidas = [];
  respostaStatus = 200;
});

describe('blog: webhook de revalidação', () => {
  it('manda POST com o segredo no header X-Revalidate-Secret', async () => {
    const r = await revalidacao.revalidar({ slug: 'wifi6-vale-a-pena' });

    expect(r.ok).toBe(true);
    expect(recebidas).toHaveLength(1);
    expect(recebidas[0].metodo).toBe('POST');
    expect(recebidas[0].url).toBe('/api/revalidate');
    expect(recebidas[0].segredo).toBe('segredo-combinado');
    // O contrato usa header próprio, não Authorization.
    expect(recebidas[0].autorizacao).toBeUndefined();
  });

  it('manda o slug no corpo', async () => {
    await revalidacao.revalidar({ slug: 'wifi6-vale-a-pena' });
    expect(recebidas[0].corpo).toEqual({ slug: 'wifi6-vale-a-pena' });
  });

  it('omite o slug quando não há artigo específico', async () => {
    await revalidacao.revalidar({});
    expect(recebidas[0].corpo).toEqual({});
  });

  it('devolve os caminhos que o blog informou ter revalidado', async () => {
    const r = await revalidacao.revalidar({ slug: 'x' });
    expect(r.revalidados).toEqual(['tag:artigos', '/']);
  });

  it('não estoura quando o blog responde 401 — só reporta', async () => {
    respostaStatus = 401;
    const r = await revalidacao.revalidar({ slug: 'x' });

    expect(r.ok).toBe(false);
    expect(r.motivo).toBe('http_401');
  });

  it('não estoura quando o blog está fora do ar', async () => {
    const url = process.env.BLOG_REVALIDATE_URL;
    process.env.BLOG_REVALIDATE_URL = 'http://127.0.0.1:1/api/revalidate';

    const r = await revalidacao.revalidar({ slug: 'x' });
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe('sem_resposta');

    process.env.BLOG_REVALIDATE_URL = url;
  });

  it('não chama nada quando a URL não está configurada', async () => {
    const url = process.env.BLOG_REVALIDATE_URL;
    delete process.env.BLOG_REVALIDATE_URL;

    const r = await revalidacao.revalidar({ slug: 'x' });
    expect(r).toEqual({ ok: false, motivo: 'nao_configurado' });
    expect(recebidas).toHaveLength(0);

    process.env.BLOG_REVALIDATE_URL = url;
  });
});

describe('blog: job de artigos agendados', () => {
  const scheduler = require('../application/blog/BlogScheduler');
  const artigoRepo = require('../infrastructure/repositories/blogArticleRepository');

  it('avisa o blog e marca cada artigo cuja hora chegou', async () => {
    const pendentes = [
      { id: 1, slug: 'agendado-um' },
      { id: 2, slug: 'agendado-dois' },
    ];
    jest.spyOn(artigoRepo, 'pendentesDeRevalidacao').mockResolvedValue(pendentes);
    const marcar = jest.spyOn(artigoRepo, 'marcarRevalidado').mockResolvedValue({});

    const resultado = await scheduler.processarAgendados();

    expect(resultado).toEqual({ processados: 2, avisados: 2 });
    expect(recebidas.map((r) => r.corpo.slug)).toEqual(['agendado-um', 'agendado-dois']);
    expect(marcar.mock.calls.map((c) => c[0])).toEqual([1, 2]);
  });

  it('não marca o artigo quando o blog não confirmou — fica para o próximo ciclo', async () => {
    respostaStatus = 401;
    jest.spyOn(artigoRepo, 'pendentesDeRevalidacao').mockResolvedValue([{ id: 9, slug: 'falhou' }]);
    const marcar = jest.spyOn(artigoRepo, 'marcarRevalidado').mockResolvedValue({});

    const resultado = await scheduler.processarAgendados();

    expect(resultado).toEqual({ processados: 1, avisados: 0 });
    expect(marcar).not.toHaveBeenCalled();
  });

  it('não faz nada quando não há agendado vencido', async () => {
    jest.spyOn(artigoRepo, 'pendentesDeRevalidacao').mockResolvedValue([]);

    expect(await scheduler.processarAgendados()).toEqual({ processados: 0, avisados: 0 });
    expect(recebidas).toHaveLength(0);
  });

  afterEach(() => jest.restoreAllMocks());
});
