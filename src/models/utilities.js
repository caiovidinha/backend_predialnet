const { client } = require("../prisma/client");
const axios = require("axios");
const https = require("https");

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
        console.error('Erro ao fazer login na API:', error.response ? error.response.data : error.message);
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
                        data: { expiresIn: nextWeek,show: false },
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
        console.error("Erro em manageShowAd:", error);
        throw error;
    }
};

// Function to update ser_adicional
const updateSerAdicionalModel = async (id_seradicional, data) => {
    const token = await loginAPI()
    const url = `https://uaipi.predialnet.com.br/v1/seradicional/${id_seradicional}`;
  
    try {
      const response = await instance.put(url, data, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      // Return the response data
      	console.log(response.data);
	return response.data;
    } catch (error) {
      console.error('Error updating ser_adicional:', error.response?.data || error.message);
      throw error;
    }
  };

  const getUserByIDModel = async (id) => {
    const token = await loginAPI()
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
      console.error('Error updating ser_adicional:', error.response?.data || error.message);
      throw error;
    }
  };

  const updateControleParentalModel = async (id_ponto, data) => {
    const token = await loginAPI()
    const url = `https://uaipi.predialnet.com.br/v1/controleparental/${id_ponto}`;
  
    try {
      const response = await instance.put(url, data, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      // Retornar os dados da resposta
      console.log(response.data)
      return response.data;
    } catch (error) {
      console.error('Erro no modelo updateControleParentalModel:', error.response?.data || error.message);
      throw error;
    }
  };

module.exports = {
    manageShowAd,
    updateSerAdicionalModel,
    updateControleParentalModel,
    getUserByIDModel
};
