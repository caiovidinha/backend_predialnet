    const axios = require('axios')
    const https = require('https')
    const agent = new https.Agent({
        rejectUnauthorized: false
    })
    require('dotenv').config()

    const getToken = async () => {
    const url = `${process.env.URL}/api/`
    const b64credentials = btoa(`${process.env.CLIENT_ID}:${process.env.CLIENT_SECRET}`)
    const response = await axios.get(url, {
        httpsAgent: agent,
        headers: {
            'Authorization' : `Basic ${b64credentials}`
        }
    })
    return response.data
    }

    const existeEnd = (lista,cep,num) => {
        for(let i = 0;i<lista.length;i++){
            let checkCEP = lista[i].cep.toString().replace('-','')
            if(cep == checkCEP && num == lista[i].numero) {
                return 'true'
            }
        }
        return 'false'
    }

    const getClientes = async () => {
    const url = `${process.env.URL}/api/cliente/listagem`
    const JWT = await getToken()
    const response = await axios.get(url, {
        httpsAgent: agent,
        headers: {
            'Authorization' : `Bearer ${JWT}`
        }
    })
    return response.data.clientes
    }

    module.exports = {
    getToken,
    getClientes,
    existeEnd
    }