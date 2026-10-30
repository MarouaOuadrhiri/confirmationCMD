'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Shell from '../../components/Shell';
import { useApp } from '../../components/AppContext';
import { api } from '../../lib/api';
import { BrandIcon, BrandBadge } from '../../components/BrandBadge';

export default function SettingsPage() {
  const router = useRouter();
  const { user, setBrandId, refreshBrands, confirmDialog, promptDialog } = useApp();
  const [brands, setBrands] = useState([]);
  const [companies, setCompanies] = useState([]);
  
  // Brand Management State
  const [showAddBrand, setShowAddBrand] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [newBrandSlug, setNewBrandSlug] = useState('');
  const [newBrandEmail, setNewBrandEmail] = useState('');
  const [newBrandPassword, setNewBrandPassword] = useState('');
  const [addingBrand, setAddingBrand] = useState(false);

  const [newCompName, setNewCompName] = useState('');
  const [newCompPhone, setNewCompPhone] = useState('');
  const [newCompUrl, setNewCompUrl] = useState('');
  const [addingComp, setAddingComp] = useState(false);

  // Blacklist Management State
  const [manualBlacklist, setManualBlacklist] = useState([]);
  const [autoBlacklist, setAutoBlacklist] = useState([]);
  const [newBlPhone, setNewBlPhone] = useState('');
  const [newBlName, setNewBlName] = useState('');
  const [newBlReason, setNewBlReason] = useState('');
  const [addingBl, setAddingBl] = useState(false);

  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [shownKeys, setShownKeys] = useState({});

  useEffect(() => {
    if (user && user.role !== 'admin') router.replace('/dashboard');
  }, [user, router]);

  const load = () => {
    api('/api/brands')
      .then((d) => setBrands(d.brands || []))
      .catch((e) => setError(e.message));
    api('/api/shipping-companies')
      .then((d) => setCompanies(d.companies || []))
      .catch(() => {});
    api('/api/blacklist')
      .then((d) => {
        setManualBlacklist(d.manual_blacklist || []);
        setAutoBlacklist(d.auto_blacklisted || []);
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (user?.role === 'admin') load();
  }, [user]);

  const addBrand = async (e) => {
    if (e) e.preventDefault();
    if (!newBrandName.trim()) {
      setError('Le nom de la marque est obligatoire.');
      return;
    }
    if (!newBrandEmail.trim()) {
      setError("L'email de connexion pour le compte de la marque est obligatoire.");
      return;
    }
    if (!newBrandPassword || newBrandPassword.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    setAddingBrand(true);
    setError('');
    setMsg('');
    try {
      const res = await api('/api/brands', {
        method: 'POST',
        body: {
          name: newBrandName.trim(),
          slug: newBrandSlug.trim() || undefined,
          login_email: newBrandEmail.trim(),
          login_password: newBrandPassword,
        },
      });
      setMsg(`✅ Marque "${res.brand?.name}" créée avec succès ! Clé API d'intégration générée: ${res.brand?.api_key}`);
      setNewBrandName('');
      setNewBrandSlug('');
      setNewBrandEmail('');
      setNewBrandPassword('');
      setShowAddBrand(false);
      load();
      if (refreshBrands) refreshBrands();
    } catch (err) {
      setError(err.message);
    } finally {
      setAddingBrand(false);
    }
  };

  const deleteBrand = async (b) => {
    const adminPassword = await promptDialog({
      title: '🔐 Suppression Définitive de Marque',
      message: `Veuillez saisir votre mot de passe administrateur pour supprimer la marque "${b.name}" (ID: #${b.id}) :`,
      detail: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#f87171' }}>
          <div>⚠️ <strong>Attention :</strong></div>
          <div>Cette action supprimera également le compte utilisateur associé (${b.login_email || b.name}) et désactivera sa clé API d'intégration.</div>
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
      await api(`/api/brands/${b.id}`, {
        method: 'DELETE',
        headers: { 'x-admin-password': adminPassword },
      });
      setMsg(`🗑️ Marque "${b.name}" supprimée avec succès.`);
      load();
      if (refreshBrands) refreshBrands();
    } catch (e) {
      setError(e.message);
    }
  };

  const addCompany = async () => {
    if (!newCompName.trim()) {
      setError('Le nom de la société de livraison est requis.');
      return;
    }
    setAddingComp(true);
    setError('');
    setMsg('');
    try {
      await api('/api/shipping-companies', {
        method: 'POST',
        body: {
          name: newCompName.trim(),
          phone: newCompPhone ? newCompPhone.trim() : null,
          tracking_url_template: newCompUrl ? newCompUrl.trim() : null,
        }
      });
      setMsg(`🚚 Société de livraison "${newCompName}" ajoutée avec succès.`);
      setNewCompName('');
      setNewCompPhone('');
      setNewCompUrl('');
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setAddingComp(false);
    }
  };

  const deleteCompany = async (c) => {
    const adminPassword = await promptDialog({
      title: '🔐 Suppression Société de Livraison',
      message: `Veuillez saisir votre mot de passe administrateur pour supprimer "${c.name}" :`,
      detail: (
        <div style={{ fontSize: 13 }}>
          <span>⚠️ Les commandes déjà expédiées avec cette société conserveront leur historique.</span>
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
      await api(`/api/shipping-companies/${c.id}`, {
        method: 'DELETE',
        headers: { 'x-admin-password': adminPassword }
      });
      setMsg(`🚚 Société "${c.name}" supprimée avec succès.`);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const addBlacklistEntry = async () => {
    if (!newBlPhone.trim()) {
      setError('Le numéro de téléphone est obligatoire.');
      return;
    }
    setAddingBl(true);
    setError('');
    setMsg('');
    try {
      await api('/api/blacklist', {
        method: 'POST',
        body: {
          phone: newBlPhone.trim(),
          customer_name: newBlName.trim() || null,
          reason: newBlReason.trim() || 'Ajouté manuellement par administrateur',
        }
      });
      setMsg(`🚫 Numéro "${newBlPhone}" ajouté à la Liste Noire avec succès.`);
      setNewBlPhone('');
      setNewBlName('');
      setNewBlReason('');
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setAddingBl(false);
    }
  };

  const removeBlacklistEntry = async (item) => {
    const phone = item.phone;
    const adminPassword = await promptDialog({
      title: '🔓 Débloquer de la Liste Noire',
      message: `Veuillez saisir votre mot de passe administrateur pour débloquer "${phone}" (${item.customer_name || 'Client'}) :`,
      placeholder: 'Mot de passe administrateur...',
      inputType: 'password',
      confirmText: '🔓 Débloquer le Numéro',
      cancelText: 'Annuler',
      variant: 'prompt',
      icon: '🔓',
    });

    if (!adminPassword) return;
    try {
      await api(`/api/blacklist/${encodeURIComponent(phone)}`, {
        method: 'DELETE',
        headers: { 'x-admin-password': adminPassword }
      });
      setMsg(`🔓 Numéro "${phone}" débloqué de la Liste Noire.`);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const regenKey = async (id, brandName) => {
    const ok = await confirmDialog({
      title: 'Regenerate API Key',
      message: `Are you sure you want to regenerate the API key for "${brandName || 'this brand'}"?`,
      detail: (
        <div>
          <span>⚠️ Any active landing page configured with the previous key will stop transmitting orders until updated with the new key.</span>
        </div>
      ),
      confirmText: '🔄 Yes, Regenerate Key',
      cancelText: 'Cancel',
      variant: 'warning',
      icon: '🔑',
    });

    if (!ok) return;
    try {
      const d = await api(`/api/brands/${id}/regenerate-key`, { method: 'POST' });
      setMsg(`🔑 New API key generated: ${d.api_key} — make sure to update your landing page .env files.`);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const resetPw = async (id, loginEmail) => {
    const newPassword = await promptDialog({
      title: 'Reset Brand Password',
      message: `Set a new secure password for account:`,
      placeholder: 'Enter new password (min. 6 characters)',
      inputType: 'password',
      confirmText: '🔐 Update Password',
      cancelText: 'Cancel',
      variant: 'prompt',
      icon: '🔐',
    });

    if (!newPassword || !newPassword.trim()) return;
    try {
      await api(`/api/brands/${id}/reset-password`, { method: 'POST', body: { password: newPassword.trim() } });
      setMsg(`🔐 Password updated successfully for ${loginEmail}.`);
    } catch (e) {
      setError(e.message);
    }
  };

  const copy = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setMsg('📋 API key copied to clipboard!');
      setTimeout(() => setMsg(''), 3000);
    });
  };

  const mask = (key) => (key ? key.slice(0, 8) + '••••••••••••••••' + key.slice(-6) : '—');

  return (
    <Shell title="⚙️ Configuration Globale">
      {error && <div className="error">{error}</div>}
      {msg && (
        <div className="card" style={{ borderLeft: '4px solid var(--brand)', padding: '14px 20px', marginBottom: 20 }}>
          <strong style={{ color: 'var(--brand)' }}>{msg}</strong>
        </div>
      )}

      {/* Brands Table */}
      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2>🏷️ Registered Brands ({brands.length})</h2>
            <p className="muted" style={{ fontSize: 13, marginTop: 3 }}>
              API Keys, accès administrateur et identifiants pour connecter vos landing pages et boutiques
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              className="btn brand"
              style={{ fontWeight: 700 }}
              onClick={() => setShowAddBrand((prev) => !prev)}
            >
              {showAddBrand ? '✕ Fermer' : '➕ Ajouter une Marque (Boutique)'}
            </button>
            <span className="badge green">Active Workspaces</span>
          </div>
        </div>

        {/* Add Brand Form */}
        {showAddBrand && (
          <form onSubmit={addBrand} style={{ background: 'var(--bg-secondary)', padding: '18px 20px', borderRadius: 'var(--radius-md)', marginBottom: 20, border: '1.5px solid var(--brand-border)', animation: 'modalPopIn 0.2s ease forwards' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <strong style={{ fontSize: 14, color: 'var(--ink)' }}>➕ Créer une Nouvelle Marque (Boutique Multi-Canaux)</strong>
                <p className="muted" style={{ fontSize: 12.5, margin: '2px 0 0 0' }}>
                  Une clé API unique sera générée automatiquement pour lier les landing pages et formulaires de cette marque.
                </p>
              </div>
              <button
                type="button"
                className="btn ghost small"
                onClick={() => setShowAddBrand(false)}
                title="Fermer le formulaire"
              >
                ✕
              </button>
            </div>

            <div className="form-grid" style={{ marginBottom: 14 }}>
              <label className="field">
                Nom de la Marque *
                <input
                  className="input"
                  placeholder="ex: Atlas Studio, Lumera, VitaSilk..."
                  value={newBrandName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewBrandName(val);
                    if (!newBrandSlug || newBrandSlug === newBrandName.toLowerCase().replace(/[^a-z0-9]+/g, '-')) {
                      setNewBrandSlug(val.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''));
                    }
                  }}
                  required
                />
              </label>

              <label className="field">
                Slug / Identifiant URL
                <input
                  className="input"
                  placeholder="ex: atlas-studio"
                  value={newBrandSlug}
                  onChange={(e) => setNewBrandSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}
                />
              </label>

              <label className="field">
                Email de Connexion pour la Marque *
                <input
                  type="email"
                  className="input"
                  placeholder="ex: contact@atlas-studio.ma ou atlas-studio@dashboard.local"
                  value={newBrandEmail}
                  onChange={(e) => setNewBrandEmail(e.target.value)}
                  required
                />
              </label>

              <label className="field">
                Mot de Passe de Connexion *
                <input
                  type="password"
                  className="input"
                  placeholder="Min. 6 caractères (ex: Brand123!)"
                  value={newBrandPassword}
                  onChange={(e) => setNewBrandPassword(e.target.value)}
                  required
                />
              </label>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setShowAddBrand(false)}
                disabled={addingBrand}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="btn brand"
                disabled={addingBrand}
                style={{ fontWeight: 700, padding: '10px 22px' }}
              >
                {addingBrand ? 'Création en cours…' : '🚀 Créer la Marque & Générer Clé API'}
              </button>
            </div>
          </form>
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Brand</th>
                <th>Products</th>
                <th>Orders</th>
                <th>Login Email</th>
                <th>Integration API Key</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {brands.map((b) => (
                <tr key={b.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className="brand-icon-box" style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-md)', padding: 3 }}>
                        <BrandIcon brand={b.name} size={24} />
                      </div>
                      <div>
                        <strong style={{ fontSize: 14 }}>{b.name}</strong>
                        <br />
                        <span className="muted" style={{ fontSize: 11.5 }}>slug: /{b.slug}</span>
                      </div>
                    </div>
                  </td>
                  <td><span className="badge purple">{b.products_count || 0} products</span></td>
                  <td><span className="badge blue">{b.orders_count || 0} orders</span></td>
                  <td><strong>{b.login_email || <span className="muted">—</span>}</strong></td>
                  <td>
                    <div className="copy-row">
                      <span className="apikey">{shownKeys[b.id] ? b.api_key : mask(b.api_key)}</span>
                      <button
                        className="btn ghost small"
                        onClick={() => setShownKeys((m) => ({ ...m, [b.id]: !m[b.id] }))}
                      >
                        {shownKeys[b.id] ? '🙈 Hide' : '👁️ Show'}
                      </button>
                      <button className="btn ghost small" onClick={() => copy(b.api_key)}>
                        📋 Copy Key
                      </button>
                    </div>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="btn ghost small"
                        style={{ color: 'var(--brand)', borderColor: 'var(--brand)', fontWeight: 700 }}
                        title="Ajouter un produit pour cette marque"
                        onClick={() => {
                          setBrandId(String(b.id));
                          router.push('/products');
                        }}
                      >
                        ➕ Add Product
                      </button>
                      <button className="btn ghost small" title="Regenerate API Key" onClick={() => regenKey(b.id, b.name)}>
                        🔄 New Key
                      </button>
                      <button className="btn ghost small" title="Reset Password" onClick={() => resetPw(b.id, b.login_email)}>
                        🔐 Password
                      </button>
                      <button
                        className="btn danger small"
                        title="Supprimer cette marque"
                        onClick={() => deleteBrand(b)}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!brands.length && (
                <tr>
                  <td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 28 }}>
                    Aucune marque enregistrée. Cliquez sur "Ajouter une Marque" pour commencer.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Blacklist / Anti-Fraud Management Section */}
      <div className="card" style={{ marginTop: 24, border: '1.5px solid rgba(239, 68, 68, 0.35)' }}>
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2 style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🚫</span>
              <span>Gestion de la Liste Noire & Anti-Fraude ({manualBlacklist.length + autoBlacklist.length})</span>
            </h2>
            <p className="muted" style={{ fontSize: 13, marginTop: 3 }}>
              Clients détectés avec 3+ colis refusés/retournés ou bloqués manuellement pour éviter des frais de livraison perdus.
            </p>
          </div>
          <span className="badge red">Protection Colis & COD</span>
        </div>

        {/* Manual Add to Blacklist Form */}
        <div style={{ background: 'var(--bg-secondary)', padding: '16px 20px', borderRadius: 'var(--radius-md)', marginBottom: 20, border: '1px solid var(--card-border)' }}>
          <strong style={{ fontSize: 14, display: 'block', marginBottom: 12 }}>➕ Bloquer un Nouveau Numéro Manuellement</strong>
          <div className="form-grid" style={{ marginBottom: 12 }}>
            <label className="field">
              Numéro de Téléphone *
              <input
                className="input"
                placeholder="ex: 0661000000"
                value={newBlPhone}
                onChange={(e) => setNewBlPhone(e.target.value)}
                required
              />
            </label>
            <label className="field">
              Nom du Client (Optionnel)
              <input
                className="input"
                placeholder="ex: Fouad Alami"
                value={newBlName}
                onChange={(e) => setNewBlName(e.target.value)}
              />
            </label>
            <label className="field">
              Motif de Blocage
              <input
                className="input"
                placeholder="ex: Refus systématique, faux numéro, pas sérieux..."
                value={newBlReason}
                onChange={(e) => setNewBlReason(e.target.value)}
              />
            </label>
          </div>
          <button className="btn danger" onClick={addBlacklistEntry} disabled={addingBl}>
            {addingBl ? 'Blocage en cours…' : '🚫 Ajouter à la Liste Noire'}
          </button>
        </div>

        {/* 1. Auto-detected Blacklist Table (3+ returns/refusals in DB) */}
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🤖</span>
            <span>Clients Détectés Automatiquement (3+ Refus / Retours) ({autoBlacklist.length})</span>
          </h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Téléphone</th>
                  <th>Client</th>
                  <th>Ville</th>
                  <th>Colis Refusés / Retournés</th>
                  <th>Colis Livrés</th>
                  <th>Total Commandes</th>
                  <th>Dernière Commande</th>
                </tr>
              </thead>
              <tbody>
                {autoBlacklist.map((c, i) => (
                  <tr key={i}>
                    <td>
                      <strong style={{ color: '#ef4444' }}>📞 {c.phone}</strong>
                    </td>
                    <td><strong>{c.customer_name || '—'}</strong></td>
                    <td>{c.city || '—'}</td>
                    <td>
                      <span className="badge red" style={{ fontWeight: 700, fontSize: 12 }}>
                        ❌ {c.refusal_count} refus / retours
                      </span>
                    </td>
                    <td>
                      <span className="badge green" style={{ fontSize: 12 }}>
                        ✅ {c.delivered_count} livrés
                      </span>
                    </td>
                    <td><span className="badge blue">{c.total_orders} commandes</span></td>
                    <td className="muted" style={{ fontSize: 12 }}>
                      {c.last_order_date ? new Date(c.last_order_date).toLocaleDateString('fr-FR') : '—'}
                    </td>
                  </tr>
                ))}
                {!autoBlacklist.length && (
                  <tr>
                    <td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 20 }}>
                      Aucun client avec 3 retours ou plus détecté pour l'instant.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 2. Manual Blacklist Table */}
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>📝</span>
            <span>Numéros Bloqués Manuellement ({manualBlacklist.length})</span>
          </h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Téléphone</th>
                  <th>Client</th>
                  <th>Motif</th>
                  <th>Bloqué par</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {manualBlacklist.map((item) => (
                  <tr key={item.id}>
                    <td><strong style={{ color: '#ef4444' }}>📞 {item.phone}</strong></td>
                    <td><strong>{item.customer_name || '—'}</strong></td>
                    <td><span className="muted">{item.reason || 'Bloqué manuellement'}</span></td>
                    <td><span className="badge purple">{item.created_by || 'admin'}</span></td>
                    <td className="muted" style={{ fontSize: 12 }}>
                      {item.created_at ? new Date(item.created_at).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td>
                      <button
                        className="btn ghost small"
                        onClick={() => removeBlacklistEntry(item)}
                        title="Débloquer ce numéro"
                      >
                        🔓 Débloquer
                      </button>
                    </td>
                  </tr>
                ))}
                {!manualBlacklist.length && (
                  <tr>
                    <td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 20 }}>
                      Aucun numéro bloqué manuellement.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Shipping Companies (Agences de Livraison) Section */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2>🚚 Sociétés de Livraison ({companies.length})</h2>
            <p className="muted" style={{ fontSize: 13, marginTop: 3 }}>
              Agences de livraison disponibles lors de la confirmation d'une commande (Ozon, Sendit, Cathedis...)
            </p>
          </div>
          <span className="badge purple">Logistique & Expédition</span>
        </div>

        {/* Add Company Form */}
        <div style={{ background: 'var(--bg-secondary)', padding: '16px 20px', borderRadius: 'var(--radius-md)', marginBottom: 20, border: '1px solid var(--card-border)' }}>
          <strong style={{ fontSize: 14, display: 'block', marginBottom: 12 }}>➕ Ajouter une Nouvelle Société de Livraison</strong>
          <div className="form-grid" style={{ marginBottom: 12 }}>
            <label className="field">
              Nom de la Société *
              <input
                className="input"
                placeholder="ex: Ozon Express / Sendit / Cathedis"
                value={newCompName}
                onChange={(e) => setNewCompName(e.target.value)}
                required
              />
            </label>
            <label className="field">
              Téléphone / Contact
              <input
                className="input"
                placeholder="ex: 0522000000"
                value={newCompPhone}
                onChange={(e) => setNewCompPhone(e.target.value)}
              />
            </label>
            <label className="field">
              Lien de suivi (Template URL)
              <input
                className="input"
                placeholder="ex: https://tracking.ozon.ma/track?code="
                value={newCompUrl}
                onChange={(e) => setNewCompUrl(e.target.value)}
              />
            </label>
          </div>
          <button className="btn" onClick={addCompany} disabled={addingComp}>
            {addingComp ? 'Ajout en cours…' : '🚀 Enregistrer la Société'}
          </button>
        </div>

        {/* Companies Table */}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Société</th>
                <th>Téléphone</th>
                <th>Lien de Suivi</th>
                <th>Statut</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="brand-icon-box" style={{ width: 34, height: 34, fontSize: 16 }}>
                        🚚
                      </div>
                      <div>
                        <strong style={{ fontSize: 14 }}>{c.name}</strong>
                        <span className="muted" style={{ display: 'block', fontSize: 11 }}>ID: #{c.id}</span>
                      </div>
                    </div>
                  </td>
                  <td>{c.phone ? <span>📞 {c.phone}</span> : <span className="muted">—</span>}</td>
                  <td>
                    {c.tracking_url_template ? (
                      <span className="apikey" style={{ fontSize: 12 }}>{c.tracking_url_template}</span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <span className="badge green">Active</span>
                  </td>
                  <td>
                    <button
                      className="btn danger small"
                      onClick={() => deleteCompany(c)}
                      title="Supprimer cette société de livraison"
                    >
                      🗑️ Supprimer
                    </button>
                  </td>
                </tr>
              ))}
              {!companies.length && (
                <tr>
                  <td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 28 }}>
                    Aucune société de livraison enregistrée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}

