const { PrismaClient } = require("@prisma/client")
const { checkUser, checkUserApp } = require("../models/auth")
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
    const userStatus = await checkUser(userCredential)

    //checkAppDatabase
    const userStatusApp = await checkUserApp(userCredential)

    //generatePassword
    //createUser (db)

    const infos = {
        status: userStatus,
        statusApp: userStatusApp
    }
    
    return res.status(201).json(infos)
}

module.exports = {
    getOk,
    newUser
}