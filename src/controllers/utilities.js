// controllers/utilities.js

const logger = require("../utils/logger");
const { manageShowAd } = require("../models/utilities");
const {
  updateSerAdicionalModel,
  updateControleParentalModel,
  getUserByIDModel,
} = require("../models/utilities");

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
  const cpf = params.cpf;

  if (!cpf) {
    logger.warn("CPF não fornecido em toggleShowAd");
    return res.status(400).json({ error: "CPF não fornecido." });
  }

  try {
    logger.info("Iniciando toggleShowAd", { cpf });
    const result = await manageShowAd(cpf);
    logger.info("toggleShowAd executado com sucesso", { cpf, result });

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
      logger.warn("Parâmetros inválidos em updateSerAdicionalController", {
        body: req.body,
      });
      return res.status(400).json({ error: "Parâmetros inválidos" });
    }

    logger.info("Iniciando updateSerAdicionalController", {
      id,
      requerido,
      serPonto,
    });

    // Chamar a função do modelo
    const response = await updateSerAdicionalModel(id, { requerido, serPonto });

    logger.info("updateSerAdicionalController executado com sucesso", {
      id,
      response,
    });

    res
      .status(200)
      .json({ message: "ser_adicional atualizado com sucesso", data: response });
  } catch (error) {
    logger.error("Erro em updateSerAdicionalController", { error: error.message });
    res.status(500).json({ error: "Erro ao atualizar ser_adicional" });
  }
};

const updateControleParentalController = async (req, res) => {
  try {
    const { id, controle_parental } = req.body;

    logger.info("Iniciando updateControleParentalController", {
      id,
      controle_parental,
    });

    // Chamar a função do modelo
    const response = await updateControleParentalModel(id, {
      controle_parental,
    });

    logger.info("updateControleParentalController executado com sucesso", {
      id,
      response,
    });

    res.status(200).json({
      message: "Controle Parental atualizado com sucesso",
      data: response,
    });
  } catch (error) {
    logger.error("Erro em updateControleParentalController", {
      error: error.message,
    });
    res.status(500).json({ error: "Erro ao atualizar Controle Parental" });
  }
};

const getUserByID = async (req, res) => {
  try {
    const { id } = req.params;

    logger.info("Iniciando getUserByID", { id });

    // Chamar a função do modelo
    const response = await getUserByIDModel(id);

    logger.info("getUserByID executado com sucesso", { id, response });

    res.status(200).json({ data: response });
  } catch (error) {
    logger.error("Erro em getUserByID", { error: error.message });
    res.status(500).json({ error: "Erro ao pegar usuário" });
  }
};

module.exports = {
  toggleShowAd,
  updateSerAdicionalController,
  updateControleParentalController,
  getUserByID,
};
