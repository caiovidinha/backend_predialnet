const express = require('express');
const { criarRateLimit } = require('../middlewares/rateLimit');
const { validateJWT, requireAdmin } = require('../middlewares/auth');
const {
  registrarEvento, listarCadastro, criarCadastro, atualizarCadastro,
} = require('../controllers/parceriaController');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Parcerias
 *   description: Funil das parcerias no Assine Já (?parceria=<slug>)
 */

// Uma visita completa gera uns 6 eventos; 120 em 5 minutos por IP cobre
// várias pessoas atrás do mesmo NAT (escritório do parceiro) e ainda segura um
// robô enchendo a tabela.
const limite = criarRateLimit({ janelaMs: 5 * 60 * 1000, maximo: 120 });

// sendBeacon chega como text/plain; o JSON global só lê application/json.
const corpoTexto = express.text({ type: 'text/plain', limit: '4kb' });

/**
 * @swagger
 * /parcerias/eventos:
 *   post:
 *     summary: Registra um evento do funil de uma parceria (público)
 *     tags: [Parcerias]
 *     security: []
 *     description: >
 *       Chamado pelo navegador no Assine Já via navigator.sendBeacon
 *       (text/plain com JSON) ou fetch (application/json). Não aceita dado
 *       pessoal. Limite de 120 eventos a cada 5 minutos por IP.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [parceria, evento, sessao]
 *             properties:
 *               parceria: { type: string, example: "clube-xyz", description: "Normalizado para slug (a-z, 0-9, - e _), até 40 caracteres" }
 *               evento: { type: string, enum: [acesso, consulta, dados, envio, whatsapp] }
 *               detalhe: { type: string, description: "consulta → com_planos | plano_indisponivel | so_regiao | sem_cobertura | a_confirmar; envio → registrado | chat | falhou; whatsapp → botao | modal" }
 *               sessao: { type: string, example: "2f1c9a4e-0b7d-4a51-9a63-1c2b3d4e5f60", description: "Id aleatório por aba" }
 *               plano: { type: string, example: "black800" }
 *               origem: { type: string, description: "document.referrer; só origem + caminho são guardados" }
 *     responses:
 *       204: { description: Registrado }
 *       400: { description: Evento inválido }
 *       429: { description: Limite de requisições }
 */
router.post('/eventos', limite, corpoTexto, registrarEvento);

// ── Cadastro de influencers (operador) ───────────────────────
// Mesma proteção do /stats: só o dashboard, com o ADMIN_BYPASS_TOKEN.
const operador = [validateJWT, requireAdmin];

/**
 * @swagger
 * /parcerias:
 *   get:
 *     summary: Lista os influencers/parceiros cadastrados (operador)
 *     tags: [Parcerias]
 *     responses:
 *       200: { description: "[{ id, slug, nome, instagram, contato, observacao, ativo, createdAt, updatedAt }]" }
 *   post:
 *     summary: Cadastra um influencer/parceiro e define o slug do link (operador)
 *     tags: [Parcerias]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nome]
 *             properties:
 *               nome: { type: string, example: "Fulana Silva" }
 *               slug: { type: string, example: "fulana", description: "Opcional; sem ele, nasce do nome. Não muda depois." }
 *               instagram: { type: string, example: "@fulana" }
 *               contato: { type: string }
 *               observacao: { type: string }
 *     responses:
 *       201: { description: Criado }
 *       400: { description: Dados inválidos }
 *       409: { description: Slug já existe }
 */
router.get('/', operador, listarCadastro);
router.post('/', operador, criarCadastro);

/**
 * @swagger
 * /parcerias/{id}:
 *   patch:
 *     summary: Edita nome, Instagram, contato, observação ou ativa/desativa (operador)
 *     tags: [Parcerias]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Atualizado }
 *       400: { description: Dados inválidos (inclusive tentar mudar o slug) }
 *       404: { description: Não encontrado }
 */
router.patch('/:id', operador, atualizarCadastro);

// O limitador entrega o erro por next(err) (formato do blog); aqui só importa
// o status — o beacon nem lê a resposta.
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  if (err.retryAfter) res.setHeader('Retry-After', String(err.retryAfter));
  return res.status(status).json({ error: err.mensagem || err.message || 'Erro.' });
});

module.exports = router;
