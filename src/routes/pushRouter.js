const express = require("express");
const router = express.Router();
const {
  saveTokenController,
  sendNotificationController,
  notifyFaturaGerada,
  notifyUsersWithOpenInvoice,
} = require("../controllers/pushController");

router.post("/save-token", saveTokenController);
router.post("/send", sendNotificationController);
router.post("/webhook/fatura-gerada", notifyFaturaGerada);
router.post("/segment/fatura-aberta", notifyUsersWithOpenInvoice);

module.exports = router;