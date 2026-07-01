const axios = require('axios');
const https = require('https');
const logger = require('../../utils/logger');

const UAIPI_BASE = 'https://uaipi.predialnet.com.br/v1';
const TOKEN_TTL_MS = 14 * 60 * 1000;

const instance = axios.create({
  baseURL: UAIPI_BASE,
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
});

let _cachedToken = null;
let _tokenExpiresAt = 0;

async function getToken() {
  if (_cachedToken && Date.now() < _tokenExpiresAt) return _cachedToken;

  const { data } = await instance.post('/auth/login', {
    email: process.env.API_LOGIN,
    password: process.env.API_PASS,
  });

  _cachedToken = data.data.access_token;
  _tokenExpiresAt = Date.now() + TOKEN_TTL_MS;
  return _cachedToken;
}

function _invalidateToken() {
  _cachedToken = null;
  _tokenExpiresAt = 0;
}

async function _request(method, path, { body, params } = {}) {
  const token = await getToken();
  try {
    const res = await instance.request({
      method,
      url: path,
      headers: { Authorization: `Bearer ${token}` },
      data: body,
      params,
    });
    return res.data;
  } catch (err) {
    if (err.response?.status === 401) {
      _invalidateToken();
    }
    logger.error('UAIPI request error', {
      method, path, status: err.response?.status, error: err.message, response: err.response?.data,
    });
    // Propaga a mensagem da UAIPI quando disponível para que callers possam identificar casos esperados
    const apiMessage = err.response?.data?.message || err.response?.data?.error;
    if (apiMessage) {
      const wrapped = new Error(apiMessage);
      wrapped.status = err.response.status;
      wrapped.originalError = err;
      throw wrapped;
    }
    throw err;
  }
}

const get = (path, params) => _request('GET', path, { params });
const post = (path, body) => _request('POST', path, { body });
const put = (path, body) => _request('PUT', path, { body });
const del = (path) => _request('DELETE', path);

async function sendEmail(to, subject, htmlContent) {
  const cc = to === 'comercial@predialnet.com.br' ? ['predialnet@predialnet.com.br'] : [];
  try {
    const token = await getToken();
    await instance.post('/enviar-email', { to, subject, htmlContent, cc }, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return { success: true };
  } catch (err) {
    logger.error('Erro ao enviar e-mail via UAIPI', { to, subject, error: err.message });
    return { error: 'Erro ao enviar o e-mail' };
  }
}

module.exports = { getToken, get, post, put, del, sendEmail };
