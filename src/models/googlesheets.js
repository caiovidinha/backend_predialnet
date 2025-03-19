const { google } = require("googleapis");
const { parse, format } = require("date-fns");
const path = require("path");

// Autenticação com a API do Google
const auth = new google.auth.GoogleAuth({
    keyFile: path.join(process.cwd(), "/credentials.json"), // Substitua pelo caminho do seu arquivo de credenciais JSON
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

const SHEET_ID = "1K6VI3mODd1nFUdZ7AzwbTiyW_tK_DXsgWV4g9fALDe4"; // ID da sua planilha
const SHEET_NAME = "Diário"; // Nome da aba

/**
 * Converte a data de diferentes formatos para DD/MM/YYYY.
 * - Se for um número (XLSX), converte corretamente para data.
 * - Se já estiver no formato correto, mantém.
 * @param {string|number} dateString - Data no formato YYYY-MM-DD, DD/MM/YYYY ou número de série do Excel.
 * @returns {string} - Data formatada como DD/MM/YYYY.
 */
const formatDateToBR = (dateString) => {
    if (!dateString) return "";

    // Se já estiver no formato DD/MM/YYYY, retorna como está
    if (typeof dateString === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) {
        return dateString;
    }

    // Se for um número (número de série do Excel), converte para data real
    if (typeof dateString === "number") {
        const excelBaseDate = new Date(1900, 0, dateString - 1);
        return format(excelBaseDate, "dd/MM/yyyy");
    }

    // Se for uma string no formato YYYY-MM-DD, converte para DD/MM/YYYY
    if (typeof dateString === "string" && dateString.includes("-")) {
        const [year, month, day] = dateString.split("-");
        if (!year || !month || !day) return dateString; // Evita erro caso os valores estejam inválidos
        return `${day}/${month}/${year}`;
    }

    return dateString; // Caso não se encaixe em nenhum formato esperado
};

/**
 * Adiciona uma nova linha na planilha.
 * @param {string} date - Data do agendamento (Formato YYYY-MM-DD).
 * @param {number} appointments - Número de agendamentos.
 */
const addRowToSheet = async (date, appointments) => {
    const formattedDate = formatDateToBR(date);
    try {
        dados = await sheets.spreadsheets.values.append({
            spreadsheetId: SHEET_ID,
            range: `${SHEET_NAME}!A:B`,
            valueInputOption: "USER_ENTERED",
            requestBody: {
                values: [[formattedDate, appointments]],
            },
        });
        console.log(JSON.stringify(dados.config.body) + " adicionados à planilha.");
    } catch (error) {
        console.error("Erro ao adicionar dados ao Google Sheets:", error);
        throw new Error("Erro ao adicionar dados ao Google Sheets.");
    }
};

module.exports = {
    addRowToSheet,
};
