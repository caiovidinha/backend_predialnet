// controllers/fatura.js

const {
    getSecondCopyLink,
    getLastSixInvoices,
    getPixFromLastOpenInternetInvoice,
    checkCurrentInvoiceStatus,
    getCurrentInvoice
} = require("../models/fatura");

/**
 * Controlador para obter a 2ª via da fatura.
 * @param {Object} req - Objeto de requisição do Express.
 * @param {Object} res - Objeto de resposta do Express.
 */
const getSecondCopyLinkController = async (req, res) => {
    const { id } = req.params; // Recebe o ID da rota
    try {
        const result = await getSecondCopyLink(id);
        return res.status(200).json(result);
    } catch (error) {
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
        const result = await getLastSixInvoices(id);
        return res.status(200).json(result);
    } catch (error) {
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
        const result = await getPixFromLastOpenInternetInvoice(id);
        return res.status(200).json(result);
    } catch (error) {
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
        const result = await checkCurrentInvoiceStatus(id);
        return res.status(200).json(result);
    } catch (error) {
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
        const result = await getCurrentInvoice(id);
        return res.status(200).json(result);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getSecondCopyLinkController,
    getLastSixInvoicesController,
    getPixFromLastOpenInternetInvoiceController,
    checkCurrentInvoiceStatusController,
    getCurrentInvoiceController
};
