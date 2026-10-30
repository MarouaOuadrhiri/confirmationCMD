# 📈 Mediast Dashboard

A self-hosted COD (cash-on-delivery) dashboard that **replaces the Google Sheet**.
Next.js frontend + Express API + MySQL database.

- **One login per brand** — e.g. `okinso` and `vinillia`; each brand sees only its own orders & stats.
- **Admin view** — sees everything, can filter per brand, manages brands/logins/API keys.
- **Each brand has many products, each product = one landing page.** All landing pages
  of a brand share the brand's API key and send their `product_id` with each order.
- Same vocabulary as the sheet: Confirmé, Appel 1/2/3, Livré, Retourné, Mise En Distribution…
- KPIs: Orders Today, Total Orders, Charges, Revenus, Profit, Ads Spend, Expedition, Returned, Confirmation/Delivery/Return rates.
- Confirmer performance table, per-product stats (per landing page), monthly stats.

```
project/
├── dashboard/        ← this dashboard
│   ├── backend/      Express API  → http://localhost:4000
│   │   ├── src/      routes: auth, brands, products, orders, confirmers, expenses, stats, public
│   │   └── database/ schema.sql + seed.js
│   ├── frontend/     Next.js app  → http://localhost:3000
│   │   └── app/      login, dashboard, orders, products, confirmers, expenses, settings
│   └── integration/  snippet + guide to link your landing pages
├── okinso/           ← okinso's landing pages (one folder per product)
└── vinillia/         ← vinillia's landing pages
```

## Requirements

- Node.js 18+ and MySQL 8+ installed.

## 1. Database

```bash
mysql -u root -p -e "CREATE DATABASE gestionCmdMdiast CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p gestionCmdMdiast < backend/database/schema.sql
```

## 2. Backend

```bash
cd backend
cp .env.example .env
# edit .env: DB_USER / DB_PASSWORD / DB_NAME, and set a long random JWT_SECRET
npm install
npm run seed     # creates admin + 2 brands + logins + demo data, prints credentials
npm run dev      # API on http://localhost:4000
```

Check it's alive: open http://localhost:4000/api/health → `{ ok: true, db: "connected" }`.

## 3. Frontend

```bash
cd frontend
cp .env.example .env
# edit .env if the API is not on http://localhost:4000
npm install
npm run dev      # app on http://localhost:3000
```

## 🐳 Quick Start with Docker (Single Command)

To run the entire system (MySQL + Backend API + Next.js Frontend) inside Docker containers:

```bash
# Start all containers in the background
docker compose up -d --build

# Populate database with seed data & admin account
docker exec -it mediast-backend node database/seed.js

# View live logs
docker compose logs -f
```

- **Frontend App**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:4000](http://localhost:4000)
- **API Healthcheck**: [http://localhost:4000/api/health](http://localhost:4000/api/health)

To stop all containers:
```bash
docker compose down
```

---

## 4. Logins

| Rôle / Utilisateur   | Email                          | Mot de passe par défaut | Marque associée |
|----------------------|--------------------------------|-------------------------|-----------------|
| **Admin Principal**  | `admin@dashboard.local`        | `Admin123!`             | Toutes marques  |
| **Brand Okinso**     | `okinso@dashboard.local`       | `Brand123!`             | Okinso          |
| **Brand Vinillia**   | `vinillia@dashboard.local`     | `Brand123!`             | Vinillia        |
| **Brand Marjad**     | `marjad@dashboard.local`       | `Brand123!`             | Marjad          |
| **Confirmateur 1**   | `confirmer1@dashboard.local`   | `Confirmer123!`         | Multi-Marques (Okinso, Vinillia, Marjad) |

> **Note :** L'administrateur peut ensuite créer d'autres comptes confirmateurs dédiés ou multi-marques à tout moment depuis la page **🎧 Confirmateurs** en leur assignant les marques de son choix.

## 5. Fonctionnalités Multi-Canaux & Équipe de Confirmation

- **Comptes Confirmateurs Dédiés** : L'administrateur peut créer des confirmateurs et leur générer des identifiants (email & mot de passe). Les confirmateurs ont accès à leur interface pour gérer les appels, livraisons et notes.
- **Assignation des Commandes** : L'administrateur et les marques peuvent assigner chaque commande à un confirmateur spécifique via le sélecteur dans la liste des commandes.
- **Notes de Commande Partagées** : Tous les rôles (**Admin**, **Vinillia**, **Okinso**, et les **Confirmateurs**) peuvent consulter, ajouter et mettre à jour des notes détaillées sur chaque commande via le modal de note rapide (avec tags instantanés).
- **Commandes Manuelles Multi-Canaux** : Tous les rôles peuvent enregistrer manuellement des commandes provenant de **WhatsApp**, **Instagram**, **Facebook**, **Landing Page** ou **Appel Direct / Autre**, avec calcul automatique des frais de livraison et assignation immédiate.
- **🚫 Liste Noire & Détection Fraude** : Accessible à **tous les utilisateurs** dans la barre latérale pour rechercher et vérifier n'importe quel numéro de téléphone, consulter les clients détectés avec 3+ refus de colis, et protéger les marges de livraison.
- **🚚 Sociétés de Livraison (Ozon, Sendit, Cathedis...)** : Accessible dans la barre latérale pour **Admin**, **Vinillia** et **Okinso** pour gérer les agences partenaires et portails de suivi.

## 6. Link your landing pages

See **[integration/INTEGRATION.md](integration/INTEGRATION.md)** — per landing page:
copy the **brand's** API key from ⚙️ Brands & Logins, copy the **product's id**
from 🛍️ Products, paste the snippet into the order form. Orders appear instantly
in that brand's dashboard.

## Production notes

- Put MySQL behind a password, set a strong `JWT_SECRET`.
- Run with Docker: `docker compose up -d --build` or with PM2: `pm2 start src/index.js --name mediast-api`.
- Build the frontend: `npm run build && npm run start`.
- Serve both behind nginx/Caddy with HTTPS; set `API_URL` / `NEXT_PUBLIC_API_URL` to the public API domain.
- CORS is open (`cors()`) — restrict `origin` in `backend/src/index.js` to your frontend domain in production.

