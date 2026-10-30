'use client';
import { useEffect, useState } from 'react';
import Shell from '../../components/Shell';
import { useApp } from '../../components/AppContext';
import { api, dh } from '../../lib/api';

const iso = (d) => d.toISOString().slice(0, 10);

export default function ExpensesPage() {
  const { brandParam, brandId, user, promptDialog } = useApp();
  const [rows, setRows] = useState([]);
  const [brands, setBrands] = useState([]);
  const [type, setType] = useState('ads');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(iso(new Date()));
  const [label, setLabel] = useState('');
  const [brand, setBrand] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = () => {
    api(`/api/expenses?x=1${brandParam}`)
      .then((d) => setRows(d.expenses || []))
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    if (!user) return;
    load();
    if (user.role === 'admin') {
      api('/api/brands').then((d) => setBrands(d.brands || [])).catch(() => {});
    }
  }, [user, brandId]);

  const add = async () => {
    setError('');
    setSuccess('');
    if (!amount || Number(amount) <= 0) {
      setError('Please enter a valid expense amount');
      return;
    }
    try {
      const body = { type, amount: Number(amount), date, label };
      if (user.role === 'admin') {
        if (!brand) throw new Error('Please choose a brand for this expense');
        body.brand_id = brand;
      }
      await api('/api/expenses', { method: 'POST', body });
      setAmount('');
      setLabel('');
      setSuccess('Expense logged successfully.');
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const remove = async (r) => {
    if (user?.role !== 'admin') {
      setError('Action interdite. Seul le compte Administrateur peut supprimer des dépenses.');
      return;
    }

    const id = typeof r === 'object' ? r.id : r;
    const desc = typeof r === 'object' ? `${r.type === 'ads' ? 'Ads spend' : 'Charge'} (${dh(r.amount)})` : 'cette dépense';

    const adminPassword = await promptDialog({
      title: '🔐 Suppression Sécurisée — Dépense',
      message: `Veuillez saisir votre mot de passe administrateur pour supprimer cet enregistrement :`,
      detail: (
        <div style={{ fontSize: 13 }}>
          <span><strong>Dépense :</strong> {desc}</span>
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
      await api(`/api/expenses/${id}`, { 
        method: 'DELETE',
        headers: { 'x-admin-password': adminPassword }
      });
      setSuccess('Dépense supprimée avec succès.');
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const totalAds = rows.filter((r) => r.type === 'ads').reduce((s, r) => s + Number(r.amount), 0);
  const totalCharges = rows.filter((r) => r.type === 'charge').reduce((s, r) => s + Number(r.amount), 0);
  const totalCombined = totalAds + totalCharges;

  return (
    <Shell title="💸 Expenses & Marketing Spend">
      {error && <div className="error">{error}</div>}
      {success && (
        <div className="card" style={{ borderLeft: '4px solid var(--green)', padding: '12px 18px', marginBottom: 20 }}>
          <strong style={{ color: 'var(--green-text)' }}>✅ {success}</strong>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="kpis">
        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon-wrap amber">💰</div>
            <span className="kpi-trend negative">Meta / TikTok</span>
          </div>
          <div className="kpi-label">Ads Spend</div>
          <div className="kpi-value red">{dh(totalAds)}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon-wrap red">🧾</div>
            <span className="kpi-trend negative">Operations</span>
          </div>
          <div className="kpi-label">Charges (Packaging/Shipping)</div>
          <div className="kpi-value red">{dh(totalCharges)}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon-wrap purple">💸</div>
            <span className="kpi-trend neutral">Combined</span>
          </div>
          <div className="kpi-label">Total Outflow</div>
          <div className="kpi-value">{dh(totalCombined)}</div>
        </div>
      </div>

      {/* Add Expense Form */}
      <div className="card">
        <div className="card-header">
          <h2>➕ Log New Expense / Ads Spend</h2>
          <span className="badge amber">Outflow Tracker</span>
        </div>
        <div className="form-grid">
          <label className="field">
            Expense Category *
            <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="ads">💰 Ads spend (Meta / TikTok / Google)</option>
              <option value="charge">🧾 Operational charge (Delivery fees, Packaging, Staff…)</option>
            </select>
          </label>
          <label className="field">
            Amount (DH) *
            <input type="number" className="input" placeholder="e.g. 1500" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </label>
          <label className="field">
            Date *
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label className="field">
            Label / Description
            <input className="input" placeholder="e.g. Meta Ads - Campaign 1" value={label} onChange={(e) => setLabel(e.target.value)} />
          </label>
          {user?.role === 'admin' && (
            <label className="field">
              Brand Assignment *
              <select className="input" value={brand} onChange={(e) => setBrand(e.target.value)}>
                <option value="">— Select Brand —</option>
                {brands.map((b) => <option key={b.id} value={b.id}>🏷️ {b.name}</option>)}
              </select>
            </label>
          )}
        </div>
        <button className="btn" onClick={add}>💾 Save Expense</button>
      </div>

      {/* Expenses History Table */}
      <div className="card">
        <div className="card-header">
          <h2>💸 Expense Records ({rows.length})</h2>
          <span className="badge blue">Ledger</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Label / Description</th>
                <th>Amount</th>
                {user?.role === 'admin' && <th>Brand</th>}
                {user?.role === 'admin' && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="muted"><strong>{r.date?.slice(0, 10)}</strong></td>
                  <td>
                    {r.type === 'ads' ? (
                      <span className="badge amber">💰 Ads Spend</span>
                    ) : (
                      <span className="badge gray">🧾 Operational Charge</span>
                    )}
                  </td>
                  <td>{r.label || <span className="muted">—</span>}</td>
                  <td><strong style={{ color: 'var(--red)' }}>{dh(r.amount)}</strong></td>
                  {user?.role === 'admin' && <td><span className="badge purple">{r.brand_name || '—'}</span></td>}
                  {user?.role === 'admin' && (
                    <td>
                      <button className="btn danger small" title="Delete Expense (Admin only)" onClick={() => remove(r)}>
                        ✕
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={user?.role === 'admin' ? 6 : 4} className="muted" style={{ textAlign: 'center', padding: 28 }}>
                    No expenses recorded yet.
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

