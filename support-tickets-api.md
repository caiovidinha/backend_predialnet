# Chamados de Suporte (Kanban) — Contrato da API

Base do backend para o painel de suporte gerenciar **chamados/tickets** em um
board estilo kanban, com abertura, comentários e **notificação por e-mail** ao
suporte quando um chamado é aberto.

- **Base URL:** `NEXT_PUBLIC_API_URL` → produção `https://appgw.predialnet.com.br`
- **Prefixo:** `/tickets`
- **Autenticação:** todas as rotas exigem `x-access-token: <ADMIN_BYPASS_TOKEN>`
  (mesmo do resto do painel). `401` sem token, `403` não-admin.

## Colunas (status) e prioridades
- **status** (colunas do kanban): `ABERTO` · `EM_ANDAMENTO` · `AGUARDANDO` ·
  `RESOLVIDO` · `FECHADO`
- **priority:** `BAIXA` · `MEDIA` · `ALTA` · `URGENTE`

## Modelo do chamado
```ts
type Ticket = {
  id: string;
  number: number;         // nº sequencial do chamado (#1, #2, …)
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: string | null;
  position: number;       // ordem dentro da coluna (kanban)
  requesterName: string | null; // operador que abriu o chamado
  cpf: string | null;           // cliente relacionado (dados vêm da API via CPF)
  codcliente: string | null;    // contrato (opcional)
  assignee: string | null;
  closedAt: string | null; // setado ao entrar em RESOLVIDO/FECHADO
  createdAt: string;
  updatedAt: string;
  comments?: TicketComment[]; // só no detalhe
};

type TicketComment = {
  id: string;
  author: string | null;
  body: string;
  internal: boolean;  // comentário interno (não mostrar ao cliente)
  createdAt: string;
};
```

## Endpoints

### Abrir chamado (operador → suporte) — dispara e-mail
```
POST /tickets
Body: {
  "subject": "Sem internet",            // obrigatório
  "description": "Cliente sem conexão", // obrigatório
  "priority": "ALTA",                   // opcional (default MEDIA)
  "category": "Conexão",                // opcional
  "requesterName": "Operador João",     // quem abriu (opcional)
  "cpf": "02227913738",                 // cliente relacionado (opcional)
  "codcliente": "157175",               // contrato (opcional)
  "assignee": "operador1"               // responsável (opcional)
}
→ 201 Ticket
```
O chamado é aberto **pelo operador para o suporte**. Do cliente basta o `cpf`
(e opcionalmente `codcliente`) — o resto dos dados o painel puxa da API
(`/support/clients/:credential/overview`, `.../contracts`).
Ao criar, envia e-mail de notificação para `SUPPORT_NOTIFY_EMAIL`
(padrão `caiomdavidinha@gmail.com`), best-effort. `400` se faltar
subject/description.

### Board kanban
```
GET /tickets/board
→ 200 { "columns": [ { "status": "ABERTO", "tickets": [Ticket, …] }, … ], "total": N }
```
Retorna **todas as 5 colunas** (mesmo vazias), cada uma com seus chamados
ordenados por `position` e depois `createdAt`. Ideal pra renderizar o board.

### Listar (filtros + paginação)
```
GET /tickets?status=&priority=&assignee=&cpf=&q=&page=1&limit=20
→ 200 { items: Ticket[], total, page, limit }
```
`q` busca em assunto/descrição/nome/e-mail do solicitante. `limit` máx. 100.

### Detalhe (com comentários)
```
GET /tickets/:id  → 200 Ticket (com comments[])  ·  404 se não achar
```

### Atualizar / mover no kanban
```
PATCH /tickets/:id
Body (qualquer subconjunto): {
  "status": "EM_ANDAMENTO",   // mover de coluna
  "position": 2,              // ordem dentro da coluna (drag & drop)
  "priority": "URGENTE",
  "assignee": "operador2",
  "subject": "...", "description": "...", "category": "..."
}
→ 200 Ticket
```
Ao mover para `RESOLVIDO`/`FECHADO`, `closedAt` é preenchido; ao sair, é limpo.
`400` valor inválido · `404` não encontrado.

### Comentar (andamento)
```
POST /tickets/:id/comments
Body: { "body": "Retornei o contato", "author": "operador1", "internal": true }
→ 201 TicketComment
```
`internal: true` = comentário interno (não exibir ao cliente). `400` sem body.

### Remover (soft delete)
```
DELETE /tickets/:id  → 200 { "deleted": true, "id" }
```
Marca `deleted_at`; some das listagens e do board (não apaga do banco).

## Anexos (object storage)

Os arquivos vão para um bucket S3-compatível; o backend guarda só os metadados
e gera **URLs temporárias assinadas** para download (o front não passa o arquivo
pelo servidor no download). `storageKey` nunca é exposto.

```ts
type TicketAttachment = {
  id: string;
  ticketId: string;
  filename: string;
  mimeType: string | null;
  size: number | null;
  uploadedBy: string | null;
  createdAt: string;
};
```

### Anexar arquivo (multipart)
```
POST /tickets/:id/attachments      (multipart/form-data)
  file: <binário>        // obrigatório, campo "file"
  uploadedBy: "operador1" // opcional
→ 201 TicketAttachment
```
`400` sem arquivo · `413` acima do limite (`TICKET_MAX_UPLOAD_MB`, padrão 25 MB)
· `503` storage não configurado no servidor.

### Listar anexos
```
GET /tickets/:id/attachments  → 200 { items: TicketAttachment[] }
```
(Também vêm no detalhe do chamado, em `attachments[]`.)

### Baixar (URL temporária assinada)
```
GET /tickets/:id/attachments/:attId/url
→ 200 { "url": "https://…", "expiresIn": 300, "filename": "print.png" }
```
O front usa essa `url` direto (expira em `S3_URL_TTL_SEC`, padrão 300s).

### Remover anexo
```
DELETE /tickets/:id/attachments/:attId  → 200 { "deleted": true, "id" }
```
Remove do bucket **e** do banco.

## Sugestão de telas (front)
1. **Board kanban** (`GET /tickets/board`): 5 colunas, cards com `#number`,
   assunto, prioridade (cor), responsável, tempo. Drag & drop → `PATCH` com
   `status` (e `position`).
2. **Novo chamado** (form): `POST /tickets` — assunto, descrição, prioridade,
   categoria, dados do solicitante (nome/e-mail/telefone) e, se aplicável,
   `cpf`/`codcliente` (pode vir do fluxo de busca de cliente do painel).
3. **Detalhe** (`GET /tickets/:id`): dados + thread de comentários; adicionar
   andamento (`POST .../comments`), com toggle "interno".
4. **Lista/busca** (`GET /tickets`): filtros por status/prioridade/responsável/
   CPF e busca textual.

## Config de deploy
- **Migrations novas** (`tickets`, `ticket_comments`, `ticket_attachments`):
  `npm run migrate` + `npx prisma generate` + restart.
- **`SUPPORT_NOTIFY_EMAIL`** (opcional): destino da notificação de novo chamado.
  Sem ela, usa `caiomdavidinha@gmail.com`.
- **Object storage (anexos)** — env S3-compatível (funciona com AWS S3, DO
  Spaces, Cloudflare R2, Backblaze B2, MinIO):
  - `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (obrigatórios p/ anexos)
  - `S3_REGION` (padrão `us-east-1`)
  - `S3_ENDPOINT` (para provedores não-AWS, ex. `https://<region>.digitaloceanspaces.com`)
  - `S3_FORCE_PATH_STYLE=true` (MinIO e alguns provedores)
  - `S3_URL_TTL_SEC` (validade da URL de download, padrão 300)
  - `TICKET_MAX_UPLOAD_MB` (limite por arquivo, padrão 25)
  - Sem essas envs, os chamados funcionam normalmente; só o upload de anexo
    responde `503`.
