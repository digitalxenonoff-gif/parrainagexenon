// api/admin-pdf.js — Reçoit un PDF (base64), le dépose dans le bucket PRIVÉ,
// enregistre seulement son chemin (pdf_path) et passe le statut à 'pdf_ready'.
// Plus aucun PDF n'est stocké en base ni lisible publiquement.
const { applyCors, requireAdmin, sb, uploadPdf, readBody, TABLE } = require('./_lib');

module.exports = async function handler(req, res) {
  if (!applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });
  if (!requireAdmin(req, res)) return;

  const b = readBody(req);
  const id = parseInt(b.id);
  let dataUrl = (b.pdf_base64 || '').toString();
  if (!id || !dataUrl) return res.status(400).json({ error: 'Paramètres invalides' });

  // Accepte un data URI "data:application/pdf;base64,...." ou du base64 brut.
  const comma = dataUrl.indexOf(',');
  if (dataUrl.startsWith('data:') && comma !== -1) dataUrl = dataUrl.slice(comma + 1);

  let buffer;
  try { buffer = Buffer.from(dataUrl, 'base64'); }
  catch { return res.status(400).json({ error: 'PDF invalide' }); }

  if (buffer.length === 0 || buffer.length > 5 * 1024 * 1024) {
    return res.status(400).json({ error: 'PDF vide ou trop volumineux (max 5 Mo)' });
  }
  // Vérifie l'en-tête PDF (%PDF) pour éviter les uploads arbitraires.
  if (buffer.slice(0, 4).toString('latin1') !== '%PDF') {
    return res.status(400).json({ error: 'Le fichier n\'est pas un PDF' });
  }

  const path = `cartes/${id}-${Date.now()}.pdf`;

  try {
    await uploadPdf(path, buffer);
    await sb(`${TABLE}?id=eq.${id}`, { method: 'PATCH', body: { statut: 'pdf_ready', pdf_path: path } });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[admin-pdf]', e.message);
    return res.status(500).json({ error: 'Erreur serveur lors du dépôt du PDF' });
  }
};
