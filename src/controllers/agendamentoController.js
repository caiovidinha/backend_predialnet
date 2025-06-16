const multer = require("multer");
const xlsx = require("xlsx");
const { addRowToSheet } = require("../models/googlesheets");
const logger = require("../utils/logger"); // <- ADICIONADO

// Configuração do Multer para upload de arquivos
const upload = multer({ dest: "uploads/" });

/**
 * Processa e envia os agendamentos para o Google Sheets.
 * Suporta JSON (individual) e arquivos CSV/XLSX (múltiplos).
 */
const processAgendamento = async (req, res) => {
  try {
    if (req.file) {
      const filePath = req.file.path;
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

      logger.info("📊 Dados extraídos do CSV/XLSX", { preview: sheetData.slice(0, 5) });

      let processedRows = 0;

      for await (const row of sheetData) {
        const date = row[0];
        const appointments = row[1];

        if (date && !isNaN(appointments)) {
          await addRowToSheet(date, parseInt(appointments));
          processedRows++;
        } else {
          logger.warn("⚠️ Linha ignorada (inválida)", { linha: row });
        }
      }

      logger.info("✅ Linhas processadas", { count: processedRows });
      res.status(200).json({ message: `📊 ${processedRows} registros adicionados à planilha!` });
    } else {
      const { date, appointments } = req.body;

      if (!date || isNaN(appointments)) {
        return res.status(400).json({ error: "❌ Dados inválidos. Envie uma data e um número de agendamentos." });
      }

      await addRowToSheet(date, parseInt(appointments));
      logger.info("📅 Agendamento manual registrado", { date, appointments });
      res.status(200).json({ message: "📅 Agendamento registrado com sucesso!" });
    }
  } catch (error) {
    logger.error("❌ Erro ao processar agendamento", { error: error.message });
    res.status(500).json({ error: "Erro interno ao processar os agendamentos." });
  }
};

module.exports = {
  upload,
  processAgendamento,
};
