'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Shell from '../../components/Shell';
import { useApp } from '../../components/AppContext';
import { api, dh } from '../../lib/api';
import { BrandBadge, BrandIcon } from '../../components/BrandBadge';

export default function ProductsPage() {
  const { brandParam, brandId, user, refreshBrands, confirmDialog, promptDialog } = useApp();
  const [mounted, setMounted] = useState(false);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    setMounted(true);
  }, []);
  const [brands, setBrands] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [stock, setStock] = useState('100');
  const [minStockAlert, setMinStockAlert] = useState('15');
  const [brand, setBrand] = useState('');
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [integrationProduct, setIntegrationProduct] = useState(null);
  const [copiedSection, setCopiedSection] = useState('');

  // Quick Brand Modal State (Admin)
  const [showQuickBrandModal, setShowQuickBrandModal] = useState(false);
  const [quickBrandName, setQuickBrandName] = useState('');
  const [quickBrandSlug, setQuickBrandSlug] = useState('');
  const [quickBrandEmail, setQuickBrandEmail] = useState('');
  const [quickBrandPassword, setQuickBrandPassword] = useState('');
  const [creatingQuickBrand, setCreatingQuickBrand] = useState(false);

  const load = () => {
    api(`/api/products?x=1${brandParam}`)
      .then((d) => setProducts(d.products || []))
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    if (!user) return;
    load();
    if (user.role === 'admin') {
      api('/api/brands')
        .then((d) => {
          const list = d.brands || [];
          setBrands(list);
          if (!brand && brandId !== 'all') {
            setBrand(String(brandId));
          }
        })
        .catch(() => {});
    }
  }, [user, brandId]);

  useEffect(() => {
    if (user?.role === 'admin' && !editId && brandId !== 'all') {
      setBrand(String(brandId));
    }
  }, [brandId, user, editId]);

  const reset = () => {
    setName('');
    setPrice('');
    setCost('');
    setStock('100');
    setMinStockAlert('15');
    setBrand(user?.role === 'admin' && brandId !== 'all' ? String(brandId) : '');
    setEditId(null);
  };

  const createQuickBrand = async (e) => {
    if (e) e.preventDefault();
    if (!quickBrandName.trim()) {
      setError('Le nom de la marque est obligatoire.');
      return;
    }
    if (!quickBrandEmail.trim()) {
      setError("L'email de connexion de la marque est obligatoire.");
      return;
    }
    if (!quickBrandPassword || quickBrandPassword.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    setCreatingQuickBrand(true);
    setError('');
    try {
      const res = await api('/api/brands', {
        method: 'POST',
        body: {
          name: quickBrandName.trim(),
          slug: quickBrandSlug.trim() || undefined,
          login_email: quickBrandEmail.trim(),
          login_password: quickBrandPassword,
        },
      });

      const newBrand = res.brand;
      const updatedBrands = await refreshBrands();
      setBrands(updatedBrands.length ? updatedBrands : (prev) => [...prev, newBrand]);
      setBrand(String(newBrand.id));
      setSuccess(`✅ Marque "${newBrand.name}" créée et sélectionnée avec succès ! Vous pouvez maintenant créer le produit.`);
      setQuickBrandName('');
      setQuickBrandSlug('');
      setQuickBrandEmail('');
      setQuickBrandPassword('');
      setShowQuickBrandModal(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreatingQuickBrand(false);
    }
  };

  const save = async () => {
    setError('');
    setSuccess('');
    try {
      if (!name.trim()) throw new Error('Product name is required');
      if (price === '' || isNaN(Number(price))) throw new Error('Valid selling price is required');
      
      const body = { 
        name: name.trim(), 
        price: Number(price) || 0, 
        cost: Number(cost) || 0,
        stock: Number(stock) || 0,
        min_stock_alert: Number(minStockAlert) || 15,
      };

      if (user.role === 'admin') {
        if (!brand) throw new Error('Please select a Brand for this product');
        body.brand_id = Number(brand);
      }

      if (editId) {
        await api(`/api/products/${editId}`, { method: 'PUT', body });
        setSuccess(`Product "${name}" updated successfully.`);
      } else {
        const res = await api('/api/products', { method: 'POST', body });
        setSuccess(`New product "${name}" created with Product ID: ${res.product.id}`);
        // Find brand details to auto-open integration modal
        const selectedBrandObj = brands.find((b) => b.id === Number(brand)) || user.brand;
        setIntegrationProduct({
          ...res.product,
          brand_name: selectedBrandObj?.name || 'Brand',
          brand_api_key: selectedBrandObj?.api_key || user.brand?.api_key || 'YOUR_BRAND_API_KEY',
        });
      }
      reset();
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const startEdit = (p) => {
    setEditId(p.id);
    setName(p.name);
    setPrice(p.price);
    setCost(p.cost);
    setStock(String(p.stock ?? 100));
    setMinStockAlert(String(p.min_stock_alert ?? 15));
    if (user?.role === 'admin') {
      setBrand(String(p.brand_id));
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async (id, pName) => {
    if (user?.role !== 'admin') {
      setError('Action interdite. Seul le compte Administrateur peut supprimer des produits.');
      return;
    }

    const adminPassword = await promptDialog({
      title: `🔐 Suppression Sécurisée — Produit #${id}`,
      message: `Veuillez saisir votre mot de passe administrateur pour confirmer la suppression définitive du produit "${pName || id}" :`,
      detail: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
          <div><strong>🛍️ Produit :</strong> {pName} (ID: #{id})</div>
          <div style={{ color: 'var(--amber-text)', marginTop: 4 }}>
            ⚠️ L'historique des commandes liées sera conservé, mais ce produit sera retiré du catalogue.
          </div>
        </div>
      ),
      placeholder: 'Mot de passe administrateur...',
      inputType: 'password',
      confirmText: '🗑️ Confirmer la Suppression',
      cancelText: 'Annuler',
      variant: 'danger',
      icon: '🔐',
    });

    if (!adminPassword) return;
    try {
      await api(`/api/products/${id}`, { 
        method: 'DELETE',
        headers: { 'x-admin-password': adminPassword }
      });
      setSuccess(`Produit ID #${id} supprimé avec succès.`);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(label);
    setTimeout(() => setCopiedSection(''), 2500);
  };

  const filteredProducts = products.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      String(p.id).includes(q) ||
      p.brand_name?.toLowerCase().includes(q)
    );
  });

  return (
    <Shell title="🛍️ Products & Landing Pages Catalog">
      {error && <div className="error" style={{ marginBottom: 16 }}>⚠️ {error}</div>}
      {success && (
        <div className="card" style={{ borderLeft: '4px solid var(--green)', padding: '12px 18px', marginBottom: 20 }}>
          <strong style={{ color: 'var(--green-text)' }}>✅ {success}</strong>
        </div>
      )}

      {/* Add / Edit Form (Admin Only) */}
      {user?.role === 'admin' && (
        <div className="card" style={{ border: '2px solid var(--card-border)' }}>
          <div className="card-header">
            <h2>{editId ? `✏️ Edit Product (ID: ${editId})` : '➕ Add New Product'}</h2>
            <span className="badge purple">1 Product = 1 Landing Page</span>
          </div>
          <p className="muted" style={{ marginBottom: 16, fontSize: 13.5 }}>
            Fill in the product details and stock level. Once created, you will get the <strong>Product ID</strong> and code snippet to link to your landing page.
          </p>
          <div className="form-grid">
            <label className="field" style={{ gridColumn: 'span 2' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontWeight: 600 }}>Target Brand (Marque) *</span>
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() => setShowQuickBrandModal(true)}
                  title="Ajouter une nouvelle marque"
                  style={{ fontWeight: 700, borderColor: 'var(--brand)', color: 'var(--brand)', padding: '4px 10px', fontSize: 12 }}
                >
                  + Nouvelle Marque
                </button>
              </div>
              <select 
                className="input" 
                value={brand} 
                onChange={(e) => setBrand(e.target.value)}
                style={{ fontWeight: 600, borderColor: brand ? 'var(--brand)' : 'var(--input-border)', width: '100%' }}
              >
                <option value="">— Sélectionner la Marque —</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.slug})
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Product Name *
              <input 
                className="input" 
                placeholder="e.g. VitaSilk or Keratin Complex" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                required 
              />
            </label>
            <label className="field">
              Selling Price / Prix Produit (DH) *
              <input 
                type="number" 
                className="input" 
                placeholder="e.g. 199 or 299" 
                value={price} 
                onChange={(e) => setPrice(e.target.value)} 
                required 
              />
            </label>
            <label className="field">
              Unit Cost / Coût d'achat (DH)
              <input 
                type="number" 
                className="input" 
                placeholder="e.g. 80" 
                value={cost} 
                onChange={(e) => setCost(e.target.value)} 
              />
            </label>
            <label className="field">
              Stock Initial (Unités) *
              <input 
                type="number" 
                className="input" 
                placeholder="e.g. 100" 
                value={stock} 
                onChange={(e) => setStock(e.target.value)} 
                required
              />
            </label>
            <label className="field">
              Alerte Stock Faible (&le;)
              <input 
                type="number" 
                className="input" 
                placeholder="e.g. 15" 
                value={minStockAlert} 
                onChange={(e) => setMinStockAlert(e.target.value)} 
              />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button className="btn" onClick={save}>
              {editId ? '💾 Save Product Changes' : '🚀 Create Product'}
            </button>
            {editId && (
              <button className="btn ghost" onClick={reset}>
                Cancel Edit
              </button>
            )}
          </div>
        </div>
      )}

      {/* Products Table */}
      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2>🛍️ Products Catalog ({filteredProducts.length})</h2>
            <p className="muted" style={{ fontSize: 13, marginTop: 2 }}>
              Active products, pricing, stock levels, and catalog overview
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              type="search"
              className="input"
              placeholder="🔍 Search products or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: 220, padding: '8px 12px', fontSize: 13 }}
            />
            <span className="badge blue">Live Catalog</span>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product ID</th>
                <th>Product Name</th>
                {user?.role === 'admin' && <th>Brand</th>}
                <th>Prix Produit</th>
                {user?.role !== 'confirmer' && <th>Coût Achat</th>}
                {user?.role !== 'confirmer' && <th>Margin / Unité</th>}
                <th>Stock</th>
                {user?.role === 'admin' && <th>Landing Integration</th>}
                {user?.role === 'admin' && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((p) => {
                const pPrice = Number(p.price || 0);
                const margin = pPrice - Number(p.cost);
                const marginPct = pPrice > 0 ? ((margin / pPrice) * 100).toFixed(0) : 0;
                const stockQty = Number(p.stock || 0);
                const alertLimit = Number(p.min_stock_alert || 15);

                return (
                  <tr key={p.id}>
                    <td>
                      <span className="apikey" style={{ fontWeight: 800, color: 'var(--brand)' }}>
                        ID #{p.id}
                      </span>
                    </td>
                    <td>
                      <strong style={{ fontSize: 14.5 }}>{p.name}</strong>
                    </td>
                    {user?.role === 'admin' && (
                      <td>
                        <BrandBadge brand={p.brand_name} size="sm" />
                      </td>
                    )}
                    <td><strong style={{ color: 'var(--green-text)' }}>{dh(pPrice)}</strong></td>
                    {user?.role !== 'confirmer' && <td className="muted">{dh(p.cost)}</td>}
                    {user?.role !== 'confirmer' && (
                      <td>
                        <span className={`badge ${margin >= 0 ? 'green' : 'red'}`}>
                          {dh(margin)} ({marginPct}%)
                        </span>
                      </td>
                    )}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <strong style={{ color: stockQty === 0 ? 'var(--red)' : stockQty <= alertLimit ? '#f59e0b' : 'inherit' }}>
                          {stockQty}
                        </strong>
                        {stockQty === 0 ? (
                          <span className="badge red" style={{ fontSize: 10, padding: '1px 5px' }}>Rupture</span>
                        ) : stockQty <= alertLimit ? (
                          <span className="badge amber" style={{ fontSize: 10, padding: '1px 5px' }}>Faible</span>
                        ) : null}
                      </div>
                    </td>
                    {user?.role === 'admin' && (
                      <td>
                        <button
                          className="btn ghost small"
                          style={{ color: 'var(--brand)', borderColor: 'var(--brand)', fontWeight: 600 }}
                          onClick={() => setIntegrationProduct(p)}
                          title="View snippet to link this product with landing page"
                        >
                          🔗 How to Link
                        </button>
                      </td>
                    )}
                    {user?.role === 'admin' && (
                      <td>
                        <div className="row-actions">
                          <button className="btn ghost small" onClick={() => startEdit(p)} title="Edit product">
                            ✏️ Edit
                          </button>
                          <button className="btn danger small" onClick={() => remove(p.id, p.name)} title="Delete product (Admin only)">
                            ✕
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {!filteredProducts.length && (
                <tr>
                  <td colSpan={user?.role === 'admin' ? 9 : (user?.role === 'confirmer' ? 4 : 6)} className="muted" style={{ textAlign: 'center', padding: 32 }}>
                    No products found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: How to Link Landing Page */}
      {mounted && typeof document !== 'undefined' && integrationProduct && createPortal(
        <div className="modal-overlay" onClick={() => setIntegrationProduct(null)}>
          <div className="modal-container" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 18, margin: 0 }}>
                  🔗 Link "{integrationProduct.name}" (ID #{integrationProduct.id}) to Landing Page
                </h2>
                <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                  <span className="badge brand">
                    Brand: {integrationProduct.brand_name || 'Brand Workspace'}
                  </span>
                  <span className="badge green">
                    Prix Produit: {dh(integrationProduct.price)}
                  </span>
                </div>
              </div>
              <button 
                className="btn ghost small" 
                onClick={() => setIntegrationProduct(null)}
                style={{ fontSize: 18, padding: '4px 10px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              
              {/* Step 1: .env */}
              <div style={{ background: 'var(--bg, #f8fafc)', padding: 16, borderRadius: 8, border: '1px solid var(--card-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <strong>1️⃣ Add to your landing page <code>.env</code> file:</strong>
                  <button 
                    className="btn ghost small"
                    onClick={() => copyToClipboard(`VITE_DASHBOARD_API_URL=http://localhost:4000\nVITE_STORE_API_KEY=${integrationProduct.brand_api_key || 'YOUR_API_KEY'}`, 'env')}
                  >
                    {copiedSection === 'env' ? '✅ Copied!' : '📋 Copy .env'}
                  </button>
                </div>
                <pre style={{ margin: 0, padding: 12, background: '#1e293b', color: '#f8fafc', borderRadius: 6, fontSize: 13, overflowX: 'auto' }}>
{`VITE_DASHBOARD_API_URL=http://localhost:4000
VITE_STORE_API_KEY=${integrationProduct.brand_api_key || 'YOUR_API_KEY'}`}
                </pre>
              </div>

              {/* Step 2: Form Submit Code */}
              <div style={{ background: 'var(--bg, #f8fafc)', padding: 16, borderRadius: 8, border: '1px solid var(--card-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <strong>2️⃣ Submit Order Code (React / Vite / Next.js):</strong>
                  <button 
                    className="btn ghost small"
                    onClick={() => copyToClipboard(`const handleSubmit = async (e) => {
  e.preventDefault();
  
  const response = await fetch(\`\${import.meta.env.VITE_DASHBOARD_API_URL || 'http://localhost:4000'}/api/public/orders\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': import.meta.env.VITE_STORE_API_KEY,
    },
    body: JSON.stringify({
      product_id: ${integrationProduct.id}, // ID for ${integrationProduct.name}
      product_name: '${integrationProduct.name}',
      customer_name: formData.fullName,
      phone: formData.phone,
      city: formData.city,
      address: formData.address || '',
      quantity: formData.quantity || 1,
      price: ${integrationProduct.price || 0},
      delivery_fee: formData.deliveryFee || 0, // Frais selon la ville du client (0 si gratuit)
      note: 'Source: Landing Page',
    }),
  });

  if (response.ok) {
    const data = await response.json();
    console.log('Order created:', data.order_id);
  }
};`, 'code')}
                  >
                    {copiedSection === 'code' ? '✅ Copied!' : '📋 Copy Code'}
                  </button>
                </div>
                <pre style={{ margin: 0, padding: 12, background: '#1e293b', color: '#f8fafc', borderRadius: 6, fontSize: 12.5, overflowX: 'auto', lineHeight: 1.5 }}>
{`const handleSubmit = async (e) => {
  e.preventDefault();

  await fetch(\`\${import.meta.env.VITE_DASHBOARD_API_URL || 'http://localhost:4000'}/api/public/orders\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': import.meta.env.VITE_STORE_API_KEY,
    },
    body: JSON.stringify({
      product_id: ${integrationProduct.id}, // 👈 ID pour ${integrationProduct.name}
      product_name: '${integrationProduct.name}',
      customer_name: formData.fullName,
      phone: formData.phone,
      city: formData.city,
      address: formData.address || '',
      quantity: 1,
      price: ${integrationProduct.price || 0},
      delivery_fee: formData.deliveryFee || 0, // Frais de livraison calculés par ville / promo (0 si gratuit)
      note: 'Source: Landing Page ${integrationProduct.name}',
    }),
  });
};`}
                </pre>
              </div>

              {/* Summary Points */}
              <div style={{ fontSize: 13, color: 'var(--muted, #64748b)', lineHeight: 1.6 }}>
                💡 <strong>Frais de Livraison :</strong> Chaque commande envoyée depuis la landing page ou saisie manuellement contient ses propres frais de livraison selon la ville du client (ou 0 DH si gratuit).
              </div>

            </div>

            <div style={{ marginTop: 20, textAlign: 'right' }}>
              <button className="btn brand" onClick={() => setIntegrationProduct(null)}>
                Got it / Fermer
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Quick Add Brand Modal for Admin */}
      {mounted && typeof document !== 'undefined' && showQuickBrandModal && createPortal(
        <div className="modal-overlay" onClick={() => setShowQuickBrandModal(false)}>
          <div className="modal-container" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--brand-light)', border: '1px solid var(--brand-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                  🏷️
                </div>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--ink)' }}>
                    Ajouter une Nouvelle Marque (Boutique)
                  </h3>
                  <p className="muted" style={{ fontSize: 12.5, margin: '2px 0 0 0' }}>
                    Créez la marque pour lui associer immédiatement ce produit.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickBrandModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--ink-muted)', fontSize: 18, cursor: 'pointer', padding: 4 }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={createQuickBrand}>
              <div className="form-grid" style={{ marginBottom: 18 }}>
                <label className="field" style={{ gridColumn: 'span 2' }}>
                  Nom de la Marque *
                  <input
                    className="input"
                    placeholder="ex: Atlas Studio, Lumera, VitaSilk..."
                    value={quickBrandName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setQuickBrandName(val);
                      if (!quickBrandSlug || quickBrandSlug === quickBrandName.toLowerCase().replace(/[^a-z0-9]+/g, '-')) {
                        setQuickBrandSlug(val.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''));
                      }
                    }}
                    required
                    autoFocus
                  />
                </label>

                <label className="field" style={{ gridColumn: 'span 2' }}>
                  Slug / Identifiant URL
                  <input
                    className="input"
                    placeholder="ex: atlas-studio"
                    value={quickBrandSlug}
                    onChange={(e) => setQuickBrandSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}
                  />
                </label>

                <label className="field">
                  Email de Connexion *
                  <input
                    type="email"
                    className="input"
                    placeholder="ex: contact@atlas-studio.ma"
                    value={quickBrandEmail}
                    onChange={(e) => setQuickBrandEmail(e.target.value)}
                    required
                  />
                </label>

                <label className="field">
                  Mot de Passe *
                  <input
                    type="password"
                    className="input"
                    placeholder="Min. 6 caractères"
                    value={quickBrandPassword}
                    onChange={(e) => setQuickBrandPassword(e.target.value)}
                    required
                  />
                </label>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid var(--card-border)' }}>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setShowQuickBrandModal(false)}
                  disabled={creatingQuickBrand}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn brand"
                  disabled={creatingQuickBrand}
                  style={{ fontWeight: 700 }}
                >
                  {creatingQuickBrand ? 'Création en cours…' : '🚀 Créer & Sélectionner la Marque'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </Shell>
  );
}

