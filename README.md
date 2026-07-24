# Les envies de Lyna

## 1. Supabase
Dans l’Éditeur SQL, exécuter `supabase-configuration.sql`.

Ajouter ensuite les cadeaux dans la table `cadeaux` :
- `nom`
- `categorie`
- `prix` (ex. `24,99 €`)
- `image` (URL directe de l’image)
- `lien` (URL du magasin)
- `reserve` = false
- `reserve_par` vide
- `ordre` = 1, 2, 3…
- `coup_de_coeur` = true ou false

## 2. Clés Supabase
Dans Supabase, cliquer sur **Connecter** et récupérer :
- l’URL du projet ;
- la clé **Publishable** (`sb_publishable_...`).

Ne jamais utiliser ni partager une clé Secret ou `service_role`.

## 3. GitHub
Créer un dépôt vide et y charger le contenu de ce dossier.

## 4. Vercel
Importer le dépôt GitHub puis ajouter :
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Puis cliquer sur **Deploy**.
