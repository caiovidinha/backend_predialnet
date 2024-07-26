const { PrismaClient } = require("@prisma/client")
const { checkUser } = require("../models/auth")
const { z } = require('zod')

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
    const userStatus = await checkUser(userCredential)

    if(!userStatus)return res.status(400).json('Não é cliente predialnet')

    //checkAppDatabase
    //generatePassword
    //createUser (db)
    users.push({userCredential, password:''})
    
    return res.status(201).json(userStatus)
}

module.exports = {
    getOk,
    newUser
}