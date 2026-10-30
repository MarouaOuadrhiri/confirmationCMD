/**
 * Mediast — landing page integration snippet (vanilla JS)
 * ------------------------------------------------------------------
 * One API key per BRAND (not per landing page):
 *   - every landing page inside okinso/    uses the OKINSO api key
 *   - every landing page inside vinillia/  uses the VINILLIA api key
 * Each landing page passes its own product_id so the dashboard knows
 * exactly which product / landing page the order came from.
 * (Find the product id in the dashboard: Products page, "ID" column.)
 *
 * ⚠️ LIVRAISON POLICY:
 * - All landing pages have free shipping (0 DH) except:
 * - Shampoo Cafeine (Vinillia / Product ID 8): Prix 199 DH + Coût de livraison 35 DH (Total = 234 DH).
 *
 * 1) Set API_URL and API_KEY below (the key of THIS page's brand).
 * 2) Set PRODUCT_ID to this landing page's product id.
 * 3) Call sendOrderToDashboard(order) on form submit.
 *
 * order = {
 *   customer_name:'...',  // required
 *   phone:      '...',    // required
 *   city:       '...',    // optional
 *   address:    '...',    // optional
 *   quantity:   1,       // optional, default 1
 *   price:      199,     // optional (auto-retrieved from product)
 *   delivery_fee: 35,    // optional (0 for free delivery, 35 for Shampoo Cafeine)
 *   note:       '...',   // optional
 * }
 */
const API_URL = 'http://localhost:4000'; // <-- your server URL in production
const API_KEY = 'PASTE_BRAND_API_KEY_HERE'; // <-- from dashboard: Brands & Logins
const PRODUCT_ID = 1; // <-- this landing page's product id (dashboard → Products)

async function sendOrderToDashboard(order) {
  const res = await fetch(API_URL + '/api/public/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify({ product_id: PRODUCT_ID, ...order }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Order failed');
  return data; // { ok: true, order_id }
}

/* ---- example: hook it to a plain HTML form ----
document.getElementById('order-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await sendOrderToDashboard({
      customer_name: document.getElementById('nom').value,
      phone: document.getElementById('telephone').value,
      city: document.getElementById('wilaya').value,
      quantity: Number(document.getElementById('quantite').value) || 1,
    });
    alert('شكراً! تم استلام طلبك بنجاح');
    e.target.reset();
  } catch (err) {
    alert('Error: ' + err.message);
  }
});
*/

/* ---- optional: fetch this brand's products (ids, names, prices, delivery_fees) ----
async function loadBrandProducts() {
  const res = await fetch(API_URL + '/api/public/products?api_key=' + API_KEY);
  const data = await res.json();
  return data.products; // [{ id, name, price, delivery_fee }]
}
*/
