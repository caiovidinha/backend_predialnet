// models/fatura.js

const axios = require('axios');
const logger = require("../utils/logger");
require('dotenv').config();

/**
 * Função para realizar o login na API externa e obter o token JWT.
 * @returns {Promise<string>} - Retorna o token JWT.
 */
const loginAPI = async () => {
    try {
        const data = {   
            "email": process.env.API_LOGIN,
            "password": process.env.API_PASS
        };
        const response = await axios.post('https://uaipi.predialnet.com.br/v1/auth/login', data);
        return response.data.data.access_token;
    } catch (error) {
        logger.error('Erro ao fazer login na API', {
            error: error.message,
            response: error.response?.data
        });
        throw new Error('Não foi possível autenticar com a API externa.');
    }
};

/**
 * Função para buscar as faturas de um usuário a partir do ID.
 * @param {string} id - ID do usuário ou da fatura conforme a API externa.
 * @returns {Promise<Array>} - Retorna um array de faturas.
 */
const fetchFaturas = async (id) => {
    try {
        const token = await loginAPI();
        const response = await axios.get(`https://uaipi.predialnet.com.br/v1/faturas/${id}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        // Ajuste: A lista de faturas está dentro de response.data.data
        return response.data.data; // Retorna o array de faturas
    } catch (error) {
        logger.error('Erro ao buscar faturas', {
            id,
            error: error.message,
            response: error.response?.data
        });
        throw new Error('Não foi possível buscar as faturas.');
    }
};

/**
 * Função para obter a 2ª via da fatura (link da última fatura do tipo "internet").
 * @param {string} id - ID do usuário ou da fatura.
 * @returns {Promise<Object>} - Retorna um objeto com o link da fatura.
 */
const getSecondCopyLink = async (id, boleta) => {
    try {
        const faturas = await fetchFaturas(id);
        const internetFaturas = faturas
            .filter(fatura => fatura.tipo.toLowerCase() === 'internet')
            .sort((a, b) => new Date(b.data_emissao) - new Date(a.data_emissao));
        
        if (internetFaturas.length === 0) {
            throw new Error('Nenhuma fatura do tipo internet encontrada.');
        }
        
        const lastInternetFatura = internetFaturas.filter(fatura => fatura.boleta == boleta);
        return { link: lastInternetFatura[0].link };
    } catch (error) {
        logger.error('Erro ao obter 2ª via da fatura', {
            id,
            boleta,
            error: error.message
        });
        throw error;
    }
};

/**
 * Função para obter o histórico das últimas 6 faturas.
 * @param {string} id - ID do usuário ou da fatura.
 * @returns {Promise<Object>} - Retorna um objeto com um array das últimas 6 faturas.
 */
const getLastSixInvoices = async (id) => {
    try {
        const faturas = await fetchFaturas(id);
        const sortedFaturas = faturas.sort((a, b) => new Date(b.data_emissao) - new Date(a.data_emissao));
        const internetFaturas = sortedFaturas.filter(fatura => fatura.tipo.toLowerCase() === 'internet');
        const lastSixFaturas = internetFaturas.slice(0, 6);
        return { faturas: lastSixFaturas };
    } catch (error) {
        logger.error('Erro ao obter histórico das faturas', {
            id,
            error: error.message
        });
        throw error;
    }
};

/**
 * Função para obter o histórico das últimas 6 faturas.
 * @param {string} id - ID do usuário ou da fatura.
 * @returns {Promise<Object>} - Retorna um objeto com um array das últimas 6 faturas.
 */
const setFaturaDigital = async (id, data) => {
    try {
        const token = await loginAPI();
        const response = await axios.put(`https://uaipi.predialnet.com.br/v1/clientes/${id}`, data, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.data;
    } catch (error) {
        logger.error('Erro ao atualizar fatura digital', {
            id,
            data,
            error: error.message,
            response: error.response?.data
        });
        throw new Error('Não foi possível buscar as faturas.');
    }
};

/**
 * Função para obter o 'pix' da última fatura do tipo "internet" que está em aberto.
 * @param {string} id - ID do usuário ou da fatura.
 * @returns {Promise<Object>} - Retorna um objeto com o campo 'pix'.
 */
const getPixFromLastOpenInternetInvoice = async (id) => {
    try {
        const faturas = await fetchFaturas(id);
        const today = new Date();
        const openInternetFaturas = faturas
            .filter(fatura => 
                fatura.tipo.toLowerCase() === 'internet' && 
                !fatura.dta_pagamento
            )
            .sort((a, b) => new Date(b.data_emissao) - new Date(a.data_emissao));
        
        if (openInternetFaturas.length === 0) {
            throw new Error('Nenhuma fatura do tipo internet em aberto ou em atraso encontrada.');
        }
        
        const lastOpenInternetFatura = openInternetFaturas[0];
        return { pix: lastOpenInternetFatura.pix };
    } catch (error) {
        logger.error('Erro ao obter PIX da última fatura em aberto', {
            id,
            error: error.message
        });
        throw error;
    }
};

/**
 * Verifica o status da "fatura atual" seguindo a regra:
 * - Se houver faturas em aberto, usa a MAIS ANTIGA (menor dta_vencimento).
 * - Se todas estiverem pagas/canceladas, usa a ATIVA (não cancelada) mais recente.
 */
const checkCurrentInvoiceStatus = async (id) => {
  try {
    const faturas = await fetchFaturas(id);
    if (!Array.isArray(faturas) || faturas.length === 0) {
      throw new Error('Nenhuma fatura encontrada.');
    }

    const isOpen = (f) => !f.cancelada && f.dta_pagamento == null;
    const isActive = (f) => !f.cancelada;

    const toTime = (d) => new Date(`${d}T00:00:00`).getTime(); // 'YYYY-MM-DD' -> ms
    const hojeMs = toTime(new Date().toISOString().slice(0, 10)); // compara por data (sem hora)

    // 1) Abertas (ordenadas da MAIS ANTIGA p/ a MAIS RECENTE pelo vencimento)
    const abertasOrdenadas = faturas
      .filter(isOpen)
      .sort((a, b) => toTime(a.dta_vencimento) - toTime(b.dta_vencimento));

    let faturaAtual;

    if (abertasOrdenadas.length > 0) {
      faturaAtual = abertasOrdenadas[0];
    } else {
      // 2) Todas pagas/canceladas => pega a ATIVA mais recente
      const ativasOrdenadasDesc = faturas
        .filter(isActive)
        .sort((a, b) => toTime(b.dta_vencimento) - toTime(a.dta_vencimento));

      faturaAtual = (ativasOrdenadasDesc[0] ?? faturas.sort(
        (a, b) => toTime(b.dta_vencimento) - toTime(a.dta_vencimento)
      )[0]);
    }

    // Status: paga | atrasada | em aberto
    let status = 'em aberto';
    if (faturaAtual.dta_pagamento) {
      status = 'paga';
    } else if (toTime(faturaAtual.dta_vencimento) < hojeMs) {
      status = 'atrasada';
    } else {
      status = 'em aberto';
    }

    return {
      status,
      valor: faturaAtual.valor,
      vencimento: faturaAtual.dta_vencimento,
      boleta: faturaAtual.boleta,
      link: faturaAtual.link,
    };
  } catch (error) {
    logger.error('Erro ao verificar status da fatura atual', { id, error: error.message });
    throw error;
  }
};

/**
 * Função para obter a fatura atual (a mais recente).
 * @param {string} id - ID do usuário ou da fatura.
 * @returns {Promise<Object>} - Retorna a fatura atual.
 */
const getCurrentInvoice = async (id) => {
  try {
    const faturas = await fetchFaturas(id);
    if (!Array.isArray(faturas) || faturas.length === 0) {
      throw new Error('Nenhuma fatura encontrada.');
    }

    const isOpen = (f) => !f.cancelada && (f.dta_pagamento == null);
    const isActive = (f) => !f.cancelada; // pra ignorar canceladas no fallback

    const toTime = (d) => new Date(`${d}T00:00:00`).getTime(); // 'YYYY-MM-DD' -> ms (local)

    // 1) Abretes ordenadas da MAIS ANTIGA pra MAIS RECENTE pelo vencimento
    const abertasOrdenadas = faturas
      .filter(isOpen)
      .sort((a, b) => toTime(a.dta_vencimento) - toTime(b.dta_vencimento));

    let faturaAtual;

    if (abertasOrdenadas.length > 0) {
      // pega a ABERTA mais antiga
      faturaAtual = abertasOrdenadas[0];
    } else {
      // 2) Todas pagas/canceladas: pega a ATIVA mais recente
      const ativasOrdenadasDesc = faturas
        .filter(isActive)
        .sort((a, b) => toTime(b.dta_vencimento) - toTime(a.dta_vencimento));

      if (ativasOrdenadasDesc.length === 0) {
        // só sobrou cancelada mesmo
        faturaAtual = faturas.sort(
          (a, b) => toTime(b.dta_vencimento) - toTime(a.dta_vencimento)
        )[0];
      } else {
        faturaAtual = ativasOrdenadasDesc[0];
      }
    }

    const outrasPendentes = abertasOrdenadas.filter(f => f.boleta !== faturaAtual.boleta);

    return { faturaAtual, outrasPendentes };
  } catch (error) {
    logger.error('Erro ao obter fatura atual', { id, error: error.message });
    throw error;
  }
};


/**
 * Função para cadastrar uma liberação temporária.
 * @param {string} codcliente - Código do cliente.
 * @param {string} prazo - Prazo da liberação temporária.
 * @returns {Promise<Object>} - Retorna a resposta da API externa.
 */
const cadastrarLibtemp = async (codcliente, prazo) => {
    try {
        const token = await loginAPI();
        const payload = { codcliente, prazo };
        const response = await axios.post('https://uaipi.predialnet.com.br/v1/libtemp', payload, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    } catch (error) {
        logger.error('Erro ao cadastrar liberação temporária', {
            codcliente,
            prazo,
            error: error.message,
            response: error.response?.data
        });
        throw new Error(error.response?.data?.message || 'Erro ao cadastrar liberação temporária.');
    }
};

/**
 * Função para consultar uma liberação temporária por codcliente.
 * @param {string} codcliente - Código do cliente.
 * @returns {Promise<Object>} - Retorna a resposta da API externa.
 */
const consultarLibtempPorCliente = async (codcliente) => {
    try {
        const token = await loginAPI();
        const response = await axios.get(`https://uaipi.predialnet.com.br/v1/libtemp/cliente/${codcliente}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    } catch (error) {
        logger.error('Erro ao consultar liberação temporária', {
            codcliente,
            error: error.message,
            response: error.response?.data
        });
        throw new Error(error.response?.data?.message || 'Erro ao consultar liberação temporária.');
    }
};

/**
 * Função para deletar uma liberação temporária por ID.
 * @param {string} id - ID da liberação temporária.
 * @returns {Promise<Object>} - Retorna a resposta da API externa.
 */
const deletarLibtemp = async (id) => {
    try {
        const token = await loginAPI();
        const response = await axios.delete(`https://uaipi.predialnet.com.br/v1/libtemp/${id}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    } catch (error) {
        logger.error('Erro ao deletar liberação temporária', {
            id,
            error: error.message,
            response: error.response?.data
        });
        throw new Error(error.response?.data?.message || 'Erro ao deletar liberação temporária.');
    }
};

module.exports = {
    getSecondCopyLink,
    getLastSixInvoices,
    getPixFromLastOpenInternetInvoice,
    checkCurrentInvoiceStatus,
    getCurrentInvoice,
    cadastrarLibtemp,
    consultarLibtempPorCliente,
    deletarLibtemp,
    setFaturaDigital
};
