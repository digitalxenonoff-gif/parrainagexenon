// api/admin-login.js — Vérifie email + mot de passe côté SERVEUR, renvoie un jeton signé.
// Le mot de passe n'est jamais dans le navigateur.
const { applyCors, readBody, makeToken, safeEqual, ADMIN_EMAIL, ADMIN_PASSWORD } = require('./_lib');

module.exports = async function handler(req, res) {
  if (!applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const b = readBody(req);
  const email = (b.email || '').toString().trim();
  const password = (b.password || '').toString();

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'Admin non configuré (variables d\'environnement manquantes)' });
  }

  const ok = safeEqual(email.toLowerCase(), ADMIN_EMAIL.toLowerCase()) && safeEqual(password, ADMIN_PASSWORD);
  if (!ok) {
    // Réponse volontairement lente et générique pour limiter le brute-force.
    await new Promise(r => setTimeout(r, 600));
    return res.status(401).json({ error: 'Identifiants incorrects' });
  }

  return res.status(200).json({ token: makeToken() });
};
