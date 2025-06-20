// controllers/fatura.js

const {
    getSecondCopyLink,
    getLastSixInvoices,
    getPixFromLastOpenInternetInvoice,
    checkCurrentInvoiceStatus,
    getCurrentInvoice,
    cadastrarLibtemp,
    consultarLibtempPorCliente,
    deletarLibtemp,
    setFaturaDigital
} = require("../models/fatura");

const logger = require("../utils/logger"); // ✅ logger adicionado

/**
 * Controlador para obter a 2ª via da fatura.
 * @param {Object} req - Objeto de requisição do Express.
 * @param {Object} res - Objeto de resposta do Express.
 */
const getSecondCopyLinkController = async (req, res) => {
    const { id, boleta } = req.params; // Recebe o ID da rota
    try {
        logger.info("Solicitando 2ª via da fatura", { id, boleta });
        const result = await getSecondCopyLink(id, boleta);
        return res.status(200).json(result);
    } catch (error) {
        logger.error("Erro ao obter 2ª via da fatura", { error: error.message });
        return res.status(500).json({ error: error.message });
    }
};

/**
 * Controlador para obter o histórico das últimas 6 faturas.
 * @param {Object} req - Objeto de requisição do Express.
 * @param {Object} res - Objeto de resposta do Express.
 */
const getLastSixInvoicesController = async (req, res) => {
    const { id } = req.params; // Recebe o ID da rota
    try {
        logger.info("Buscando últimas 6 faturas", { id });
        const result = await getLastSixInvoices(id);
        return res.status(200).json(result);
    } catch (error) {
        logger.error("Erro ao obter histórico de faturas", { error: error.message });
        return res.status(500).json({ error: error.message });
    }
};

/**
 * Controlador para obter o PIX da última fatura em aberto do tipo "internet".
 * @param {Object} req - Objeto de requisição do Express.
 * @param {Object} res - Objeto de resposta do Express.
 */
const getPixFromLastOpenInternetInvoiceController = async (req, res) => {
    const { id } = req.params; // Recebe o ID da rota
    try {
        logger.info("Buscando PIX da última fatura em aberto", { id });
        const result = await getPixFromLastOpenInternetInvoice(id);
        return res.status(200).json(result);
    } catch (error) {
        logger.error("Erro ao obter PIX da fatura", { error: error.message });
        return res.status(500).json({ error: error.message });
    }
};

/**
 * Controlador para verificar o status da fatura atual.
 * @param {Object} req - Objeto de requisição do Express.
 * @param {Object} res - Objeto de resposta do Express.
 */
const checkCurrentInvoiceStatusController = async (req, res) => {
    const { id } = req.params; // Recebe o ID da rota
    try {
        logger.info("Verificando status da fatura atual", { id });
        const result = await checkCurrentInvoiceStatus(id);
        return res.status(200).json(result);
    } catch (error) {
        logger.error("Erro ao verificar status da fatura", { error: error.message });
        return res.status(500).json({ error: error.message });
    }
};

/**
 * Controlador para obter a fatura atual.
 * @param {Object} req - Objeto de requisição do Express.
 * @param {Object} res - Objeto de resposta do Express.
 */
const getCurrentInvoiceController = async (req, res) => {
    const { id } = req.params; // Recebe o ID da rota
    try {
        logger.info("Buscando fatura atual", { id });
        const result = await getCurrentInvoice(id);
        return res.status(200).json(result);
    } catch (error) {
        logger.error("Erro ao buscar fatura atual", { error: error.message });
        return res.status(500).json({ error: error.message });
    }
};

/**
 * Controlador para obter a fatura atual.
 * @param {Object} req - Objeto de requisição do Express.
 * @param {Object} res - Objeto de resposta do Express.
 */
const setFaturaDigitalController = async (req, res) => {
    const { id } = req.params; // Recebe o ID da rota
    const data = req.body; 
    try {
        logger.info("Atualizando fatura digital", { id, data });
        const result = await setFaturaDigital(id, data);
        return res.status(200).json(result);
    } catch (error) {
        logger.error("Erro ao atualizar fatura digital", { error: error.message });
        return res.status(500).json({ error: error.message });
    }
};

/**
 * Controlador para cadastrar uma liberação temporária.
 * @param {Object} req - Objeto de requisição do Express.
 * @param {Object} res - Objeto de resposta do Express.
 */
const cadastrarLibtempController = async (req, res) => {
    const { codcliente, prazo } = req.body;
    try {
        if (!codcliente || !prazo) {
            logger.warn("Campos obrigatórios ausentes para liberação temporária", { codcliente, prazo });
            return res.status(400).json({ error: "codcliente e prazo são obrigatórios." });
        }
        logger.info("Cadastrando liberação temporária", { codcliente, prazo });
        const result = await cadastrarLibtemp(codcliente, prazo);
        return res.status(result.status).json(result);
    } catch (error) {
        if (error.message.includes('não elegível')) {
            logger.warn("Cliente não elegível para liberação temporária", { error: error.message });
            return res.status(403).json({ error: error.message });
        }
        logger.error("Erro ao cadastrar liberação temporária", { error: error.message });
        return res.status(500).json({ error: error.message });
    }
};

/**
 * Controlador para consultar uma liberação temporária por codcliente.
 * @param {Object} req - Objeto de requisição do Express.
 * @param {Object} res - Objeto de resposta do Express.
 */
const consultarLibtempPorClienteController = async (req, res) => {
    const { codcliente } = req.params;
    try {
        if (!codcliente) {
            logger.warn("Codcliente não informado na consulta de liberação temporária");
            return res.status(400).json({ error: "codcliente é obrigatório." });
        }
        logger.info("Consultando liberação temporária por cliente", { codcliente });
        const result = await consultarLibtempPorCliente(codcliente);
        return res.status(result.status).json(result);
    } catch (error) {
        logger.error("Erro ao consultar liberação temporária", { error: error.message });
        return res.status(500).json({ error: error.message });
    }
};

/**
 * Controlador para deletar uma liberação temporária por ID.
 * @param {Object} req - Objeto de requisição do Express.
 * @param {Object} res - Objeto de resposta do Express.
 */
const deletarLibtempController = async (req, res) => {
    const { id } = req.params;
    try {
        if (!id) {
            logger.warn("ID não informado na deleção da liberação temporária");
            return res.status(400).json({ error: "ID da liberação temporária é obrigatório." });
        }
        logger.info("Deletando liberação temporária", { id });
        const result = await deletarLibtemp(id);
        return res.status(result.status).json(result);
    } catch (error) {
        logger.error("Erro ao deletar liberação temporária", { error: error.message });
        return res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getSecondCopyLinkController,
    getLastSixInvoicesController,
    getPixFromLastOpenInternetInvoiceController,
    checkCurrentInvoiceStatusController,
    getCurrentInvoiceController,
    cadastrarLibtempController,
    consultarLibtempPorClienteController,
    deletarLibtempController,
    setFaturaDigitalController
};
