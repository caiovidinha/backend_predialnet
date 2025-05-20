const fs = require("fs");
const https = require("https");
const http = require("http");
const path = require("path");
const app = require("./app"); // Sua instância do Express


// const sslOptions = {
//   key: fs.readFileSync(path.join("/etc", "letsencrypt", "live", "appgw.predialnet.com.br", "privkey.pem")),
//   cert: fs.readFileSync(path.join("/etc", "letsencrypt", "live", "appgw.predialnet.com.br", "cert.pem")),
//   ca: fs.readFileSync(path.join("/etc", "letsencrypt", "live", "appgw.predialnet.com.br", "chain.pem")),
// };


// const httpsServer = https.createServer(sslOptions, app);
// httpsServer.listen(443, () => {
//   console.log("Servidor HTTPS rodando na porta 443");
// });

// Servidor HTTP
const httpsServer = http.createServer(app);
httpsServer.listen(5000, () => {
  console.log("Servidor HTTPS rodando na porta 5000");
});
