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
            if(user) return {
                status: 'É cliente (CN)',
                cpf: user.cpf,
                numeroCliente: user.cNumber
            }
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
    if(user) return {
        status: 'É cliente (CPF)',
        cpf: user.cpf,
        numeroCliente: user.cNumber
    }
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
            if(user) return {error:`(CN) Usuário já possui conta.`}
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
    if(user) return {error:`(CPF) Usuário já possui conta.`}
    return 'Criar senha'
}

const generatePassword = () => {
        const lowerChars = 'abcdefghijklmnopqrstuvwxyz'
        const upperChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
        const numbers = '0123456789'
        const specialChars = '!@#$%^&*()-_=+[]{}|;:,.<>?'
    
        function getRandomChar(charSet) {
            return charSet[Math.floor(Math.random() * charSet.length)]
        }
    
        const length = Math.floor(Math.random() * 3) + 12 // Random length between 12 and 14
        let password = ''
    
        // Ensure at least one of each required character type
        password += getRandomChar(lowerChars)
        password += getRandomChar(upperChars)
        password += getRandomChar(numbers)
        password += getRandomChar(specialChars)
    
        // Limit to 3 special characters
        let specialCharCount = 1
    
        // Fill the rest of the password length with random characters from all sets
        const allChars = lowerChars + upperChars + numbers + specialChars
        while (password.length < length) {
            let char = getRandomChar(allChars)
            if (specialChars.includes(char)) {
                if (specialCharCount < 3) {
                    password += char
                    specialCharCount++
                }
            } else {
                password += char
            }
        }
    
        // Shuffle the password to ensure randomness
        password = password.split('').sort(() => 0.5 - Math.random()).join('')
    
        return password
}

const passwordExistsInDatabase = (password) => {
    // Esta função deve verificar se a senha já existe no banco de dados
    return false
}


module.exports = {
    checkUser,
    checkUserApp,
    generatePassword,
    passwordExistsInDatabase
}
