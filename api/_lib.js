// api/_lib.js — Helpers partagés (jamais exposés au navigateur)
// Toutes les clés viennent de process.env (configurées dans Vercel).
const crypto = require('crypto');

const SUPABASE_URL  = process.env.SUPABASE_URL;            // ex: https://xxxx.supabase.co
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_KEY;    // clé service_role — SECRÈTE, serveur uniquement
const TABLE         = 'parrainages';
const BUCKET        = process.env.PDF_BUCKET || 'cartes-cadeaux'; // bucket PRIVÉ

const ADMIN_EMAIL   = process.env.ADMIN_EMAIL || '';
const ADMIN_PASSWORD= process.env.ADMIN_PASSWORD || '';
const SESSION_SECRET= process.env.ADMIN_SESSION_SECRET || '';
const SESSION_TTL   = 8 * 60 * 60 * 1000; // 8 h

// Domaines autorisés à appeler l'API depuis un navigateur.
// Ajoutez ici votre domaine personnalisé si vous en avez un.
const ALLOWED_ORIGINS = [
  'https://parrainagexenon.vercel.app',
  'https://www.parrainagexenon.vercel.app',
];

// ---- CORS ---------------------------------------------------------------
// Renvoie true si la requête peut continuer, false si elle a été refusée.
function applyCors(req, res, methods) {
  const origin = req.headers.origin || '';
  // Pas d'Origin = appel same-origin ou direct (curl) : on autorise.
  if (!origin || ALLOWED_ORIGINS.includes(origin)) {
    if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', methods || 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token');
    if (req.method === 'OPTIONS') { res.status(204).end(); return false; }
    return true;
  }
  res.status(403).json({ error: 'Origine non autorisée' });
  return false;
}

// ---- Supabase REST (service_role, bypass RLS) ---------------------------
async function sb(path, { method = 'GET', body, headers = {}, raw = false } = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (raw) return r;
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${text}`);
  return data;
}

// ---- Storage (bucket privé) --------------------------------------------
// Upload d'un PDF (buffer) -> renvoie le chemin stocké.
async function uploadPdf(pathInBucket, buffer) {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${pathInBucket}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/pdf',
      'x-upsert': 'true',
    },
    body: buffer,
  });
  if (!r.ok) throw new Error(`Storage upload ${r.status}: ${await r.text()}`);
  return pathInBucket;
}

// URL signée temporaire pour télécharger un PDF privé.
async function signPdf(pathInBucket, expiresIn = 300) {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${pathInBucket}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expiresIn }),
  });
  if (!r.ok) return null;
  const j = await r.json();
  return j.signedURL ? `${SUPABASE_URL}/storage/v1${j.signedURL}` : null;
}

// ---- Jeton admin signé (HMAC) ------------------------------------------
function makeToken() {
  const ts = Date.now();
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(String(ts)).digest('hex');
  return Buffer.from(`${ts}:${sig}`).toString('base64');
}

function verifyToken(token) {
  try {
    if (!SESSION_SECRET) return false;
    const [ts, sig] = Buffer.from(token, 'base64').toString('utf8').split(':');
    if (!ts || !sig) return false;
    if (Date.now() - parseInt(ts) > SESSION_TTL) return false;
    const expected = crypto.createHmac('sha256', SESSION_SECRET).update(ts).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch { return false; }
}

// Vérifie le jeton admin présent dans l'en-tête X-Admin-Token. Renvoie true/false.
function requireAdmin(req, res) {
  const token = req.headers['x-admin-token'] || '';
  if (!verifyToken(token)) {
    res.status(401).json({ error: 'Session admin invalide. Reconnectez-vous.' });
    return false;
  }
  return true;
}

// Comparaison constante (anti timing-attack) pour le mot de passe.
function safeEqual(a, b) {
  const ba = Buffer.from(String(a)); const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function readBody(req) {
  // Vercel parse déjà le JSON dans req.body si Content-Type le permet.
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}

module.exports = {
  TABLE, BUCKET, ADMIN_EMAIL, ADMIN_PASSWORD,
  applyCors, sb, uploadPdf, signPdf,
  makeToken, verifyToken, requireAdmin, safeEqual, readBody,
};
