const { client } = require('../prisma/client');
const logger = require('../utils/logger');

const VALID_TARGETING_TYPES = ['GLOBAL', 'CLIENTE', 'CIDADE', 'BAIRRO', 'RUA', 'CEP', 'CEP_NUMERO'];
// Resolution priority: more specific wins over more generic
const PRIORITY_ORDER = ['CLIENTE', 'CEP_NUMERO', 'CEP', 'RUA', 'BAIRRO', 'CIDADE', 'GLOBAL'];

const createMessage = async ({ title, msg_cliente, timeout_sec = 10, targets = [] }) => {
    return client.appMessage.create({
        data: {
            title,
            msg_cliente,
            timeout_sec,
            targets: {
                create: targets.map(t => ({
                    targeting_type: t.targeting_type,
                    targeting_value: t.targeting_type === 'GLOBAL' ? '*' : (t.targeting_value ?? '*'),
                })),
            },
        },
        include: { targets: true },
    });
};

const listMessages = async ({ page = 1, limit = 20, includeInactive = false } = {}) => {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);

    const where = {
        deleted_at: null,
        ...(includeInactive ? {} : { active: true }),
    };

    const [items, total] = await Promise.all([
        client.appMessage.findMany({
            where,
            include: { targets: true },
            orderBy: { created_at: 'desc' },
            skip: (safePage - 1) * safeLimit,
            take: safeLimit,
        }),
        client.appMessage.count({ where }),
    ]);

    return { items, total, page: safePage, limit: safeLimit };
};

const getMessageById = async (id) => {
    return client.appMessage.findFirst({
        where: { id, deleted_at: null },
        include: { targets: true },
    });
};

const updateMessage = async (id, { title, msg_cliente, timeout_sec, active }) => {
    const data = {};
    if (title !== undefined) data.title = title;
    if (msg_cliente !== undefined) data.msg_cliente = msg_cliente;
    if (timeout_sec !== undefined) data.timeout_sec = timeout_sec;
    if (active !== undefined) data.active = active;

    return client.appMessage.update({
        where: { id },
        data,
        include: { targets: true },
    });
};

const softDeleteMessage = async (id) => {
    return client.appMessage.update({
        where: { id },
        data: { deleted_at: new Date(), active: false },
    });
};

const addTarget = async (messageId, { targeting_type, targeting_value = '*' }) => {
    return client.appMessageTarget.create({
        data: {
            messageId,
            targeting_type,
            targeting_value: targeting_type === 'GLOBAL' ? '*' : targeting_value,
        },
    });
};

const removeTarget = async (targetId) => {
    return client.appMessageTarget.delete({ where: { id: targetId } });
};

/**
 * Finds the highest-priority active message for a given client.
 * Priority order: CLIENTE > CEP > BAIRRO > GLOBAL
 * Returns the message in msg_monitoramento format, or null if none found.
 */
const findMessageForClient = async ({ cpf }) => {
    try {
        // All targets now store CPF as targeting_value (resolved at creation time).
        // GLOBAL targets use targeting_type = 'GLOBAL' with value '*'.
        const message = await client.appMessage.findFirst({
            where: {
                active: true,
                deleted_at: null,
                targets: {
                    some: {
                        OR: [
                            { targeting_value: String(cpf) },
                            { targeting_type: 'GLOBAL' },
                        ],
                    },
                },
            },
            orderBy: { created_at: 'desc' },
        });

        if (!message) return null;

        return {
            id: message.id,
            msg_cliente: message.msg_cliente,
            timeout_sec: message.timeout_sec,
        };
    } catch (error) {
        // Fail silently so the calling endpoint still returns client data
        logger.error('Erro em findMessageForClient', {
            cpf,
            error: error.message,
            code: error.code,
            meta: error.meta,
            stack: error.stack,
        });
        return null;
    }
};

module.exports = {
    VALID_TARGETING_TYPES,
    createMessage,
    listMessages,
    getMessageById,
    updateMessage,
    softDeleteMessage,
    addTarget,
    removeTarget,
    findMessageForClient,
};
