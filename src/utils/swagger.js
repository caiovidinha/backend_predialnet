const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Predialnet - API de Notificações Push",
      version: "1.0.0",
      description: "Documentação completa da API Predialnet",
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: [
    "./src/routes/*.js",      // ✅ rotas, como loginRouter.js, pushRouter.js, etc
    "./src/controllers/*.js", // ✅ se quiser documentar os controllers diretamente
  ],
};

const specs = swaggerJsdoc(options);

module.exports = {
  swaggerUi,
  specs,
};
