const { google } = require("googleapis");
const fs = require("fs");
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
 * Adiciona uma nova linha na planilha.
 * @param {string} date - Data do agendamento (Formato YYYY-MM-DD).
 * @param {number} appointments - Número de agendamentos.
 */
const formatDateToBR = (dateString) => {
    if (!dateString) return "";
    const [year, month, day] = dateString.split("-");
    return `${day}/${month}/${year}`;
};
const addRowToSheet = async (date, appointments) => {
    const formattedDate = formatDateToBR(date);
    try {
        await sheets.spreadsheets.values.append({
            spreadsheetId: SHEET_ID,
            range: `${SHEET_NAME}!A:B`,
            valueInputOption: "USER_ENTERED",
            requestBody: {
                values: [[formattedDate, appointments]],
            },
        });
        console.log("Dados adicionados à planilha.");
    } catch (error) {
        console.error("Erro ao adicionar dados ao Google Sheets:", error);
        throw new Error("Erro ao adicionar dados ao Google Sheets.");
    }
};

module.exports = {
    addRowToSheet,
};
