const { client } = require("../prisma/client");
const axios = require("axios");
const https = require("https");
const logger = require("../utils/logger");
const { checkCurrentInvoiceStatus, consultarLibtempPorCliente } = require("../models/fatura");
const { log } = require("console");

const instance = axios.create({
    httpsAgent: new https.Agent({
        rejectUnauthorized: false,
    }),
});

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
 * Gerencia o registro na tabela show_ad com base no CPF fornecido.
 * 
 * @param {Object} item - O objeto que contém a propriedade cliente.
 * @returns {Object} - Retorna um objeto com a propriedade 'show' atualizada.
 */
const manageShowAd = async (cpf) => {
    try {
        // 2. Buscar o usuário na tabela 'users' usando o CPF
        const user = await client.user.findUnique({
            where: { cpf: cpf },
        });

        if (!user) {
            throw new Error("Usuário não encontrado com o CPF fornecido.");
        }

        const userId = user.id;

        // 3. Verificar se já existe um registro na tabela 'show_ad' para este userId
        const showAd = await client.showAd.findUnique({
            where: { userId: userId },
        });

        // 4. Definir a data de expiração (hoje + 7 dias)
        const today = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(today.getDate() + 7);

        if (!showAd) {
            // 4.1. Se não existir, criar um novo registro com 'show' = true
            await client.showAd.create({
                data: {
                    expiresIn: nextWeek,
                    userId: userId,
                    show: false,
                },
            });
            return { show: true };
        } else {
            if (!showAd.show) {
                // 4.2. Se 'show' for false, verificar se o registro expirou
                if (showAd.expiresIn < today) {
                    // 4.2.1. Se expirou, atualizar 'show' para true
                    await client.showAd.update({
                        where: { userId: userId },
                        data: { expiresIn: nextWeek, show: false },
                    });
                    return { show: true };
                }
                // 4.2.2. Se ainda não expirou, manter 'show' como false
                return { show: showAd.show };
            } else {
                // 4.3. Se 'show' for true, atualizar para false e definir nova data de expiração
                await client.showAd.update({
                    where: { userId: userId },
                    data: {
                        show: false,
                        expiresIn: nextWeek,
                    },
                });
                return { show: true };
            }
        }
    } catch (error) {
        logger.error("Erro em manageShowAd", {
            cpf,
            error: error.message
        });
        throw error;
    }
};

// Function to update ser_adicional
const updateSerAdicionalModel = async (id_seradicional, data) => {
    const token = await loginAPI();
    const url = `https://uaipi.predialnet.com.br/v1/seradicional/${id_seradicional}`;
  
    try {
        const response = await instance.put(url, data, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });
        // Return the response data
        return response.data;
    } catch (error) {
        logger.error('Erro ao atualizar ser_adicional', {
            id_seradicional,
            data,
            error: error.message,
            response: error.response?.data
        });
        throw error;
    }
};

const getUserByIDModel = async (id) => {
    const token = await loginAPI();
    const url = `https://uaipi.predialnet.com.br/v1/clientes/${id}`;
  
    try {
        const response = await instance.get(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });
        // Return the response data
        return response.data.data[0];
    } catch (error) {
        logger.error('Erro ao buscar usuário por ID', {
            id,
            error: error.message,
            response: error.response?.data
        });
        throw error;
    }
};

const updateControleParentalModel = async (id_ponto, data) => {
    const token = await loginAPI();
    const url = `https://uaipi.predialnet.com.br/v1/controleparental/${id_ponto}`;
  
    try {
        const response = await instance.put(url, data, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });
        // Retornar os dados da resposta
        return response.data;
    } catch (error) {
        logger.error('Erro ao atualizar controle parental', {
            id_ponto,
            data,
            error: error.message,
            response: error.response?.data
        });
        throw error;
    }
};

const getClientStatusModel = async (codcliente) => {
    try {
        const token = await loginAPI();
        const clienteData = await getUserByIDModel(codcliente);
        const serpontos = clienteData.cliente.serpontos || [];

        const service_status = await Promise.all(
            serpontos.map(async (ponto) => {
                try {
                    const response = await instance.get(`https://uaipi.predialnet.com.br/v1/serponto/${ponto.id}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });

                    const data = response.data.data;

                    return {
                        id_ponto: data.id,
                        status_conexao: data.dados_conexao?.status || "Desconhecido",
                        velocidade: `${data.plano?.velocidade || ''} ${data.plano?.unidade || ''}`,
                    };
                } catch (err) {
                    logger.error("Erro ao consultar serponto", {
                        id_ponto: ponto.id,
                        error: err.message
                    });

                    return {
                        id_ponto: ponto.id,
                        status_conexao: "Erro",
                        sessao_inicio: null,
                        plano: ponto.plano?.plano_apelido || null,
                        velocidade: `${ponto.plano?.velocidade || ''}${ponto.plano?.unidade || ''}`,
                        servicos_ativos: []
                    };
                }
            })
        );

        const [payment, libtemp] = await Promise.all([
            (async () => {
                try {
                    const curr=await checkCurrentInvoiceStatus(codcliente);
                    console.log(curr)
                    return curr
                } catch (err) {
                    if (
                        err.message.includes("sem fatura") ||
                        err.message.includes("não encontrada")
                    ) {
                        return {
                            status: "sem fatura disponível",
                            valor: "-"
                        };
                    }
                    throw err;
                }
            })(),
            (async () => {
                try {
                    return await consultarLibtempPorCliente(codcliente);
                } catch (err) {
                    if (
                        err.message.includes("Nenhuma liberação temporária ativa encontrada para o cliente") ||
                        err.message.includes("não encontrada")
                    ) {
                        return null;
                    }
                    throw err;
                }
            })()
        ]);

        const [ano, mes, dia] = payment.vencimento.split('-');
        const vencimento = `${dia}/${mes}/${ano}`;
        return {
            service_status,
            payment_status: {
                status: payment.status,
                valor: payment.valor || "-",
                vencimento: vencimento || "-"
            },
            libtemp_status: libtemp?.status === 1
        };
    } catch (error) {
        logger.error("Erro em getClientStatusModel", {
            codcliente,
            error: error.message
        });
        throw error;
    }
};

const getAlertMessageModel = async (codcliente) => {
    try {
        const clienteData = await getUserByIDModel(codcliente); 
        return clienteData.cliente.msg_monitoramento;
    } catch (error) {
        logger.error("Erro em getAlertMessageModel", {
            codcliente,
            error: error.message
        });
        throw error;
    }
};





module.exports = {
    manageShowAd,
    updateSerAdicionalModel,
    updateControleParentalModel,
    getUserByIDModel,
    getClientStatusModel,
    getAlertMessageModel
};
