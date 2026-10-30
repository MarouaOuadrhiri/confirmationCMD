'use client';
import { useEffect, useState } from 'react';
import Shell from '../../components/Shell';
import { useApp } from '../../components/AppContext';
import { api, dh } from '../../lib/api';

export default function BlacklistPage() {
  const { user, promptDialog } = useApp();
  const [manualBlacklist, setManualBlacklist] = useState([]);
  const [autoBlacklist, setAutoBlacklist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  // Live Phone Checker
  const [checkPhone, setCheckPhone] = useState('');
  const [checkResult, setCheckResult] = useState(null);
  const [checking, setChecking] = useState(false);

  // Search filter
  const [search, setSearch] = useState('');

  // Manual Add Form (Admin)
  const [newPhone, setNewPhone] = useState('');
  const [newName, setNewName] = useState('');
  const [newReason, setNewReason] = useState('');
  const [adding, setAdding] = useState(false);

  // Detail Modal for a specific customer
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const load = () => {
    setLoading(true);
    api('/api/blacklist')
      .then((d) => {
        setManualBlacklist(d.manual_blacklist || []);
        setAutoBlacklist(d.auto_blacklisted || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  const handleCheckPhone = async (e) => {
    if (e) e.preventDefault();
    if (!checkPhone.trim()) return;
    setChecking(true);
    setCheckResult(null);
    try {
      const res = await api(`/api/blacklist/check?phone=${encodeURIComponent(checkPhone.trim())}`);
      setCheckResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setChecking(false);
    }
  };

  const handleAddManual = async (e) => {
    e.preventDefault();
    if (!newPhone.trim()) {
      setError('Le numéro de téléphone est obligatoire.');
      return;
    }
    setAdding(true);
    setError('');
    setMsg('');
    try {
      await api('/api/blacklist', {
        method: 'POST',
        body: {
          phone: newPhone.trim(),
          customer_name: newName.trim() || null,
          reason: newReason.trim() || 'Bloqué manuellement par administrateur',
        },
      });
      setMsg(`🚫 Numéro ${newPhone} ajouté à la Liste Noire.`);
      setNewPhone('');
      setNewName('');
      setNewReason('');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveManual = async (item) => {
    if (user?.role !== 'admin') {
      setError('Seul l\'administrateur peut débloquer un numéro.');
      return;
    }
    const adminPassword = await promptDialog({
      title: '🔓 Débloquer de la Liste Noire',
      message: `Veuillez saisir votre mot de passe administrateur pour débloquer "${item.phone}" :`,
      placeholder: 'Mot de passe administrateur...',
      inputType: 'password',
      confirmText: '🔓 Débloquer le Numéro',
      cancelText: 'Annuler',
      variant: 'prompt',
      icon: '🔓',
    });

    if (!adminPassword) return;
    try {
      await api(`/api/blacklist/${encodeURIComponent(item.phone)}`, {
        method: 'DELETE',
        headers: { 'x-admin-password': adminPassword },
      });
      setMsg(`🔓 Numéro "${item.phone}" débloqué de la Liste Noire avec succès.`);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  // Filtered lists
  const q = search.toLowerCase().trim();
  const filteredAuto = autoBlacklist.filter((c) => {
    if (!q) return true;
    return (
      (c.phone && c.phone.toLowerCase().includes(q)) ||
      (c.customer_name && c.customer_name.toLowerCase().includes(q)) ||
      (c.city && c.city.toLowerCase().includes(q))
    );
  });

  const filteredManual = manualBlacklist.filter((c) => {
    if (!q) return true;
    return (
      (c.phone && c.phone.toLowerCase().includes(q)) ||
      (c.customer_name && c.customer_name.toLowerCase().includes(q)) ||
      (c.reason && c.reason.toLowerCase().includes(q))
    );
  });

  const totalBlacklisted = autoBlacklist.length + manualBlacklist.length;
  const totalRefusals = autoBlacklist.reduce((acc, c) => acc + Number(c.refusal_count || 0), 0);

  return (
    <Shell title="🚫 Liste Noire & Détection Fraude">
      {error && <div className="error">{error}</div>}
      {msg && (
        <div className="card" style={{ borderLeft: '4px solid var(--brand)', padding: '14px 20px', marginBottom: 20 }}>
          <strong style={{ color: 'var(--brand)' }}>{msg}</strong>
        </div>
      )}

      {/* KPI Cards (Side-by-Side) */}
      <div className="kpis" style={{ marginBottom: 24 }}>
        <div className="kpi-card" style={{ borderLeft: '4px solid #ef4444' }}>
          <div className="kpi-top">
            <div className="kpi-icon-wrap red">🚫</div>
            <span className="kpi-trend negative">Total Bloqué</span>
          </div>
          <div className="kpi-label">Clients Liste Noire</div>
          <div className="kpi-value red">{totalBlacklisted}</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid var(--amber)' }}>
          <div className="kpi-top">
            <div className="kpi-icon-wrap amber">📦</div>
            <span className="kpi-trend neutral">Refus / Retours</span>
          </div>
          <div className="kpi-label">Colis Refusés / Retournés</div>
          <div className="kpi-value amber">{totalRefusals}</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="kpi-top">
            <div className="kpi-icon-wrap green">🛡️</div>
            <span className="kpi-trend positive">Économies</span>
          </div>
          <div className="kpi-label">Frais Livraison Préservés</div>
          <div className="kpi-value green">{dh(totalRefusals * 35)}</div>
        </div>
      </div>

      {/* Live Phone Checker Bar */}
      <div className="card" style={{ background: 'var(--bg-secondary)', border: '1.5px solid var(--card-border)', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 22 }}>🔍</span>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Vérification Immédiate de Numéro (Anti-Fraude)</h3>
            <p className="muted" style={{ margin: '2px 0 0 0', fontSize: 13 }}>
              Saisissez un numéro de téléphone pour vérifier son historique de refus avant confirmation d'une commande.
            </p>
          </div>
        </div>

        <form onSubmit={handleCheckPhone} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            className="input"
            style={{ flex: 1, minWidth: 240, fontSize: 14 }}
            placeholder="ex: 0661000000 ou +212661000000..."
            value={checkPhone}
            onChange={(e) => setCheckPhone(e.target.value)}
          />
          <button type="submit" className="btn brand" disabled={checking} style={{ fontWeight: 700 }}>
            {checking ? 'Vérification…' : '🔎 Vérifier le Client'}
          </button>
        </form>

        {checkResult && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--card-border)' }}>
            {checkResult.is_blacklisted ? (
              <div className="duplicate-alert-box blacklist">
                <div className="dup-header">
                  <div className="dup-header-info">
                    <span style={{ fontSize: 24 }}>🚫</span>
                    <div>
                      <h4 style={{ color: '#ef4444', fontSize: 15 }}>ATTENTION : NUMÉRO SUR LISTE NOIRE !</h4>
                      <p>
                        {checkResult.is_manual
                          ? `Ce numéro est bloqué manuellement (${checkResult.manual_entry?.reason || 'Raison spécifiée'})`
                          : `Ce numéro a ${checkResult.refusal_count} commandes refusées ou retournées sur un total de ${checkResult.total_orders} commandes.`}
                      </p>
                    </div>
                  </div>
                  <span className="badge red" style={{ fontSize: 12, fontWeight: 700 }}>
                    ❌ Risque Critique (Ne pas livrer sans acompte)
                  </span>
                </div>
              </div>
            ) : checkResult.refusal_count > 0 ? (
              <div className="duplicate-alert-box" style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1.5px solid rgba(245, 158, 11, 0.4)' }}>
                <div className="dup-header">
                  <div className="dup-header-info">
                    <span style={{ fontSize: 22 }}>⚠️</span>
                    <div>
                      <h4 style={{ color: '#d97706', fontSize: 14 }}>Vigilance : {checkResult.refusal_count} retour(s) antérieur(s)</h4>
                      <p>Ce client a déjà eu {checkResult.refusal_count} retour(s) et {checkResult.delivered_count} commande(s) livrée(s).</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="duplicate-alert-box" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1.5px solid rgba(16, 185, 129, 0.4)' }}>
                <div className="dup-header">
                  <div className="dup-header-info">
                    <span style={{ fontSize: 22 }}>✅</span>
                    <div>
                      <h4 style={{ color: '#10b981', fontSize: 14 }}>Client Fiable (Aucun retour détecté)</h4>
                      <p>{checkResult.total_orders > 0 ? `${checkResult.delivered_count} commande(s) livrée(s) avec succès.` : 'Nouveau client (aucune commande précédente enregistrée).'}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Manual Add to Blacklist Form (Admin) */}
      {user?.role === 'admin' && (
        <div className="card" style={{ marginBottom: 24, border: '1px dashed #ef4444' }}>
          <div className="card-header">
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>➕</span>
                <span>Bloquer un Numéro Manuellement (Admin)</span>
              </h3>
              <p className="muted" style={{ margin: '2px 0 0 0', fontSize: 12.5 }}>
                Ajoutez directement un numéro suspect ou fraudeur à la liste noire.
              </p>
            </div>
          </div>

          <form onSubmit={handleAddManual}>
            <div className="form-grid" style={{ marginBottom: 12 }}>
              <label className="field">
                Numéro de Téléphone *
                <input
                  className="input"
                  placeholder="ex: 0661000000"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  required
                />
              </label>
              <label className="field">
                Nom du Client
                <input
                  className="input"
                  placeholder="ex: Nom du client..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </label>
              <label className="field">
                Motif de Blocage
                <input
                  className="input"
                  placeholder="ex: Refus systématique, arnaque..."
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                />
              </label>
            </div>
            <button type="submit" className="btn danger" disabled={adding} style={{ fontWeight: 700 }}>
              {adding ? 'Enregistrement…' : '🚫 Bloquer ce Numéro'}
            </button>
          </form>
        </div>
      )}

      {/* Search & Filter */}
      <div className="filters" style={{ marginBottom: 16 }}>
        <div className="field" style={{ flex: 1 }}>
          <input
            className="input"
            placeholder="🔍 Rechercher par numéro de téléphone, nom de client ou ville…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table 1: Auto-Detected Blacklist (>= 3 Returns/Refusals) */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🤖</span>
              <span>Clients Détectés Automatiquement (3+ Refus / Retours) ({filteredAuto.length})</span>
            </h2>
            <p className="muted" style={{ fontSize: 13, margin: '2px 0 0 0' }}>
              Clients ayant atteint le seuil critique de 3 commandes retournées ou refusées.
            </p>
          </div>
          <span className="badge red">Auto-Blacklist</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Téléphone</th>
                <th>Client</th>
                <th>Ville</th>
                <th>Colis Refusés / Retours</th>
                <th>Colis Livrés</th>
                <th>Total Commandes</th>
                <th>Dernière Commande</th>
                <th>Détails</th>
              </tr>
            </thead>
            <tbody>
              {filteredAuto.map((c, i) => (
                <tr key={i}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <strong style={{ color: '#ef4444' }}>📞 {c.phone}</strong>
                      <a
                        href={`https://wa.me/${c.phone.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: '#25d366', fontSize: 11, fontWeight: 600 }}
                      >
                        💬 WA
                      </a>
                    </div>
                  </td>
                  <td><strong>{c.customer_name || '—'}</strong></td>
                  <td>{c.city || '—'}</td>
                  <td>
                    <span className="badge red" style={{ fontWeight: 700, fontSize: 12 }}>
                      ❌ {c.refusal_count} refus
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
                  <td>
                    <button
                      type="button"
                      className="btn ghost small"
                      onClick={() => {
                        setCheckPhone(c.phone);
                        handleCheckPhone();
                      }}
                      title="Inspecter l'historique de ce client"
                    >
                      🔍 Inspecter
                    </button>
                  </td>
                </tr>
              ))}
              {!filteredAuto.length && (
                <tr>
                  <td colSpan={8} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                    {loading ? 'Chargement…' : 'Aucun client avec 3 refus trouvé.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Table 2: Manually Blocked Numbers */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>📝</span>
              <span>Numéros Bloqués Manuellement ({filteredManual.length})</span>
            </h2>
            <p className="muted" style={{ fontSize: 13, margin: '2px 0 0 0' }}>
              Numéros ajoutés à la liste noire par l'administrateur.
            </p>
          </div>
          <span className="badge purple">Manuel</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Téléphone</th>
                <th>Client</th>
                <th>Motif</th>
                <th>Bloqué par</th>
                <th>Date d'ajout</th>
                {user?.role === 'admin' && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {filteredManual.map((item) => (
                <tr key={item.id}>
                  <td><strong style={{ color: '#ef4444' }}>📞 {item.phone}</strong></td>
                  <td><strong>{item.customer_name || '—'}</strong></td>
                  <td><span className="muted">{item.reason || 'Bloqué manuellement'}</span></td>
                  <td><span className="badge purple">{item.created_by || 'admin'}</span></td>
                  <td className="muted" style={{ fontSize: 12 }}>
                    {item.created_at ? new Date(item.created_at).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  {user?.role === 'admin' && (
                    <td>
                      <button
                        className="btn ghost small"
                        onClick={() => handleRemoveManual(item)}
                        title="Débloquer ce numéro"
                      >
                        🔓 Débloquer
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {!filteredManual.length && (
                <tr>
                  <td colSpan={user?.role === 'admin' ? 6 : 5} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                    {loading ? 'Chargement…' : 'Aucun numéro bloqué manuellement.'}
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

