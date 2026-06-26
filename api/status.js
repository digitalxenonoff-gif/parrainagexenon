// api/status.js — Renvoie UNIQUEMENT les parrainages de la personne qui s'identifie.
// Le filtrage est fait côté serveur : le navigateur ne reçoit jamais toute la table.
const { applyCors, sb, signPdf, readBody, TABLE } = require('./_lib');

module.exports = async function handler(req, res) {
  if (!applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const b = readBody(req);
  const email = (b.email || '').toString().trim().toLowerCase();
  const wa    = (b.whatsapp || '').toString().trim();
  const username = (b.username || '').toString().trim().toLowerCase();

  if (!email && !wa && !username) {
    return res.status(400).json({ error: 'Au moins un identifiant requis' });
  }

  // On construit un filtre OR côté Supabase pour ne récupérer QUE les lignes concernées.
  const conds = [];
  if (email)    { conds.push(`user_email.ilike.${email}`);    conds.push(`parrain.ilike.${email}`); }
  if (wa)       { conds.push(`user_wa.eq.${wa}`);             conds.push(`parrain.eq.${wa}`); }
  if (username) { conds.push(`user_username.ilike.${username}`); conds.push(`parrain.ilike.${username}`); }

  try {
    const or = encodeURIComponent(`(${conds.join(',')})`);
    // On ne sélectionne pas pdf_data (qui n'existe plus) ; on renvoie pdf_path -> URL signée.
    const cols = 'id,filleul,parrain,paiement,statut,date,pdf_path';
    const rows = await sb(`${TABLE}?select=${cols}&or=${or}`);

    // Pour chaque carte cadeau prête, on génère une URL signée temporaire (5 min).
    const out = [];
    for (const p of rows || []) {
      let pdf_url = null;
      if (p.statut === 'pdf_ready' && p.pdf_path) {
        pdf_url = await signPdf(p.pdf_path, 300);
      }
      out.push({
        filleul: p.filleul, paiement: p.paiement, statut: p.statut,
        date: p.date, pdf_url,
      });
    }
    return res.status(200).json({ results: out });
  } catch (e) {
    console.error('[status]', e.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};
