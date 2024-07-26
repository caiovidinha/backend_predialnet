const app = require('./app')
const dotenv = require('dotenv').config()
const http = require('http')
const https = require('https')

const runServer = (port,server) => {
    server.listen(port, () => console.log(`Servidor rodando na porta ${port}`))
}

const regularServer=http.createServer(app)
if(process.env.NODE_ENV === 'production') {
    // TODO: CONF SSL
    // TODO: RODAR NA PORTA 80 E 443
}else{
    const serverPort = process.env.PORT ? parseInt(process.env.PORT) : 9000
    runServer(serverPort, regularServer)
}
