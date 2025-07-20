// controllers/utilities.js

const logger = require("../utils/logger");
const { manageShowAd } = require("../models/utilities");
const { updateSerAdicionalModel, updateControleParentalModel, getUserByIDModel, getClientStatusModel } = require("../models/utilities");

/**
 * Controlador para gerenciar a exibição de anúncios (show_ad).
 *
 * Recebe o CPF como parâmetro de busca e executa a lógica definida em manageShowAd.
 *
 * @param {Object} req - Objeto de requisição do Express.
 * @param {Object} res - Objeto de resposta do Express.
 */
const toggleShowAd = async (req, res) => {
    const params = req.params; // Assumindo que o CPF é enviado como query parameter
    const cpf = params.cpf

    if (!cpf) {
        logger.warn("CPF não fornecido em toggleShowAd");
        return res.status(400).json({ error: "CPF não fornecido." });
    }

    try {
        const result = await manageShowAd(cpf);
        
        logger.info("toggleShowAd executado com sucesso", { cpf, show: result.show });
        return res.status(200).json({ show: result.show });
    } catch (error) {
        logger.error("Erro em toggleShowAd", { cpf, error: error.message });
        return res.status(500).json({ error: error.message });
    }
};

const updateSerAdicionalController = async (req, res) => {
    try {
        const { id, requerido, serPonto } = req.body;
    
        if (!id || requerido === undefined || !serPonto) {
            logger.warn("Parâmetros inválidos em updateSerAdicionalController", { body: req.body });
            return res.status(400).json({ error: 'Parâmetros inválidos' });
        }
    
        // Chamar a função do modelo
        const response = await updateSerAdicionalModel(id, { requerido, serPonto });
    
        logger.info("ser_adicional atualizado com sucesso", { id, requerido, serPonto });
        res.status(200).json({ message: 'ser_adicional atualizado com sucesso', data: response });
    } catch (error) {
        logger.error("Erro no controlador updateSerAdicional", { error: error.message });
        res.status(500).json({ error: 'Erro ao atualizar ser_adicional' });
    }
};

const updateControleParentalController = async (req, res) => {
    try {
        const { id, controle_parental } = req.body;
    
        // Chamar a função do modelo
        const response = await updateControleParentalModel(id, { controle_parental });
    
        logger.info("Controle Parental atualizado com sucesso", { id, controle_parental });
        res.status(200).json({ message: 'Controle Parental atualizado com sucesso', data: response });
    } catch (error) {
        logger.error("Erro no controlador updateControleParental", { error: error.message });
        res.status(500).json({ error: 'Erro ao atualizar Controle Parental' });
    }
};

const getUserByID = async (req, res) => {
    try {
        const { id } = req.params;
    
        // Chamar a função do modelo
        const response = await getUserByIDModel(id);
    
        logger.info("getUserByID executado com sucesso", { id });
        res.status(200).json({ data: response });
    } catch (error) {
        logger.error("Erro ao pegar usuário", { error: error.message });
        res.status(500).json({ error: 'Erro ao pegar usuário' });
    }
};

const getClientStatusController = async (req, res) => {
    const { codcliente } = req.params;

    if (!codcliente) {
        logger.warn("codcliente não fornecido em getClientStatus");
        return res.status(400).json({ error: "codcliente não fornecido." });
    }

    try {
        const status = await getClientStatusModel(codcliente);
        logger.info("Status geral do cliente consultado com sucesso", { codcliente });
        return res.status(200).json(status);
    } catch (error) {
        logger.error("Erro ao consultar status geral do cliente", {
            codcliente,
            error: error.message
        });
        return res.status(500).json({ error: "Erro ao consultar status do cliente." });
    }
};


module.exports = {
    toggleShowAd,
    updateSerAdicionalController,
    updateControleParentalController,
    getUserByID,
    getClientStatusController 
};
