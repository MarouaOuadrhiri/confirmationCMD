'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Shell from '../../components/Shell';
import { useApp } from '../../components/AppContext';
import { api } from '../../lib/api';
import { BrandBadge, BrandIcon } from '../../components/BrandBadge';

export default function ConfirmersPage() {
  const { brandParam, brandId, user, promptDialog } = useApp();
  const [rows, setRows] = useState([]);
  const [brands, setBrands] = useState([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedBrandIds, setSelectedBrandIds] = useState([]);
  const [createAccount, setCreateAccount] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Account modal state
  const [accountModal, setAccountModal] = useState(null);
  const [modalEmail, setModalEmail] = useState('');
  const [modalPassword, setModalPassword] = useState('');
  const [modalError, setModalError] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  // Edit Confirmer modal state
  const [editModal, setEditModal] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editBrandIds, setEditBrandIds] = useState([]);
  const [editError, setEditError] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  const load = () => {
    api(`/api/confirmers?x=1${brandParam}`)
      .then((d) => setRows(d.confirmers || []))
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    if (!user) return;
    load();
    if (user.role === 'admin') {
      api('/api/brands').then((d) => {
        const bList = d.brands || [];
        setBrands(bList);
        if (bList.length > 0 && selectedBrandIds.length === 0) {
          setSelectedBrandIds(bList.map((b) => b.id)); // default all brands
        }
      }).catch(() => {});
    }
  }, [user, brandId]);

  const toggleBrandSelection = (id) => {
    setSelectedBrandIds((prev) =>
      prev.includes(id) ? prev.filter((bId) => bId !== id) : [...prev, id]
    );
  };

  const selectAllBrands = () => {
    if (selectedBrandIds.length === brands.length) {
      setSelectedBrandIds([]);
    } else {
      setSelectedBrandIds(brands.map((b) => b.id));
    }
  };

  const add = async () => {
    setError('');
    setSuccess('');
    if (!name.trim()) {
      setError('Le nom du confirmateur est requis');
      return;
    }
    if (user.role === 'admin' && selectedBrandIds.length === 0) {
      setError('Veuillez sélectionner au moins une marque pour ce confirmateur.');
      return;
    }

    try {
      const body = { 
        name: name.trim(), 
        phone: phone ? phone.trim() : '',
        brand_ids: selectedBrandIds,
      };

      if (createAccount) {
        if (!email.trim() || !password.trim()) {
          throw new Error('Veuillez renseigner un email et un mot de passe pour le compte confirmateur');
        }
        body.email = email.trim();
        body.password = password.trim();
      }

      await api('/api/confirmers', { method: 'POST', body });
      setName('');
      setPhone('');
      setEmail('');
      setPassword('');
      setSuccess('Confirmateur et accès créés avec succès.');
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const openAccountModal = (confirmer) => {
    setAccountModal(confirmer);
    setModalEmail(confirmer.user_email || confirmer.login_email || `confirmer${confirmer.id}@dashboard.local`);
    setModalPassword('');
    setModalError('');
  };

  const saveAccountModal = async () => {
    if (!modalEmail.trim() || !modalPassword.trim()) {
      setModalError('Email et mot de passe requis');
      return;
    }
    setModalLoading(true);
    setModalError('');
    try {
      await api(`/api/confirmers/${accountModal.id}/account`, {
        method: 'POST',
        body: { email: modalEmail.trim(), password: modalPassword.trim() }
      });
      setSuccess(`Identifiants mis à jour pour ${accountModal.name}`);
      setAccountModal(null);
      load();
    } catch (e) {
      setModalError(e.message);
    } finally {
      setModalLoading(false);
    }
  };

  const openEditModal = (c) => {
    setEditModal(c);
    setEditName(c.name || '');
    setEditPhone(c.phone || '');
    setEditBrandIds(c.brand_ids && c.brand_ids.length > 0 ? c.brand_ids : (c.brand_id ? [Number(c.brand_id)] : []));
    setEditError('');
  };

  const saveEditModal = async () => {
    if (!editName.trim()) {
      setEditError('Le nom est requis');
      return;
    }
    if (editBrandIds.length === 0) {
      setEditError('Veuillez sélectionner au moins une marque');
      return;
    }

    setEditLoading(true);
    setEditError('');
    try {
      await api(`/api/confirmers/${editModal.id}`, {
        method: 'PUT',
        body: {
          name: editName.trim(),
          phone: editPhone ? editPhone.trim() : null,
          brand_ids: editBrandIds,
        }
      });
      setSuccess(`Confirmateur "${editName}" mis à jour avec succès.`);
      setEditModal(null);
      load();
    } catch (e) {
      setEditError(e.message);
    } finally {
      setEditLoading(false);
    }
  };

  const remove = async (c) => {
    if (user?.role !== 'admin') {
      setError('Action interdite. Seul le compte Administrateur peut supprimer des confirmateurs.');
      return;
    }

    const id = typeof c === 'object' ? c.id : c;
    const agentName = typeof c === 'object' ? c.name : 'this confirmer';

    const adminPassword = await promptDialog({
      title: '🔐 Suppression Sécurisée — Confirmateur',
      message: `Veuillez saisir votre mot de passe administrateur pour supprimer "${agentName}" :`,
      detail: (
        <div style={{ fontSize: 13 }}>
          <span>⚠️ Le compte de connexion associé sera également supprimé. Les commandes assignées seront détachées.</span>
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
      await api(`/api/confirmers/${id}`, { 
        method: 'DELETE',
        headers: { 'x-admin-password': adminPassword }
      });
      setSuccess('Confirmateur supprimé avec succès.');
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <Shell title="🎧 Confirmers & Multi-Brand Call Team">
      {error && <div className="error" style={{ marginBottom: 16 }}>⚠️ {error}</div>}
      {success && (
        <div className="card" style={{ borderLeft: '4px solid var(--green)', padding: '12px 18px', marginBottom: 20 }}>
          <strong style={{ color: 'var(--green-text)' }}>✅ {success}</strong>
        </div>
      )}

      {/* Add Confirmer Form (Admin Only) */}
      {user?.role === 'admin' && (
        <div className="card">
          <div className="card-header">
            <h2>➕ Add Team Member & Multi-Brand Access</h2>
            <span className="badge blue">Multi-Brand Confirmatrice</span>
          </div>
          
          <div className="form-grid">
            <label className="field">
              Nom complet *
              <input className="input" placeholder="e.g. Salma B." value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="field">
              Numéro de téléphone
              <input className="input" placeholder="e.g. 0661234567" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
          </div>

          {/* Multi-Brand Checkboxes */}
          <div style={{ marginTop: 12, marginBottom: 16, padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--card-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <strong style={{ fontSize: 13.5 }}>🏷️ Marques Assignées à cette Confirmatrice * :</strong>
              {brands.length > 1 && (
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={selectAllBrands}
                  style={{ fontSize: 11.5, padding: '2px 8px' }}
                >
                  {selectedBrandIds.length === brands.length ? 'Désélectionner tout' : '✨ Sélectionner toutes'}
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {brands.map((b) => {
                const isSelected = selectedBrandIds.includes(b.id);
                return (
                  <label
                    key={b.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer',
                      padding: '7px 14px',
                      background: isSelected ? 'var(--brand-glow, rgba(99, 102, 241, 0.12))' : 'var(--card-bg)',
                      border: `1.5px solid ${isSelected ? 'var(--brand)' : 'var(--card-border)'}`,
                      borderRadius: 'var(--radius-md)',
                      fontSize: 13,
                      fontWeight: isSelected ? 700 : 500,
                      color: isSelected ? 'var(--brand)' : 'inherit',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleBrandSelection(b.id)}
                      style={{ accentColor: 'var(--brand)', width: 16, height: 16 }}
                    />
                    <BrandIcon brand={b.name} size={16} />
                    <span>{b.name}</span>
                  </label>
                );
              })}
            </div>
            <p className="muted" style={{ fontSize: 11.5, marginTop: 8, marginBottom: 0 }}>
              💡 Une confirmatrice peut gérer 1 seule marque, plusieurs marques (ex: Lumera + Noria), ou toutes les marques.
            </p>
          </div>

          {/* Dedicated Login Account */}
          <div style={{ marginBottom: 16, padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--card-border)' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13.5 }}>
              <input
                type="checkbox"
                checked={createAccount}
                onChange={(e) => setCreateAccount(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--brand)' }}
              />
              <span>Créer des identifiants de connexion dédiés pour ce confirmateur</span>
            </label>

            {createAccount && (
              <div className="form-grid" style={{ marginTop: 14, marginBottom: 0 }}>
                <label className="field">
                  Email de connexion *
                  <input
                    type="email"
                    className="input"
                    placeholder="e.g. salma@dashboard.local"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </label>
                <label className="field">
                  Mot de passe de départ *
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Confirmer123!"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </label>
              </div>
            )}
          </div>

          <button className="btn" onClick={add}>➕ Ajouter le Confirmateur</button>
        </div>
      )}

      {/* Confirmers List */}
      <div className="card">
        <div className="card-header">
          <h2>🎧 Équipe de Confirmation ({rows.length})</h2>
          <span className="badge brand">Team roster & Multi-Brand Access</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Agent</th>
                <th>Téléphone</th>
                {user?.role === 'admin' && <th>Marques Assignées</th>}
                <th>Compte de Connexion</th>
                {user?.role === 'admin' && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const hasAccount = Boolean(c.user_email || c.login_email);
                const displayEmail = c.user_email || c.login_email;

                // Brand Badges
                const assignedBrandIds = c.brand_ids && c.brand_ids.length > 0 ? c.brand_ids : (c.brand_id ? [Number(c.brand_id)] : []);

                return (
                  <tr key={c.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="user-avatar" style={{ width: 34, height: 34, fontSize: 13, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
                          {(c.name || 'C')[0].toUpperCase()}
                        </div>
                        <div>
                          <strong>{c.name}</strong>
                          <span className="muted" style={{ display: 'block', fontSize: 11 }}>ID: #{c.id}</span>
                        </div>
                      </div>
                    </td>
                    <td>{c.phone ? <span>📞 {c.phone}</span> : <span className="muted">—</span>}</td>
                    
                    {/* Multi-Brand Badges */}
                    {user?.role === 'admin' && (
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          {assignedBrandIds.length > 0 ? (
                            assignedBrandIds.map((bId) => {
                              const bObj = brands.find((b) => b.id === bId);
                              return (
                                <BrandBadge key={bId} brand={bObj?.name || `Brand #${bId}`} size="sm" />
                              );
                            })
                          ) : c.brand_name ? (
                            <BrandBadge brand={c.brand_name} size="sm" />
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </div>
                      </td>
                    )}

                    {/* Login Account */}
                    <td>
                      {hasAccount ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="badge blue" style={{ fontSize: 12 }}>
                            🔑 {displayEmail}
                          </span>
                          {user?.role === 'admin' && (
                            <button
                              className="btn ghost small"
                              onClick={() => openAccountModal(c)}
                              title="Réinitialiser ou modifier le mot de passe"
                              style={{ padding: '3px 8px', fontSize: 11 }}
                            >
                              ⚙️ Mot de passe
                            </button>
                          )}
                        </div>
                      ) : (
                        <div>
                          <span className="badge gray" style={{ marginRight: 8, fontSize: 11 }}>Pas de compte</span>
                          {user?.role === 'admin' && (
                            <button
                              className="btn small"
                              onClick={() => openAccountModal(c)}
                              style={{ padding: '3px 8px', fontSize: 11 }}
                            >
                              ➕ Créer accès
                            </button>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    {user?.role === 'admin' && (
                      <td>
                        <div className="row-actions">
                          <button 
                            className="btn ghost small" 
                            title="Modifier les marques et informations" 
                            onClick={() => openEditModal(c)}
                            style={{ padding: '4px 8px', fontSize: 12 }}
                          >
                            ✏️ Modifier
                          </button>
                          <button 
                            className="btn danger small" 
                            title="Supprimer le confirmateur" 
                            onClick={() => remove(c)}
                            style={{ padding: '4px 8px', fontSize: 12 }}
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {!rows.length && (
                <tr>
                  <td colSpan={user?.role === 'admin' ? 5 : 3} className="muted" style={{ textAlign: 'center', padding: 28 }}>
                    Aucun confirmateur enregistré pour le moment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Confirmer Modal */}
      {editModal && mounted && createPortal(
        <div className="modal-overlay" onClick={() => setEditModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <button 
                type="button" 
                className="modal-header-close-btn" 
                onClick={() => setEditModal(null)}
                title="Fermer"
              >
                ✕
              </button>
              <div className="modal-icon-badge badge-brand">✏️</div>
              <div className="modal-title-wrap">
                <h3 className="modal-title">Modifier Confirmateur — #{editModal.id}</h3>
                <p className="modal-message">
                  Modifiez le nom, téléphone et les marques assignées à {editModal.name}.
                </p>
              </div>
            </div>

            {editError && <div className="error" style={{ margin: '0 24px 16px 24px' }}>⚠️ {editError}</div>}

            <div style={{ padding: '0 24px 20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label className="field">
                Nom complet *
                <input
                  className="input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Salma B."
                  required
                />
              </label>

              <label className="field">
                Numéro de téléphone
                <input
                  className="input"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="e.g. 0661234567"
                />
              </label>

              <div className="field">
                <span>Marques Assignées *</span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                  {brands.map((b) => {
                    const isChecked = editBrandIds.includes(b.id);
                    return (
                      <label
                        key={b.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          cursor: 'pointer',
                          padding: '6px 12px',
                          background: isChecked ? 'var(--brand-glow, rgba(99, 102, 241, 0.12))' : 'var(--bg-secondary)',
                          border: `1.5px solid ${isChecked ? 'var(--brand)' : 'var(--card-border)'}`,
                          borderRadius: 'var(--radius-md)',
                          fontSize: 12.5,
                          fontWeight: isChecked ? 700 : 500,
                          color: isChecked ? 'var(--brand)' : 'inherit',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) setEditBrandIds([...editBrandIds, b.id]);
                            else setEditBrandIds(editBrandIds.filter((id) => id !== b.id));
                          }}
                          style={{ accentColor: 'var(--brand)', width: 15, height: 15 }}
                        />
                        <BrandIcon brand={b.name} size={15} />
                        <span>{b.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="modal-btn-cancel" onClick={() => setEditModal(null)} disabled={editLoading}>
                Annuler
              </button>
              <button className="modal-btn-confirm btn-brand" onClick={saveEditModal} disabled={editLoading}>
                {editLoading ? 'Enregistrement…' : 'Enregistrer les modifications'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Account Modal (Create / Reset Password) */}
      {accountModal && mounted && createPortal(
        <div className="modal-overlay" onClick={() => setAccountModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <button 
                type="button" 
                className="modal-header-close-btn" 
                onClick={() => setAccountModal(null)}
                title="Fermer"
              >
                ✕
              </button>
              <div className="modal-icon-badge badge-brand">🔑</div>
              <div className="modal-title-wrap">
                <h3 className="modal-title">Identifiants — {accountModal.name}</h3>
                <p className="modal-message">
                  Configurez l'email et le mot de passe pour permettre à cet agent de se connecter au dashboard.
                </p>
              </div>
            </div>

            {modalError && <div className="error" style={{ margin: '0 24px 16px 24px' }}>⚠️ {modalError}</div>}

            <div style={{ padding: '0 24px 20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label className="field">
                Email de connexion
                <input
                  type="email"
                  className="input"
                  value={modalEmail}
                  onChange={(e) => setModalEmail(e.target.value)}
                  placeholder="name@dashboard.local"
                  required
                />
              </label>

              <label className="field">
                Nouveau mot de passe
                <input
                  type="text"
                  className="input"
                  value={modalPassword}
                  onChange={(e) => setModalPassword(e.target.value)}
                  placeholder="e.g. Confirmer123!"
                  required
                />
              </label>
            </div>

            <div className="modal-footer">
              <button className="modal-btn-cancel" onClick={() => setAccountModal(null)} disabled={modalLoading}>
                Annuler
              </button>
              <button className="modal-btn-confirm btn-brand" onClick={saveAccountModal} disabled={modalLoading}>
                {modalLoading ? 'Enregistrement…' : 'Enregistrer les identifiants'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </Shell>
  );
}

