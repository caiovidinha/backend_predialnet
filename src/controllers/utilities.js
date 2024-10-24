// controllers/showAdController.js

const { manageShowAd } = require("../models/utilities");

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
        return res.status(400).json({ error: "CPF não fornecido." });
    }

    try {
        const result = await manageShowAd(cpf);
        
        return res.status(200).json({ show: result.show });
    } catch (error) {
        
        return res.status(500).json({ error: error.message });
    }
};

module.exports = {
    toggleShowAd,
};
