const { validateJWT } = require("../models/auth");
const utilitiesController = require("../controllers/utilities")
const express = require("express");

const utilitiesRouter = express.Router();

utilitiesRouter.get("/toggle-ad/:cpf", utilitiesController.toggleShowAd);

module.exports = utilitiesRouter;