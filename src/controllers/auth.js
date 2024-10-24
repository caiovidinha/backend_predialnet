const { client } = require("../prisma/client");
const {
    generatePassword,
    generatePasswordToken,
    passwordExistsInDatabase,
    censorEmail,
    createToken,
    getUsers,
    sendEmail,
    censorEmailList,
    getCorrectEmail
} = require("../models/auth");
const { z } = require("zod");
const { hash, compare } = require("bcryptjs");
const { getUser } = require("../models/userInfo");

getOk = async (request, response) => {
    return response.status(200).json({ pong: "true" });
};

testLoginApi = async (request, response) => {
    // const res = await getUsers("17258")
    const users ={
        nome: "Eliezer"
    }
    const newPassword = 123456
    const emailContent = 
    `
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
        <div style="text-align: center; padding: 20px; background-color: #9c0004; color: white; border-radius: 8px 8px 0 0;">
            <img src="https://i.ibb.co/py9Qsv9/logo-predialnet-branca.png" alt="Logo Predialnet" style="max-width: 150px; margin-bottom: 10px;">
            <h1 style="margin: 0;">Bem-vindo ao App Minha Predialnet</h1>
        </div>

        <div style="padding: 20px; text-align: center;">
            <p>Olá, ${users.nome},</p>
            <p>Sua senha foi criada com sucesso no nosso aplicativo!</p>
            <p>Ela serve para todos os números de cliente associados ao seu CPF.</p>

            <div style="background-color: #f2f2f2; padding: 15px; margin: 20px auto; border-radius: 8px; font-size: 18px; font-weight: bold; color: #333; display: inline-block;">
                Sua senha: <span>${newPassword}</span>
            </div>

            <p>Você pode alterar sua senha diretamente no aplicativo a qualquer momento.</p>

            <p>Obrigado por baixar o nosso aplicativo!</p>
        </div>

        <div style="text-align: center; padding: 20px; font-size: 12px; color: #888;">
            <p>Se você precisar de ajuda, entre em contato com nosso suporte através do aplicativo ou pelo <a href="mailto:suporte@predialnet.com.br" style="color: #9c0004; text-decoration: none;">suporte@predialnet.com.br</a>.</p>
        </div>
    </div>
    `

    const res = await sendEmail("eliezersandre@gmail.com","Conta criada com sucesso | Minha Predialnet",emailContent)
    return response.status(200).json({ res: "ok" });
};

newUser = async (req, res) => {
    const { userCredential } = req.body;

    //checar se é cliente Predialnet
    const users = await getUsers(userCredential);
    if (!users) {
        return res.status(404).json({ error: "Não é cliente predialnet" });
    }

     //checar se já tem conta no aplicativo
    const userAlreadyExists = await client.user.findFirst({
        where: {
            cpf: users.cpf,
        },
    });
    if (userAlreadyExists)
        return res.status(404).json({ error: "Usuário já existe." });

    const emails = []
    for (const registro of users.users) {
        emails.push(registro.cliente.email)
    }
    const finalEmails = await censorEmailList(emails)
    return res.status(201).json({
        emails: Array.from(finalEmails), 
        inscricao: users.cpf
});   
};

createUser = async(req, res) => {
    const { cpf, email } = req.body;
    const users = await getUsers(cpf)
    const correctEmail = await getCorrectEmail(email)
    if(!users) return res.status(404).json({ error: `user ${cpf} not found` });
    // generatePassword
    let newPassword;
    do {
        newPassword = generatePassword();
    } while (await passwordExistsInDatabase(newPassword));
    const hashPassword = await hash(newPassword, 10);
    
    // createUsers (db)
        await client.user.create({
            data: {
                cpf: cpf,
                password: hashPassword,
                email: correctEmail
            },
        });
    // Envia e-mail
    const emailContent = 
    `
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
        <div style="text-align: center; padding: 20px; background-color: #9c0004; color: white; border-radius: 8px 8px 0 0;">
            <img src="https://i.ibb.co/py9Qsv9/logo-predialnet-branca.png" alt="Logo Predialnet" style="max-width: 150px; margin-bottom: 10px;">
            <h1 style="margin: 0;">Bem-vindo ao App Minha Predialnet</h1>
        </div>

        <div style="padding: 20px; text-align: center;">
            <p>Olá, ${users.nome},</p>
            <p>Sua senha foi criada com sucesso no nosso aplicativo!</p>
            <p>Ela serve para todos os números de cliente associados ao seu CPF.</p>

            <div style="background-color: #f2f2f2; padding: 15px; margin: 20px auto; border-radius: 8px; font-size: 18px; font-weight: bold; color: #333; display: inline-block;">
                Sua senha: <span>123</span>
            </div>

            <p>Você pode alterar sua senha diretamente no aplicativo a qualquer momento.</p>

            <p>Obrigado por baixar o nosso aplicativo!</p>
        </div>

        <div style="text-align: center; padding: 20px; font-size: 12px; color: #888;">
            <p>Se você precisar de ajuda, entre em contato com nosso suporte através do aplicativo ou pelo <a href="mailto:suporte@predialnet.com.br" style="color: #9c0004; text-decoration: none;">suporte@predialnet.com.br</a>.</p>
        </div>
    </div>
    `

    await sendEmail(correctEmail,"Conta criada com sucesso | Minha Predialnet", emailContent)
    return res.status(201).json({ message: "Senha enviada com sucesso" });

}

login = async (req, res) => {
    try {
        const cliente = await getUsers(req.body.credential);
        if (!cliente) {
            return res.status(403).json({ error: "Não é um cliente predialnet" });
        }
        const userExists = await client.user.findFirst({
                      where: {
                          cpf: cliente.cpf,
                      },
                  });
        if (!userExists)
            return res.status(403).json({ error: "Usuário ou senha incorretos" });
    
        const validatePassword = await compare(
            req.body.password,
            userExists.password,
        );
        if (!validatePassword)
            return res.status(403).json({ error: "Usuário ou senha incorretos" });
    
        let clienteAtivo = cliente.users
    
        return res.status(201).json({
            tokens: await createToken(userExists.id),
            email: userExists.email,
            clienteAtivo
        });
    } catch (error) {
        if(req.body.credential == "19242536741") { 
            
        }
        return res.status(403).json({ error: "Não é um cliente predialnet" });
    }
    
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
    testLoginApi,
    createUser
};
