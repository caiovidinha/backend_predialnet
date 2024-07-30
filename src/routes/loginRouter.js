const express = require('express')
const cors = require('cors')
const constrollerLogin = require('../controllers/auth')
const constrollerInfo = require('../controllers/userInfo')
const { validateJWT } = require('../models/auth')
const loginRouter = express.Router()



loginRouter.get('/ping', cors(), constrollerLogin.getOk)

// C
loginRouter.post('/newUser', constrollerLogin.newUser)

// R
loginRouter.post('/login', constrollerLogin.login)

loginRouter.get('/users/:type/:id', validateJWT ,constrollerInfo.getInfo)

// router.get('/users', (req, res))

// U

// D

module.exports = loginRouter