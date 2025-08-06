const multer = require("multer");
const xlsx = require("xlsx");
const { addRowToSheet } = require("../models/googlesheets");
const { createCard } = require("../models/trello");
const logger = require("../utils/logger"); // ✅ adicionado

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

            logger.info("📊 Dados extraídos do CSV/XLSX:", { data: sheetData });

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
                    logger.warn(`⚠️ Linha ignorada (inválida): ${JSON.stringify(row)}`);
                }
            }

            logger.info(`✅ ${processedRows} linhas processadas com sucesso.`);
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
        logger.error("❌ Erro ao processar agendamento:", { error: error.message });
        res.status(500).json({ error: "Erro interno ao processar os agendamentos." });
    }
};

/**
 * POST /agendamento/trello
 * Apenas envia cards para o Trello, sem tocar no Google Sheets.
 * Aceita JSON { listId, date, appointments } ou um arquivo CSV/XLSX + listId.
 */
async function sendAgendamentoToTrello(req, res) {
  try {
    const listId = req.body.listId;
    if (!listId) {
      return res.status(400).json({ error: "Campo 'listId' é obrigatório" });
    }

    let rows = [];
    if (req.file) {
      // processa arquivo CSV/XLSX
      const wb = xlsx.readFile(req.file.path);
      const [sheetName] = wb.SheetNames;
      rows = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });
      logger.info("📊 Dados extraídos do arquivo para Trello:", { count: rows.length });
    } else {
      // JSON puro
      const { date, appointments } = req.body;
      if (!date || isNaN(appointments)) {
        return res.status(400).json({ error: "Campos 'date' e 'appointments' inválidos" });
      }
      rows = [[date, appointments]];
      logger.info("📅 Agendamento Trello via JSON:", { date, appointments });
    }

    let sent = 0;
    for (const [date, rawCount] of rows) {
      const count = parseInt(rawCount, 10);
      if (!date || isNaN(count)) {
        logger.warn("⚠️ Linha inválida pulada:", { date, rawCount });
        continue;
      }
      const name = `📅 ${date}`;
      const desc = `Agendamentos: ${count}`;
      await createCard(listId, name, desc);
      sent++;
    }

    return res.status(200).json({
      message: `✔️ ${sent} card(s) criado(s) na lista ${listId}`
    });
  } catch (err) {
    logger.error("❌ Erro em sendAgendamentoToTrello:", { error: err.message });
    return res.status(500).json({ error: "Erro interno ao enviar para Trello" });
  }
}

module.exports = {
    upload,
    processAgendamento,
    sendAgendamentoToTrello
};
