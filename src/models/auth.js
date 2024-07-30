const axios = require('axios')
const https = require('https')
const dotenv = require('dotenv').config()
const jwt = require('jsonwebtoken')
const instance = axios.create({
    httpsAgent: new https.Agent({
        rejectUnauthorized: false
    })
})

const SECRET = 'predialnet'

const standardUser = [{
    cpf: '19242536741',
    cNumber: '123456',
    email: 'caiomdavidinha@gmail.com'
},{    
    cpf: '19242536742',
    cNumber: '012345',
    email: 'caiovidinha@gmail.com'
}]

const standardUserApp = [
    {
        cpf: '19242536742',
        cNumber: '012345',
        password: '!xNQ5oFkRa>>nc'
    },
    {
        cpf: '85937201459',
        cNumber: '678901',
        password: 'Pa$$w0rd1!'
    },
    {
        cpf: '47382910568',
        cNumber: '234567',
        password: 'S3cureP@ss'
    },
    {
        cpf: '09128374655',
        cNumber: '890123',
        password: 'MyP@ssw0rd!'
    }
]

require('dotenv').config()

const validatePassword = (credentials)=> {
    const { credential, password } = credentials;
    for (let user of standardUserApp) {
        if (user.cpf == credential && user.password == password || user.cNumber == credential && user.password == password) {
            return true;
        }
    }
    return false;
} 
const createToken = ()=> {
    return jwt.sign({userId: 1}, process.env.ACCESS_TOKEN_SECRET, {expiresIn: 300})

} 

const validateJWT = (req, res, next) => {
    const token = req.headers['x-access-token']
    
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if(err) return res.status(401).end()

        req.userId = decoded.userId
        next()
    })
}


const checkUser = async(userCredential) => {
    let user
    if(userCredential.length < 11) {
        for(let i=0;i<standardUser.length;i++){
            if(userCredential==standardUser[i].cNumber) {
                
                user = {
                    cpf: standardUser[i].cpf,
                    cNumber: standardUser[i].cNumber,
                    email: standardUser[i].email,
                }
            }
        }
            if(user) return {
                status: 'É cliente (CN)',
                cpf: user.cpf,
                numeroCliente: user.cNumber,
                email: user.email
            }
            return {error: 'Número do cliente não existe'}
        }
    
    
        for(let i=0;i<standardUser.length;i++){
            if(userCredential==standardUser[i].cpf) {
                
                user = {
                    cpf: standardUser[i].cpf,
                    cNumber: standardUser[i].cNumber,
                    email: standardUser[i].email
                }
            }
        }
    if(user) return {
        status: 'É cliente (CPF)',
        cpf: user.cpf,
        numeroCliente: user.cNumber,
        email:user.email
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
                    password: standardUserApp[i].password,
                }
            }
        }
    if(user) return {error:`(CPF) Usuário já possui conta.`}
    return {
        status: 'Criar senha'
    }
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

const censorEmail = (email) => {
    const [localPart, domain] = email.split('@')
    const censoredLocalPart =  localPart.slice(0,3) + '*'.repeat(localPart.length - 4) + localPart.slice(-1)
    return `${censoredLocalPart}@${domain}`
  }


module.exports = {
    checkUser,
    checkUserApp,
    generatePassword,
    passwordExistsInDatabase,
    censorEmail,
    validatePassword,
    createToken,
    validateJWT
}
