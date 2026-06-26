// api/submit.js — Soumission d'un parrainage (public). Insère côté serveur.
const { applyCors, sb, readBody } = require('./_lib');

module.exports = async function handler(req, res) {
  if (!applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const b = readBody(req);

  // Validation minimale
  const filleul = (b.filleul || '').toString().trim().slice(0, 200);
  const paiement = (b.paiement || '').toString();
  if (!filleul) return res.status(400).json({ error: 'Filleul requis' });
  if (!['paypal', 'virement', 'carte', 'remise'].includes(paiement)) {
    return res.status(400).json({ error: 'Mode de récompense invalide' });
  }

  // On ne stocke que des champs attendus, taillés.
  const row = {
    filleul,
    parrain:       (b.parrain || '—').toString().slice(0, 200),
    paiement,
    paiement_info: typeof b.paiement_info === 'string' ? b.paiement_info.slice(0, 2000) : '',
    statut:        'pending',
    date:          new Date().toLocaleDateString('fr-FR'),
    user_email:    (b.user_email || '').toString().slice(0, 200),
    user_wa:       (b.user_wa || '').toString().slice(0, 40),
    user_username: (b.user_username || '').toString().slice(0, 100),
  };

  try {
    await sb(require('./_lib').TABLE, { method: 'POST', body: row });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[submit]', e.message);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};
