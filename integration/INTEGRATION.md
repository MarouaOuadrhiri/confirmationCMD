# Linking your landing pages to the dashboard

Your project folders look like this:

```
project/
├── dashboard/     ← this dashboard
├── okinso/        ← okinso's landing pages (one per product)
└── vinillia/      ← vinillia's landing pages (one per product)
```

**One brand = one login + one API key.** All landing pages inside a brand's folder
share that brand's API key. Each landing page additionally sends its `product_id`
so the dashboard knows exactly which product the order came from.

| Brand    | Folder      | Products (landing pages)                                                        | Login                      |
|----------|-------------|---------------------------------------------------------------------------------|----------------------------|
| Okinso   | `okinso/`   | Crystal Rose, Crystal Mauve, VitaSilk, SOS Therapy, SOS Gold, SOS Rose Foncé        | `okinso@dashboard.local`   |
| Vinillia | `vinillia/` | Keratin Complex, Shampoo Cafeine                                                  | `vinillia@dashboard.local` |

Starter password for both brand logins: `Brand123!` — **change it after first login**
(admin → ⚙️ Brands & Logins → Reset password).

Admin: `admin@dashboard.local` / `Admin123!` — sees everything, can filter per brand.

## 1. Get the brand's API key

1. Log in as **admin**.
2. Open **⚙️ Brands & Logins**.
3. Click **Show** then **Copy** on the brand's API key.

## 2. Get each landing page's product id

Open **🛍️ Products** in the dashboard — the **ID** column shows each product's id.
That id goes into the landing page's snippet as `PRODUCT_ID`.

## 3. Paste the snippet into each landing page

Open `integration/landing-page-snippet.js`, copy it into the landing page (or adapt it),
and set the three constants at the top:

```js
const API_URL = 'https://your-server.com'; // where the backend runs
const API_KEY = 'PASTE_THE_BRAND_API_KEY_HERE'; // same key for all pages of this brand
const PRODUCT_ID = 3; // THIS page's product id (different per landing page)
```

### React landing page (Vite)

In your order form submit handler:

```jsx
const API_URL = 'https://your-server.com';
const API_KEY = 'PASTE_THE_BRAND_API_KEY_HERE';
const PRODUCT_ID = 8; // e.g. 8 for Shampoo Cafeine

const handleSubmit = async (e) => {
  e.preventDefault();
  // ... your validation ...
  await fetch(API_URL + '/api/public/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify({
      product_id: PRODUCT_ID,
      customer_name: nom,
      phone: telephone,
      city: wilaya,
      address: adresse,
      quantity: quantite,
      price: 199, // Selling price
      delivery_fee: 35, // 35 DH for Shampoo Cafeine (0 for all other landing pages)
    }),
  });
  // ... your success message ...
};
```

### Plain HTML landing page

See the commented example at the bottom of `landing-page-snippet.js`.

## 4. Field mapping & Delivery Policy

### 🚚 Delivery Policy (Coût de Livraison)
- **Toutes les landing pages :** Livraison 100% Gratuite (`delivery_fee = 0 DH`).
- **Exception :** `Shampoo Cafeine` (Vinillia / Product ID 8) : Prix = **199 DH**, Coût de livraison = **35 DH**, Total réglé par le client = **234 DH**.

| Landing page field | API field       | Required | Notes |
|--------------------|-----------------|----------|-------|
| —                  | `product_id`    | **yes**  | Identifie le produit / la landing page |
| nom                | `customer_name` | yes      | Nom complet du client |
| telephone          | `phone`         | yes      | Numéro WhatsApp ou Téléphone |
| wilaya / ville     | `city`          | no       | Ville de livraison |
| (address input)    | `address`       | no       | Adresse détaillée |
| quantite           | `quantity`      | no (1)   | Nombre d'unités |
| prix               | `price`         | no       | Prix unitaire (ex: 199 DH) |
| cout_livraison     | `delivery_fee`  | no       | Frais de livraison (0 par défaut, 35 pour Caféine) |
| —                  | `note`          | no       | Notes ou variante |

New orders arrive with call status **Nouveau** / shipping **En attente** and appear
instantly in that brand's dashboard (Orders page + KPIs + per-product stats).

## 5. New brand or new product later?

- **New brand** (new folder of landing pages): admin → **⚙️ Brands & Logins** → "+ New brand".
  It creates the brand, its login and its API key in one click.
- **New product** (new landing page in an existing brand): **🛍️ Products** → "+ New product",
  then paste its id into the new landing page. No new login or key needed.
