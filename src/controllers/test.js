const loading = async (req, res) => {
  const time = req.params.time;
  setTimeout(() => {
    res.status(201).json({ loaded: true });
  }, time);
};

// Temporário: responde true quando o CPF informado é o de teste (TEST_CPF no
// .env). Compara só os dígitos, então "022.279.137-38" e "02227913738" batem;
// como string, para não perder o zero à esquerda. Sem TEST_CPF definido,
// sempre false.
const soDigitos = (valor) => String(valor ?? '').replace(/\D/g, '');

const isTestCpf = (req, res) => {
  const alvo = soDigitos(process.env.TEST_CPF);
  const cpf = soDigitos(req.params.cpf);
  return res.status(200).json(Boolean(alvo) && cpf === alvo);
};

module.exports = {
  loading,
  isTestCpf,
};
