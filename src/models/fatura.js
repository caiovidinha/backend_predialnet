// models/fatura.js

const axios = require('axios');
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
        console.error('Erro ao fazer login na API:', error.response ? error.response.data : error.message);
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
        console.error('Erro ao buscar faturas:', error.response ? error.response.data : error.message);
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
        // Filtra as faturas do tipo "internet" e ordena por data de emissão desc
        const internetFaturas = faturas
            .filter(fatura => fatura.tipo.toLowerCase() === 'internet')
            .sort((a, b) => new Date(b.data_emissao) - new Date(a.data_emissao));
        
        if (internetFaturas.length === 0) {
            throw new Error('Nenhuma fatura do tipo internet encontrada.');
        }
        
        const lastInternetFatura = internetFaturas.filter(fatura => fatura.boleta == boleta);
        return { link: lastInternetFatura[0].link }; // Ajuste o campo 'link' conforme a estrutura real da fatura
    } catch (error) {
        console.error('Erro ao obter 2ª via da fatura:', error.message);
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
        // Ordena as faturas por data de emissão desc
        const sortedFaturas = faturas.sort((a, b) => new Date(b.data_emissao) - new Date(a.data_emissao));
        const internetFaturas = sortedFaturas.filter(fatura => fatura.tipo.toLowerCase() === 'internet');
        const lastSixFaturas = internetFaturas.slice(0, 6);
        return { faturas: lastSixFaturas };
    } catch (error) {
        console.error('Erro ao obter histórico das faturas:', error.message);
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
        console.log(response.data)
        return response.data;
    } catch (error) {
        console.error('Erro ao atualizar fatura:', error.response ? error.response.data : error.message);
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
        // Filtra as faturas do tipo "internet" que estão em aberto (sem data de pagamento e vencimento >= hoje)
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
	console.log(lastOpenInternetFatura);
        return { pix: lastOpenInternetFatura.pix }; // Ajuste o campo 'pix' conforme a estrutura real da fatura
    } catch (error) {
        console.error('Erro ao obter PIX da última fatura em aberto:', error.message);
        throw error;
    }
};

/**
 * Função para verificar o status da fatura atual (em aberto, paga ou atrasada).
 * @param {string} id - ID do usuário ou da fatura.
 * @returns {Promise<Object>} - Retorna um objeto com o status da fatura.
 */
const checkCurrentInvoiceStatus = async (id) => {
    try {
        const faturas = await fetchFaturas(id);
        // Supondo que a "fatura atual" seja a mais recente
        const sortedFaturas = faturas.sort((a, b) => new Date(b.data_emissao) - new Date(a.data_emissao));
        
        if (sortedFaturas.length === 0) {
            throw new Error('Nenhuma fatura encontrada.');
        }
        
        const currentFatura = sortedFaturas[0];
        const today = new Date();
        let status = 'em aberto';
        if (currentFatura.dta_pagamento) {
            status = 'paga';
        } else if (new Date(currentFatura.vencimento) < today) {
            status = 'atrasada';
        } else {
            status = 'em aberto';
        }
        
        return { status: status };
    } catch (error) {
        console.error('Erro ao verificar status da fatura atual:', error.message);
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
        // Ordena as faturas por data de emissão desc
        const sortedFaturas = faturas.sort((a, b) => new Date(b.data_emissao) - new Date(a.data_emissao));
        
        if (sortedFaturas.length === 0) {
            throw new Error('Nenhuma fatura encontrada.');
        }
        
        const currentFatura = sortedFaturas[0];
        return { faturaAtual: currentFatura };
    } catch (error) {
        console.error('Erro ao obter fatura atual:', error.message);
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
        const payload = {
            codcliente: codcliente,
            prazo: prazo
        };
        const response = await axios.post('https://uaipi.predialnet.com.br/v1/libtemp', payload, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        
        return response.data; // { message, status, data }
    } catch (error) {
        console.error('Erro ao cadastrar liberação temporária:', error.response ? error.response.data : error.message);
        if (error.response && error.response.data && error.response.data.message) {
            throw new Error(error.response.data.message);
        } else {
            throw new Error('Erro ao cadastrar liberação temporária.');
        }
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
        return response.data; // { message, status, data }
    } catch (error) {
        console.error('Erro ao consultar liberação temporária:', error.response ? error.response.data : error.message);
        if (error.response && error.response.data && error.response.data.message) {
            throw new Error(error.response.data.message);
        } else {
            throw new Error('Erro ao consultar liberação temporária.');
        }
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
        return response.data; // { message, status, data }
    } catch (error) {
        console.error('Erro ao deletar liberação temporária:', error.response ? error.response.data : error.message);
        if (error.response && error.response.data && error.response.data.message) {
            throw new Error(error.response.data.message);
        } else {
            throw new Error('Erro ao deletar liberação temporária.');
        }
    }
};

module.exports = {
    getSecondCopyLink,
    getLastSixInvoices,
    getPixFromLastOpenInternetInvoice,
    checkCurrentInvoiceStatus,
    getCurrentInvoice, // Adicionado
    cadastrarLibtemp, // Adicionado
    consultarLibtempPorCliente, // Adicionado
    deletarLibtemp, // Adicionado
    setFaturaDigital
};
