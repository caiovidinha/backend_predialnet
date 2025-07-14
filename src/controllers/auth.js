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
    getCorrectEmail,
    updateEmailOnUAIPI 
} = require("../models/auth");
const { hash, compare } = require("bcryptjs");
const logger = require("../utils/logger");

getOk = async (request, response) => {
    return response.status(200).json({ pong: "true" });
};

newUser = async (req, res) => {
    const { userCredential } = req.body;

    const users = await getUsers(userCredential);
    if (!users) {
        logger.warn("Tentativa de criação de usuário falhou - cliente não encontrado:", { userCredential });
        return res.status(404).json({ error: "Não é cliente predialnet" });
    }

    const userAlreadyExists = await client.user.findFirst({
        where: {
            cpf: users.cpf,
        },
    });

    if (userAlreadyExists) {
        logger.warn("Usuário já existe:", { cpf: users.cpf });
        return res.status(404).json({ error: "Usuário já existe." });
    }

    const emails = []
    for (const registro of users.users) {
        emails.push(registro.cliente.email)
    }
    
    const finalEmails = await censorEmailList(emails)
    logger.info("Novo usuário pronto para ser criado:", { cpf: users.cpf, emails: finalEmails });
    return res.status(201).json({
        emails: Array.from(finalEmails), 
        inscricao: users.cpf
});   
};

updateEmail = async (req, res) => {
    const { email, codcliente, inscricao } = req.body;

    if (!email || !codcliente || !inscricao) {
        logger.warn("Campos obrigatórios não preenchidos na atualização de e-mail");
        return res.status(400).json({ error: "Campos obrigatórios não preenchidos." });
    }

    try {
        const result = await updateEmailOnUAIPI({ email, codcliente, inscricao });

        if (result.error) {
            logger.error("Erro ao atualizar e-mail:", { error: result.error });
            return res.status(500).json({ error: result.error });
        }

        logger.info("E-mail atualizado com sucesso na UAIPI", { codcliente, inscricao });
        return res.status(200).json({ message: "E-mail atualizado com sucesso na base da Predialnet." });
    } catch (error) {
        console.error("Erro ao atualizar e-mail:", error);
        return res.status(500).json({ error: "Erro interno ao atualizar e-mail." });
    }
};

createUser = async(req, res) => {
    const { cpf, email } = req.body;
    const users = await getUsers(cpf)
    const correctEmail = await getCorrectEmail(email)
    if (!users) {
        logger.warn("CPF não encontrado ao criar usuário:", { cpf });
        return res.status(404).json({ error: `user ${cpf} not found` });
    }
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
    logger.info("Usuário criado com sucesso:", { cpf });
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

    await sendEmail(correctEmail,"Conta criada com sucesso | Minha Predialnet", emailContent)
    logger.info("E-mail de boas-vindas enviado para:", { email: correctEmail });
    return res.status(201).json({ message: "Senha enviada com sucesso" });

}

handleEmail = async(req,res)=>{
    const { to, subject, content } = req.body;
    const response = await sendEmail(to,subject,content)
    if (response.error) {
        logger.error("Erro ao enviar e-mail manual:", { to, subject });
        return res.status(400).json({ error: "Erro ao enviar e-mail" });
    }
    logger.info("E-mail enviado com sucesso:", { to, subject });
    return res.status(200).json({ message: "E-mail enviado com sucesso" });
}

login = async (req, res) => {
    try {
        const cliente = await getUsers(req.body.credential);
        if (!cliente) {
            logger.warn("Login negado - cliente não encontrado:", { credential: req.body.credential });
            return res.status(403).json({ error: "Não é um cliente predialnet" });
        }

        const userExists = await client.user.findFirst({
                      where: {
                          cpf: cliente.cpf,
                      },
                  });

        if (!userExists) {
            logger.warn("Login negado - usuário não encontrado:", { cpf: cliente.cpf });
            return res.status(403).json({ error: "Usuário ou senha incorretos" });
        }
    
        const validatePassword = await compare(
            req.body.password,
            userExists.password,
        );
        if (!validatePassword) {
            logger.warn("Login negado - senha incorreta:", { cpf: cliente.cpf });
            return res.status(403).json({ error: "Usuário ou senha incorretos" });
        }
    
        let clienteAtivo = cliente.users
        const passwordToken = await client.passwordToken.findFirst({
            where: { userId: userExists.id },
        });

        const mustChangePassword = !passwordToken;
        logger.info("Login realizado com sucesso:", { cpf: cliente.cpf });
        return res.status(201).json({
            tokens: await createToken(userExists.id),
            email: userExists.email,
            clienteAtivo,
            mustChangePassword
        });
    } catch (error) {
        logger.error("Erro durante o login:", { error: error.message });
        return res.status(403).json({ error: "Não é um cliente predialnet" });
    }
    
};

forgotPassword = async (req, res) => {
    try {
        const { userCredential } = req.body;

        // Buscar usuário pelo CPF (userCredential)
        const user = await client.user.findFirst({
            where: {
                cpf: userCredential,  // Busca pelo CPF ao invés do email
            },
        });

        if (!user) {
            logger.warn("Solicitação de senha - usuário não encontrado:", { cpf: userCredential });
            return res.status(403).json({ error: "Usuário não existe" });
        }

        // Gerar token para redefinição de senha
        const token = await generatePasswordToken(user.id);
        const passToken = token.id;

        // Criar URL de redefinição de senha
        const urlResetPassword = `https://www.predialnet.com.br/redefinir-senha?token=${passToken}&email=${user.email}`;

        // Censurar e-mail para o retorno
        const hashEmail = censorEmail(user.email);

        // Criar o conteúdo do e-mail
        const emailContent = `
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
            <div style="text-align: center; padding: 20px; background-color: #9c0004; color: white; border-radius: 8px 8px 0 0;">
                <img src="https://i.ibb.co/py9Qsv9/logo-predialnet-branca.png" alt="Logo Predialnet" style="max-width: 150px; margin-bottom: 10px;">
                <h1 style="margin: 0;">Redefinição de Senha</h1>
            </div>

            <div style="padding: 20px; text-align: center;">
                <p>Olá,</p>
                <p>Você solicitou a redefinição de sua senha.</p>
                <p>Clique no botão abaixo para redefinir sua senha:</p>

                <a href="${urlResetPassword}" style="display: inline-block; background-color: #9c0004; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 15px;">
                    Redefinir Senha
                </a>
                <p>Se o botão acima não funcionar, copie e cole este link no seu navegador:</p>
                <p><a href="${urlResetPassword}" style="word-break: break-all; color: #9c0004;">${urlResetPassword}</a></p>

                <p>Se você não solicitou a redefinição, ignore este e-mail.</p>
            </div>

            <div style="text-align: center; padding: 20px; font-size: 12px; color: #888;">
                <p>Se precisar de ajuda, entre em contato com nosso suporte através do <a href="mailto:suporte@predialnet.com.br" style="color: #9c0004; text-decoration: none;">suporte@predialnet.com.br</a>.</p>
            </div>
        </div>
        `;

        // Enviar e-mail com o link de redefinição
        await sendEmail(user.email, "Redefinição de Senha | Predialnet", emailContent);

        logger.info("E-mail de redefinição de senha enviado:", { email: user.email });
        return res.status(200).json({
            message: "E-mail enviado com sucesso!",
            email: hashEmail, // Retorna o e-mail censurado
        });

    } catch (error) {
        logger.error("Erro ao processar solicitação de redefinição de senha:", { error: error.message });
        return res.status(500).json({ error: "Erro interno no servidor." });
    }
};


resetPassword = async (req, res) => {
    const { email, token, newPassword } = req.body;
    const users = await client.user.findMany({
        where: {
            email: email,
        },
    });

    if (users.length === 0) {
        logger.warn("Reset de senha - e-mail não encontrado:", { email });
        return res.status(404).json({ error: "Usuário não existe" });
    }

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

    if (!passToken || passToken.id !== token) {
        logger.warn("Reset de senha - token inválido:", { email, token });
        return res.status(403).json({ error: "Token inválido" });
    }

    const now = new Date();
    if (now > passToken.expiresIn){
        logger.warn("Reset de senha - token expirado:", { email });
        return res.status(403).json({ error: "Token expirado" });
    }

    const hashPassword = await hash(newPassword, 10);
    const updatedUsers = await client.user.updateMany({
        where: {
            email: email,
        },
        data: {
            password: hashPassword,
        },
    });
    if (updatedUsers.length == 0){
        logger.error("Erro ao atualizar senha - nenhum registro afetado", { email });
        return res.status(400).json({ error: "Erro ao atualizar registros" });
    }

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
    
    logger.info("Senha redefinida com sucesso:", { email });
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
    createUser,
    handleEmail,
    updateEmail
};
