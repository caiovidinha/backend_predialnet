// controllers/showAdController.js

const { manageShowAd } = require("../models/utilities");
const { updateSerAdicionalModel,updateControleParentalModel, getUserByIDModel } = require("../models/utilities");

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

const updateSerAdicionalController = async (req, res) => {
    try {
      const { id, requerido, serPonto } = req.body;
  
      if (!id || requerido === undefined || !serPonto) {
        return res.status(400).json({ error: 'Parâmetros inválidos' });
      }
  
      // Chamar a função do modelo
      const response = await updateSerAdicionalModel(id, { requerido, serPonto });
  
      res.status(200).json({ message: 'ser_adicional atualizado com sucesso', data: response });
    } catch (error) {
      console.error('Erro no controlador updateSerAdicional:', error.message);
      res.status(500).json({ error: 'Erro ao atualizar ser_adicional' });
    }
  };

  const updateControleParentalController = async (req, res) => {
    try {
      const { id, controle_parental } = req.body;
  
      // Chamar a função do modelo
      const response = await updateControleParentalModel(id, { controle_parental });
  
      res.status(200).json({ message: 'Controle Parental atualizado com sucesso', data: response });
    } catch (error) {
      console.error('Erro no controlador updateControleParental:', error.message);
      res.status(500).json({ error: 'Erro ao atualizar Controle Parental' });
    }
  };

  
  const getUserByID = async (req, res) => {
    try {
      const { id } = req.params;

  
      // Chamar a função do modelo
      const response = await getUserByIDModel(id);
  
      res.status(200).json({ data: response });
    } catch (error) {
      console.error('Erro ao pegar usuário', error.message);
      res.status(500).json({ error: 'Erro ao pegar usuário' });
    }
  };


module.exports = {
    toggleShowAd,
    updateSerAdicionalController,
    updateControleParentalController,
    getUserByID
};
