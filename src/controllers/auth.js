const { PrismaClient } = require("@prisma/client")
const { checkUser, checkUserApp, generatePassword, passwordExistsInDatabase, censorEmail, validatePassword, createToken } = require("../models/auth")
const { z } = require('zod')
const { status } = require("express/lib/response")

const prisma = new PrismaClient()

getOk = async(request, response) => {
    return response.status(200).json({pong: "true"})
}


newUser = async(req, res) => {

    const newUserSchema = z.object({
        userCredential: z.string()
    })
   
    const body = newUserSchema.safeParse(req.body)
    if(!body.success) return res.json({ error: 'Dados inválidos' })

    body.data.password

    const { userCredential } = req.body
    //checkUser
    const userStatusDBPredial = await checkUser(userCredential)
    
    if(userStatusDBPredial.error) {
        console.log(userStatusDBPredial.error)
        return res.status(404).json(userStatusDBPredial.error)
    }

    //checkAppDatabase
    const userStatusApp = await checkUserApp(userCredential)
    if(userStatusApp.error) {
        console.log(userStatusApp.error)
        return res.status(404).json(userStatusApp.error)
    }
    
    //generatePassword
    let newPassword
    do {
        newPassword = generatePassword()
    } while (passwordExistsInDatabase(newPassword))

    //createUser (db)
    const infos = {
        statusDBPredial: userStatusDBPredial,
        statusApp: userStatusApp,
        password: newPassword,
        email: userStatusDBPredial.email,
        registroDB: {
            cpf: userStatusDBPredial.cpf,
            numeroCliente: userStatusDBPredial.numeroCliente,
            password: newPassword,
        },
        status: "Conta criada com sucesso"
    }

    //TODO: enviar senha por email/sms
    return res.status(201).json(censorEmail(infos.email))
}

login = async (req, res) => {
    const loginSchema = z.object({
        credential: z.string(),
        password: z.string()
    })
    const body = loginSchema.safeParse(req.body)
    if(!body.success) return res.status(400).json({error: 'Dados inválidos'})


    const userStatusDBPredial = await checkUser(body.data.credential)
    
    if(userStatusDBPredial.error) {
        return res.status(403).json(userStatusDBPredial.error)
    }

    const userStatusApp = await checkUserApp(body.data.credential)
    if(!userStatusApp.error) {
        return res.status(403).json({error: "Conta não existe no app"})
    }

    if(validatePassword(body.data)) {
        return res.status(201).json({
            token: createToken()
        })
    }
    return res.status(403).json({error: "Senha inválida"})
}

module.exports = {
    getOk,
    newUser,
    login
}

