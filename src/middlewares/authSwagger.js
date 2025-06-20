// src/middlewares/authSwagger.js
require("dotenv").config();

const SWAGGER_TOKEN = process.env.SWAGGER_TOKEN || "supersecreto";

const swaggerAuthMiddleware = (req, res, next) => {
  const token =
    req.headers.authorization?.replace("Bearer ", "").trim() ||
    req.query.token;

  if (!token || token !== SWAGGER_TOKEN) {
    res.set("WWW-Authenticate", 'Bearer realm="Swagger"');
    return res.status(401).send("Unauthorized Swagger access");
  }

  next();
};

module.exports = swaggerAuthMiddleware;
