const express = require("express");
const { upload, processAgendamento } = require("../controllers/agendamentoController");

const router = express.Router();

router.post("/", upload.single("file"), processAgendamento);

module.exports = router;
