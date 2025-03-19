const multer = require("multer");
const xlsx = require("xlsx");
const { addRowToSheet } = require("../models/googlesheets");

// Configuração do Multer para upload de arquivos
const upload = multer({ dest: "uploads/" });

/**
 * Processa e envia os agendamentos para o Google Sheets.
 * Suporta JSON (individual) e arquivos CSV/XLSX (múltiplos).
 */
const processAgendamento = async (req, res) => {
    try {
        if (req.file) {
            // Se for um arquivo, processa o upload
            const filePath = req.file.path;
            const workbook = xlsx.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

            console.log("📊 Dados extraídos do CSV/XLSX:", sheetData);

            let processedRows = 0;

            // Processa cada linha **um por vez**, garantindo que o Google Sheets não sobrescreva nada
            for await (const row of sheetData) {
                const date = row[0]; // Coluna A (Data)
                const appointments = row[1]; // Coluna B (Número de agendamentos)

                // Verifica se a linha é válida
                if (date && !isNaN(appointments)) {
                    await addRowToSheet(date, parseInt(appointments));
                    processedRows++;
                } else {
                    console.warn(`⚠️ Linha ignorada (inválida): ${JSON.stringify(row)}`);
                }
            }

            console.log(`✅ ${processedRows} linhas processadas com sucesso.`);
            res.status(200).json({ message: `📊 ${processedRows} registros adicionados à planilha!` });
        } else {
            // Se for JSON, processa a entrada manual
            const { date, appointments } = req.body;

            if (!date || isNaN(appointments)) {
                return res.status(400).json({ error: "❌ Dados inválidos. Envie uma data e um número de agendamentos." });
            }

            await addRowToSheet(date, parseInt(appointments));
            res.status(200).json({ message: "📅 Agendamento registrado com sucesso!" });
        }
    } catch (error) {
        console.error("❌ Erro ao processar agendamento:", error);
        res.status(500).json({ error: "Erro interno ao processar os agendamentos." });
    }
};

module.exports = {
    upload,
    processAgendamento,
};
