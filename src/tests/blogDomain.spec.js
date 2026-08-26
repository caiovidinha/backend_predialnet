const { sanitizarCorpo, textoPuro, calcularTempoLeitura } = require('../domain/blog/sanitize');
const { gerarSlug, slugValido, gerarSlugUnico } = require('../domain/blog/slug');
const { validarArtigo, serializarArtigo } = require('../domain/blog/artigo');
const midia = require('../infrastructure/storage/blogMedia');

describe('blog: sanitização do corpo', () => {
  it('remove script, iframe, object, embed e form', () => {
    const sujo = `
      <p>ok</p>
      <script>alert(1)</script>
      <iframe src="https://evil.com"></iframe>
      <object data="x"></object>
      <embed src="x">
      <form action="/roubar"><input name="senha"></form>
    `;
    const limpo = sanitizarCorpo(sujo);

    expect(limpo).toContain('<p>ok</p>');
    for (const tag of ['script', 'iframe', 'object', 'embed', 'form', 'input']) {
      expect(limpo).not.toContain(`<${tag}`);
    }
    // O conteúdo do script também some, não só a tag.
    expect(limpo).not.toContain('alert(1)');
  });

  it('remove atributos on* e urls javascript:', () => {
    const limpo = sanitizarCorpo(
      '<p onclick="roubar()">a</p><img src="x" onerror="roubar()"><a href="javascript:roubar()">b</a>',
    );

    expect(limpo).not.toContain('onclick');
    expect(limpo).not.toContain('onerror');
    expect(limpo).not.toContain('javascript:');
  });

  it('converte h1 em h2 — o h1 da página é o título do artigo', () => {
    expect(sanitizarCorpo('<h1>Título</h1>')).toBe('<h2>Título</h2>');
  });

  it('acrescenta rel="noopener noreferrer" em link externo', () => {
    expect(sanitizarCorpo('<a href="https://exemplo.com">x</a>'))
      .toContain('rel="noopener noreferrer"');
  });

  it('preserva as tags permitidas', () => {
    const original = '<h2>t</h2><ul><li><strong>a</strong> <em>b</em></li></ul>'
      + '<blockquote>c</blockquote><figure><img src="https://x.com/a.png" alt="a" />'
      + '<figcaption>leg</figcaption></figure><table><tbody><tr><td>1</td></tr></tbody></table>';

    expect(sanitizarCorpo(original)).toBe(original);
  });

  it('calcula tempo de leitura em palavras ÷ 200, com mínimo de 1', () => {
    expect(calcularTempoLeitura('<p>uma frase curta</p>')).toBe(1);
    expect(calcularTempoLeitura(`<p>${'palavra '.repeat(800)}</p>`)).toBe(4);
  });

  it('extrai texto puro para busca e contagem', () => {
    expect(textoPuro('<p>a <strong>b</strong></p>')).toBe('a b');
  });
});

describe('blog: slug', () => {
  it('remove acentos, pontuação e caixa alta', () => {
    expect(gerarSlug('Wi-Fi 6 vale a pena?')).toBe('wi-fi-6-vale-a-pena');
    expect(gerarSlug('Conexão à Internet: até 2029!')).toBe('conexao-a-internet-ate-2029');
  });

  it('valida o formato esperado', () => {
    expect(slugValido('wifi6-vale-a-pena')).toBe(true);
    expect(slugValido('Wifi Vale')).toBe(false);
    expect(slugValido('-comeca-com-hifen')).toBe(false);
  });

  it('acrescenta sufixo numérico quando o slug já existe', async () => {
    const usados = new Set(['wi-fi-6', 'wi-fi-6-2']);
    const novo = await gerarSlugUnico('Wi-Fi 6', async (s) => usados.has(s));
    expect(novo).toBe('wi-fi-6-3');
  });
});

describe('blog: validação do artigo', () => {
  const completo = {
    titulo: 'Wi-Fi 6 vale a pena?',
    resumo: 'O que muda na prática quando a casa inteira depende do mesmo roteador.',
    categoria: 'tecnologia',
    corpo: '<p>texto</p>',
  };

  it('aceita um artigo completo', () => {
    expect(validarArtigo(completo)).toEqual({});
  });

  it('aponta os campos obrigatórios que faltam', () => {
    const campos = validarArtigo({});
    expect(campos).toEqual({
      titulo: 'Obrigatório.',
      resumo: 'Obrigatório.',
      categoria: 'Obrigatório.',
      corpo: 'Obrigatório.',
    });
  });

  it('no modo parcial só valida o que veio', () => {
    expect(validarArtigo({ titulo: 'novo' }, { parcial: true })).toEqual({});
    expect(validarArtigo({ titulo: '' }, { parcial: true })).toEqual({ titulo: 'Obrigatório.' });
  });

  it('recusa slug, status e data fora do formato', () => {
    const campos = validarArtigo({
      ...completo, slug: 'Slug Inválido', status: 'publicando', publicado_em: 'ontem',
    });
    expect(campos.slug).toBeDefined();
    expect(campos.status).toBeDefined();
    expect(campos.publicado_em).toBeDefined();
  });
});

describe('blog: serialização', () => {
  const linha = {
    id: 12,
    slug: 'wifi6',
    titulo: 'Wi-Fi 6',
    resumo: 'resumo',
    categoria: { nome: 'Tecnologia', slug: 'tecnologia' },
    autor: 'Predialnet',
    corpo: '<p>x</p>',
    capa_url: 'https://appgw.predialnet.com.br/blog/midia/a.webp',
    capa_alt: 'alt',
    capa_largura: 1200,
    capa_altura: 675,
    destaque: true,
    status: 'publicado',
    publicado_em: new Date('2026-08-12T12:00:00Z'),
    atualizado_em: new Date('2026-08-14T12:00:00Z'),
    tempo_leitura: 4,
    visualizacoes: 1832,
    seo_titulo: null,
    seo_descricao: null,
    seo_noindex: false,
  };

  it('aninha capa e seo e devolve datas ISO', () => {
    const artigo = serializarArtigo(linha);
    expect(artigo.categoria).toBe('Tecnologia');
    expect(artigo.capa).toEqual({
      url: linha.capa_url, alt: 'alt', largura: 1200, altura: 675,
    });
    expect(artigo.seo).toEqual({ titulo: null, descricao: null, noindex: false });
    expect(artigo.publicado_em).toBe('2026-08-12T12:00:00.000Z');
  });

  it('omite o corpo quando a listagem não pede', () => {
    expect(serializarArtigo(linha, { incluirCorpo: false }).corpo).toBeUndefined();
    expect(serializarArtigo(linha, { incluirCorpo: true }).corpo).toBe('<p>x</p>');
  });

  it('devolve capa nula quando não há imagem', () => {
    expect(serializarArtigo({ ...linha, capa_url: null }).capa).toBeNull();
  });
});

describe('blog: upload de imagem', () => {
  // PNG mínimo montado à mão: assinatura + cabeçalho do chunk IHDR (tamanho em
  // 4 bytes big-endian, depois o nome) + largura e altura.
  const png = (() => {
    const buf = Buffer.alloc(40);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
    buf.writeUInt32BE(13, 8);        // tamanho do IHDR
    buf.write('IHDR', 12, 'ascii');
    buf.writeUInt32BE(1200, 16);     // largura
    buf.writeUInt32BE(675, 20);      // altura
    return buf;
  })();

  it('identifica o tipo pelos magic bytes, não pela extensão', () => {
    expect(midia.detectarTipo(png)).toBe('image/png');
    expect(midia.detectarTipo(Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array(20).fill(0)]))).toBe('image/jpeg');
  });

  it('recusa arquivo que não é imagem, mesmo com nome de imagem', () => {
    const php = Buffer.from(`<?php system($_GET[0]); ?>${'A'.repeat(40)}`);
    expect(midia.detectarTipo(php)).toBeNull();
  });

  it('lê as dimensões do PNG sem depender do sharp', () => {
    expect(midia.medir(png, 'image/png')).toEqual({ largura: 1200, altura: 675 });
  });

  it('só aceita nomes de arquivo gerados por nós', () => {
    expect(midia.NOME_VALIDO.test('a7f3e912b4c5d6e7.webp')).toBe(true);
    expect(midia.NOME_VALIDO.test('../../package.json')).toBe(false);
    expect(midia.NOME_VALIDO.test('script.php')).toBe(false);
    expect(midia.NOME_VALIDO.test('a7f3e912b4c5d6e7.php')).toBe(false);
  });
});
