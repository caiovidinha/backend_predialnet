# API do Blog — implementação

Implementação do backend do blog na API `appgw.predialnet.com.br`. O front é um
projeto Next.js separado, em `blog.predialnet.com.br`. Este documento cobre o que
foi construído, como subir e onde a implementação difere da spec.

**Base:** `https://appgw.predialnet.com.br/blog`

> A spec original foi escrita para um site estático em Astro, com o conteúdo
> assado no build. Com o front em Next.js isso deixa de valer: o artigo
> publicado aparece sozinho, sem rebuild. Os contratos de leitura, o modelo de
> dados e a autenticação continuam iguais — o que mudou está em
> [Revalidação do cache do blog](#revalidação-do-cache-do-blog).

---

## Como subir

```bash
# 1. Variáveis novas (ver bloco "Blog" no .env.example)
#    Obrigatória: BLOG_ACCESS_TOKEN_SECRET
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 2. Migração — cria as 7 tabelas e semeia as 4 categorias iniciais
npm run migrate

# 3. Primeiro usuário do painel (não existe cadastro aberto)
npm run blog:usuario -- --email ana@predialnet.com.br --nome Ana --papel admin
#    Sem --senha, uma senha aleatória é gerada e impressa uma única vez.

# 4. Sobe normalmente
npm start
```

A API responde sem `BLOG_ACCESS_TOKEN_SECRET`, mas qualquer rota do painel devolve
500 até a variável existir. Os endpoints públicos funcionam sem ela.

---

## Endpoints

### Públicos (sem autenticação)

| Método | Rota | Observação |
|---|---|---|
| GET | `/blog/artigos` | `categoria`, `busca`, `pagina`, `por_pagina` (máx. 100), `ordem`, `corpo` |
| GET | `/blog/artigos/:slug` | Sempre com `corpo` |
| GET | `/blog/categorias` | Com `total` de artigos publicados |
| GET | `/blog/redirecionamentos` | Slugs antigos → novos, para o 301 |
| POST | `/blog/newsletter` | Rate limit: 5 por IP a cada 10 min |
| GET | `/blog/midia/:arquivo` | Imagens enviadas pelo painel |

Só saem artigos com `status: publicado` **e** `publicado_em` no passado — agendar
é gravar uma data futura, e o artigo aparece sozinho quando a hora chega.

Com `corpo=true`, `/blog/artigos` devolve o HTML junto: serve para o Next montar
as páginas em lote (`generateStaticParams` + ISR) sem cair em N+1 requisições.

### Autenticação

| Método | Rota | Observação |
|---|---|---|
| POST | `/blog/auth/login` | 5 tentativas por usuário/IP a cada 15 min, com bloqueio progressivo |
| POST | `/blog/auth/refresh` | Rotativo: o refresh usado é revogado |
| POST | `/blog/auth/logout` | 204 |

### Painel (`Authorization: Bearer <access_token>`)

| Método | Rota | Observação |
|---|---|---|
| GET | `/blog/admin/eu` | Dados do usuário do token |
| GET | `/blog/admin/artigos` | Inclui rascunhos e arquivados (`status=todos` por padrão) |
| POST | `/blog/admin/artigos` | Slug e tempo de leitura gerados se ausentes |
| PUT | `/blog/admin/artigos/:id` | Atualização parcial |
| DELETE | `/blog/admin/artigos/:id` | Exclusão lógica (vira `arquivado`), 204 |
| POST | `/blog/admin/artigos/:id/publicar` | Publica ou agenda; avisa o blog e devolve `revalidado` |
| GET | `/blog/admin/preview/:id` | Artigo em qualquer status |
| POST | `/blog/admin/upload` | `multipart/form-data`, campo `arquivo` |
| POST | `/blog/admin/revalidar` | Força a revalidação do cache do blog (`slug` opcional) |
| GET | `/blog/admin/newsletter` | Inscritos |
| GET | `/blog/admin/auditoria` | Quem criou, editou, publicou e excluiu |
| GET/POST | `/blog/admin/usuarios` | **papel `admin`** |
| PUT | `/blog/admin/usuarios/:id` | **papel `admin`** — nome, senha, papel, situação |

Trocar a senha ou desativar um usuário revoga todos os refresh tokens dele.

---

## Decisões de implementação

**Sanitização do corpo.** Feita na escrita, com `sanitize-html`, na lista de tags
da seção 2.3. `h1` vira `h2`, link externo ganha `rel="noopener noreferrer"`,
`on*` e `javascript:` são removidos, e o conteúdo de `script`/`style` é
descartado junto com a tag. Coberto por testes em
[src/tests/blogDomain.spec.js](src/tests/blogDomain.spec.js).

**Imagens em disco local.** `uploads/blog`, servidas por `GET /blog/midia/:arquivo`.
O tipo é decidido por magic bytes (não pela extensão nem pelo Content-Type do
multipart), o nome do arquivo é aleatório e a rota só aceita nomes no padrão que
nós geramos — um `.php` renomeado nem entra, e nada no diretório é interpretado.

> **Consequência operacional:** a imagem existe só na máquina que recebeu o
> upload. Hoje isso está de bom tamanho — em produção a API roda sob PM2, com
> filesystem real, e `/uploads` está no `.gitignore`, então restart e deploy por
> `git pull` não encostam nas imagens.
>
> O dia de migrar é quando a API passar a rodar em mais de uma instância ou em
> container efêmero. Aí o destino natural é o R2/S3 (o `objectStorage.js` do
> módulo de chamados já tem a configuração). A troca é contida: `salvar()` e
> `ler()` em [blogMedia.js](src/infrastructure/storage/blogMedia.js) são os únicos
> pontos que tocam byte, e a rota `/blog/midia/:arquivo` não muda — os artigos já
> publicados seguem apontando para o lugar certo.

**Resize e WebP são opcionais.** `sharp` é carregado com `require` condicional.
Sem ele, a imagem é validada e gravada como veio, e as dimensões saem de um
leitor de cabeçalho próprio (PNG, JPEG e WebP; AVIF devolve `null`). Instalar
`sharp` liga o redimensionamento para `BLOG_IMAGE_MAX_WIDTH` e a conversão para
WebP, sem mudar mais nada.

**Tokens.** Access token é JWT de 15 min com segredo próprio
(`BLOG_ACCESS_TOKEN_SECRET`, separado do `ACCESS_TOKEN_SECRET` do app). O refresh
é uma string opaca de 48 bytes; o banco guarda só o `sha256`. Cada refresh revoga
o anterior.

**CORS.** Allowlist com origem refletida e `Vary: Origin` — nunca `*`, nem nos
endpoints públicos. O padrão libera `blog.`, `www.` e a raiz de
`predialnet.com.br`; `BLOG_CORS_ORIGINS` substitui a lista. Em
`NODE_ENV=development` entram `localhost:3100` (blog) e `localhost:4321` (site),
com os equivalentes em `127.0.0.1`.

Entrada com `*` vira padrão, para os previews da Vercel:
`BLOG_CORS_ORIGINS=...,https://*.vercel.app`. O curinga cobre um nível de
subdomínio e não atravessa ponto, então ele libera `https://preview.vercel.app`
mas recusa `https://vercel.app.evil.com` e `https://a.b.vercel.app`.

Vale lembrar que CORS só entra em jogo em chamada feita pelo navegador — o
painel e o formulário de newsletter. O que o Next busca no servidor (SSR, ISR,
Server Component) não manda `Origin` e não é afetado por essa lista.

**Rate limit em memória.** Sem dependência nova. Com mais de uma instância atrás
de load balancer o limite efetivo vira (máximo × nº de instâncias); trocar por
Redis é mexer só em [src/http/middlewares/rateLimit.js](src/http/middlewares/rateLimit.js).
Login que dá certo não consome cota.

**Auditoria.** Toda criação, edição, publicação, exclusão, upload e login vai
para `blog_auditoria` com usuário e IP. Falha de gravação vira warning, nunca
derruba a operação.

**`sanitize-html` fixado em 2.17.0.** A 2.17.7 passou a depender de
`htmlparser2@12`, que é ESM puro e só carrega via `require()` em Node ≥ 22.12.
A 2.17.0 usa `htmlparser2@8` (CommonJS) e roda em qualquer versão. Quando a
produção estiver confirmadamente em Node ≥ 22.12, dá para voltar para a última.

---

## Diferenças em relação à spec

| Item | Spec | Implementado | Motivo |
|---|---|---|---|
| `resumo` | 120–200 caracteres | Obrigatório, máx. 300 | A faixa é recomendação editorial; barrar no servidor travaria texto legítimo |
| Datas | `2026-08-21T14:30:00-03:00` | `2026-08-21T17:30:00.000Z` | Mesmo instante em ISO 8601; `new Date()` no front lê os dois igual |
| `refresh_token` | Exemplo com cara de JWT | String opaca de 96 hex | Opaco é revogável de verdade; para o painel continua sendo só uma string |
| Artigo | — | Campo extra `categoria_slug` | `categoria` traz o nome, conforme a spec; o slug ajuda a montar links |

Campos e nomes de todo o resto seguem a spec — inclusive o formato de erro
`{ erro, mensagem, campos }` e o `409` da newsletter com `ok: true`.

---

## Revalidação do cache do blog

O blog guarda as respostas da API em cache e revalida sozinho a cada 5 minutos.
O webhook transforma "até 5 minutos" em "imediato".

A API chama, no contrato combinado com o front:

```http
POST https://blog.predialnet.com.br/api/revalidate
Content-Type: application/json
X-Revalidate-Secret: <BLOG_REVALIDATE_SECRET>

{ "slug": "wifi6-vale-a-pena" }
```

`BLOG_REVALIDATE_SECRET` **tem que ser idêntico** ao `REVALIDATE_SECRET`
configurado no blog. Se divergir, o blog responde 401 e o log traz a dica
apontando exatamente isso — vale procurar por `blog: revalidação falhou`.

### Quando dispara

| Evento | Dispara | Espera a resposta? |
|---|---|---|
| Publicar | Sim | Sim — é o valor de `revalidado` |
| Editar artigo no ar | Sim | Não, vai em segundo plano |
| Trocar o slug de artigo no ar | Sim, para os dois slugs | Não |
| Arquivar artigo no ar | Sim | Não |
| Salvar rascunho | Não | — |
| Editar artigo agendado | Não | — |
| Artigo agendado chega a hora | Sim, pelo job | — |

Publicar espera porque é ação deliberada e o editor merece saber se o blog foi
avisado — daí o campo `revalidado` na resposta ser verdade, e não chute. Salvar
não espera, porque é frequente e ninguém quer 5 s a cada Ctrl+S. O timeout é
curto (`BLOG_REVALIDATE_TIMEOUT_MS`, 5 s) justamente para que o pior caso do
publicar continue tolerável.

Falha nunca derruba a operação: a publicação é gravada de qualquer jeito e o
blog se atualiza sozinho no ciclo de 5 minutos.

### Artigos agendados

`publicado_em` no futuro já some dos endpoints públicos sozinho — isso é filtro
de query. O que precisa de job é **avisar o blog na hora certa**.

[BlogScheduler.js](src/application/blog/BlogScheduler.js) roda a cada minuto
(`BLOG_SCHEDULER_INTERVALO_MS`), procura artigo publicado com a data já vencida e
a coluna `revalidado_em` ainda nula, avisa o blog e marca. Se o blog não
confirmar, a marca não é gravada e o artigo volta na próxima passada — sem
sininho perdido.

O job sobe junto com a API no [server.js](src/server.js), não no `app.js`, para
que importar o app num teste não ligue timer nenhum. Ele nem inicia se
`BLOG_REVALIDATE_URL` estiver vazio. Se um dia o PM2 rodar em cluster, ponha
`BLOG_SCHEDULER_ATIVO=false` em todas as instâncias menos uma — embora o pior
caso de duas instâncias seja uma revalidação duplicada, que é inofensiva.

### Forçando na mão

`POST /blog/admin/revalidar` com `{ "slug": "..." }` opcional, para quando o
cache do blog ficar velho e ninguém quiser reeditar artigo só para destravar.

---

## Tabelas

`blog_artigos`, `blog_categorias`, `blog_usuarios`, `blog_refresh_tokens`,
`blog_newsletter`, `blog_redirecionamentos`, `blog_auditoria`.

Ids inteiros nos artigos e usuários (e não uuid como no resto do schema) porque
o front já está escrito contra `"id": 12`.
