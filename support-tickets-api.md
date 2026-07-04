# Chamados de Suporte (Kanban) — API

Instruções para o front do painel de suporte consumir a API de **chamados**
(board kanban), com abertura, comentários e anexos.

- **Base URL:** `https://appgw.predialnet.com.br` (via `NEXT_PUBLIC_API_URL`)
- **Prefixo:** `/tickets`
- **Autenticação:** todas as rotas exigem o header `x-access-token` com o token
  de operador do painel (o mesmo usado nas outras telas). `401` sem token,
  `403` sem permissão.
- **Erros:** sempre no formato `{ "error": "mensagem" }` com o status HTTP
  apropriado (mensagem exibível ao operador).

## Colunas (status) e prioridades
- **status** (colunas do kanban): `ABERTO` · `EM_ANDAMENTO` · `AGUARDANDO` ·
  `RESOLVIDO` · `FECHADO`
- **priority:** `BAIXA` · `MEDIA` · `ALTA` · `URGENTE`

## Modelos
```ts
type Ticket = {
  id: string;
  number: number;               // nº sequencial do chamado (#1, #2, …)
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: string | null;
  position: number;             // ordem dentro da coluna (kanban)
  requesterName: string | null; // operador que abriu o chamado
  cpf: string | null;           // cliente relacionado (dados vêm da API via CPF)
  codcliente: string | null;    // contrato (opcional)
  assignee: string | null;      // responsável
  closedAt: string | null;      // preenchido ao entrar em RESOLVIDO/FECHADO
  createdAt: string;
  updatedAt: string;
  comments?: TicketComment[];        // só no detalhe
  attachments?: TicketAttachment[];  // só no detalhe
};

type TicketComment = {
  id: string;
  author: string | null;
  body: string;
  internal: boolean;  // comentário interno (não mostrar ao cliente)
  createdAt: string;
};

type TicketAttachment = {
  id: string;
  ticketId: string;
  filename: string;
  mimeType: string | null;
  size: number | null;   // bytes
  uploadedBy: string | null;
  createdAt: string;
};
```

## Endpoints

### Abrir chamado
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
Do cliente basta o `cpf` (e opcionalmente `codcliente`) — o resto dos dados o
painel busca nos endpoints de suporte (`/support/clients/:credential/overview`,
`.../contracts`). A abertura dispara uma **notificação por e-mail** ao suporte.
`400` se faltar `subject`/`description`.

### Board kanban
```
GET /tickets/board
→ 200 { "columns": [ { "status": "ABERTO", "tickets": Ticket[] }, … ], "total": N }
```
Retorna **todas as 5 colunas** (mesmo vazias), cada uma com seus chamados
ordenados por `position` e depois `createdAt`. Ideal pra renderizar o board.

### Listar (filtros + paginação)
```
GET /tickets?status=&priority=&assignee=&cpf=&q=&page=1&limit=20
→ 200 { items: Ticket[], total, page, limit }
```
`q` busca em assunto, descrição, nome de quem abriu e CPF. `limit` máx. 100.

### Detalhe (com comentários e anexos)
```
GET /tickets/:id  → 200 Ticket (com comments[] e attachments[])  ·  404 se não achar
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
`internal: true` = comentário interno (não exibir ao cliente). `400` sem `body`.

### Remover chamado
```
DELETE /tickets/:id  → 200 { "deleted": true, "id" }
```
Some das listagens e do board.

## Anexos

Os arquivos são enviados via multipart e o download é feito por uma **URL
temporária** que a API devolve (o arquivo não passa pelo painel no download).

### Anexar arquivo
```
POST /tickets/:id/attachments      (multipart/form-data)
  file: <binário>          // obrigatório, campo "file"
  uploadedBy: "operador1"  // opcional
→ 201 TicketAttachment
```
`400` sem arquivo · `413` acima do limite (**25 MB** por arquivo).

### Listar anexos
```
GET /tickets/:id/attachments  → 200 { items: TicketAttachment[] }
```
(Também vêm no detalhe do chamado, em `attachments[]`.)

### Baixar (URL temporária)
```
GET /tickets/:id/attachments/:attId/url
→ 200 { "url": "https://…", "expiresIn": 300, "filename": "print.png" }
```
Use a `url` diretamente. Ela **expira em ~5 min** — gere na hora do clique, não
guarde. `404` se o anexo não existir.

### Remover anexo
```
DELETE /tickets/:id/attachments/:attId  → 200 { "deleted": true, "id" }
```

### Exemplo (upload e download)
```js
// Upload — campo "file"
const fd = new FormData();
fd.append('file', file);            // File do input
fd.append('uploadedBy', operador);  // opcional
await fetch(`${API}/tickets/${id}/attachments`, {
  method: 'POST',
  headers: { 'x-access-token': token }, // NÃO setar Content-Type: o browser cuida do boundary
  body: fd,
});

// Download — pega a URL temporária e abre/baixa
const { url } = await fetch(
  `${API}/tickets/${id}/attachments/${attId}/url`,
  { headers: { 'x-access-token': token } },
).then(r => r.json());
window.open(url); // ou <a href={url} download>
```

## Sugestão de telas
1. **Board kanban** (`GET /tickets/board`): 5 colunas, cards com `#number`,
   assunto, prioridade (cor), responsável e tempo. Drag & drop → `PATCH` com
   `status` (e `position`).
2. **Novo chamado** (form): `POST /tickets` — assunto, descrição, prioridade,
   categoria, quem abriu (`requesterName`) e, se aplicável, `cpf`/`codcliente`
   (pode vir do fluxo de busca de cliente do painel). Suporta anexos.
3. **Detalhe** (`GET /tickets/:id`): dados do chamado, thread de comentários
   (com toggle "interno") e anexos (upload/baixar/remover).
4. **Lista/busca** (`GET /tickets`): filtros por status/prioridade/responsável/
   CPF e busca textual.
