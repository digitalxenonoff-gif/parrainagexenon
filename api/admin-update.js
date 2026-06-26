// api/admin-update.js — Change le statut d'un parrainage. Jeton requis.
const { applyCors, requireAdmin, sb, readBody, TABLE } = require('./_lib');

const ALLOWED = ['pending', 'validated', 'sent', 'contact', 'pdf_ready'];

module.exports = async function handler(req, res) {
  if (!applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });
  if (!requireAdmin(req, res)) return;

  const b = readBody(req);
  const id = parseInt(b.id);
  const statut = (b.statut || '').toString();
  if (!id || !ALLOWED.includes(statut)) {
    return res.status(400).json({ error: 'Paramètres invalides' });
  }

  try {
    await sb(`${TABLE}?id=eq.${id}`, { method: 'PATCH', body: { statut } });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[admin-update]', e.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};
