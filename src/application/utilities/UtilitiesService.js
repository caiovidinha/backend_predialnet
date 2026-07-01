const uaipi = require('../../infrastructure/external/uaipiClient');
const { client } = require('../../prisma/client');
const clientAddressRepo = require('../../infrastructure/repositories/clientAddressRepository');
const messageRepo = require('../../infrastructure/repositories/messageRepository');
const { checkCurrentInvoiceStatus } = require('../fatura/FaturaService');
const { consultarLibtempPorCliente } = require('../fatura/FaturaService');
const logger = require('../../utils/logger');

const toggleShowAd = async (cpf) => {
  const user = await client.user.findUnique({ where: { cpf } });
  if (!user) throw new Error('Usuário não encontrado com o CPF fornecido.');

  const today = new Date();
  const nextWeek = new Date();
  nextWeek.setDate(today.getDate() + 7);

  const showAd = await client.showAd.findUnique({ where: { userId: user.id } });

  if (!showAd) {
    await client.showAd.create({ data: { expiresIn: nextWeek, userId: user.id, show: false } });
    return { show: true };
  }
  if (!showAd.show) {
    await client.showAd.update({ where: { userId: user.id }, data: { expiresIn: nextWeek, show: false } });
    return { show: showAd.expiresIn < today ? true : showAd.show };
  }
  await client.showAd.update({ where: { userId: user.id }, data: { show: false, expiresIn: nextWeek } });
  return { show: true };
};

const getClientData = async (id) => {
  const data = await uaipi.get(`/clientes/${id}`);
  const response = data.data[0];

  const cpf = response?.cliente?.inscricao ?? null;
  const cidade = response?.cliente?.cidade ?? null;
  const bairro = response?.cliente?.bairro ?? null;
  const cep = response?.cliente?.cep ? String(response.cliente.cep).replace('-', '') : null;
  const numero = response?.cliente?.numero ?? null;

  if (cpf) {
    clientAddressRepo.upsertBatch([cpf], { cidade, bairro, cep, numero })
      .catch(err => logger.warn('Falha ao popular ClientAddress (lazy)', { cpf, error: err.message }));
  }

  try {
    const addr = cpf ? await clientAddressRepo.findByCpf(cpf) : null;
    const messages = await messageRepo.findForClient({ cpf, addr });
    const ourMessage = _pickBestMessage(messages, cpf, addr);
    if (ourMessage) {
      response.cliente = { ...response.cliente, msg_monitoramento: ourMessage };
    }
  } catch (err) {
    logger.warn('Falha ao buscar mensagem do banco', { id, error: err.message });
  }

  return response;
};

const getClientStatus = async (codcliente) => {
  const data = await uaipi.get(`/clientes/${codcliente}`);
  const clienteData = data.data[0];
  const serpontos = clienteData.cliente.serpontos || [];

  const service_status = await Promise.all(
    serpontos.map(async (ponto) => {
      try {
        const res = await uaipi.get(`/serponto/${ponto.id}`);
        const d = res.data;
        return {
          id_ponto: d.id,
          status_conexao: d.dados_conexao?.status || 'Desconhecido',
          velocidade: `${d.plano?.velocidade || ''} ${d.plano?.unidade || ''}`,
        };
      } catch (err) {
        logger.error('Erro ao consultar serponto', { id_ponto: ponto.id, error: err.message });
        return {
          id_ponto: ponto.id,
          status_conexao: 'Erro',
          velocidade: `${ponto.plano?.velocidade || ''}${ponto.plano?.unidade || ''}`,
        };
      }
    })
  );

  const [payment, libtemp] = await Promise.all([
    checkCurrentInvoiceStatus(codcliente).catch(err => {
      logger.warn('Erro ao verificar fatura em getClientStatus', { codcliente, error: err.message });
      return { status: 'sem fatura disponível', valor: '-', vencimento: null };
    }),
    consultarLibtempPorCliente(codcliente).catch(err => {
      // libtemp é opcional — 404/any error = cliente sem liberação ativa
      logger.warn('Erro ao consultar libtemp em getClientStatus', { codcliente, error: err.message });
      return null;
    }),
  ]);

  const vencimento = payment.vencimento
    ? (() => { const [a, m, d] = payment.vencimento.split('-'); return `${d}/${m}/${a}`; })()
    : '-';

  return {
    service_status,
    payment_status: { status: payment.status, valor: payment.valor || '-', vencimento },
    libtemp_status: libtemp?.status === 1,
  };
};

const updateSerAdicional = async (id, data) => {
  return uaipi.put(`/seradicional/${id}`, data);
};

const updateControleParental = async (id, data) => {
  return uaipi.put(`/controleparental/${id}`, data);
};

const getAlertMessage = async (codcliente) => {
  const res = await uaipi.get(`/clientes/${codcliente}`);
  const clienteData = res.data[0];
  const externalMsg = clienteData?.cliente?.msg_monitoramento ?? null;

  const cpf = clienteData?.cliente?.inscricao ?? null;
  const cidade = clienteData?.cliente?.cidade ?? null;
  const bairro = clienteData?.cliente?.bairro ?? null;
  const cep = clienteData?.cliente?.cep ? String(clienteData.cliente.cep).replace('-', '') : null;
  const numero = clienteData?.cliente?.numero ?? null;

  if (cpf) {
    clientAddressRepo.upsertBatch([cpf], { cidade, bairro, cep, numero })
      .catch(err => logger.warn('Falha ao popular ClientAddress (lazy)', { cpf, error: err.message }));
  }

  const addr = cpf ? await clientAddressRepo.findByCpf(cpf) : null;
  const messages = await messageRepo.findForClient({ cpf, addr });
  const ourMsg = _pickBestMessage(messages, cpf, addr);
  return ourMsg || externalMsg;
};

const getAllUserCpfs = async () => {
  const rows = await client.user.findMany({ select: { cpf: true } });
  return rows.map(r => r.cpf);
};

const getClientsByAddress = async ({ cidade, bairro, cep, numero } = {}) => {
  const params = {};
  if (cidade) params.cidade = cidade;
  if (bairro) params.bairro = bairro;
  if (cep) params.cep = cep;
  if (numero) params.numero = numero;

  const res = await uaipi.get('/clientes/by-address', params);
  const data = res.data ?? res;
  if (!Array.isArray(data)) return [];
  return data.map(item => (typeof item === 'object' ? item.cliente?.inscricao : item)).filter(Boolean);
};

// ── private ──────────────────────────────────────────────────
const PRIORITY_ORDER = ['CLIENTE', 'CEP_NUMERO', 'CEP', 'RUA', 'BAIRRO_CIDADE', 'CIDADE', 'GLOBAL'];

function _pickBestMessage(messages, cpf, addr) {
  if (!messages.length) return null;
  for (const type of PRIORITY_ORDER) {
    let match = null;
    if (type === 'CLIENTE')
      match = messages.find(m => m.targets.some(t => t.targeting_type === 'CLIENTE' && t.targeting_value === String(cpf)));
    else if (type === 'CEP_NUMERO' && addr?.cep && addr?.numero)
      match = messages.find(m => m.targets.some(t => t.targeting_type === 'CEP_NUMERO' && t.targeting_value === `${addr.cep}:${addr.numero}`));
    else if (type === 'CEP' && addr?.cep)
      match = messages.find(m => m.targets.some(t => t.targeting_type === 'CEP' && t.targeting_value === addr.cep));
    else if (type === 'RUA' && addr?.cep)
      match = messages.find(m => m.targets.some(t => t.targeting_type === 'RUA' && t.targeting_value === addr.cep));
    else if (type === 'BAIRRO_CIDADE' && addr?.bairro && addr?.cidade)
      match = messages.find(m => m.targets.some(t => t.targeting_type === 'BAIRRO_CIDADE' && t.targeting_value === `${addr.bairro}:${addr.cidade}`));
    else if (type === 'CIDADE' && addr?.cidade)
      match = messages.find(m => m.targets.some(t => t.targeting_type === 'CIDADE' && t.targeting_value === addr.cidade));
    else if (type === 'GLOBAL')
      match = messages.find(m => m.targets.some(t => t.targeting_type === 'GLOBAL'));

    if (match) return { id: match.id, msg_cliente: match.msg_cliente, timeout_sec: match.timeout_sec };
  }
  return null;
}

module.exports = {
  toggleShowAd,
  getClientData,
  getClientStatus,
  updateSerAdicional,
  updateControleParental,
  getAlertMessage,
  getAllUserCpfs,
  getClientsByAddress,
};
