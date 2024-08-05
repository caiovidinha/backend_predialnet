const express = require('express')
const testController = require('../controllers/test')

const testRouter = express.Router()



testRouter.get('/loading/:time', testController.loading)


module.exports = testRouter