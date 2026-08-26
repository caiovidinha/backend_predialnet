// Formato de erro único do blog (seção 7 da spec):
//   { erro, mensagem, campos? }
// O `campos` só aparece em 422, mapeando campo → motivo.

class BlogError extends Error {
  constructor(status, erro, mensagem, extra = {}) {
    super(mensagem);
    this.name = 'BlogError';
    this.status = status;
    this.erro = erro;
    this.mensagem = mensagem;
    this.campos = extra.campos;
    this.retryAfter = extra.retryAfter;
  }

  toBody() {
    const body = { erro: this.erro, mensagem: this.mensagem };
    if (this.campos) body.campos = this.campos;
    return body;
  }
}

const requisicaoInvalida = (mensagem = 'Requisição malformada.') =>
  new BlogError(400, 'requisicao_invalida', mensagem);

const naoAutenticado = (mensagem = 'Autenticação necessária.') =>
  new BlogError(401, 'nao_autenticado', mensagem);

const semPermissao = (mensagem = 'Você não tem permissão para esta ação.') =>
  new BlogError(403, 'sem_permissao', mensagem);

const naoEncontrado = (mensagem = 'Recurso não encontrado.') =>
  new BlogError(404, 'nao_encontrado', mensagem);

const conflito = (mensagem = 'Conflito com um registro existente.') =>
  new BlogError(409, 'conflito', mensagem);

const validacao = (campos, mensagem = 'Alguns campos precisam de atenção.') =>
  new BlogError(422, 'validacao', mensagem, { campos });

const muitasRequisicoes = (retryAfter, mensagem = 'Muitas requisições. Tente novamente em instantes.') =>
  new BlogError(429, 'muitas_requisicoes', mensagem, { retryAfter });

module.exports = {
  BlogError,
  requisicaoInvalida,
  naoAutenticado,
  semPermissao,
  naoEncontrado,
  conflito,
  validacao,
  muitasRequisicoes,
};
