const express = require("express");
const cors = require("cors");
const requestIntercepter = require("./utils/requestIntercepter");
const loginRouter = require("./routes/loginRouter");
const testRouter = require("./routes/testRouter");
const faturaRouter = require("./routes/faturaRouter");
const utilitiesRouter = require("./routes/utilitiesRouter");
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.all("*", requestIntercepter);
app.use("/", loginRouter);
app.use("/test", testRouter);
app.use("/fatura", faturaRouter);
app.use("/utils", utilitiesRouter);

module.exports = app;
