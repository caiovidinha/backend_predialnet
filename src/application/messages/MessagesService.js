const messageRepo = require('../../infrastructure/repositories/messageRepository');
const clientAddressRepo = require('../../infrastructure/repositories/clientAddressRepository');
const { getClientsByAddress } = require('../utilities/UtilitiesService');
const { getAllUserCpfs } = require('../utilities/UtilitiesService');
const logger = require('../../utils/logger');

const VALID_TARGETING_TYPES = ['GLOBAL', 'CLIENTE', 'CIDADE', 'BAIRRO_CIDADE', 'RUA', 'CEP', 'CEP_NUMERO'];
const VALID_FILTER_TYPES = ['GERAL', 'CPF', 'CIDADE', 'BAIRRO', 'RUA', 'CEP', 'CEP_NUMERO'];

function _parseTargetToParams({ targeting_type, targeting_value }) {
  if (targeting_type === 'CIDADE') return { cidade: targeting_value };
  if (targeting_type === 'BAIRRO_CIDADE') { const [bairro, cidade] = targeting_value.split(':'); return { bairro, cidade }; }
  if (targeting_type === 'RUA' || targeting_type === 'CEP') return { cep: targeting_value };
  if (targeting_type === 'CEP_NUMERO') { const [cep, numero] = targeting_value.split(':'); return { cep, numero }; }
  return {};
}

function _buildAddressFields({ targeting_type, targeting_value }) {
  if (targeting_type === 'CIDADE') return { cidade: targeting_value };
  if (targeting_type === 'BAIRRO_CIDADE') { const [bairro, cidade] = targeting_value.split(':'); return { bairro, cidade }; }
  if (targeting_type === 'RUA') return { cep: targeting_value };
  if (targeting_type === 'CEP') return { cep: targeting_value };
  if (targeting_type === 'CEP_NUMERO') { const [cep, numero] = targeting_value.split(':'); return { cep, numero }; }
  return {};
}

async function _resolveTargets(targets) {
  const resolved = [];
  for (const t of targets) {
    resolved.push(t);
    if (t.targeting_type === 'GLOBAL' || t.targeting_type === 'CLIENTE') continue;
    const params = _parseTargetToParams(t);
    const addrFields = _buildAddressFields(t);
    getClientsByAddress(params)
      .then(cpfs => clientAddressRepo.upsertBatch(cpfs, addrFields))
      .catch(err => logger.error('Erro ao popular ClientAddress (background)', {
        targeting_type: t.targeting_type, error: err.message,
      }));
  }
  return resolved;
}

const createMessage = async ({ title, msg_cliente, timeout_sec, targets }) => {
  const resolvedTargets = targets ? await _resolveTargets(targets) : [];
  return messageRepo.create({ title, msg_cliente, timeout_sec, targets: resolvedTargets });
};

const listMessages = ({ page, limit, includeInactive }) =>
  messageRepo.list({ page, limit, includeInactive });

const getMessageById = (id) => messageRepo.findById(id);

const updateMessage = (id, fields) => {
  const data = {};
  if (fields.title !== undefined) data.title = fields.title;
  if (fields.msg_cliente !== undefined) data.msg_cliente = fields.msg_cliente;
  if (fields.timeout_sec !== undefined) data.timeout_sec = fields.timeout_sec;
  if (fields.active !== undefined) data.active = fields.active;
  return messageRepo.update(id, data);
};

const deleteMessage = (id) => messageRepo.softDelete(id);

const addTarget = async (id, { targeting_type, targeting_value }) => {
  if (targeting_type === 'GLOBAL' || targeting_type === 'CLIENTE') {
    return messageRepo.addTarget(id, { targeting_type, targeting_value: targeting_value ?? '*' });
  }
  const addrFields = _buildAddressFields({ targeting_type, targeting_value });
  const params = _parseTargetToParams({ targeting_type, targeting_value });
  getClientsByAddress(params)
    .then(cpfs => clientAddressRepo.upsertBatch(cpfs, addrFields))
    .catch(err => logger.error('Erro ao popular ClientAddress (background)', { id, error: err.message }));

  const target = await messageRepo.addTarget(id, { targeting_type, targeting_value });
  return { target, message: 'Target salvo. Population de ClientAddress em andamento em background.' };
};

const removeTarget = (targetId) => messageRepo.removeTarget(targetId);

const assignByAddress = async (id, { filter_type, cpfs, cidade, bairro, cep, numero }) => {
  let targetCpfs;
  if (filter_type === 'GERAL') targetCpfs = await getAllUserCpfs();
  else if (filter_type === 'CPF') targetCpfs = cpfs.map(String);
  else {
    const params = {};
    if (filter_type === 'CIDADE') params.cidade = cidade;
    else if (filter_type === 'BAIRRO') params.bairro = bairro;
    else if (filter_type === 'CEP' || filter_type === 'RUA') params.cep = cep;
    else if (filter_type === 'CEP_NUMERO') { params.cep = cep; params.numero = numero; }
    targetCpfs = await getClientsByAddress(params);
  }

  if (!targetCpfs.length) return { assigned: 0, message: 'Nenhum cliente encontrado.' };

  const results = await Promise.allSettled(
    targetCpfs.map(cpf => messageRepo.addTarget(id, { targeting_type: 'CLIENTE', targeting_value: String(cpf) }))
  );
  return {
    assigned: results.filter(r => r.status === 'fulfilled').length,
    failed: results.filter(r => r.status === 'rejected').length,
  };
};

module.exports = {
  VALID_TARGETING_TYPES,
  VALID_FILTER_TYPES,
  createMessage,
  listMessages,
  getMessageById,
  updateMessage,
  deleteMessage,
  addTarget,
  removeTarget,
  assignByAddress,
};
