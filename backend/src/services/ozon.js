/**
 * Ozon Express Shipping API Integration
 * Endpoint: https://api.ozonexpress.ma/customers/{YOUR_ID}/{YOUR_API_KEY}/add-parcel
 */

const DEFAULT_CUSTOMER_ID = '97465';
const DEFAULT_API_KEY = 'd8a679-4b84fc-87738c-f5a1d1-f4aef6';
const DEFAULT_API_BASE = 'https://api.ozonexpress.ma';

/**
 * Checks if the given shipping company name corresponds to Ozon Express
 * @param {string} companyName
 * @returns {boolean}
 */
function isOzonCompany(companyName) {
  if (!companyName) return false;
  const norm = String(companyName).trim().toLowerCase();
  return norm.includes('ozon');
}

/**
 * Dispatches an order to Ozon Express add-parcel API
 * @param {Object} order - Full order database row
 * @returns {Promise<{success: boolean, tracking?: string, message?: string, error?: string, raw?: any}>}
 */
async function addParcelToOzon(order) {
  const customerId = process.env.OZON_CUSTOMER_ID || DEFAULT_CUSTOMER_ID;
  const apiKey = process.env.OZON_API_KEY || DEFAULT_API_KEY;
  const baseUrl = (process.env.OZON_API_BASE || DEFAULT_API_BASE).replace(/\/+$/, '');

  const endpoint = `${baseUrl}/customers/${customerId}/${apiKey}/add-parcel`;

  const totalAmount = Number(order.price || 0) + Number(order.delivery_fee || 0);
  const cleanPhone = String(order.phone || '').trim();
  const cleanCity = String(order.city || 'Casablanca').trim();
  const cleanAddress = String(order.address || cleanCity || 'Maroc').trim();
  const cleanRecipient = String(order.customer_name || 'Client').trim();
  const cleanProduct = `${order.product_name || 'Produit'} (Qté: ${order.quantity || 1})`;
  const orderRef = `ORD-${order.id}`;

  const payload = {
    tracking: order.tracking_number || `${orderRef}-${Date.now().toString().slice(-4)}`,
    ref: orderRef,
    reference: orderRef,
    destinataire: cleanRecipient,
    recipient: cleanRecipient,
    telephone: cleanPhone,
    phone: cleanPhone,
    adresse: cleanAddress,
    address: cleanAddress,
    ville: cleanCity,
    city: cleanCity,
    prix: totalAmount,
    price: totalAmount,
    marchandise: cleanProduct,
    product: cleanProduct,
    quantite: Number(order.quantity || 1),
    quantity: Number(order.quantity || 1),
    commentaire: order.note || '',
    note: order.note || '',
    change: 0,
    ouvrir: 0,
  };

  console.log(`[Ozon Express API] Connecting to ${endpoint} for Order #${order.id}...`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 seconds timeout

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { rawText: text };
    }

    if (!response.ok) {
      console.error(`[Ozon Express API Error] HTTP ${response.status}:`, data);
      return {
        success: false,
        error: data.message || data.error || `HTTP ${response.status}`,
        raw: data,
      };
    }

    // Extract tracking code if returned by Ozon Express
    const extractedTracking =
      data.tracking ||
      data.tracking_number ||
      data.code_suivi ||
      data.barcode ||
      data.parcel_id ||
      data.data?.tracking ||
      data.data?.tracking_number ||
      data.data?.code_suivi ||
      payload.tracking;

    console.log(`[Ozon Express API] Order #${order.id} sent successfully. Tracking: ${extractedTracking}`);

    return {
      success: true,
      tracking: String(extractedTracking).trim(),
      message: data.message || 'Parcel added successfully to Ozon Express',
      raw: data,
    };
  } catch (err) {
    console.error(`[Ozon Express API Error] Order #${order.id}:`, err.message);
    return {
      success: false,
      error: err.message,
    };
  }
}

module.exports = {
  addParcelToOzon,
  isOzonCompany,
  DEFAULT_CUSTOMER_ID,
  DEFAULT_API_KEY,
  DEFAULT_API_BASE,
};
