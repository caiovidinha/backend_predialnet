const logger = require('../utils/logger');
const {
    VALID_TARGETING_TYPES,
    createMessage,
    listMessages,
    getMessageById,
    updateMessage,
    softDeleteMessage,
    addTarget,
    removeTarget,
} = require('../models/messages');
const { getClientsByAddressModel, getAllUserCpfsModel } = require('../models/utilities');

const createMessageController = async (req, res) => {
    const { title, msg_cliente, timeout_sec, targets } = req.body;

    if (!title || !msg_cliente) {
        return res.status(400).json({ error: 'Os campos title e msg_cliente são obrigatórios.' });
    }

    if (targets !== undefined) {
        if (!Array.isArray(targets)) {
            return res.status(400).json({ error: 'targets deve ser um array.' });
        }
        for (const t of targets) {
            if (!t.targeting_type || !VALID_TARGETING_TYPES.includes(t.targeting_type)) {
                return res.status(400).json({
                    error: `targeting_type inválido. Valores aceitos: ${VALID_TARGETING_TYPES.join(', ')}.`,
                });
            }
            if (t.targeting_type !== 'GLOBAL' && !t.targeting_value) {
                return res.status(400).json({
                    error: `targeting_value é obrigatório para o tipo ${t.targeting_type}.`,
                });
            }
        }
    }

    try {
        const message = await createMessage({ title, msg_cliente, timeout_sec, targets });
        logger.info('Mensagem de aviso criada', { id: message.id, title });
        return res.status(201).json(message);
    } catch (error) {
        logger.error('Erro ao criar mensagem', { error: error.message });
        return res.status(500).json({ error: 'Erro ao criar mensagem.' });
    }
};

const listMessagesController = async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit) || 20), 100);
    const includeInactive = req.query.includeInactive === 'true';

    try {
        const result = await listMessages({ page, limit, includeInactive });
        return res.status(200).json(result);
    } catch (error) {
        logger.error('Erro ao listar mensagens', { error: error.message });
        return res.status(500).json({ error: 'Erro ao listar mensagens.' });
    }
};

const getMessageController = async (req, res) => {
    const { id } = req.params;

    try {
        const message = await getMessageById(id);
        if (!message) return res.status(404).json({ error: 'Mensagem não encontrada.' });
        return res.status(200).json(message);
    } catch (error) {
        logger.error('Erro ao buscar mensagem', { id, error: error.message });
        return res.status(500).json({ error: 'Erro ao buscar mensagem.' });
    }
};

const updateMessageController = async (req, res) => {
    const { id } = req.params;
    const { title, msg_cliente, timeout_sec, active } = req.body;

    try {
        const existing = await getMessageById(id);
        if (!existing) return res.status(404).json({ error: 'Mensagem não encontrada.' });

        const updated = await updateMessage(id, { title, msg_cliente, timeout_sec, active });
        logger.info('Mensagem atualizada', { id });
        return res.status(200).json(updated);
    } catch (error) {
        logger.error('Erro ao atualizar mensagem', { id, error: error.message });
        return res.status(500).json({ error: 'Erro ao atualizar mensagem.' });
    }
};

const deleteMessageController = async (req, res) => {
    const { id } = req.params;

    try {
        const existing = await getMessageById(id);
        if (!existing) return res.status(404).json({ error: 'Mensagem não encontrada.' });

        await softDeleteMessage(id);
        logger.info('Mensagem removida (soft delete)', { id });
        return res.status(200).json({ message: 'Mensagem removida com sucesso.' });
    } catch (error) {
        logger.error('Erro ao remover mensagem', { id, error: error.message });
        return res.status(500).json({ error: 'Erro ao remover mensagem.' });
    }
};

const addTargetController = async (req, res) => {
    const { id } = req.params;
    const { targeting_type, targeting_value } = req.body;

    if (!targeting_type || !VALID_TARGETING_TYPES.includes(targeting_type)) {
        return res.status(400).json({
            error: `targeting_type inválido. Valores aceitos: ${VALID_TARGETING_TYPES.join(', ')}.`,
        });
    }
    if (targeting_type !== 'GLOBAL' && !targeting_value) {
        return res.status(400).json({
            error: 'targeting_value é obrigatório para tipos não-GLOBAL.',
        });
    }

    try {
        const existing = await getMessageById(id);
        if (!existing) return res.status(404).json({ error: 'Mensagem não encontrada.' });

        const target = await addTarget(id, { targeting_type, targeting_value: targeting_value ?? '*' });
        logger.info('Target adicionado à mensagem', { messageId: id, targeting_type, targeting_value });
        return res.status(201).json(target);
    } catch (error) {
        logger.error('Erro ao adicionar target', { id, error: error.message });
        return res.status(500).json({ error: 'Erro ao adicionar target.' });
    }
};

const removeTargetController = async (req, res) => {
    const { targetId } = req.params;

    try {
        await removeTarget(targetId);
        logger.info('Target removido', { targetId });
        return res.status(200).json({ message: 'Target removido com sucesso.' });
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Target não encontrado.' });
        }
        logger.error('Erro ao remover target', { targetId, error: error.message });
        return res.status(500).json({ error: 'Erro ao remover target.' });
    }
};

const VALID_FILTER_TYPES = ['GERAL', 'CPF', 'CIDADE', 'BAIRRO', 'RUA', 'CEP', 'CEP_NUMERO'];

/**
 * Assigns a message to clients based on a filter type.
 *
 * filter_type options:
 *   GERAL      — all users in the app (queries local users table)
 *   CPF        — direct list of CPFs (body: cpfs[])
 *   CIDADE     — all clients in a city (body: cidade)
 *   BAIRRO     — all clients in a neighborhood (body: bairro)
 *   RUA        — all clients on a street identified by CEP (body: cep)
 *   CEP        — all clients with a given postal code (body: cep)
 *   CEP_NUMERO — all clients at a specific address (body: cep + numero)
 */
const assignByAddressController = async (req, res) => {
    const { id } = req.params;
    const { filter_type, cpfs, cidade, bairro, cep, numero } = req.body;

    if (!filter_type || !VALID_FILTER_TYPES.includes(filter_type)) {
        return res.status(400).json({
            error: `filter_type inválido. Valores aceitos: ${VALID_FILTER_TYPES.join(', ')}.`,
        });
    }

    // Per-type validation
    if (filter_type === 'CPF' && (!Array.isArray(cpfs) || cpfs.length === 0))
        return res.status(400).json({ error: 'cpfs deve ser um array não-vazio para filter_type CPF.' });
    if (filter_type === 'CIDADE' && !cidade)
        return res.status(400).json({ error: 'cidade é obrigatório para filter_type CIDADE.' });
    if (filter_type === 'BAIRRO' && !bairro)
        return res.status(400).json({ error: 'bairro é obrigatório para filter_type BAIRRO.' });
    if ((filter_type === 'CEP' || filter_type === 'RUA') && !cep)
        return res.status(400).json({ error: 'cep é obrigatório para filter_type CEP/RUA.' });
    if (filter_type === 'CEP_NUMERO' && (!cep || !numero))
        return res.status(400).json({ error: 'cep e numero são obrigatórios para filter_type CEP_NUMERO.' });

    try {
        const existing = await getMessageById(id);
        if (!existing) return res.status(404).json({ error: 'Mensagem não encontrada.' });

        let targetCpfs;

        if (filter_type === 'GERAL') {
            targetCpfs = await getAllUserCpfsModel();
        } else if (filter_type === 'CPF') {
            targetCpfs = cpfs.map(String);
        } else {
            const params = {};
            if (filter_type === 'CIDADE') params.cidade = cidade;
            else if (filter_type === 'BAIRRO') params.bairro = bairro;
            else if (filter_type === 'CEP' || filter_type === 'RUA') params.cep = cep;
            else if (filter_type === 'CEP_NUMERO') { params.cep = cep; params.numero = numero; }

            targetCpfs = await getClientsByAddressModel(params);
        }

        if (targetCpfs.length === 0) {
            return res.status(200).json({ assigned: 0, message: 'Nenhum cliente encontrado para o filtro informado.' });
        }

        const results = await Promise.allSettled(
            targetCpfs.map(cpf => addTarget(id, { targeting_type: 'CLIENTE', targeting_value: String(cpf) }))
        );

        const assigned = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        logger.info('Mensagem atribuída', { messageId: id, filter_type, assigned, failed });
        return res.status(200).json({ assigned, failed });
    } catch (error) {
        logger.error('Erro em assignByAddressController', { id, filter_type, error: error.message });
        return res.status(500).json({ error: 'Erro ao atribuir mensagem.' });
    }
};

module.exports = {
    createMessageController,
    listMessagesController,
    getMessageController,
    updateMessageController,
    deleteMessageController,
    addTargetController,
    removeTargetController,
    assignByAddressController,
};
