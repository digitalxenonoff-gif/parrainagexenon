// api/status.js — Renvoie UNIQUEMENT les parrainages de la personne qui s'identifie.
// Filtrage côté serveur, avec entrée strictement validée et neutralisée.
const { applyCors, sb, signPdf, readBody, clientIp, rateLimit, TABLE } = require('./_lib');

// Neutralise les jokers ILIKE (% et _) pour forcer une correspondance EXACTE,
// pas une recherche par motif. '\' est le caractère d'échappement de LIKE.
function escLike(v) { return v.replace(/([\\%_])/g, '\\$1'); }

module.exports = async function handler(req, res) {
  if (!applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  // Anti-énumération : 40 consultations max par IP toutes les 10 minutes.
  const allowed = await rateLimit(`status:${clientIp(req)}`, 40, 10 * 60 * 1000);
  if (!allowed) return res.status(429).json({ error: 'Trop de requêtes. Réessayez plus tard.' });

  const b = readBody(req);
  let email    = (b.email || '').toString().trim().toLowerCase();
  let wa       = (b.whatsapp || '').toString().trim();
  let username = (b.username || '').toString().trim().toLowerCase();

  // Validation stricte : tout identifiant qui n'a pas un format plausible est rejeté.
  // Aucun caractère structurel ( , ( ) ) ne peut donc atteindre le filtre.
  const reEmail = /^[a-z0-9._%+-]{1,100}@[a-z0-9.-]{1,100}\.[a-z]{2,}$/i;
  const reWa    = /^[+0-9 ]{6,20}$/;
  const reUser  = /^[a-z0-9._-]{2,40}$/i;
  if (email && !reEmail.test(email)) email = '';
  if (wa && !reWa.test(wa)) wa = '';
  if (username && !reUser.test(username)) username = '';

  // Refus explicite : pas d'identifiant valide, ou tentative de joker seul.
  if (!email && !wa && !username) {
    return res.status(400).json({ error: 'Identifiant invalide' });
  }

  // Chaque valeur est échappée (jokers) PUIS encodée (traitée comme littérale
  // par PostgREST). La structure du filtre, elle, n'est pas issue de l'utilisateur.
  const E = (v) => encodeURIComponent(escLike(v));
  const X = (v) => encodeURIComponent(v);
  const conds = [];
  if (email)    { conds.push(`user_email.ilike.${E(email)}`);    conds.push(`parrain.ilike.${E(email)}`); }
  if (wa)       { conds.push(`user_wa.eq.${X(wa)}`);             conds.push(`parrain.eq.${X(wa)}`); }
  if (username) { conds.push(`user_username.ilike.${E(username)}`); conds.push(`parrain.ilike.${E(username)}`); }

  try {
    const orFilter = `(${conds.join(',')})`; // structure fixe, valeurs déjà encodées
    const cols = 'id,filleul,parrain,paiement,statut,date,pdf_path';
    const rows = await sb(`${TABLE}?select=${cols}&or=${orFilter}&limit=50`);

    const out = [];
    for (const p of rows || []) {
      let pdf_url = null;
      if (p.statut === 'pdf_ready' && p.pdf_path) {
        pdf_url = await signPdf(p.pdf_path, 300);
      }
      out.push({ filleul: p.filleul, paiement: p.paiement, statut: p.statut, date: p.date, pdf_url });
    }
    return res.status(200).json({ results: out });
  } catch (e) {
    console.error('[status]', e.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};
