const express = require('express')
const cors = require('cors')
const requestIntercepter = require('./utils/requestIntercepter')
const loginRouter = require('./routes/loginRouter')
const app = express()
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.all('*', requestIntercepter)
app.use('/',loginRouter)

module.exports = app;