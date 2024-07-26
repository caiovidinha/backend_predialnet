const axios = require('axios')
const https = require('https')
const dotenv = require('dotenv').config()
const instance = axios.create({
    httpsAgent: new https.Agent({
        rejectUnauthorized: false
    })
})

const standardUser = {
    cpf: '19242536741',
    cNumber: '123456'
}

require('dotenv').config()


const checkUser = async(userCredential) => {

    if(userCredential.length < 11) {

        if(userCredential==standardUser.cNumber) {

            return `Usuário encontrado (CN) - CPF: ${standardUser.cpf} | Número do Cliente: ${standardUser.cNumber}`
            
        }
        return {error: 'Número do cliente não existe'}
    }
    
    if(userCredential==standardUser.cpf){
  
        return `Usuário encontrado (CPF) - CPF: ${standardUser.cpf} | Número do Cliente: ${standardUser.cNumber}`
    }

    return {error: 'CPF Não existe'}
}

module.exports = {
    checkUser
}
