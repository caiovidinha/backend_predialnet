// models/auth.js

const axios = require("axios");
const https = require("https");
const dotenv = require("dotenv").config();
const jwt = require("jsonwebtoken");
const { client } = require("../prisma/client");
const dayjs = require("dayjs");
const logger = require("../utils/logger");

const instance = axios.create({
    httpsAgent: new https.Agent({
        rejectUnauthorized: false,
    }),
});

require("dotenv").config();

const loginAPI = async () => {
    const data = {
        "email": process.env.API_LOGIN,
        "password": process.env.API_PASS
    };
    const JWT = await instance.post('https://uaipi.predialnet.com.br/v1/auth/login', data);
    return JWT.data.data.access_token;
};

const sendEmail = async (to, subject, content) => {
    let data = {};
    if (to == "comercial@predialnet.com.br") {
        data = {
            "to": to,
            "subject": subject,
            "htmlContent": content,
            "cc": ["predialnet@predialnet.com.br"]
        };
    } else {
        data = {
            "to": to,
            "subject": subject,
            "htmlContent": content,
            "cc": []
        };
    }

    try {
        const token = await loginAPI();
        const email = await instance.post('https://uaipi.predialnet.com.br/v1/enviar-email', data, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!email) {
            logger.error("Falha ao enviar o e-mail, resposta indefinida", { to, subject });
            return { error: "Erro ao enviar o e-mail" };
        }
        return email;
    } catch (error) {
        logger.error("Erro ao enviar e-mail via UAIPI", {
            to,
            subject,
            error: error.message,
            response: error.response?.data
        });
        return { error: "Erro ao enviar o e-mail" };
    }
};

const passwordExistsInDatabase = async (password) => {
    const user = await client.user.findFirst({
        where: {
            password: password,
        },
    });
    if (!user) return false;
    return true;
};

const createToken = async (userId) => {
    const token = jwt.sign(
        { userId: userId },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: 300,
        },
    );
    await client.refreshToken.deleteMany({
        where: {
            userId: userId,
        },
    });
    const refreshToken = await generateRefreshToken(userId);
    return { token, refreshToken };
};

const refreshJWT = async (userId) => {
    const token = jwt.sign(
        { userId: userId },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: 300,
        },
    );
    return token;
};

const generateRefreshToken = async (userId) => {
    const expiresIn = dayjs().add(15, "sec").unix();
    const refToken = await client.refreshToken.create({
        data: {
            userId,
            expiresIn,
        },
    });
    return refToken;
};

const generatePasswordToken = async (userId) => {
    const expiresIn = new Date();
    expiresIn.setHours(expiresIn.getHours() + 1);
    const currentToken = await client.passwordToken.findFirst({
        where: {
            userId: userId,
        },
    });
    if (currentToken) {
        await client.passwordToken.deleteMany({
            where: {
                userId: userId,
            },
        });
    }
    const passToken = await client.passwordToken.create({
        data: {
            userId,
            expiresIn,
        },
    });
    return passToken;
};

const updateEmailOnUAIPI = async ({ email, codcliente, inscricao }) => {
    const token = await loginAPI();

    try {
        const response = await instance.post(
            `https://uaipi.predialnet.com.br/v1/clientes/${codcliente}/set-email`,
            {
                email,
                codcliente,
                inscricao,
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            }
        );

        if (response.status !== 200) {
            logger.error("Erro ao atualizar e-mail na UAIPI", {
                codcliente,
                status: response.status,
                data: response.data
            });
            return { error: "Falha ao atualizar e-mail" };
        }

        return { success: true };
    } catch (err) {
        logger.error("Erro de conexão com a UAIPI ao atualizar e-mail", {
            codcliente,
            error: err.message,
            response: err.response?.data
        });
        return { error: "Erro de conexão com a UAIPI" };
    }
};

const validateJWT = async (req, res, next) => {
    const token = req.headers["x-access-token"];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, async (err, decoded) => {
        if (err) return res.status(401).end();

        const user = await client.user.findUnique({
            where: { id: decoded.userId },
        });

        if (!user) return res.status(401).end();

        req.userId = user.id;
        req.cpf = user.cpf;
        next();
    });
};

const getUsersByCPF = async (credential) => {
    const token = await loginAPI();
    try {
        const list = await axios.get(`https://uaipi.predialnet.com.br/v1/clientes/${credential}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return (list.data.data);
    } catch (error) {
        logger.error("Erro ao buscar usuário por CPF na UAIPI", {
            credential,
            error: error.message,
            response: error.response?.data
        });
        return false;
    }
};

const refreshTokenRegenerate = async (refresh_token) => {
    const refreshToken = await client.refreshToken.findFirst({
        where: {
            id: refresh_token,
        },
    });
    if (!refreshToken) return false;
    const newToken = await refreshJWT(refreshToken.userId);
    const refreshTokenExpired = dayjs().isAfter(
        dayjs.unix(refreshToken.expiresIn),
    );
    if (refreshTokenExpired) {
        await client.refreshToken.deleteMany({
            where: {
                userId: refreshToken.userId,
            },
        });
        const newRefreshToken = await generateRefreshToken(refreshToken.userId);
        return { newToken, newRefreshToken };
    }
    return newToken;
};

const getUsers = async (userCredential) => {
    let users = [];
    users = await getUsersByCPF(userCredential);
    if (!users) return false;
    const cpf = users[0].cliente.inscricao;
    const email = users[0].cliente.email;
    const nome = users[0].cliente.nome;
    return {
        users,
        nome,
        cpf,
        email
    };
};

const generatePassword = () => {
    const lowerChars = "abcdefghijklmnopqrstuvwxyz";
    const upperChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const numbers = "0123456789";
    const specialChars = "!@#$%&*";

    function getRandomChar(charSet) {
        return charSet[Math.floor(Math.random() * charSet.length)];
    }

    const length = Math.floor(Math.random() * 3) + 12;
    let password = "";

    password += getRandomChar(lowerChars);
    password += getRandomChar(upperChars);
    password += getRandomChar(numbers);
    password += getRandomChar(specialChars);

    let specialCharCount = 1;
    const allChars = lowerChars + upperChars + numbers + specialChars;
    while (password.length < length) {
        let char = getRandomChar(allChars);
        if (specialChars.includes(char)) {
            if (specialCharCount < 3) {
                password += char;
                specialCharCount++;
            }
        } else {
            password += char;
        }
    }

    password = password
        .split("")
        .sort(() => 0.5 - Math.random())
        .join("");
    return password;
};

const censorEmail = (email) => {
    const [localPart, domain] = email.split("@");
    const censorLocalPart = (localPart) => {
        const localArr = localPart.split('');
        const numCharsToCensor = Math.max(1, Math.floor(localPart.length * 0.5));

        let censoredIndices = new Set();
        while (censoredIndices.size < numCharsToCensor) {
            const randomIndex = Math.floor(Math.random() * localPart.length);
            censoredIndices.add(randomIndex);
        }

        censoredIndices.forEach(index => {
            localArr[index] = '*';
        });

        return localArr.join('');
    };
    const censoredLocalPart = censorLocalPart(localPart);

    const cEmail = `${censoredLocalPart}@${domain}`;
    return cEmail;
};

const getCorrectEmail = async (censoredEmail) => {
    const correctEmail = await client.emails.findFirst({
        where: {
            censoredEmail: censoredEmail
        }
    });
    return correctEmail.email;
};

const validateUserEmail = async (cpf, providedEmail) => {
    const users = await getUsers(cpf);

    const clientEmails = users.users.map(user => user.cliente.email).filter(email => !!email);

    const censoredEmailsSet = await censorEmailList(clientEmails);
    const censoredEmails = Array.from(censoredEmailsSet);

    const emailExists = clientEmails.includes(providedEmail);

    if (!emailExists) {
        logger.warn("E-mail informado não corresponde aos e-mails cadastrados:", { cpf, providedEmail });
        return {
            censoredEmails
        };
    }

    return false;
};

const censorEmailList = async (emailLists) => {
    let censoredEmails = new Set();
    const unicos = new Set(emailLists);
    const emailList = Array.from(unicos);

    await Promise.all(
        emailList.map(async (email) => {
            if (email) {
                let censoredEmail;
                let newEmail = false;

                do {
                    const checkDB = await client.emails.findFirst({
                        where: {
                            email: email,
                        },
                    });
                    if (checkDB == null) {
                        censoredEmail = censorEmail(email);
                        newEmail = true;
                    } else {
                        censoredEmail = checkDB.censoredEmail;
                    }
                } while (censoredEmails.has(censoredEmail));
                censoredEmails.add(censoredEmail);
                if (newEmail) {
                    await client.emails.create({
                        data: {
                            censoredEmail: censoredEmail,
                            email: email,
                        },
                    });
                }
            }
        })
    );

    return censoredEmails;
};

module.exports = {
    getUsers,
    generatePassword,
    censorEmail,
    passwordExistsInDatabase,
    createToken,
    refreshJWT,
    validateJWT,
    generateRefreshToken,
    refreshTokenRegenerate,
    generatePasswordToken,
    loginAPI,
    getUsersByCPF,
    sendEmail,
    censorEmailList,
    getCorrectEmail,
    updateEmailOnUAIPI,
    validateUserEmail
};
