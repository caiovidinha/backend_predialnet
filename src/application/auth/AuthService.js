const jwt = require('jsonwebtoken');
const { hash, compare } = require('bcryptjs');
const dayjs = require('dayjs');
const uaipi = require('../../infrastructure/external/uaipiClient');
const userRepo = require('../../infrastructure/repositories/userRepository');
const emailRepo = require('../../infrastructure/repositories/emailRepository');
const tokenRepo = require('../../infrastructure/repositories/tokenRepository');
const logger = require('../../utils/logger');
const { AuthError, ForbiddenError, NotFoundError, ValidationError } = require('../../domain/errors/AppError');

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

const generatePassword = () => {
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const nums = '0123456789';
  const special = '!@#$%&*';
  const all = lower + upper + nums + special;
  const rnd = (set) => set[Math.floor(Math.random() * set.length)];
  const len = Math.floor(Math.random() * 3) + 12;
  let pw = rnd(lower) + rnd(upper) + rnd(nums) + rnd(special);
  let specCount = 1;
  while (pw.length < len) {
    const c = rnd(all);
    if (special.includes(c)) { if (specCount < 3) { pw += c; specCount++; } }
    else pw += c;
  }
  return pw.split('').sort(() => 0.5 - Math.random()).join('');
};

const censorEmail = (email) => {
  const [local, domain] = email.split('@');
  const arr = local.split('');
  const toHide = Math.max(1, Math.floor(local.length * 0.5));
  const indices = new Set();
  while (indices.size < toHide) indices.add(Math.floor(Math.random() * local.length));
  indices.forEach(i => { arr[i] = '*'; });
  return `${arr.join('')}@${domain}`;
};

const censorEmailList = async (emails) => {
  const unique = [...new Set(emails.filter(Boolean))];
  const result = new Set();
  await Promise.all(unique.map(async (email) => {
    let censored;
    let isNew = false;
    do {
      const existing = await emailRepo.findByEmail(email);
      if (!existing) {
        censored = censorEmail(email);
        isNew = true;
      } else {
        censored = existing.censoredEmail;
      }
    } while (result.has(censored));
    result.add(censored);
    if (isNew) await emailRepo.create(email, censored);
  }));
  return result;
};

const getCorrectEmail = async (censoredEmail) => {
  const rec = await emailRepo.findByCensored(censoredEmail);
  if (!rec) throw new NotFoundError('E-mail censurado não encontrado');
  return rec.email;
};

const getUsersFromUAIPI = async (credential) => {
  try {
    const data = await uaipi.get(`/clientes/${credential}`);
    const users = data.data;
    if (!users || users.length === 0) return null;
    return {
      users,
      cpf: users[0].cliente.inscricao,
      nome: users[0].cliente.nome,
      email: users[0].cliente.email,
    };
  } catch {
    return null;
  }
};

const createTokenPair = async (userId) => {
  const token = jwt.sign({ userId }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: 300 });
  await tokenRepo.deleteRefreshTokensByUser(userId);
  const refreshToken = await tokenRepo.createRefreshToken(userId);
  return { token, refreshToken };
};

// ──────────────────────────────────────────────────────────────
// Use cases
// ──────────────────────────────────────────────────────────────

const login = async ({ credential, password }) => {
  const cliente = await getUsersFromUAIPI(credential);
  if (!cliente) throw new ForbiddenError('Não é um cliente predialnet');

  const user = await userRepo.findByCpf(cliente.cpf);
  if (!user) throw new ForbiddenError('Usuário ou senha incorretos');

  const valid = await compare(password, user.password);
  if (!valid) throw new ForbiddenError('Usuário ou senha incorretos');

  const passwordToken = await userRepo.findPasswordToken(user.id);
  logger.info('Login realizado', { cpf: cliente.cpf });
  return {
    tokens: await createTokenPair(user.id),
    email: user.email,
    clienteAtivo: cliente.users,
    mustChangePassword: !passwordToken,
  };
};

const newUser = async ({ userCredential }) => {
  const cliente = await getUsersFromUAIPI(userCredential);
  if (!cliente) throw new NotFoundError('Não é cliente predialnet');

  const exists = await userRepo.findByCpf(cliente.cpf);
  if (exists) throw new NotFoundError('Usuário já existe.');

  const emails = cliente.users.map(r => r.cliente.email);
  const finalEmails = await censorEmailList(emails);
  logger.info('Novo usuário pronto para ser criado', { cpf: cliente.cpf });
  return { emails: Array.from(finalEmails), inscricao: cliente.cpf };
};

const createUser = async ({ cpf, email: censoredEmail }) => {
  const cliente = await getUsersFromUAIPI(cpf);
  if (!cliente) throw new NotFoundError(`user ${cpf} not found`);

  const realEmail = await getCorrectEmail(censoredEmail);

  let newPassword;
  do {
    newPassword = generatePassword();
  } while (await userRepo.findByCpf(newPassword));

  const hashPassword = await hash(newPassword, 10);
  await userRepo.create({ cpf, password: hashPassword, email: realEmail });
  logger.info('Usuário criado', { cpf });

  const emailContent = `
    <div style="max-width:600px;margin:0 auto;background:#fff;padding:20px;border-radius:8px;box-shadow:0 4px 8px rgba(0,0,0,.1)">
      <div style="text-align:center;padding:20px;background:#9c0004;color:#fff;border-radius:8px 8px 0 0">
        <img src="https://www.predialnet.com.br/download/logo_predialnet_branca.png" alt="Logo Predialnet" style="max-width:150px;margin-bottom:10px">
        <h1 style="margin:0">Bem-vindo ao App Minha Predialnet</h1>
      </div>
      <div style="padding:20px;text-align:center">
        <p>Olá, ${cliente.nome},</p>
        <p>Sua senha foi criada com sucesso no nosso aplicativo!</p>
        <p>Ela serve para todos os números de cliente associados ao seu CPF.</p>
        <div style="background:#f2f2f2;padding:15px;margin:20px auto;border-radius:8px;font-size:18px;font-weight:bold;color:#333;display:inline-block">
          Sua senha: <span>${newPassword}</span>
        </div>
        <p>Você pode alterar sua senha diretamente no aplicativo a qualquer momento.</p>
        <p>Obrigado por baixar o nosso aplicativo!</p>
      </div>
      <div style="text-align:center;padding:20px;font-size:12px;color:#888">
        <p>Se precisar de ajuda, entre em contato pelo <a href="mailto:suporte@predialnet.com.br" style="color:#9c0004">suporte@predialnet.com.br</a>.</p>
      </div>
    </div>`;

  await uaipi.sendEmail(realEmail, 'Conta criada com sucesso | Minha Predialnet', emailContent);
  logger.info('E-mail de boas-vindas enviado', { email: realEmail });
  return { message: 'Senha enviada com sucesso' };
};

const forgotPassword = async ({ userCredential, insideApp }) => {
  const user = await userRepo.findByCpf(userCredential);
  if (!user) throw new ForbiddenError('Usuário não existe');

  const clientEmails = await getUsersFromUAIPI(userCredential)
    .then(c => c?.users?.map(r => r.cliente.email)?.filter(Boolean) ?? []);

  if (!clientEmails.includes(user.email)) {
    const censoredEmails = Array.from(await censorEmailList(clientEmails));
    return { needsEmailUpdate: true, censoredEmails };
  }

  const token = await tokenRepo.createPasswordToken(user.id);
  const url = `https://www.predialnet.com.br/redefinir-senha?token=${token.id}&email=${user.email}`;

  if (insideApp) {
    logger.info('Link de redefinição gerado via app', { cpf: userCredential });
    return { message: 'Link de redefinição gerado com sucesso!', url };
  }

  const emailContent = `
    <div style="max-width:600px;margin:0 auto;background:#fff;padding:20px;border-radius:8px">
      <div style="text-align:center;padding:20px;background:#9c0004;color:#fff;border-radius:8px 8px 0 0">
        <h1 style="margin:0">Redefinição de Senha</h1>
      </div>
      <div style="padding:20px;text-align:center">
        <p>Você solicitou a redefinição de sua senha.</p>
        <a href="${url}" style="display:inline-block;background:#9c0004;color:#fff;padding:10px 20px;text-decoration:none;border-radius:5px;margin-top:15px">Redefinir Senha</a>
        <p>Se o botão não funcionar: <a href="${url}" style="color:#9c0004">${url}</a></p>
        <p>Se você não solicitou a redefinição, ignore este e-mail.</p>
      </div>
    </div>`;

  await uaipi.sendEmail(user.email, 'Redefinição de Senha | Predialnet', emailContent);
  logger.info('E-mail de redefinição enviado', { email: user.email });
  return { message: 'E-mail enviado com sucesso!', email: censorEmail(user.email) };
};

const resetPassword = async ({ email, token, newPassword }) => {
  const users = await userRepo.findManyByEmail(email);
  if (!users.length) throw new NotFoundError('Usuário não existe');

  let passToken;
  for (const u of users) {
    passToken = await tokenRepo.findPasswordToken(u.id);
    if (passToken) break;
  }
  if (!passToken || passToken.id !== token) throw new ForbiddenError('Token inválido');
  if (new Date() > passToken.expiresIn) throw new ForbiddenError('Token expirado');

  const hashPassword = await hash(newPassword, 10);
  await userRepo.updatePassword(email, hashPassword);
  logger.info('Senha redefinida', { email });
  return { status: 'Sucesso', mensagem: 'Senha alterada com sucesso!' };
};

const updateEmail = async ({ email, codcliente, inscricao }) => {
  if (!email || !codcliente || !inscricao)
    throw new ValidationError('Campos obrigatórios não preenchidos.');

  const result = await uaipi.post(`/clientes/${codcliente}/set-email`, { email, codcliente, inscricao });
  logger.info('E-mail atualizado na UAIPI', { codcliente });
  return { message: 'E-mail atualizado com sucesso na base da Predialnet.' };
};

const updateEmailCensored = async ({ cpf, censoredEmail }) => {
  if (!cpf || !censoredEmail) throw new ValidationError('CPF e e-mail censurado são obrigatórios.');

  const user = await userRepo.findByCpf(cpf);
  if (!user) throw new NotFoundError('Usuário não encontrado.');

  const emailRecord = await emailRepo.findByCensored(censoredEmail);
  if (!emailRecord) throw new NotFoundError('E-mail não localizado.');

  await userRepo.updateEmail(user.id, emailRecord.email);
  logger.info('E-mail atualizado via censurado', { cpf });
  return { message: 'E-mail atualizado com sucesso.' };
};

const mustChangePasswordCheck = async ({ cpf }) => {
  if (!cpf) throw new ValidationError('CPF não fornecido');
  const user = await userRepo.findByCpf(cpf);
  if (!user) throw new NotFoundError('Usuário não encontrado');
  const token = await tokenRepo.findPasswordToken(user.id);
  return { mustChangePassword: !token };
};

const renewToken = async ({ refresh_token }) => {
  const refreshToken = await tokenRepo.findRefreshToken(refresh_token);
  if (!refreshToken) return false;

  const newToken = jwt.sign(
    { userId: refreshToken.userId },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: 300 }
  );

  const expired = dayjs().isAfter(dayjs.unix(refreshToken.expiresIn));
  if (expired) {
    await tokenRepo.deleteRefreshTokensByUser(refreshToken.userId);
    const newRefreshToken = await tokenRepo.createRefreshToken(refreshToken.userId);
    return { newToken, newRefreshToken };
  }
  return newToken;
};

const sendEmail = async ({ to, subject, content }) => {
  const result = await uaipi.sendEmail(to, subject, content);
  if (result.error) throw new Error('Erro ao enviar e-mail');
  return { message: 'E-mail enviado com sucesso' };
};

module.exports = {
  login,
  newUser,
  createUser,
  forgotPassword,
  resetPassword,
  updateEmail,
  updateEmailCensored,
  mustChangePasswordCheck,
  renewToken,
  sendEmail,
  getUsersFromUAIPI,
  censorEmailList,
};
