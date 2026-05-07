# Graphic AI

Application web minimale pour améliorer des graphiques avec le modèle d'image d'OpenAI (`gpt-image-2`).

## Démarrage

1. Installe les dépendances :

   ```powershell
   npm install
   ```

2. Crée un fichier `.env` à partir de `.env.example` et ajoute les clés :

   ```text
   OPENAI_API_KEY=...
   PORT=3000
   SUPABASE_URL=...
   SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   SUPABASE_IMAGE_BUCKET=graphic-ai
   ```

3. Configure Supabase (une seule fois) :

   - Auth : désactive les inscriptions publiques (signup désactivé).
   - Stockage : crée un bucket privé nommé `graphic-ai`.
   - SQL : exécute le script suivant dans l'éditeur SQL.

   ```sql
   create table if not exists public.profiles (
     id uuid primary key references auth.users (id) on delete cascade,
     email text not null,
     role text not null default 'member' check (role in ('admin','member')),
     is_active boolean not null default true,
     created_at timestamp with time zone default now()
   );

   create table if not exists public.images (
     id uuid primary key default gen_random_uuid(),
     created_at timestamp with time zone default now(),
     created_by uuid references auth.users (id) on delete set null,
     mime_type text not null,
     storage_path text not null,
     mode text,
     prompt text
   );

   alter table public.profiles enable row level security;
   alter table public.images enable row level security;

   create or replace function public.is_active_user()
   returns boolean
   language sql
   stable
   as $$
     select exists (
       select 1
       from public.profiles p
       where p.id = auth.uid()
         and p.is_active = true
     );
   $$;

   create policy "read own profile"
     on public.profiles
     for select
     using (auth.uid() = id);

   create policy "active users read images"
     on public.images
     for select
     using (public.is_active_user());
   ```

   - Crée le **premier admin** :
     - Auth > Users : crée un utilisateur.
     - SQL : ajoute son profil en `admin` :

     ```sql
     insert into public.profiles (id, email, role, is_active)
     values ('<USER_ID>', '<EMAIL>', 'admin', true);
     ```

4. Lance le serveur :

   ```powershell
   npm run dev
   ```

5. Ouvre l'app : `http://localhost:3000`

## Utilisation

- Connecte-toi avec ton compte.
- Dépose un graphique à modifier.
- Ajoute jusqu'à 4 inspirations (limite volontaire pour rester léger côté API et UI).
- Rédige tes instructions et choisis le nombre d'images souhaitées.
- Télécharge l'image générée qui te convient.

## Détails techniques

- Serveur Node/Express avec la route `/api/generate`.
- Modèle utilisé : `gpt-image-2` via l'API OpenAI (`/v1/images/edits` quand des images sont fournies, `/v1/images/generations` sinon).
- Les images sont envoyées en base64 au serveur, puis relayées à l'API en multipart.
- L'option `imageSize` (1K/2K/4K) est mappée vers `quality` OpenAI (`low`/`medium`/`high`). L'aspect ratio est mappé vers la taille la plus proche supportée (`1024x1024`, `1024x1536`, `1536x1024`).
- Les résultats sont sauvegardés dans le stockage Supabase et indexés en base.
- Note : l'organisation OpenAI doit être vérifiée pour accéder aux modèles GPT Image.
