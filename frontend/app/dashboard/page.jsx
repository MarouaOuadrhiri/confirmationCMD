'use client';
import { useEffect, useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import Shell from '../../components/Shell';
import BrandSelect from '../../components/BrandSelect';
import { useApp } from '../../components/AppContext';
import { api, dh } from '../../lib/api';

const STATUS_COLORS = [
  '#10b981', '#830000', '#3b82f6', '#0ea5e9', '#f59e0b',
  '#f43f5e', '#b91c1c', '#dc2626', '#14b8a6', '#64748b'
];

export default function DashboardPage() {
  const { brandParam, brandId, setBrandId, brands, user } = useApp();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!user) return;
    setError('');
    const q = `?from=${from}&to=${to}${brandParam}`;
    api(`/api/stats${q}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [user, brandId, from, to]);

  const k = data?.kpis;

  // Transform monthly data for chart
  const monthlyChartData = useMemo(() => {
    if (!data?.monthly) return [];
    return [...data.monthly].reverse().map((m) => ({
      name: m.month,
      revenus: Number(m.revenus || 0),
      orders: Number(m.total_orders || 0),
      confirmed: Number(m.confirmed || 0),
      delivered: Number(m.delivered || 0),
    }));
  }, [data?.monthly]);

  // Transform call statuses for pie chart
  const callChartData = useMemo(() => {
    if (!data?.call_statuses) return [];
    return data.call_statuses.map((s) => ({
      name: s.status,
      value: Number(s.count || 0),
    }));
  }, [data?.call_statuses]);

  // Transform shipping statuses for chart
  const shippingChartData = useMemo(() => {
    if (!data?.shipping_statuses) return [];
    return data.shipping_statuses.map((s) => ({
      name: s.status,
      value: Number(s.count || 0),
    }));
  }, [data?.shipping_statuses]);

  const isConfirmer = user?.role === 'confirmer';

  const CustomBarTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-chart-tooltip">
          <div className="tooltip-title">{label}</div>
          {isConfirmer ? (
            <>
              <div className="tooltip-item" style={{ color: 'var(--brand)' }}>
                <span>Commandes:</span>
                <strong>{payload.find((p) => p.dataKey === 'orders')?.value || 0}</strong>
              </div>
              <div className="tooltip-item" style={{ color: '#10b981' }}>
                <span>Confirmées:</span>
                <strong>{payload.find((p) => p.dataKey === 'confirmed')?.value || 0}</strong>
              </div>
              {payload.find((p) => p.dataKey === 'delivered') && (
                <div className="tooltip-item" style={{ color: '#3b82f6' }}>
                  <span>Livrées:</span>
                  <strong>{payload.find((p) => p.dataKey === 'delivered')?.value || 0}</strong>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="tooltip-item" style={{ color: '#830000' }}>
                <span>Revenus:</span>
                <strong>{dh(payload.find((p) => p.dataKey === 'revenus')?.value)}</strong>
              </div>
              {payload.find((p) => p.dataKey === 'orders') && (
                <div className="tooltip-item" style={{ color: '#10b981' }}>
                  <span>Orders:</span>
                  <strong>{payload.find((p) => p.dataKey === 'orders')?.value}</strong>
                </div>
              )}
            </>
          )}
        </div>
      );
    }
    return null;
  };

  const CustomPieTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const d = payload[0];
      return (
        <div className="custom-chart-tooltip">
          <div className="tooltip-title" style={{ color: d.payload.fill || '#830000' }}>
            {d.name}
          </div>
          <div className="tooltip-item">
            <span>Orders:</span>
            <strong>{d.value}</strong>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Shell title={isConfirmer ? "🎧 Tableau de Bord Confirmateur" : "📊 Dashboard & Analytics"}>
      {error && <div className="error">{error}</div>}

      <div className="filters">
        {user?.role === 'admin' && (
          <div className="field brand-scope-field">
            <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--ink-muted)' }}>Brand Scope</span>
            <BrandSelect
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              brands={brands}
              includeAll={true}
              allLabel="All brands"
            />
          </div>
        )}
        
        <div className="date-range-group">
          <div className="field">
            <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--ink-muted)' }}>From Date</span>
            <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <span className="date-arrow">→</span>
          <div className="field">
            <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--ink-muted)' }}>To Date</span>
            <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        {(from || to) && (
          <button className="btn ghost small clear-dates-btn" onClick={() => { setFrom(''); setTo(''); }}>
            ✕ Clear Dates
          </button>
        )}
      </div>

      {!data ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <p className="muted" style={{ fontSize: 16 }}>Loading performance data…</p>
        </div>
      ) : (
        <>
          {/* Top KPI Cards Grid */}
          <div className="kpis">
            {isConfirmer ? (
              /* ---- CONFIRMER DEDICATED CARDS (NO FINANCIAL METRICS) ---- */
              <>
                <div className="kpi-card">
                  <div className="kpi-top">
                    <div className="kpi-icon-wrap indigo">📦</div>
                    <span className="kpi-trend neutral">Aujourd'hui</span>
                  </div>
                  <div className="kpi-label">Commandes Aujourd'hui</div>
                  <div className="kpi-value">{k.orders_today}</div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-top">
                    <div className="kpi-icon-wrap purple">🧾</div>
                    <span className="kpi-trend positive">Total</span>
                  </div>
                  <div className="kpi-label">Mes Commandes Assignées</div>
                  <div className="kpi-value">{k.total_orders}</div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-top">
                    <div className="kpi-icon-wrap green">📞</div>
                    <span className="kpi-trend positive">Confirmées</span>
                  </div>
                  <div className="kpi-label">Commandes Confirmées</div>
                  <div className="kpi-value green">{k.confirmed || data.confirmers[0]?.confirmed || 0}</div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-top">
                    <div className="kpi-icon-wrap purple">☎️</div>
                    <span className="kpi-trend positive">Taux</span>
                  </div>
                  <div className="kpi-label">Taux de Confirmation</div>
                  <div className="kpi-value brand">{k.confirmation_rate}%</div>
                  <div className="progress-bar-wrap">
                    <div className="progress-bar-fill brand" style={{ width: `${Math.min(100, k.confirmation_rate)}%` }}></div>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-top">
                    <div className="kpi-icon-wrap green">✅</div>
                    <span className="kpi-trend positive">Livrées</span>
                  </div>
                  <div className="kpi-label">Colis Livrés</div>
                  <div className="kpi-value green">{k.delivered || data.confirmers[0]?.delivered || 0}</div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-top">
                    <div className="kpi-icon-wrap green">🚚</div>
                    <span className="kpi-trend positive">Taux</span>
                  </div>
                  <div className="kpi-label">Taux de Livraison</div>
                  <div className="kpi-value green">{k.delivery_rate}%</div>
                  <div className="progress-bar-wrap">
                    <div className="progress-bar-fill green" style={{ width: `${Math.min(100, k.delivery_rate)}%` }}></div>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-top">
                    <div className="kpi-icon-wrap red">↩️</div>
                    <span className="kpi-trend negative">Retours</span>
                  </div>
                  <div className="kpi-label">Retours / Refus</div>
                  <div className="kpi-value red">{k.returned || data.confirmers[0]?.returned || 0}</div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-top">
                    <div className="kpi-icon-wrap amber">🔁</div>
                    <span className="kpi-trend negative">Taux</span>
                  </div>
                  <div className="kpi-label">Taux de Retour</div>
                  <div className="kpi-value amber">{k.return_rate}%</div>
                  <div className="progress-bar-wrap">
                    <div className="progress-bar-fill amber" style={{ width: `${Math.min(100, k.return_rate)}%` }}></div>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-top">
                    <div className="kpi-icon-wrap blue">⏳</div>
                    <span className="kpi-trend neutral">Pipeline</span>
                  </div>
                  <div className="kpi-label">En Cours / À Traiter</div>
                  <div className="kpi-value">{k.pending_to_call || Math.max(0, k.total_orders - (k.confirmed || 0) - (k.returned || 0))}</div>
                </div>
              </>
            ) : (
              /* ---- ADMIN & BRAND FULL FINANCIAL CARDS ---- */
              <>
                <div className="kpi-card">
                  <div className="kpi-top">
                    <div className="kpi-icon-wrap indigo">📦</div>
                    <span className="kpi-trend neutral">Today</span>
                  </div>
                  <div className="kpi-label">Orders Today</div>
                  <div className="kpi-value">{k.orders_today}</div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-top">
                    <div className="kpi-icon-wrap purple">🧾</div>
                    <span className="kpi-trend positive">Total</span>
                  </div>
                  <div className="kpi-label">Total Orders</div>
                  <div className="kpi-value">{k.total_orders}</div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-top">
                    <div className="kpi-icon-wrap green">💵</div>
                    <span className="kpi-trend positive">▲ Revenue</span>
                  </div>
                  <div className="kpi-label">Total Revenus</div>
                  <div className="kpi-value green">{dh(k.revenus)}</div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-top">
                    <div className="kpi-icon-wrap green">📈</div>
                    <span className={`kpi-trend ${k.profit >= 0 ? 'positive' : 'negative'}`}>
                      {k.profit >= 0 ? '▲ Profit' : '▼ Loss'}
                    </span>
                  </div>
                  <div className="kpi-label">Net Profit</div>
                  <div className={`kpi-value ${k.profit >= 0 ? 'green' : 'red'}`}>{dh(k.profit)}</div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-top">
                    <div className="kpi-icon-wrap amber">💰</div>
                    <span className="kpi-trend negative">Ads</span>
                  </div>
                  <div className="kpi-label">Ads Spend</div>
                  <div className="kpi-value red">{dh(k.ads_spend)}</div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-top">
                    <div className="kpi-icon-wrap red">🧾</div>
                    <span className="kpi-trend negative">Charges</span>
                  </div>
                  <div className="kpi-label">Operating Charges</div>
                  <div className="kpi-value red">{dh(k.charges)}</div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-top">
                    <div className="kpi-icon-wrap blue">🚚</div>
                    <span className="kpi-trend neutral">Shipping</span>
                  </div>
                  <div className="kpi-label">Total Expedition</div>
                  <div className="kpi-value">{dh(k.total_expedition)}</div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-top">
                    <div className="kpi-icon-wrap red">↩️</div>
                    <span className="kpi-trend negative">Returns</span>
                  </div>
                  <div className="kpi-label">Returned Orders</div>
                  <div className="kpi-value red">{k.returned}</div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-top">
                    <div className="kpi-icon-wrap purple">☎️</div>
                    <span className="kpi-trend positive">Confirm</span>
                  </div>
                  <div className="kpi-label">Confirmation Rate</div>
                  <div className="kpi-value brand">{k.confirmation_rate}%</div>
                  <div className="progress-bar-wrap">
                    <div className="progress-bar-fill brand" style={{ width: `${Math.min(100, k.confirmation_rate)}%` }}></div>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-top">
                    <div className="kpi-icon-wrap green">✅</div>
                    <span className="kpi-trend positive">Delivery</span>
                  </div>
                  <div className="kpi-label">Delivery Rate</div>
                  <div className="kpi-value green">{k.delivery_rate}%</div>
                  <div className="progress-bar-wrap">
                    <div className="progress-bar-fill green" style={{ width: `${Math.min(100, k.delivery_rate)}%` }}></div>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-top">
                    <div className="kpi-icon-wrap amber">🔁</div>
                    <span className="kpi-trend negative">Rate</span>
                  </div>
                  <div className="kpi-label">Return Rate</div>
                  <div className="kpi-value amber">{k.return_rate}%</div>
                  <div className="progress-bar-wrap">
                    <div className="progress-bar-fill amber" style={{ width: `${Math.min(100, k.return_rate)}%` }}></div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Interactive Recharts Section */}
          <div className="grid2">
            <div className="card">
              <div className="card-header">
                <h2>{isConfirmer ? "📊 Performance Mensuelle (Commandes)" : "📊 Monthly Revenue Overview"}</h2>
                <span className="badge blue">Historique</span>
              </div>
              <div className="chart-container">
                {mounted && monthlyChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={monthlyChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                      <XAxis dataKey="name" stroke="var(--ink-muted)" fontSize={12} tickLine={false} />
                      <YAxis stroke="var(--ink-muted)" fontSize={12} tickLine={false} tickFormatter={(v) => isConfirmer ? v : `${v / 1000}k`} />
                      <Tooltip content={<CustomBarTooltip />} />
                      {isConfirmer ? (
                        <>
                          <Bar dataKey="orders" fill="#64748b" radius={[6, 6, 0, 0]} name="Total Commandes" />
                          <Bar dataKey="confirmed" fill="#10b981" radius={[6, 6, 0, 0]} name="Confirmées" />
                        </>
                      ) : (
                        <Bar dataKey="revenus" fill="url(#barGradient)" radius={[6, 6, 0, 0]} name="Revenus (DH)" />
                      )}
                      <defs>
                        <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#830000" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#dc2626" stopOpacity={0.6} />
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="muted" style={{ textAlign: 'center', paddingTop: 80 }}>{mounted ? 'No monthly records found.' : 'Chargement...'}</p>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h2>☎️ {isConfirmer ? "Répartition des Appels (Pipeline)" : "Call Statuses Breakdown"}</h2>
                <span className="badge brand">Call pipeline</span>
              </div>
              <div className="chart-container">
                {mounted && callChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Tooltip content={<CustomPieTooltip />} />
                      <Pie
                        data={callChartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={95}
                        paddingAngle={3}
                      >
                        {callChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="muted" style={{ textAlign: 'center', paddingTop: 80 }}>{mounted ? 'No call status data recorded.' : 'Chargement...'}</p>
                )}
              </div>
            </div>
          </div>

          {/* Confirmer Performance Table */}
          <div className="card">
            <div className="card-header">
              <h2>🎧 {isConfirmer ? "Mes Performances de Confirmation" : "Confirmer Performance Analysis"}</h2>
              <span className="badge green">Call center metrics</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Confirmer</th>
                    <th>Confirmation Rate</th>
                    <th>Delivery Rate</th>
                    <th>Return Rate</th>
                    <th>Total Orders</th>
                    <th>Confirmed</th>
                    <th>Delivered</th>
                    <th>Returned</th>
                    {!isConfirmer && <th>Total Cost</th>}
                    {!isConfirmer && <th>Revenus Generated</th>}
                  </tr>
                </thead>
                <tbody>
                  {data.confirmers.map((c) => (
                    <tr key={c.id}>
                      <td><strong>{c.name}</strong></td>
                      <td>
                        <span className="badge green" style={{ marginRight: 6 }}>{c.confirmation_rate}%</span>
                        <div className="progress-bar-wrap" style={{ width: 80, display: 'inline-block', verticalAlign: 'middle' }}>
                          <div className="progress-bar-fill green" style={{ width: `${Math.min(100, c.confirmation_rate)}%` }}></div>
                        </div>
                      </td>
                      <td>
                        <span className="badge blue" style={{ marginRight: 6 }}>{c.delivery_rate}%</span>
                        <div className="progress-bar-wrap" style={{ width: 80, display: 'inline-block', verticalAlign: 'middle' }}>
                          <div className="progress-bar-fill blue" style={{ width: `${Math.min(100, c.delivery_rate)}%` }}></div>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${c.return_rate > 20 ? 'red' : 'amber'}`}>{c.return_rate}%</span>
                      </td>
                      <td><strong>{c.total_orders}</strong></td>
                      <td><span className="badge green">{c.confirmed}</span></td>
                      <td><span className="badge blue">{c.delivered}</span></td>
                      <td><span className="badge red">{c.returned}</span></td>
                      {!isConfirmer && <td>{dh(c.total_cost)}</td>}
                      {!isConfirmer && <td><strong style={{ color: 'var(--green-hover)' }}>{dh(c.revenus)}</strong></td>}
                    </tr>
                  ))}
                  {!data.confirmers.length && <tr><td colSpan={isConfirmer ? 8 : 10} className="muted" style={{ textAlign: 'center', padding: 24 }}>No confirmers registered yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* Two Columns: Products & Monthly Tables */}
          <div className="grid2">
            <div className="card">
              <div className="card-header">
                <h2>🛍️ Performance Per Product</h2>
                <span className="badge brand">Landing pages</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Prix Produit</th>
                      <th>Orders</th>
                      <th>Confirmed</th>
                      <th>Delivered</th>
                      {!isConfirmer && <th>Revenus</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {data.products.map((p) => {
                      const basePrice = Number(p.price || 0);

                      return (
                        <tr key={p.id}>
                          <td><strong>{p.name}</strong></td>
                          <td>
                            <strong style={{ color: 'var(--green-text)' }}>{dh(basePrice)}</strong>
                          </td>
                          <td>{p.total_orders}</td>
                          <td><span className="badge green">{p.confirmed}</span></td>
                          <td><span className="badge blue">{p.delivered}</span></td>
                          {!isConfirmer && <td><strong style={{ color: 'var(--brand)' }}>{dh(p.revenus)}</strong></td>}
                        </tr>
                      );
                    })}
                    {!data.products.length && <tr><td colSpan={isConfirmer ? 5 : 6} className="muted" style={{ textAlign: 'center', padding: 20 }}>No products found.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h2>🗓️ Monthly Summary</h2>
                <span className="badge gray">History</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Orders</th>
                      <th>Confirmed</th>
                      <th>Delivered</th>
                      {!isConfirmer && <th>Revenus</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {data.monthly.map((m) => (
                      <tr key={m.month}>
                        <td><strong>{m.month}</strong></td>
                        <td>{m.total_orders}</td>
                        <td><span className="badge green">{m.confirmed}</span></td>
                        <td><span className="badge blue">{m.delivered}</span></td>
                        {!isConfirmer && <td><strong style={{ color: 'var(--green-hover)' }}>{dh(m.revenus)}</strong></td>}
                      </tr>
                    ))}
                    {!data.monthly.length && <tr><td colSpan={isConfirmer ? 4 : 5} className="muted" style={{ textAlign: 'center', padding: 20 }}>No monthly records found.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </Shell>
  );
}

