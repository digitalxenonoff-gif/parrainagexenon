// api/admin-list.js — Renvoie tous les parrainages pour le tableau admin. Jeton requis.
const { applyCors, requireAdmin, sb, signPdf, TABLE } = require('./_lib');

module.exports = async function handler(req, res) {
  if (!applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Méthode non autorisée' });
  if (!requireAdmin(req, res)) return;

  try {
    const cols = 'id,filleul,parrain,paiement,paiement_info,statut,date,pdf_path,created_at';
    const rows = await sb(`${TABLE}?select=${cols}&order=created_at.desc`);
    // URL signée temporaire pour les cartes cadeaux (jamais le contenu en base).
    for (const p of rows || []) {
      p.pdf_url = p.pdf_path ? await signPdf(p.pdf_path, 300) : null;
      delete p.pdf_path;
    }
    return res.status(200).json({ rows: rows || [] });
  } catch (e) {
    console.error('[admin-list]', e.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};
