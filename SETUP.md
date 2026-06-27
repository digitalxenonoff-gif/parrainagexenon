# XENON TV — Parrainage sécurisé · Guide de mise en route

## Durcissement de sécurité (lecture approfondie)
- **Extraction par joker `%` corrigée** : l'endpoint `/api/status` validait mal l'entrée. Désormais : validation stricte du format, neutralisation des jokers `%`/`_`, correspondance exacte, valeurs encodées. `%`, `' OR 1=1--`, `a,b@x.com` → rejetés (plus de 500, plus de fuite).
- **Limitation de débit** (table `rate_limits`) : anti-brute-force sur le login admin (8/15 min), anti-spam sur les soumissions (15/h), anti-énumération sur la consultation (40/10 min).
- **Honeypot** anti-bots sur le formulaire de parrainage.
- **Jeton admin durci** : horodatage et signature strictement validés.
- Vérifié : `submit`, `admin-update`, `admin-pdf` utilisent des insertions paramétrées / des entiers → non vulnérables à l'extraction. Erreurs génériques (pas de fuite d'info interne).

---


Cette version supprime **toute** clé et tout mot de passe du navigateur. Le front
(`index.html`, `admin.html`) ne parle plus jamais à Supabase : il passe par vos
propres fonctions serveur (`/api/*`), qui utilisent la clé `service_role` **côté
serveur uniquement**. Les PDF de cartes cadeaux vont dans un **bucket privé**, et
ne sont accessibles que par une URL signée valable 5 minutes.

---

## 1. Variables d'environnement à créer sur Vercel

Vercel → projet → **Settings → Environment Variables**. Créez ces 6 variables
(et **redéployez** après) :

| Nom | Valeur |
|---|---|
| `SUPABASE_URL` | `https://yoobuoseddhdhexuaebs.supabase.co` |
| `SUPABASE_SERVICE_KEY` | la clé **service_role** (Supabase → Settings → API → *service_role*) — **SECRÈTE** |
| `ADMIN_EMAIL` | votre email admin (ex. `xenoniptvofficiel@gmail.com`) |
| `ADMIN_PASSWORD` | un **nouveau** mot de passe fort (PAS `XenonAdmin2024!` qui est grillé) |
| `ADMIN_SESSION_SECRET` | une longue chaîne aléatoire (ex. 40+ caractères) |
| `PDF_BUCKET` | `cartes-cadeaux` (ou le nom du bucket que vous créez à l'étape 3) |

> La `service_role` ne doit **jamais** apparaître ailleurs que dans ces variables.
> Jamais dans le code, jamais dans le navigateur, jamais dans un document.

Pour générer un bon `ADMIN_SESSION_SECRET`, dans un terminal :
`openssl rand -hex 32`

---

## 2. Base de données (SQL Editor Supabase)

```sql
-- a) Nouvelle colonne : on ne stocke plus le PDF en base, juste son chemin
ALTER TABLE parrainages ADD COLUMN IF NOT EXISTS pdf_path text;

-- b) Supprimer la ligne de test qui contenait le PDF de récap (à adapter)
--    Repérez d'abord la ligne fautive dans Table Editor, puis :
-- DELETE FROM parrainages WHERE id = <ID_DE_LA_LIGNE_DE_TEST>;

-- c) Effacer TOUT l'ancien contenu base64 (cartes cadeaux + récap fuités)
ALTER TABLE parrainages DROP COLUMN IF EXISTS pdf_data;

-- d) RLS : déjà activé chez vous, sans policy permissive -> anon n'a aucun accès,
--    et la service_role (backend) passe outre. Rien d'autre à faire.
--    Vérifiez juste qu'il n'existe AUCUNE policy "USING (true)".

-- e) Table pour la limitation de débit (anti-brute-force / anti-spam).
--    Recommandée : sans elle, le limiteur se désactive silencieusement (fail-open).
CREATE TABLE IF NOT EXISTS rate_limits (
  key text PRIMARY KEY,
  count int NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
-- Aucune policy : seule la service_role (backend) y accède. anon = bloqué.
```

> Important : `DROP COLUMN pdf_data` supprime définitivement les anciens PDF
> stockés en base — c'est voulu (c'est là qu'était la fuite). Si vous teniez à
> d'anciennes cartes, exportez-les avant.

---

## 3. Storage : créer un bucket PRIVÉ

Supabase → **Storage** → **New bucket** :
- Nom : `cartes-cadeaux` (doit correspondre à `PDF_BUCKET`)
- **Public : NON** (laissez décoché — c'est essentiel)
- Aucune policy à ajouter : le backend y accède via la `service_role`.

---

## 4. Déploiement

1. Sur GitHub (`parrainagexenon`), **remplacez** `index.html`, `admin.html`,
   `vercel.json`, et ajoutez le dossier `api/` complet (`_lib.js`, `submit.js`,
   `status.js`, `admin-login.js`, `admin-list.js`, `admin-update.js`,
   `admin-pdf.js`, `ping.js`).
2. **Supprimez** du repo les anciens fichiers `oldindex.html`, `oooldindex.html`,
   `oldadmin.html`, `api/oldping.js` : ils contiennent encore l'ancienne clé et le
   mot de passe en clair.
3. Vérifiez que les 6 variables d'environnement sont créées (étape 1).
4. Vercel redéploie automatiquement.

---

## 5. Vérification après déploiement

**a) La table n'est plus lisible publiquement** (doit renvoyer `[]` ou une erreur) :
```bash
curl 'https://yoobuoseddhdhexuaebs.supabase.co/rest/v1/parrainages?select=*' \
  -H 'apikey: VOTRE_ANON_KEY' -H 'Authorization: Bearer VOTRE_ANON_KEY'
```

**b) Le front ne contient plus aucune clé** : ouvrez le site → F12 → Sources →
cherchez `supabase`, `eyJ`, `XenonAdmin`. Vous ne devez **rien** trouver.

**c) Le parcours fonctionne** : soumettre un parrainage, le voir dans l'admin
(après login), déposer un PDF, le télécharger côté client via le lien temporaire.

---

## Ce qui reste à faire EN DEHORS de ce code

Ces points ne sont pas dans l'app mais restent indispensables :

1. **Révoquer les clés Google OAuth** présentes dans le PDF fuité
   (Google Cloud Console → supprimer le client OAuth + `myaccount.google.com/connections`).
   Elles sont compromises quoi qu'il arrive.
2. **Évaluer l'obligation RGPD/CNIL** : des données personnelles (dont IBAN) ont
   été exposées. Une notification à la CNIL sous 72 h peut être requise.
3. Refaire le même travail de durcissement sur vos autres projets
   (`yt-tracker2`, etc.) s'ils exposent aussi une base sans RLS.

---

## Le principe à retenir

La sécurité ne vient pas de « cacher » des choses dans le navigateur — tout ce qui
part au navigateur est lisible. Elle vient de deux choses :
- les vrais secrets restent **côté serveur** (ici : variables d'environnement Vercel) ;
- l'accès est **verrouillé côté serveur** (ici : le navigateur ne touche jamais la
  base, et le RLS sert de filet).

Ce n'est pas « inviolable » — ça n'existe pas — mais c'est verrouillé en profondeur,
sans aucun secret exposé.
