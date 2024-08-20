const { client } = require("../prisma/client");
const {
    generatePassword,
    generatePasswordToken,
    passwordExistsInDatabase,
    censorEmail,
    createToken,
    getUsers,
} = require("../models/auth");
const { z } = require("zod");
const { hash, compare } = require("bcryptjs");

getOk = async (request, response) => {
    return response.status(200).json({ pong: "true" });
};

newUser = async (req, res) => {
    const newUserSchema = z.object({
        userCredential: z.string(),
    });

    const body = newUserSchema.safeParse(req.body);
    if (!body.success) return res.json({ error: "Dados inválidos" });

    const { userCredential } = req.body;
    //checkUser
    const cliente = await getUsers(userCredential);
    if (!cliente) {
        return res.status(404).json({ error: "Não é cliente predialnet" });
    }

    const userAlreadyExists = await client.user.findFirst({
        where: {
            cpf: cliente.cpf,
        },
    });
    if (userAlreadyExists)
        return res.status(404).json({ error: "Usuário já existe." });
    //generatePassword
    let newPassword;
    do {
        newPassword = generatePassword();
    } while (await passwordExistsInDatabase(newPassword));
    const hashPassword = await hash(newPassword, 10);

    let users = [];

    for (const registro of cliente.registros) {
        const user = await client.user.create({
            data: {
                cNumber: registro.cNumber,
                cpf: cliente.cpf,
                password: hashPassword,
            },
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
        status: "Conta criada com sucesso",
    };

    //TODO: enviar senha por email/sms
    // return res.status(201).json(infos)
    return res.status(201).json(censorEmail(infos.email));
};

login = async (req, res) => {
    const loginSchema = z.object({
        credential: z.string(),
        password: z.string(),
    });
    const body = loginSchema.safeParse(req.body);
    if (!body.success)
        return res.status(400).json({ error: "Dados inválidos" });

    const cliente = await getUsers(body.data.credential);
    if (!cliente) {
        return res.status(403).json({ error: "Não é um cliente predialnet" });
    }
    const userExists =
        body.data.credential.length < 11
            ? await client.user.findFirst({
                  where: {
                      cNumber: body.data.credential,
                  },
              })
            : await client.user.findFirst({
                  where: {
                      cpf: cliente.cpf,
                  },
              });
    if (!userExists)
        return res.status(403).json({ error: "Usuário ou senha incorretos" });

    const validatePassword = await compare(
        body.data.password,
        userExists.password,
    );
    if (!validatePassword)
        return res.status(403).json({ error: "Usuário ou senha incorretos" });

    return res.status(201).json({
        tokens: await createToken(userExists.id),
        email: userExists.email,
    });
};

forgotPassword = async (req, res) => {
    const { email } = req.body;
    const user = await client.user.findFirst({
        where: {
            email: email,
        },
    });
    if (!user) return res.status(403).json({ error: "Usuário não existe" });
    const token = await generatePasswordToken(user.id);
    const passToken = token.id;
    const urlResetPassword =
        "http://192.168.11.13:5500/index.html?token=" +
        passToken +
        "&email=" +
        email;
    const hashEmail = censorEmail(email);
    return res.status(200).json({
        urlResetPassword: urlResetPassword,
        email: hashEmail,
    });
};

resetPassword = async (req, res) => {
    const { email, token, newPassword } = req.body;
    const users = await client.user.findMany({
        where: {
            email: email,
        },
    });
    if (users.length == 0)
        return res.status(404).json({ error: "Usuário não existe" });
    let passToken = undefined;
    for (const user of users) {
        passToken = await client.passwordToken.findFirst({
            where: {
                userId: user.id,
            },
        });
        if (passToken) {
            break;
        }
    }
    if (!passToken) return res.status(403).json({ error: "Token inválido" });

    if (passToken.id != token)
        return res.status(403).json({ error: "Token inválido" });
    const now = new Date();
    if (now > passToken.expiresIn)
        return res.status(403).json({ error: "Token expirado" });
    const hashPassword = await hash(newPassword, 10);

    const updatedUsers = await client.user.updateMany({
        where: {
            email: email,
        },
        data: {
            password: hashPassword,
        },
    });
    if (updatedUsers.length == 0)
        return res.status(400).json({ error: "Erro ao atualizar registros" });

    for (const user of users) {
        const deletedToken = await client.passwordToken.delete({
            where: {
                userId: user.id,
            },
        });
        if (deletedToken) {
            break;
        }
    }

    return res.status(200).json({
        status: "Sucesso",
        mensagem: "Senha alterada com sucesso!",
    });
};

module.exports = {
    getOk,
    newUser,
    login,
    forgotPassword,
    resetPassword,
};
