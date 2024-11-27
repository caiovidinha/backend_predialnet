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

/**
 * Controlador para obter a 2ª via da fatura.
 * @param {Object} req - Objeto de requisição do Express.
 * @param {Object} res - Objeto de resposta do Express.
 */
const getSecondCopyLinkController = async (req, res) => {
    const { id, boleta } = req.params; // Recebe o ID da rota
    try {
        const result = await getSecondCopyLink(id, boleta);
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

/**
 * Controlador para obter a fatura atual.
 * @param {Object} req - Objeto de requisição do Express.
 * @param {Object} res - Objeto de resposta do Express.
 */
const setFaturaDigitalController = async (req, res) => {
    const { id } = req.params; // Recebe o ID da rota
    const data = req.body; 
    try {
        const result = await setFaturaDigital(id, data);
        return res.status(200).json(result);
    } catch (error) {
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
            return res.status(400).json({ error: "codcliente e prazo são obrigatórios." });
        }
        const result = await cadastrarLibtemp(codcliente, prazo);
        return res.status(result.status).json(result);
    } catch (error) {
        // Dependendo do erro, você pode ajustar o status code
        // Exemplo: se o status da resposta for 403, retorne 403, caso contrário 500
        if (error.message.includes('não elegível')) {
            return res.status(403).json({ error: error.message });
        }
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
            return res.status(400).json({ error: "codcliente é obrigatório." });
        }
        const result = await consultarLibtempPorCliente(codcliente);
        return res.status(result.status).json(result);
    } catch (error) {
        // Dependendo do erro, você pode ajustar o status code
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
            return res.status(400).json({ error: "ID da liberação temporária é obrigatório." });
        }
        const result = await deletarLibtemp(id);
        return res.status(result.status).json(result);
    } catch (error) {
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
