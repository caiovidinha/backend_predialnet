const fs = require("fs");
const https = require("https");
const http = require("http");
const path = require("path");
const app = require("./app"); // Sua instância do Express

// Carregue os arquivos do certificado da Let's Encrypt
// const sslOptions = {
//   key: fs.readFileSync(path.join("/etc", "letsencrypt", "live", "appgw.predialnet.com.br", "privkey.pem")),
//   cert: fs.readFileSync(path.join("/etc", "letsencrypt", "live", "appgw.predialnet.com.br", "cert.pem")),
//   ca: fs.readFileSync(path.join("/etc", "letsencrypt", "live", "appgw.predialnet.com.br", "chain.pem")),
// };

// Servidor HTTPS na porta 443
const httpsServer = http.createServer(app);
httpsServer.listen(3001, () => {
  console.log("Servidor de testes rodando na porta 3001");
});
