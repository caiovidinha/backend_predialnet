const axios = require('axios')
const https = require('https')
const dotenv = require('dotenv').config()
const { getToken } = require('./consultaModel')
const instance = axios.create({
    httpsAgent: new https.Agent({
        rejectUnauthorized: false
    })
})
require('dotenv').config()

const getCredentials = async (login) => {
    const url = `${process.env.URL}/api/cliente/show/${login}`
    const JWT = await getToken()
    const response = await instance.get(url, {
        headers: {
            'Authorization' : `Bearer ${JWT}`
        }
    })
    return response.data
}

module.exports = {
    getCredentials
}
