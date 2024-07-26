const axios = require('axios')
const https = require('https')
const dotenv = require('dotenv').config()
const instance = axios.create({
    httpsAgent: new https.Agent({
        rejectUnauthorized: false
    })
})

const standardUser = [{
    cpf: '19242536741',
    cNumber: '123456'
},{    
    cpf: '19242536742',
    cNumber: '012345'
}]

const standardUserApp = [{
    cpf: '19242536742',
    cNumber: '012345',
    password: '101299@Cc'
}]

require('dotenv').config()


const checkUser = async(userCredential) => {
    let user
    if(userCredential.length < 11) {
        for(let i=0;i<standardUser.length;i++){
            if(userCredential==standardUser[i].cNumber) {
                
                user = {
                    cpf: standardUser[i].cpf,
                    cNumber: standardUser[i].cNumber
                }
            }
        }
            if(user) return `Usuário encontrado (CN) - CPF: ${user.cpf} | Número do Cliente: ${user.cNumber}`
            return {error: 'Número do cliente não existe'}
        }
    
    
        for(let i=0;i<standardUser.length;i++){
            if(userCredential==standardUser[i].cpf) {
                
                user = {
                    cpf: standardUser[i].cpf,
                    cNumber: standardUser[i].cNumber
                }
            }
        }
    if(user) return `Usuário encontrado (CN) - CPF: ${user.cpf} | Número do Cliente: ${user.cNumber}`
    return {error: 'CPF Não existe'}
}


const checkUserApp = async(userCredential)=>{
    let user
    //lidando com cNumber
    if(userCredential.length < 11) {
        for(let i=0;i<standardUserApp.length;i++){
            if(userCredential==standardUserApp[i].cNumber) {
                
                user = {
                    cpf: standardUserApp[i].cpf,
                    cNumber: standardUserApp[i].cNumber,
                    password: standardUserApp[i].password
                }
            }
        }
            if(user) return {error:`(CN) Usuário já possui conta. Senha:${user.password}`}
            return 'Criar senha'
        }

        //lidando com cpf
        for(let i=0;i<standardUserApp.length;i++){
            if(userCredential==standardUserApp[i].cpf) {
                
                user = {
                    cpf: standardUserApp[i].cpf,
                    cNumber: standardUserApp[i].cNumber,
                    password: standardUserApp[i].password
                }
            }
        }
    if(user) return {error:`(CPF) Usuário já possui conta. Senha:${user.password}`}
    return 'Criar senha'
}

module.exports = {
    checkUser,
    checkUserApp
}
