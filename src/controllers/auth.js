const { PrismaClient } = require("@prisma/client")
const { checkUser, checkUserApp, generatePassword, passwordExistsInDatabase,censorEmail } = require("../models/auth")
const { z } = require('zod')
const { status } = require("express/lib/response")

const prisma = new PrismaClient()

getOk = async(request, response) => {
    return response.status(200).json({pong: "true"})
}

const users = []
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

module.exports = {
    getOk,
    newUser
}

