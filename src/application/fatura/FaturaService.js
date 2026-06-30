const uaipi = require('../../infrastructure/external/uaipiClient');
const logger = require('../../utils/logger');

const fetchFaturas = async (id) => {
  const data = await uaipi.get(`/faturas/${id}`);
  return data.data;
};

const getSecondCopyLink = async (id, boleta) => {
  const faturas = await fetchFaturas(id);
  const match = faturas
    .filter(f => f.tipo.toLowerCase() === 'internet')
    .sort((a, b) => new Date(b.data_emissao) - new Date(a.data_emissao))
    .filter(f => f.boleta == boleta);

  if (!match.length) throw new Error('Nenhuma fatura do tipo internet encontrada.');
  return { link: match[0].link };
};

const getLastSixInvoices = async (id) => {
  const faturas = await fetchFaturas(id);
  const sorted = faturas
    .filter(f => f.tipo.toLowerCase() === 'internet')
    .sort((a, b) => new Date(b.data_emissao) - new Date(a.data_emissao))
    .slice(0, 6);
  return { faturas: sorted };
};

const getPixFromLastOpenInternetInvoice = async (id) => {
  const faturas = await fetchFaturas(id);
  const open = faturas
    .filter(f => f.tipo.toLowerCase() === 'internet' && !f.dta_pagamento)
    .sort((a, b) => new Date(b.data_emissao) - new Date(a.data_emissao));

  if (!open.length) throw new Error('Nenhuma fatura do tipo internet em aberto encontrada.');
  return { pix: open[0].pix };
};

const checkCurrentInvoiceStatus = async (id) => {
  const faturas = await fetchFaturas(id);
  if (!faturas?.length) throw new Error('Nenhuma fatura encontrada.');

  const toMs = (d) => new Date(`${d}T00:00:00`).getTime();
  const today = toMs(new Date().toISOString().slice(0, 10));
  const isOpen = (f) => !f.cancelada && f.dta_pagamento == null;
  const isActive = (f) => !f.cancelada;

  const abertas = faturas.filter(isOpen).sort((a, b) => toMs(a.dta_vencimento) - toMs(b.dta_vencimento));
  let atual = abertas.length
    ? abertas[0]
    : (faturas.filter(isActive).sort((a, b) => toMs(b.dta_vencimento) - toMs(a.dta_vencimento))[0]
        ?? faturas.sort((a, b) => toMs(b.dta_vencimento) - toMs(a.dta_vencimento))[0]);

  let status = 'em aberto';
  if (atual.dta_pagamento) status = 'paga';
  else if (toMs(atual.dta_vencimento) < today) status = 'atrasada';

  return { status, valor: atual.valor, vencimento: atual.dta_vencimento, boleta: atual.boleta, link: atual.link };
};

const getCurrentInvoice = async (id) => {
  const faturas = await fetchFaturas(id);
  if (!faturas?.length) throw new Error('Nenhuma fatura encontrada.');

  const toMs = (d) => new Date(`${d}T00:00:00`).getTime();
  const isOpen = (f) => !f.cancelada && f.dta_pagamento == null;
  const isActive = (f) => !f.cancelada;

  const abertas = faturas.filter(isOpen).sort((a, b) => toMs(a.dta_vencimento) - toMs(b.dta_vencimento));
  let atual;
  if (abertas.length) {
    atual = abertas[0];
  } else {
    const ativas = faturas.filter(isActive).sort((a, b) => toMs(b.dta_vencimento) - toMs(a.dta_vencimento));
    atual = ativas.length ? ativas[0] : faturas.sort((a, b) => toMs(b.dta_vencimento) - toMs(a.dta_vencimento))[0];
  }

  const outrasPendentes = abertas.filter(f => f.boleta !== atual.boleta);
  return { faturaAtual: atual, outrasPendentes };
};

const setFaturaDigital = async (id, data) => {
  return uaipi.put(`/clientes/${id}`, data);
};

const getPastInvoicesStatus = async (id) => {
  const { faturas } = await getLastSixInvoices(id);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let open = 0, overdue = 0;
  faturas.forEach(inv => {
    if (inv.dta_pagamento || inv.cancelada) return;
    const due = new Date(inv.dta_vencimento);
    due.setHours(0, 0, 0, 0);
    if (due < today) overdue++; else open++;
  });
  return { open, overdue };
};

const cadastrarLibtemp = async (codcliente, prazo) => {
  return uaipi.post('/libtemp', { codcliente, prazo });
};

const consultarLibtempPorCliente = async (codcliente) => {
  return uaipi.get(`/libtemp/cliente/${codcliente}`);
};

const deletarLibtemp = async (id) => {
  return uaipi.del(`/libtemp/${id}`);
};

module.exports = {
  getSecondCopyLink,
  getLastSixInvoices,
  getPixFromLastOpenInternetInvoice,
  checkCurrentInvoiceStatus,
  getCurrentInvoice,
  setFaturaDigital,
  getPastInvoicesStatus,
  cadastrarLibtemp,
  consultarLibtempPorCliente,
  deletarLibtemp,
};
