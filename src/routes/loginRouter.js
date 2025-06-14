const express = require("express");
const cors = require("cors");
const constrollerAuth = require("../controllers/auth");
const constrollerInfo = require("../controllers/userInfo");
const controllerRefreshToken = require("../controllers/refreshToken");
// const { validateJWT } = require("../models/auth");
const loginRouter = express.Router();

loginRouter.get("/ping", cors(), constrollerAuth.getOk);

// C
loginRouter.post("/newUser", constrollerAuth.newUser);
loginRouter.post("/createUser", constrollerAuth.createUser);
loginRouter.post("/update-email", constrollerAuth.updateEmail);

// R
loginRouter.post("/login", constrollerAuth.login);

loginRouter.post("/refresh-token", controllerRefreshToken.renewToken);

loginRouter.post("/forgot-password", constrollerAuth.forgotPassword);

loginRouter.post("/reset-password", constrollerAuth.resetPassword);

loginRouter.post('/emails', constrollerAuth.handleEmail)


// U

// D

module.exports = loginRouter;
