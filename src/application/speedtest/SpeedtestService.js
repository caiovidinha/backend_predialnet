const speedtestRepo = require('../../infrastructure/repositories/speedtestRepository');
const { ValidationError } = require('../../domain/errors/AppError');

const VALID_STATUS = ['completed', 'aborted', 'error'];
const MAX_PING_SAMPLES = 500;

const toNum = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const toInt = (v) => {
  const n = toNum(v);
  return n === null ? null : Math.trunc(n);
};

const toDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const clampStr = (v, max = 191) => {
  if (v === null || v === undefined) return null;
  const s = String(v);
  return s.length > max ? s.slice(0, max) : s;
};

// Aceita tanto payload achatado quanto aninhado (download/upload/ping/device),
// já que o front ainda está em construção. Campos desconhecidos vão para `raw`.
function normalize(payload = {}, context = {}) {
  const download = payload.download || {};
  const upload = payload.upload || {};
  const ping = payload.ping || {};
  const device = payload.device || payload.client || {};

  let status = String(payload.status || 'completed').toLowerCase();
  if (!VALID_STATUS.includes(status)) status = 'completed';

  let pingSamples = ping.samples ?? payload.pingSamples ?? null;
  if (Array.isArray(pingSamples)) {
    pingSamples = pingSamples.slice(0, MAX_PING_SAMPLES).map(toNum).filter((n) => n !== null);
  } else {
    pingSamples = null;
  }

  // cpf/userId: o body tem precedência (o app já sabe quem é o cliente);
  // o token (context) fica como fallback. cpf é sanitizado para só dígitos.
  const bodyCpf = payload.cpf ? String(payload.cpf).replace(/\D/g, '') || null : null;

  return {
    userId: payload.userId ?? context.userId ?? null,
    cpf: bodyCpf ?? context.cpf ?? null,

    downloadMbps: toNum(payload.downloadMbps ?? payload.download_mbps ?? download.mbps),
    uploadMbps: toNum(payload.uploadMbps ?? payload.upload_mbps ?? upload.mbps),
    pingMs: toNum(payload.pingMs ?? payload.ping_ms ?? ping.avg ?? ping.ms),
    jitterMs: toNum(payload.jitterMs ?? payload.jitter_ms ?? ping.jitter),
    packetLoss: toNum(payload.packetLoss ?? payload.packet_loss),

    downloadBytes: toNum(payload.downloadBytes ?? download.bytes),
    downloadDurationMs: toInt(payload.downloadDurationMs ?? download.durationMs),
    downloadConnections: toInt(payload.downloadConnections ?? download.connections),

    uploadBytes: toNum(payload.uploadBytes ?? upload.bytes),
    uploadDurationMs: toInt(payload.uploadDurationMs ?? upload.durationMs),
    uploadConnections: toInt(payload.uploadConnections ?? upload.connections),

    pingSamplesCount: pingSamples ? pingSamples.length : toInt(payload.pingSamplesCount ?? ping.count),
    pingSamples,

    appVersion: clampStr(payload.appVersion ?? device.appVersion ?? device.version),
    platform: clampStr(payload.platform ?? device.platform ?? device.os),
    osVersion: clampStr(payload.osVersion ?? device.osVersion),
    deviceModel: clampStr(payload.deviceModel ?? device.model ?? device.deviceModel),
    connectionType: clampStr(payload.connectionType ?? device.connectionType ?? device.network),
    carrier: clampStr(payload.carrier ?? device.carrier),

    clientIp: clampStr(context.clientIp),
    userAgent: context.userAgent ?? null,
    serverHost: clampStr(payload.serverHost ?? payload.server ?? context.serverHost),

    status,
    errorMessage: payload.errorMessage ?? payload.error ?? null,
    config: payload.config ?? null,
    raw: payload,
    startedAt: toDate(payload.startedAt ?? payload.started_at),
    finishedAt: toDate(payload.finishedAt ?? payload.finished_at),
  };
}

async function submitResult(payload, context = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ValidationError('Corpo do resultado inválido.');
  }
  const data = normalize(payload, context);

  const hasAnyMetric =
    data.downloadMbps !== null || data.uploadMbps !== null || data.pingMs !== null;
  if (data.status === 'completed' && !hasAnyMetric) {
    throw new ValidationError('Resultado sem métricas (downloadMbps/uploadMbps/pingMs).');
  }

  return speedtestRepo.create(data);
}

async function listResults(filters) {
  return speedtestRepo.list(filters);
}

async function getResult(id) {
  return speedtestRepo.findById(id);
}

async function getClientSummary(cpf) {
  const { agg, count, last } = await speedtestRepo.summaryByCpf(cpf);
  return {
    cpf: String(cpf),
    totalTests: count,
    averages: {
      downloadMbps: agg._avg.downloadMbps,
      uploadMbps: agg._avg.uploadMbps,
      pingMs: agg._avg.pingMs,
      jitterMs: agg._avg.jitterMs,
    },
    best: {
      downloadMbps: agg._max.downloadMbps,
      uploadMbps: agg._max.uploadMbps,
    },
    worst: {
      downloadMbps: agg._min.downloadMbps,
      uploadMbps: agg._min.uploadMbps,
      pingMs: agg._min.pingMs,
    },
    lastTest: last,
  };
}

module.exports = {
  submitResult,
  listResults,
  getResult,
  getClientSummary,
  VALID_STATUS,
};
