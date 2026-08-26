const { client } = require('../../prisma/client');
const logger = require('../../utils/logger');

// Log de auditoria (seção 9): quem criou, editou, publicou e excluiu o quê.
// Nunca derruba a operação principal — falha aqui vira warning.
const registrar = async ({ usuario, acao, entidade, entidadeId, detalhes, ip }) => {
  try {
    return await client.blogAuditoria.create({
      data: {
        usuarioId: usuario?.id ?? null,
        usuarioNome: usuario?.nome ?? usuario?.email ?? null,
        acao,
        entidade,
        entidadeId: entidadeId != null ? String(entidadeId) : null,
        detalhes: detalhes ? JSON.stringify(detalhes) : null,
        ip: ip ?? null,
      },
    });
  } catch (err) {
    logger.warn('blog: falha ao gravar auditoria', { acao, entidade, error: err.message });
    return null;
  }
};

const listar = async ({ pagina = 1, porPagina = 50, entidade, entidadeId } = {}) => {
  const where = {
    ...(entidade ? { entidade } : {}),
    ...(entidadeId ? { entidadeId: String(entidadeId) } : {}),
  };
  const [items, total] = await Promise.all([
    client.blogAuditoria.findMany({
      where,
      orderBy: { criado_em: 'desc' },
      skip: (pagina - 1) * porPagina,
      take: porPagina,
    }),
    client.blogAuditoria.count({ where }),
  ]);
  return { items, total };
};

module.exports = { registrar, listar };
