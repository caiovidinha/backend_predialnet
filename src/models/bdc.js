// models/bdc.js — Store e validação do Server-Driven UI (BDC).
// Store baseado em arquivos JSON (src/bdc/seeds) para rodar local sem migração.
// Caminho de evolução: trocar readJson() por consultas Prisma (tabelas
// app_screens / app_config) mantendo a mesma interface pública.

const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");

const SEEDS_DIR = path.join(__dirname, "..", "bdc", "seeds");

// Allowlist — precisa espelhar src/sdui/registry.ts do app.
const ALLOWED_TYPES = new Set([
  "Screen", "Header", "Section", "SectionTitle", "Text", "Card", "Divider",
  "Spacer", "Button", "MenuList", "ValueBadge", "Banner", "Image", "Carousel",
  "SwitchRow", "Dialog", "Loading",
]);
const ALLOWED_ACTIONS = new Set([
  "navigate", "openURL", "openBrowser", "tel", "share", "openDialog",
  "dismiss", "toggle", "apiCall",
]);
const ALLOWED_API_CALLS = new Set([
  "fatura.pix", "fatura.segundaVia", "libtemp.create", "fatura.digital.enable",
  "notification.markRead", "planUpgrade.submit",
]);
const ALLOWED_BINDING_ROOTS = new Set([
  "cliente", "invoice", "pastInvoices", "status", "monitor", "notifications",
  "ads", "upgradePayload",
]);
// URLs só de domínios da Predialnet.
const ALLOWED_URL_RE = /^https?:\/\/([a-z0-9-]+\.)*predialnet\.com\.br(\/|$|\?)/i;

function validateAction(action, errors, where) {
  if (!action || typeof action !== "object") {
    errors.push(`${where}: ação inválida`);
    return;
  }
  if (!ALLOWED_ACTIONS.has(action.type)) {
    errors.push(`${where}: action.type não permitido: ${action.type}`);
    return;
  }
  if (action.type === "apiCall") {
    if (!action.call || !ALLOWED_API_CALLS.has(action.call.name)) {
      errors.push(`${where}: apiCall.name não permitido: ${action.call && action.call.name}`);
    }
    if (action.onSuccess) validateAction(action.onSuccess, errors, `${where}.onSuccess`);
    if (action.onError) validateAction(action.onError, errors, `${where}.onError`);
  }
  if ((action.type === "openURL" || action.type === "openBrowser") && !ALLOWED_URL_RE.test(String(action.url || ""))) {
    errors.push(`${where}: url fora do domínio permitido: ${action.url}`);
  }
}

function validateNode(node, errors, where) {
  if (!node || typeof node !== "object") {
    errors.push(`${where}: node inválido`);
    return;
  }
  if (!ALLOWED_TYPES.has(node.type)) {
    errors.push(`${where}: type não permitido: ${node.type}`);
  }
  if (node.bindings) {
    for (const [k, v] of Object.entries(node.bindings)) {
      if (typeof v !== "string") {
        errors.push(`${where}.bindings.${k}: deve ser string`);
        continue;
      }
      const root = v.split(".")[0];
      if (!ALLOWED_BINDING_ROOTS.has(root)) {
        errors.push(`${where}.bindings.${k}: raiz não permitida: ${root}`);
      }
    }
  }
  if (node.actions) {
    for (const [k, a] of Object.entries(node.actions)) {
      validateAction(a, errors, `${where}.actions.${k}`);
    }
  }
  // Ações aninhadas em props.items[].action (MenuList/Carousel).
  if (node.props && Array.isArray(node.props.items)) {
    node.props.items.forEach((it, i) => {
      if (it && it.action) validateAction(it.action, errors, `${where}.props.items[${i}].action`);
    });
  }
  if ((node.type === "Banner" || node.type === "Image") && node.props && node.props.url && !ALLOWED_URL_RE.test(String(node.props.url))) {
    errors.push(`${where}.props.url: domínio não permitido: ${node.props.url}`);
  }
  if (Array.isArray(node.children)) {
    node.children.forEach((c, i) => validateNode(c, errors, `${where}.children[${i}]`));
  }
}

/** Valida uma árvore SDUI contra a allowlist. Retorna { valid, errors }. */
function validateTree(tree) {
  const errors = [];
  validateNode(tree, errors, "tree");
  return { valid: errors.length === 0, errors };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** Retorna { schemaVersion, screen, tree } ou null se a tela não existir. */
function getScreen(name) {
  const safe = String(name).replace(/[^a-z0-9-]/gi, "");
  const file = path.join(SEEDS_DIR, "screens", `${safe}.json`);
  if (!fs.existsSync(file)) return null;
  const data = readJson(file);
  const { valid, errors } = validateTree(data.tree);
  if (!valid) logger.warn("BDC: árvore com itens fora da allowlist", { screen: safe, errors });
  return data;
}

function listScreens() {
  const dir = path.join(SEEDS_DIR, "screens");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}

function getContent() {
  return readJson(path.join(SEEDS_DIR, "content.json"));
}

function getVersion(platform) {
  const v = readJson(path.join(SEEDS_DIR, "version.json"));
  const p = (v.platforms && v.platforms[platform]) || v.platforms.android;
  return {
    minVersion: p.minVersion,
    latestVersion: p.latestVersion,
    force: !!p.force,
    updateUrl: v.updateUrl,
    message: v.message,
  };
}

module.exports = {
  validateTree,
  getScreen,
  listScreens,
  getContent,
  getVersion,
  ALLOWED_TYPES,
  ALLOWED_ACTIONS,
  ALLOWED_API_CALLS,
  ALLOWED_BINDING_ROOTS,
};
