// api/ping.js — Garde le projet Supabase actif (cron). Clé lue dans l'environnement.
module.exports = async function handler(req, res) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return res.status(500).json({ ok: false, error: 'env manquante' });
  try {
    const r = await fetch(`${url}/rest/v1/parrainages?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    return res.status(200).json({ ok: r.ok });
  } catch (e) {
    return res.status(500).json({ ok: false });
  }
};
