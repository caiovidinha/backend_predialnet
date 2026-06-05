require("dotenv").config();

const DEFAULT_TIMEOUT_MS = 30000;

function parseTimeoutMs(value) {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_TIMEOUT_MS;
  }

  return parsed;
}

async function ehCliente(req, res) {
  const inscricaoSanitizada = String(req.body?.inscricao ?? "").replace(/\D/g, "");

  if (!inscricaoSanitizada) {
    return res.status(400).json({ message: "Inscrição é obrigatória." });
  }

  if (inscricaoSanitizada.length !== 11 && inscricaoSanitizada.length !== 14) {
    return res.status(400).json({
      message: "Inscrição inválida. Informe 11 ou 14 dígitos.",
    });
  }

  const apiSapoToken = process.env.APISAPO_TOKEN;
  const apiSapoUrl = process.env.APISAPO_URL;
  const timeoutMs = parseTimeoutMs(process.env.APISAPO_TIMEOUT_MS);

  if (!apiSapoToken || !apiSapoUrl) {
    return res.status(500).json({
      message: "Configuração da APISAPO incompleta no servidor.",
    });
  }

  const baseUrl = apiSapoUrl.replace(/\/+$/, "");
  const upstreamUrl = `${baseUrl}/clientes/inscricao/${inscricaoSanitizada}/eh-cliente`;

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

  let upstreamResponse;

  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiSapoToken}`,
        Accept: "application/json",
        "X-Operador-Numero": "1",
        "X-Origem-Sistema": "Teste Site Terceirizado",
      },
      signal: abortController.signal,
    });
  } catch (error) {
    clearTimeout(timeoutId);

    if (error?.name === "AbortError") {
      return res.status(504).json({ message: "Tempo limite ao consultar a APISAPO." });
    }

    return res.status(502).json({ message: "Erro de rede ao consultar a APISAPO." });
  }

  clearTimeout(timeoutId);

  let payload = null;

  try {
    payload = await upstreamResponse.json();
  } catch (error) {
    payload = null;
  }

  if (!upstreamResponse.ok) {
    const message = payload?.message || "Falha ao consultar a APISAPO.";
    return res.status(upstreamResponse.status).json({ message });
  }

  return res.status(200).json({
    cliente: Boolean(payload?.data?.cliente),
  });
}

module.exports = {
  ehCliente,
};
