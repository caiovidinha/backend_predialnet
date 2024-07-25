const express = require('express')
const cors = require('cors')
const controllerConsulta = require('./controllers/consultaController')
const constrollerLogin = require('./controllers/loginController')

const router = express.Router()
router.get('/ping', cors(), controllerConsulta.getOk)
router.get('/consulta/:cep/:num', cors(), controllerConsulta.getAll)
router.get('/login/:login/:cpf', cors(), constrollerLogin.getAll)

module.exports = router