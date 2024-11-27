const { validateJWT } = require("../models/auth");
const utilitiesController = require("../controllers/utilities")
const express = require("express");

const utilitiesRouter = express.Router();

utilitiesRouter.get("/toggle-ad/:cpf", utilitiesController.toggleShowAd);
utilitiesRouter.get("/cliente/:id", utilitiesController.getUserByID);
utilitiesRouter.post("/seradicional", utilitiesController.updateSerAdicionalController);
utilitiesRouter.post("/controle-parental", utilitiesController.updateControleParentalController);

module.exports = utilitiesRouter;