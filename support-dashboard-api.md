# Dashboard de Suporte — Contrato da API (para o front)

Backend de um **painel de suporte** para o operador atender clientes: consultar
se é cliente, ver conta do app, dados cadastrais, status de conexão, faturas,
liberação temporária e executar ações (redefinir senha, criar conta do app).

- **Base URL:** `NEXT_PUBLIC_API_URL` → produção `https://appgw.predialnet.com.br`
- **Prefixo:** todas as rotas abaixo começam com `/support`.
- **Stack sugerida no front:** Next.js (App Router, TypeScript), mesma identidade
  visual do painel atual (vermelho Predialnet `#B4121A` / branco).

## Autenticação

Todas as rotas exigem o header do operador:

```
x-access-token: <ADMIN_BYPASS_TOKEN>
```

Sem token válido → `401`; token não-admin → `403`. Use o mesmo mecanismo de
login do painel atual (Alertas/Push).

> ⚠️ **Observação de infra:** enquanto `ENABLE_JWT` não estiver `'true'` em
> produção, o gate de admin é permissivo (libera sem exigir o token). O painel
> funciona de qualquer forma, mas o backend deve ligar isso para proteger de
> fato. Não é bloqueante para o front.

## Terminologia de identificador

- **`credential`** — aceita **CPF** (11 dígitos) **ou** `codcliente`. Usado nas
  consultas via base da Predialnet (UAIPI).
- **`cpf`** — CPF do cliente (chave da conta do app na base local).
- **`codcliente`** — código do contrato na Predialnet. **Faturas, status e
  libtemp são por contrato** — um CPF pode ter vários `codcliente`. Liste os
  contratos em `GET /support/clients/:credential/contracts`, o operador
  seleciona um, e aí você consulta `status`/`invoices`/`libtemp` por contrato.

---

## Consultas (GET)

### 1. Visão agregada — carga inicial do dashboard
```
GET /support/clients/:credential/overview
```
Resiliente: cada parte falha isoladamente (campo vem `null`), sem derrubar o resto.
```json
{
  "credential": "12345678901",
  "isClient": { "isClient": true, "cpf": "12345678901", "nome": "Fulano", "email": "f@x.com", "contratos": 2 },
  "appAccount": { "exists": true, "cpf": "12345678901", "userId": "uuid", "email": "f@x.com", "mustChangePassword": false },
  "account": { "cliente": { /* objeto completo da UAIPI: contratos, endereço, serpontos, plano... */ } }
}
```
Para os contratos/codcliente, prefira o endpoint `contracts` abaixo (mais limpo).
O `codcliente` é o `cliente.id` da UAIPI.

### 2. É cliente Predialnet?
```
GET /support/clients/:credential/is-client
```
```json
{ "isClient": true, "cpf": "12345678901", "nome": "Fulano", "email": "f@x.com", "contratos": 2 }
```
Se não for cliente: `{ "isClient": false }`.

### 3. Conta do app (base local)
```
GET /support/clients/:cpf/app-account
```
```json
{ "exists": true, "cpf": "12345678901", "userId": "uuid", "email": "f@x.com", "mustChangePassword": false }
```
Não existe: `{ "exists": false, "cpf": "12345678901" }`. CPF inválido → `400`.

### 3a. Excluir a conta do app do cliente
```
DELETE /support/clients/:cpf/app-account
```
Apaga **apenas o acesso ao aplicativo** (usuário local + tokens, push tokens e
notificações). **Não** afeta o cadastro do cliente na Predialnet (UAIPI) — o
cliente continua existindo, só perde a conta do app. Operação atômica.
```json
{ "deleted": true, "cpf": "12345678901", "userId": "uuid" }
```
- `400` — CPF inválido.
- `404` — conta do app não encontrada para esse CPF.

> 💡 Ação destrutiva — peça confirmação no front antes de chamar. Depois de
> excluir, o cliente pode criar a conta de novo pelo fluxo normal do app (ou via
> "Criar conta do app", passo 13).

### 3c. Consultar / alterar o e-mail cadastrado (conta do app)
```
GET  /support/clients/:cpf/email
PUT  /support/clients/:cpf/email     Body: { "email": "novo@dominio.com" }
```
```json
// GET / PUT (200)
{ "cpf": "12345678901", "email": "cliente@dominio.com", "censoredEmail": "c***e@d***o.com" }
// PUT também retorna: { "message": "E-mail atualizado com sucesso.", ... }
```
- O **PUT atualiza o e-mail em TODOS os lugares**: no cadastro da Predialnet
  (UAIPI, em todos os contratos do CPF via `set-email`) **e** na conta do app,
  além de semear no map censurado. Assim o e-mail não diverge (o reset de senha
  depende disso).
- `400` e-mail/CPF inválido · `404` conta do app não encontrada · `502` falha ao
  atualizar na base da Predialnet (nesse caso **nada é alterado** — pode repetir).

> **Suporte = override direto** (sem confirmação). Para o **próprio usuário**
> (app), a troca é **confirmada por código** (ver abaixo). Em ambos, o e-mail é
> sincronizado com o cadastro da Predialnet.

#### Troca pelo próprio usuário (app) — confirmada por código
Identidade pelo `x-access-token` do usuário (sem passar CPF). Dois passos:

1. **Solicitar** — envia um código de 6 dígitos para o **novo** e-mail:
   ```
   POST /account/email/change-request     Body: { "email": "novo@dominio.com" }
   → 200 { "message": "...", "email": "n***o@d***o.com" }   // nada é alterado ainda
   ```
   `400` e-mail inválido/igual ao atual · `401` não autenticado · `502` falha no envio.
2. **Confirmar** — aplica a troca com o código recebido:
   ```
   POST /account/email/change-confirm     Body: { "code": "482913" }
   → 200 { "message": "E-mail atualizado com sucesso.", "cpf", "email", "censoredEmail" }
   ```
   `403` código inválido/expirado · `404` nenhuma troca pendente · `502` falha ao
   atualizar na Predialnet (a pendência é mantida — pode confirmar de novo).

A confirmação atualiza o e-mail **na Predialnet (UAIPI, todos os contratos) e na
conta do app**, mantendo tudo alinhado.

O código expira em **15 min**; uma pendência por usuário (novo pedido substitui o
anterior). A confirmação semeia o novo e-mail no map censurado antes de aplicar.
Consulta continua em `GET /account/email`.

### 3d. Notificações (push) recebidas pelo cliente
```
GET /support/clients/:cpf/notifications
```
Lista as notificações que o cliente recebeu no app, com data e status de leitura.
```json
{
  "cpf": "12345678901",
  "total": 12,
  "unread": 3,
  "notifications": [
    {
      "id": "uuid",
      "title": "Fatura disponível",
      "body": "Sua fatura de julho já está disponível.",
      "data": { "screen": "faturas" },
      "read": false,
      "readAt": null,
      "receivedAt": "2026-07-01T12:00:00.000Z",
      "sentAt": "2026-07-01T11:59:30.000Z"
    }
  ]
}
```
Mais recentes primeiro. `receivedAt` = quando chegou pro cliente; `sentAt` =
quando a notificação foi criada; `read`/`readAt` = status de leitura.
`404` se não houver conta do app.

### 3b. Contratos (números de cliente) de um CPF
```
GET /support/clients/:credential/contracts
```
Lista os contratos do CPF para o operador **selecionar um** e então consultar
`status`, `invoices` e `libtemp` daquele `codcliente` (= `cliente.id` na UAIPI).
```json
{
  "isClient": true,
  "cpf": "02227913738",
  "nome": "Fulano de Souza",
  "total": 1,
  "contratos": [
    {
      "codcliente": "157175",
      "inscricao": "02227913738",
      "nome": "Fulano de Souza",
      "email": "fulano@x.com",
      "situacao": "Ativo",
      "permiteLiberacao": false,
      "endereco": {
        "logradouro": "Ator Paulo Gustavo", "numero": "264", "complemento": "207",
        "bairro": "Icaraí", "cidade": "Niterói", "uf": "RJ", "cep": "24230063"
      },
      "planos": [
        { "serponto_id": 239328, "status": "Conectado", "plano": "Oferta Predial 800", "velocidade": "800 Mb" }
      ],
      "cliente": { /* objeto cru completo do contrato (UAIPI) */ }
    }
  ]
}
```
Se não for cliente: `{ "isClient": false, "contratos": [] }`.

Use `contratos[].codcliente` (é o `cliente.id`) para chamar `status`, `invoices`
e `libtemp`. O `planos[]` já traz status de conexão e plano por serponto — bom
para o seletor de contrato.

### 4. Dados cadastrais completos (UAIPI)
```
GET /support/clients/:credential/account
```
Retorna o objeto do cliente (contratos, endereço, `serpontos`, plano, e
`msg_monitoramento` quando houver). `404` se não encontrado.

### 5. Status de conexão + pagamento + liberação
```
GET /support/clients/:codcliente/status
```
```json
{
  "service_status": [
    { "id_ponto": 239328, "status_conexao": "Conectado", "velocidade": "800 Mb" }
  ],
  "payment_status": { "status": "em aberto", "valor": "124.90", "vencimento": "25/06/2026" },
  "libtemp_status": false
}
```

### 6. Faturas
```
GET /support/clients/:codcliente/invoices
```
```json
{
  "history": [ /* últimas 6 faturas de internet (mais recentes primeiro) */ ],
  "current": { "status": "em aberto", "valor": "99.90", "vencimento": "2026-07-10", "boleta": "123", "link": "https://..." },
  "pastStatus": { "open": 1, "overdue": 0 }
}
```
`status` da fatura atual pode ser `"paga" | "em aberto" | "atrasada"`.

Cada fatura em `history` traz os campos reais da UAIPI: `boleta`, `tipo`
(`"internet"`), `valor` (string, ex. `"124.90"`), `dta_vencimento`,
`dta_venc_original`, `dta_pagamento` (null se em aberto), `cancelada` (bool),
`pix` (copia-e-cola), `link` (PDF do boleto), `processado`, `nf_id`, `svanf_id`.
Não há `data_emissao`.

### 7. Fatura atual + outras pendentes
```
GET /support/clients/:codcliente/invoices/current
```
```json
{ "faturaAtual": { /* fatura */ }, "outrasPendentes": [ /* faturas */ ] }
```

### 8. Liberação temporária (consulta)
```
GET /support/clients/:codcliente/libtemp
```
Retorna a situação da liberação temporária do contrato. **`404` = cliente sem
liberação ativa** (trate como estado normal, não como erro). Note também
`permiteLiberacao` (do `contracts`): se `false`, o cliente não pode receber
liberação temporária.

---

## Ações (POST/DELETE)

### 9. Redefinir senha (gera link)
```
POST /support/clients/:cpf/password-reset
Body (opcional): { "sendEmail": false }
```
- `sendEmail: false` (padrão) → retorna o link para o operador repassar:
  ```json
  { "message": "Link de redefinição gerado com sucesso!", "url": "https://www.predialnet.com.br/redefinir-senha?token=...&email=..." }
  ```
- `sendEmail: true` → envia o e-mail de redefinição ao cliente.
- `409` — e-mail do app diverge do cadastro da Predialnet:
  ```json
  { "error": "E-mail do app diverge do cadastro da Predialnet.", "availableEmails": ["f***o@x.com"] }
  ```
  (Nesse caso, use o fluxo de e-mails censurados abaixo para corrigir.)
- `403` — usuário do app não existe (cliente ainda não criou conta).

### 10. Criar liberação temporária
```
POST /support/clients/:codcliente/libtemp
Body: { "prazo": 2 }   // prazo em dias
```
`201` com o resultado. `400` se faltar `prazo`.

### 11. Remover liberação temporária
```
DELETE /support/libtemp/:id
```

### 12. E-mails disponíveis para criar conta do app
```
GET /support/clients/:credential/available-emails
```
```json
{ "emails": ["f***o@x.com", "c***l@y.com"], "inscricao": "12345678901" }
```
`404` se não for cliente ou se a conta do app já existe.

### 13. Criar conta do app (envia senha por e-mail)
```
POST /support/clients/create-account
Body: { "cpf": "12345678901", "email": "f***o@x.com" }   // email = um dos censurados do passo 12
```
`201` `{ "message": "Senha enviada com sucesso" }`.

---

## Tratamento de erros

- Erros retornam `{ "error": "mensagem" }` com o status apropriado
  (`400/403/404/409/500`).
- As mensagens vêm dos serviços internos / da UAIPI e são exibíveis ao operador.

## Sugestão de telas (front)

1. **Busca** por CPF ou codcliente → chama `overview`.
2. **Cabeçalho do cliente**: nome, CPF, é-cliente (badge), conta do app
   (existe? precisa trocar senha?), e-mail.
3. **Seletor de contrato** (quando houver vários `codcliente`) → alimenta as
   abas de Status, Faturas e Libtemp.
4. **Aba Status**: cards de conexão por serponto + situação de pagamento + libtemp.
5. **Aba Faturas**: tabela do `history` (vencimento, valor, status, link 2ª via,
   pix), destaque da `current`, contadores `pastStatus`.
6. **Ações**: botão "Redefinir senha" (link/e-mail), "Criar liberação temporária"
   (input de prazo), "Criar conta do app" (fluxo de e-mails censurados).
7. Estados de loading/erro/vazio por seção (o `overview` já é parcial-tolerante).

> Existe também o dashboard de **testes de velocidade** por CPF
> (`/speedtest/clients/:cpf/summary`, `/speedtest/results?cpf=...`) — pode entrar
> como mais uma aba do mesmo painel de suporte.
