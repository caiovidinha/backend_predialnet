require('dotenv').config();

const { hash } = require('bcryptjs');
const { client } = require('../prisma/client');

// Cria (ou atualiza a senha de) um usuário do painel do blog.
// O primeiro admin precisa nascer por aqui — não existe cadastro aberto.
//
//   npm run blog:usuario -- --email ana@predialnet.com.br --nome Ana --senha "..." --papel admin
//
// Rodar sem --senha gera uma senha aleatória e a imprime uma única vez.

const PAPEIS = ['admin', 'editor'];

const lerArgumentos = () => {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i += 1) {
    if (!args[i].startsWith('--')) continue;
    const chave = args[i].slice(2);
    const valor = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : 'true';
    out[chave] = valor;
    if (valor !== 'true') i += 1;
  }
  return out;
};

const senhaAleatoria = () => {
  const alfabeto = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
  const { randomInt } = require('crypto');
  return Array.from({ length: 20 }, () => alfabeto[randomInt(alfabeto.length)]).join('');
};

const main = async () => {
  const args = lerArgumentos();
  const email = String(args.email ?? '').trim().toLowerCase();
  const nome = String(args.nome ?? '').trim();
  const papel = String(args.papel ?? 'editor');

  if (!email || !nome) {
    console.error('Uso: npm run blog:usuario -- --email <email> --nome <nome> [--senha <senha>] [--papel admin|editor]');
    process.exit(1);
  }

  if (!PAPEIS.includes(papel)) {
    console.error(`Papel inválido: ${papel}. Use ${PAPEIS.join(' ou ')}.`);
    process.exit(1);
  }

  const senha = args.senha && args.senha !== 'true' ? String(args.senha) : senhaAleatoria();
  if (senha.length < 10) {
    console.error('A senha precisa de pelo menos 10 caracteres.');
    process.exit(1);
  }

  const senha_hash = await hash(senha, 10);
  const existente = await client.blogUsuario.findUnique({ where: { email } });

  if (existente) {
    await client.blogUsuario.update({
      where: { id: existente.id },
      data: { nome, papel, senha_hash, ativo: true },
    });
    // Senha nova derruba as sessões abertas daquele usuário.
    await client.blogRefreshToken.updateMany({
      where: { usuarioId: existente.id, revogado_em: null },
      data: { revogado_em: new Date() },
    });
    console.log(`Usuário atualizado: ${email} (${papel})`);
  } else {
    await client.blogUsuario.create({ data: { nome, email, papel, senha_hash } });
    console.log(`Usuário criado: ${email} (${papel})`);
  }

  if (!args.senha || args.senha === 'true') console.log(`Senha gerada: ${senha}`);
  console.log('Anote agora — ela não é exibida de novo.');
};

main()
  .catch((err) => {
    console.error('Falhou:', err.message);
    process.exitCode = 1;
  })
  .finally(() => client.$disconnect());
