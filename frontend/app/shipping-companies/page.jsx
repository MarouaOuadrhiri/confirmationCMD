'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Shell from '../../components/Shell';
import { useApp } from '../../components/AppContext';
import { api } from '../../lib/api';

export default function ShippingCompaniesPage() {
  const router = useRouter();
  const { user, promptDialog } = useApp();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  // Add Company Form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [adding, setAdding] = useState(false);

  // Quick Tracking Test
  const [testCompId, setTestCompId] = useState('');
  const [testCode, setTestCode] = useState('');

  useEffect(() => {
    // Only Admin, Noria, and Lumera are allowed
    if (user && user.role === 'confirmer') {
      router.replace('/orders');
    }
  }, [user, router]);

  const load = () => {
    setLoading(true);
    api('/api/shipping-companies')
      .then((d) => setCompanies(d.companies || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user && user.role !== 'confirmer') load();
  }, [user]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Le nom de la société de livraison est obligatoire.');
      return;
    }
    setAdding(true);
    setError('');
    setMsg('');
    try {
      await api('/api/shipping-companies', {
        method: 'POST',
        body: {
          name: name.trim(),
          phone: phone.trim() || null,
          tracking_url_template: trackingUrl.trim() || null,
        },
      });
      setMsg(`🚚 Société "${name}" ajoutée avec succès.`);
      setName('');
      setPhone('');
      setTrackingUrl('');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (company) => {
    if (user?.role !== 'admin') {
      setError('Seul l\'administrateur peut supprimer une société de livraison.');
      return;
    }

    const adminPassword = await promptDialog({
      title: '🔐 Suppression Société de Livraison',
      message: `Veuillez saisir votre mot de passe administrateur pour supprimer "${company.name}" :`,
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
      await api(`/api/shipping-companies/${company.id}`, {
        method: 'DELETE',
        headers: { 'x-admin-password': adminPassword },
      });
      setMsg(`🚚 Société "${company.name}" supprimée avec succès.`);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const openTrackingPortal = (comp, code) => {
    if (comp?.tracking_url_template) {
      const targetUrl = comp.tracking_url_template.includes('=')
        ? `${comp.tracking_url_template}${encodeURIComponent(code || '')}`
        : `${comp.tracking_url_template}/${encodeURIComponent(code || '')}`;
      window.open(targetUrl, '_blank');
    } else {
      window.open(`https://www.google.com/search?q=${encodeURIComponent(`${comp.name} suivi colis ${code || ''}`)}`, '_blank');
    }
  };

  return (
    <Shell title="🚚 Sociétés de Livraison (Logistique & Expédition)">
      {error && <div className="error">{error}</div>}
      {msg && (
        <div className="card" style={{ borderLeft: '4px solid var(--brand)', padding: '14px 20px', marginBottom: 20 }}>
          <strong style={{ color: 'var(--brand)' }}>{msg}</strong>
        </div>
      )}

      {/* Overview Cards (Side-by-Side) */}
      <div className="kpis" style={{ marginBottom: 24 }}>
        <div className="kpi-card" style={{ borderLeft: '4px solid var(--blue)' }}>
          <div className="kpi-top">
            <div className="kpi-icon-wrap blue">🚚</div>
            <span className="kpi-trend neutral">Disponibles</span>
          </div>
          <div className="kpi-label">Agences Partenaires</div>
          <div className="kpi-value blue">{companies.length}</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="kpi-top">
            <div className="kpi-icon-wrap green">⚡</div>
            <span className="kpi-trend positive">Opérationnel</span>
          </div>
          <div className="kpi-label">Statut Logistique</div>
          <div className="kpi-value green">100% Actives</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid var(--purple)' }}>
          <div className="kpi-top">
            <div className="kpi-icon-wrap purple">📦</div>
            <span className="kpi-trend neutral">Rapide</span>
          </div>
          <div className="kpi-label">Mode Confirmation</div>
          <div className="kpi-value brand" style={{ fontSize: 20 }}>Sélection 1 Clic</div>
        </div>
      </div>

      {/* Add Shipping Company (Admin Only) */}
      {user?.role === 'admin' && (
        <div className="card" style={{ marginBottom: 24, background: 'var(--bg-secondary)', border: '1.5px solid var(--card-border)' }}>
          <div className="card-header">
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>➕</span>
                <span>Ajouter une Nouvelle Société de Livraison</span>
              </h3>
              <p className="muted" style={{ margin: '2px 0 0 0', fontSize: 13 }}>
                Rendez cette agence immédiatement sélectionnable par toutes les confirmatrices et marques lors de la confirmation d'une commande.
              </p>
            </div>
            <span className="badge brand">Admin</span>
          </div>

          <form onSubmit={handleAdd}>
            <div className="form-grid" style={{ marginBottom: 14 }}>
              <label className="field">
                Nom de la Société *
                <input
                  className="input"
                  placeholder="ex: Ozon Express / Sendit / Cathedis / Amana..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </label>
              <label className="field">
                Téléphone Support / Dispatch
                <input
                  className="input"
                  placeholder="ex: 0522000000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </label>
              <label className="field">
                Lien de Suivi (Template URL)
                <input
                  className="input"
                  placeholder="ex: https://tracking.ozon.ma/track?code="
                  value={trackingUrl}
                  onChange={(e) => setTrackingUrl(e.target.value)}
                />
              </label>
            </div>
            <button type="submit" className="btn brand" disabled={adding} style={{ fontWeight: 700 }}>
              {adding ? 'Enregistrement…' : '🚀 Enregistrer la Société'}
            </button>
          </form>
        </div>
      )}

      {/* Companies List Table */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2>🚚 Liste des Sociétés de Livraison Disponibles ({companies.length})</h2>
            <p className="muted" style={{ fontSize: 13, margin: '2px 0 0 0' }}>
              Ces agences s'affichent automatiquement dans la popup lors de la confirmation d'une commande.
            </p>
          </div>
          <span className="badge green">Logistique Active</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Société</th>
                <th>Contact / Support</th>
                <th>URL de Suivi Tracking</th>
                <th>Statut</th>
                <th>Test Suivi</th>
                {user?.role === 'admin' && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className="brand-icon-box" style={{ width: 40, height: 40, fontSize: 20 }}>
                        {c.name.toLowerCase().includes('ozon') ? '⚡' : c.name.toLowerCase().includes('send') ? '📦' : c.name.toLowerCase().includes('cath') ? '🚚' : c.name.toLowerCase().includes('amana') ? '📬' : '🚛'}
                      </div>
                      <div>
                        <strong style={{ fontSize: 14 }}>{c.name}</strong>
                        <span className="muted" style={{ display: 'block', fontSize: 11 }}>ID: #{c.id}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    {c.phone ? (
                      <a href={`tel:${c.phone}`} style={{ color: 'var(--ink)', fontWeight: 500 }}>
                        📞 {c.phone}
                      </a>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    {c.tracking_url_template ? (
                      <span className="apikey" style={{ fontSize: 12 }}>{c.tracking_url_template}</span>
                    ) : (
                      <span className="muted">Recherche directe</span>
                    )}
                  </td>
                  <td>
                    <span className="badge green">Active</span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn ghost small"
                      onClick={() => openTrackingPortal(c, '')}
                      title="Ouvrir le portail de suivi"
                      style={{ fontSize: 11.5 }}
                    >
                      🔗 Portail
                    </button>
                  </td>
                  {user?.role === 'admin' && (
                    <td>
                      <button
                        type="button"
                        className="btn danger small"
                        onClick={() => handleDelete(c)}
                        title="Supprimer cette société de livraison"
                      >
                        🗑️ Supprimer
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {!companies.length && (
                <tr>
                  <td colSpan={user?.role === 'admin' ? 6 : 5} className="muted" style={{ textAlign: 'center', padding: 28 }}>
                    {loading ? 'Chargement des sociétés…' : 'Aucune société de livraison configurée.'}
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

