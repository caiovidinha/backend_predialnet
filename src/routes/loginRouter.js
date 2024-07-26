const express = require('express')
const cors = require('cors')
const constrollerLogin = require('../controllers/auth')
const loginRouter = express.Router()



loginRouter.get('/ping', cors(), constrollerLogin.getOk)

// C
loginRouter.post('/newUser', constrollerLogin.newUser)

// R

// router.get('/users', (req, res))

// U

// D

module.exports = loginRouter