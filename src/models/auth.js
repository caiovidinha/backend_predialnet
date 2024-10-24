const axios = require("axios");
const https = require("https");
const dotenv = require("dotenv").config();
const jwt = require("jsonwebtoken");
const { client } = require("../prisma/client");
const dayjs = require("dayjs");

const instance = axios.create({
    httpsAgent: new https.Agent({
        rejectUnauthorized: false,
    }),
});

const standardUser = [
    {
        cpf: "19242536741",
        cNumber: "123456",
        email: "caiomdavidinha@gmail.com",
    },
    {
        cpf: "19242536741",
        cNumber: "234567",
        email: "caiomdavidinha2@gmail.com",
    },
    {
        cpf: "19242536741",
        cNumber: "345678",
        email: "caiomdavidinha3@gmail.com",
    },
    { cpf: "19242536742", cNumber: "012345", email: "caiovidinha@gmail.com" },
    { cpf: "19242536742", cNumber: "567890", email: "caiovidinha2@gmail.com" },
    { cpf: "19242536742", cNumber: "678901", email: "caiovidinha3@gmail.com" },
    { cpf: "19242536743", cNumber: "678910", email: "joao.silva@gmail.com" },
    { cpf: "19242536743", cNumber: "789012", email: "joao.silva2@gmail.com" },
    {
        cpf: "19242536744",
        cNumber: "111213",
        email: "maria.oliveira@gmail.com",
    },
    {
        cpf: "19242536744",
        cNumber: "890123",
        email: "maria.oliveira2@gmail.com",
    },
    { cpf: "19242536745", cNumber: "141516", email: "ana.souza@gmail.com" },
    { cpf: "19242536745", cNumber: "901234", email: "ana.souza2@gmail.com" },
    { cpf: "19242536746", cNumber: "171819", email: "pedro.almeida@gmail.com" },
    {
        cpf: "19242536746",
        cNumber: "012345",
        email: "pedro.almeida2@gmail.com",
    },
    {
        cpf: "19242536747",
        cNumber: "202122",
        email: "claudia.pereira@gmail.com",
    },
    {
        cpf: "19242536747",
        cNumber: "234567",
        email: "claudia.pereira2@gmail.com",
    },
    { cpf: "19242536748", cNumber: "232425", email: "bruno.martins@gmail.com" },
    {
        cpf: "19242536748",
        cNumber: "345678",
        email: "bruno.martins2@gmail.com",
    },
    {
        cpf: "19242536749",
        cNumber: "262728",
        email: "rafaela.fernandes@gmail.com",
    },
    {
        cpf: "19242536749",
        cNumber: "567890",
        email: "rafaela.fernandes2@gmail.com",
    },
    {
        cpf: "19242536750",
        cNumber: "293031",
        email: "lucas.rodrigues@gmail.com",
    },
    {
        cpf: "19242536750",
        cNumber: "678901",
        email: "lucas.rodrigues2@gmail.com",
    },
    {
        cpf: "19242536751",
        cNumber: "303132",
        email: "mariana.santos@gmail.com",
    },
    {
        cpf: "19242536751",
        cNumber: "789012",
        email: "mariana.santos2@gmail.com",
    },
    {
        cpf: "19242536752",
        cNumber: "313233",
        email: "fernando.silva@gmail.com",
    },
    {
        cpf: "19242536752",
        cNumber: "890123",
        email: "fernando.silva2@gmail.com",
    },
    { cpf: "19242536753", cNumber: "323334", email: "juliana.alves@gmail.com" },
    {
        cpf: "19242536753",
        cNumber: "901234",
        email: "juliana.alves2@gmail.com",
    },
    { cpf: "19242536754", cNumber: "333435", email: "roberto.costa@gmail.com" },
    {
        cpf: "19242536754",
        cNumber: "012345",
        email: "roberto.costa2@gmail.com",
    },
];

require("dotenv").config();

const loginAPI = async() => {
    const data = {   
        "email": process.env.API_LOGIN,
        "password": process.env.API_PASS
    }
    const JWT = await instance.post('https://uaipi.predialnet.com.br/v1/auth/login',data)
    return JWT.data.data.access_token
}

const sendEmail = async(to,subject,body) => {
    const data = {
        "to": to,
        "subject": subject,
        "htmlContent": body
    }
    const token = await loginAPI()
    const email = await instance.post('https://uaipi.predialnet.com.br/v1/enviar-email',data,{
        headers: {
            'Authorization': `Bearer ${token}`
            }
        })
    if(!email) return {error: "Erro ao enviar o e-mail"}
    return email
}


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


const validateJWT = (req, res, next) => {
    const token = req.headers["x-access-token"];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) return res.status(401).end();

        req.cpf = decoded.cpf;
        next();
    });
};


const getUsersByCPF = async (credential) => {
    const token = await loginAPI()
    const list = await axios.get(`https://uaipi.predialnet.com.br/v1/clientes/${credential}`, {
                        headers: {
                            'Authorization': `Bearer ${token}`
                            }
                        })
    return(list.data.data)
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
    let users = []
    users = await getUsersByCPF(userCredential);
    const cpf = users[0].cliente.inscricao
    const email = users[0].cliente.email
    const nome = users[0].cliente.nome
    if(!users) return false
    return {
        users,
        nome,
        cpf,
        email
    };
};

const getUsersByEmail = async (email) => {
    let users = [];
    const firstUser = standardUser.find((user) => user.email === email);
    if (!firstUser) return false;
    return {
        cpf: firstUser.cpf,
        email: firstUser.email,
        registros: users,
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

    const length = Math.floor(Math.random() * 3) + 12; // Random length between 12 and 14
    let password = "";

    // Ensure at least one of each required character type
    password += getRandomChar(lowerChars);
    password += getRandomChar(upperChars);
    password += getRandomChar(numbers);
    password += getRandomChar(specialChars);

    // Limit to 3 special characters
    let specialCharCount = 1;

    // Fill the rest of the password length with random characters from all sets
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

    // Shuffle the password to ensure randomness
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
        const numCharsToCensor = Math.max(1, Math.floor(localPart.length * 0.5)); // Censura metade dos caracteres, no mínimo 1

        let censoredIndices = new Set();
        while (censoredIndices.size < numCharsToCensor) {
            const randomIndex = Math.floor(Math.random() * localPart.length);
            censoredIndices.add(randomIndex);
        }

        censoredIndices.forEach(index => {
            localArr[index] = '*'; // Substitui o caractere por '*'
        });

        return localArr.join('');
    };
    const censoredLocalPart = censorLocalPart(localPart);

    const cEmail = `${censoredLocalPart}@${domain}`
    return cEmail;
};

const getCorrectEmail = async (censoredEmail) => {
    const correctEmail = await client.emails.findFirst({
        where: {
            censoredEmail: censoredEmail
        }
    })
    return correctEmail.email;
}

const censorEmailList = async (emailLists) => {
    let censoredEmails = new Set();
    const unicos = new Set(emailLists);
    const emailList = Array.from(unicos);
  
    await Promise.all(
      emailList.map(async (email) => {
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
        } while (censoredEmails.has(censoredEmail)); // Garante que o censurado seja único
        censoredEmails.add(censoredEmail);
        if (newEmail) {
          await client.emails.create({
            data: {
              censoredEmail: censoredEmail,
              email: email,
            },
          });
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
    getUsersByEmail,
    generatePasswordToken,
    loginAPI,
    getUsersByCPF,
    sendEmail,
    censorEmailList,
    getCorrectEmail
};
