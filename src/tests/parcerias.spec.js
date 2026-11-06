jest.mock('../infrastructure/repositories/parceriaRepository', () => ({
  registrar: jest.fn(),
  totais: jest.fn(),
  porParceria: jest.fn(),
  porDia: jest.fn(),
  planos: jest.fn(),
  parceriasConhecidas: jest.fn(),
  eventos: jest.fn(),
  CAMPOS_DO_FUNIL: [
    'visitantes', 'consultas', 'com_cobertura', 'sem_cobertura', 'cobertura_a_confirmar',
    'dados', 'formularios', 'chat', 'envio_falhou', 'whatsapp',
  ],
}));

jest.mock('../infrastructure/repositories/parceriaCadastroRepository', () => ({
  listar: jest.fn(),
  buscarPorId: jest.fn(),
  buscarPorSlug: jest.fn(),
  criar: jest.fn(),
  atualizar: jest.fn(),
}));

const repo = require('../infrastructure/repositories/parceriaRepository');
const cadastroRepo = require('../infrastructure/repositories/parceriaCadastroRepository');
const cadastro = require('../application/parcerias/ParceriaCadastroService');
const service = require('../application/parcerias/ParceriaService');
const { lerCorpo } = require('../http/controllers/parceriaController');

const SESSAO = '2f1c9a4e-0b7d-4a51-9a63-1c2b3d4e5f60';
const valido = (extra = {}) => ({ parceria: 'clube-xyz', evento: 'acesso', sessao: SESSAO, ...extra });

beforeEach(() => {
  jest.clearAllMocks();
  repo.registrar.mockResolvedValue({ id: 'x' });
  cadastroRepo.listar.mockResolvedValue([]);
});

describe('parcerias: normalização', () => {
  it('vira slug: acento, caixa e espaço', () => {
    expect(service.normalizarParceria('  Clube São João  ')).toBe('clube-sao-joao');
  });

  it('corta em 40 caracteres', () => {
    expect(service.normalizarParceria('a'.repeat(80))).toHaveLength(40);
  });

  it('só símbolo vira nulo', () => {
    expect(service.normalizarParceria('!!!')).toBeNull();
  });
});

describe('parcerias: validação do evento', () => {
  it('aceita um acesso simples', async () => {
    await service.registrar(valido(), { userAgent: 'UA' });
    expect(repo.registrar).toHaveBeenCalledWith(expect.objectContaining({
      parceria: 'clube-xyz', evento: 'acesso', sessao: SESSAO, userAgent: 'UA',
    }));
  });

  it('recusa sem parceria', async () => {
    await expect(service.registrar(valido({ parceria: '' }))).rejects.toMatchObject({ statusCode: 400 });
  });

  it('recusa evento fora da allowlist', async () => {
    await expect(service.registrar(valido({ evento: 'compra' }))).rejects.toMatchObject({ statusCode: 400 });
  });

  it('recusa sessão malformada', async () => {
    await expect(service.registrar(valido({ sessao: "'; DROP TABLE" }))).rejects.toMatchObject({ statusCode: 400 });
  });

  it('consulta exige detalhe da allowlist', async () => {
    await expect(service.registrar(valido({ evento: 'consulta' }))).rejects.toMatchObject({ statusCode: 400 });
    await expect(service.registrar(valido({ evento: 'consulta', detalhe: 'xpto' }))).rejects.toMatchObject({ statusCode: 400 });
    await service.registrar(valido({ evento: 'consulta', detalhe: 'sem_cobertura' }));
    expect(repo.registrar).toHaveBeenCalledTimes(1);
  });

  it('acesso não aceita detalhe', async () => {
    await expect(service.registrar(valido({ detalhe: 'chat' }))).rejects.toMatchObject({ statusCode: 400 });
  });

  it('não guarda a query string do referrer (pode ter dado pessoal)', async () => {
    await service.registrar(valido({ origem: 'https://instagram.com/p/abc?email=a@b.com' }));
    expect(repo.registrar.mock.calls[0][0].origem).toBe('https://instagram.com/p/abc');
  });

  it('ignora campos que não existem no modelo (nome, celular)', async () => {
    await service.registrar(valido({ nome: 'Fulano', celular: '21999999999' }));
    const gravado = repo.registrar.mock.calls[0][0];
    expect(gravado).not.toHaveProperty('nome');
    expect(gravado).not.toHaveProperty('celular');
  });

  it('lê o corpo do sendBeacon (text/plain)', () => {
    expect(lerCorpo(JSON.stringify(valido()))).toEqual(valido());
    expect(lerCorpo('não é json')).toBeNull();
  });
});

describe('parcerias: resumo', () => {
  const funil = {
    visitantes: 200, consultas: 120, com_cobertura: 90, sem_cobertura: 20, cobertura_a_confirmar: 10,
    dados: 80, formularios: 40, chat: 15, envio_falhou: 1, whatsapp: 25,
  };

  beforeEach(() => {
    repo.totais.mockResolvedValue(funil);
    repo.porParceria.mockResolvedValue([{ parceria: 'clube-xyz', ...funil }]);
    repo.porDia.mockResolvedValue([]);
    repo.planos.mockResolvedValue([]);
    repo.parceriasConhecidas.mockResolvedValue(['clube-xyz']);
  });

  it('calcula as taxas do funil', async () => {
    const r = await service.resumo({ dias: 7 });
    expect(r.periodo.dias).toBe(7);
    expect(r.totais.taxas).toEqual({ consulta: 60, cobertura: 75, conversao: 20, whatsapp: 12.5 });
  });

  it('taxa sem base é nula, não divisão por zero', async () => {
    repo.totais.mockResolvedValue({ ...funil, visitantes: 0, consultas: 0 });
    const r = await service.resumo({});
    expect(r.totais.taxas.conversao).toBeNull();
    expect(r.totais.taxas.cobertura).toBeNull();
  });

  it('normaliza o filtro de parceria antes de consultar', async () => {
    await service.resumo({ parceria: 'Clube XYZ' });
    expect(repo.totais).toHaveBeenCalledWith(expect.any(Date), 'clube-xyz');
  });
});

describe('parcerias: CSV', () => {
  it('sai com BOM, ";" e escapa fórmula', () => {
    const csv = service.paraCsv(['a', 'b'], [['=HYPERLINK("x")', 'tem;ponto']]);
    expect(csv.startsWith('﻿a;b\r\n')).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain('"tem;ponto"');
  });

  it('diário: uma linha por dia e parceria', async () => {
    cadastroRepo.listar.mockResolvedValue([{ slug: 'clube-xyz', nome: 'Clube XYZ' }]);
    repo.porDia.mockResolvedValue([{ dia: '2026-11-06', parceria: 'clube-xyz', visitantes: 3, formularios: 1 }]);
    const { nome, conteudo } = await service.exportarCsv({ dias: 30 });
    expect(repo.porDia).toHaveBeenCalledWith(expect.any(Date), null, { separarParceria: true });
    expect(nome).toBe('parcerias-diario-todas-30d.csv');
    expect(conteudo.split('\r\n')[1]).toBe('2026-11-06;clube-xyz;Clube XYZ;3;;;;;;1;;;');
  });
});

describe('parcerias: resumo com o cadastro', () => {
  const zero = {
    visitantes: 0, consultas: 0, com_cobertura: 0, sem_cobertura: 0, cobertura_a_confirmar: 0,
    dados: 0, formularios: 0, chat: 0, envio_falhou: 0, whatsapp: 0,
  };

  beforeEach(() => {
    repo.totais.mockResolvedValue(zero);
    repo.porDia.mockResolvedValue([]);
    repo.planos.mockResolvedValue([]);
    repo.porParceria.mockResolvedValue([{ parceria: 'fulana', ...zero, visitantes: 9 }, { parceria: 'link-velho', ...zero, visitantes: 2 }]);
    repo.parceriasConhecidas.mockResolvedValue(['fulana', 'link-velho']);
    cadastroRepo.listar.mockResolvedValue([
      { slug: 'fulana', nome: 'Fulana Silva', instagram: 'fulana', ativo: true },
      { slug: 'beltrano', nome: 'Beltrano', instagram: null, ativo: true },
      { slug: 'inativo', nome: 'Inativo', instagram: null, ativo: false },
    ]);
  });

  it('põe o nome do cadastro na linha e marca link sem cadastro', async () => {
    const r = await service.resumo({});
    const fulana = r.parcerias.find((l) => l.parceria === 'fulana');
    const velho = r.parcerias.find((l) => l.parceria === 'link-velho');
    expect(fulana).toMatchObject({ nome: 'Fulana Silva', cadastrada: true, visitantes: 9 });
    expect(velho).toMatchObject({ nome: 'link-velho', cadastrada: false });
  });

  it('cadastrado ativo sem acesso aparece com zero; inativo sem acesso não', async () => {
    const r = await service.resumo({});
    expect(r.parcerias.find((l) => l.parceria === 'beltrano')).toMatchObject({ visitantes: 0, ultimo_evento: null });
    expect(r.parcerias.find((l) => l.parceria === 'inativo')).toBeUndefined();
  });

  it('catálogo do filtro junta cadastro e eventos, em ordem de nome', async () => {
    const r = await service.resumo({});
    expect(r.parcerias_conhecidas.map((p) => p.slug)).toEqual(['beltrano', 'fulana', 'inativo', 'link-velho']);
  });

  it('com filtro, devolve a ficha da parceria e não inventa linhas', async () => {
    repo.porParceria.mockResolvedValue([{ parceria: 'fulana', ...zero, visitantes: 9 }]);
    const r = await service.resumo({ parceria: 'fulana' });
    expect(r.parceria_info).toMatchObject({ nome: 'Fulana Silva', instagram: 'fulana' });
    expect(r.parcerias).toHaveLength(1);
  });
});

describe('parcerias: cadastro', () => {
  beforeEach(() => {
    cadastroRepo.criar.mockImplementation(async (d) => ({ id: 'novo', ativo: true, ...d }));
  });

  it('gera o slug pelo nome', async () => {
    const p = await cadastro.criar({ nome: 'Ana Júlia Ribeiro' });
    expect(p.slug).toBe('ana-julia-ribeiro');
  });

  it('respeita slug digitado (normalizado)', async () => {
    const p = await cadastro.criar({ nome: 'Ana', slug: 'Ana BF 2026' });
    expect(p.slug).toBe('ana-bf-2026');
  });

  it('exige nome', async () => {
    await expect(cadastro.criar({ nome: '  ' })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('slug repetido vira 409', async () => {
    cadastroRepo.criar.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }));
    await expect(cadastro.criar({ nome: 'Ana' })).rejects.toMatchObject({ statusCode: 409 });
  });

  it('Instagram aceita @, URL e usuário puro', () => {
    expect(cadastro.usuarioDoInstagram('@Fulana.Silva')).toBe('fulana.silva');
    expect(cadastro.usuarioDoInstagram('https://www.instagram.com/fulana/?igsh=abc')).toBe('fulana');
    expect(cadastro.usuarioDoInstagram('não é usuário')).toBeNull();
  });

  it('não deixa mudar o slug depois de criado', async () => {
    cadastroRepo.buscarPorId.mockResolvedValue({ id: '1', slug: 'ana' });
    await expect(cadastro.atualizar('1', { slug: 'ana-2' })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('edita nome e desativa', async () => {
    cadastroRepo.buscarPorId.mockResolvedValue({ id: '1', slug: 'ana' });
    cadastroRepo.atualizar.mockResolvedValue({});
    await cadastro.atualizar('1', { nome: 'Ana R.', ativo: false, slug: 'ana' });
    expect(cadastroRepo.atualizar).toHaveBeenCalledWith('1', { nome: 'Ana R.', ativo: false });
  });

  it('id inexistente é 404', async () => {
    cadastroRepo.buscarPorId.mockResolvedValue(null);
    await expect(cadastro.atualizar('x', { nome: 'a' })).rejects.toMatchObject({ statusCode: 404 });
  });
});
