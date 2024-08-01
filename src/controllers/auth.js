const { client } = require("../prisma/client")
const {  generatePassword, passwordExistsInDatabase, censorEmail, createToken, getUsers } = require("../models/auth")
const { z } = require('zod')
const { hash, compare } = require('bcryptjs')


getOk = async(request, response) => {
    return response.status(200).json({pong: "true"})
}


newUser = async(req, res) => {

    const newUserSchema = z.object({
        userCredential: z.string()
    })
   
    const body = newUserSchema.safeParse(req.body)
    if(!body.success) return res.json({ error: 'Dados inválidos' })

    const { userCredential } = req.body
    //checkUser
    const cliente = await getUsers(userCredential)
    if(!cliente) {
        return res.status(404).json({error: 'Não é cliente predialnet'})
    }
    
    const userAlreadyExists = await client.user.findFirst({
        where: {
            cpf: cliente.cpf
        }
    })
    if(userAlreadyExists) return res.status(404).json({error: 'Usuário já existe.'})
        console.log('oi')
    //generatePassword
    let newPassword
    do {
        newPassword = generatePassword()
    } while (await passwordExistsInDatabase(newPassword))
    const hashPassword = await hash(newPassword, 10)

    let users = []
    
    for (const registro of cliente.registros) {
        const user = await client.user.create({
            data: {
                cNumber: registro.cNumber,
                cpf: cliente.cpf,
                password: hashPassword,
            }
        });
        users.push(user);
    }

    //createUser (db)
    const infos = {
        cliente: cliente,
        userAlreadyExists: userAlreadyExists,
        email: cliente.email,
        registrosDB: users,
        password: newPassword,
        status: "Conta criada com sucesso"
    }
    

    //TODO: enviar senha por email/sms
    // return res.status(201).json(infos)
    return res.status(201).json(censorEmail(infos.email))
}

login = async (req, res) => {
    const loginSchema = z.object({
        credential: z.string(),
        password: z.string()
    })
    const body = loginSchema.safeParse(req.body)
    if(!body.success) return res.status(400).json({error: 'Dados inválidos'})

       
    const cliente = await getUsers(body.data.credential)
    if(!cliente) {
        return res.status(403).json({error: 'Não é um cliente predialnet'})
    }
    const userExists = 
    body.data.credential.length  < 11 
    ? await client.user.findFirst({
        where: {
            cNumber: body.data.credential
        }
    }) 
    : await client.user.findFirst({
        where: {
            cpf: cliente.cpf
        }
    })

    if(!userExists) return res.status(403).json({error: 'Usuário ou senha incorretos'})
        
    const validatePassword = await compare(body.data.password, userExists.password)
    if(!validatePassword) return res.status(403).json({error: 'Usuário ou senha incorretos'})
    
    return res.status(201).json({
        tokens: await createToken(userExists.id)
    })
}

module.exports = {
    getOk,
    newUser,
    login
}

