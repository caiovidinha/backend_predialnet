const newsletterRepo = require('../../infrastructure/repositories/blogNewsletterRepository');
const { validacao } = require('../../domain/blog/errors');

// Cadastro da barra lateral do blog — endpoint público chamado direto do
// navegador do visitante. O rate limit fica no router (seção 3 da spec).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const MAX_EMAIL = 191;

// Devolve { status, body } porque o contrato usa 201 para novo e 409 para
// repetido — e nos dois casos o corpo traz ok: true, para o formulário do site
// tratar os dois como sucesso.
const inscrever = async ({ email, origem = 'blog' }) => {
  const normalizado = String(email ?? '').trim().toLowerCase();

  if (!normalizado) throw validacao({ email: 'Obrigatório.' });
  if (normalizado.length > MAX_EMAIL) throw validacao({ email: 'E-mail longo demais.' });
  if (!EMAIL_RE.test(normalizado)) throw validacao({ email: 'E-mail inválido.' });

  const existente = await newsletterRepo.buscarPorEmail(normalizado);

  if (existente) {
    // Quem tinha cancelado e voltou é reativado, mas continua sendo "já inscrito".
    if (!existente.ativo) await newsletterRepo.reativar(existente.id, origem);
    return { status: 409, body: { ok: true, mensagem: 'Este e-mail já está inscrito.' } };
  }

  await newsletterRepo.inscrever({ email: normalizado, origem: String(origem ?? 'blog').slice(0, 60) });
  return { status: 201, body: { ok: true, mensagem: 'Inscrição confirmada.' } };
};

const listar = ({ pagina, porPagina }) => newsletterRepo.listar({ pagina, porPagina });

module.exports = { inscrever, listar };
