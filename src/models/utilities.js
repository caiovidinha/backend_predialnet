const { client } = require("../prisma/client");

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

module.exports = {
    manageShowAd,
};
