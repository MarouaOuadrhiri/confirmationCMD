'use client';
import { useEffect, useState, useMemo } from 'react';
import Shell from '../../components/Shell';
import { useApp } from '../../components/AppContext';
import { api, dh } from '../../lib/api';

export default function StockPage() {
  const { brandParam, brandId, user, promptDialog, confirmDialog } = useApp();
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, low, out, instock
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api(`/api/products?x=1${brandParam}`)
      .then((d) => {
        setProducts(d.products || []);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (!user) return;
    load();
  }, [user, brandId]);

  // Adjust stock quantity (+ / - / direct)
  const adjustStock = async (product, delta, directValue = null) => {
    setError('');
    setSuccess('');

    let newStock;
    if (directValue !== null) {
      newStock = Math.max(0, directValue);
    } else {
      newStock = Math.max(0, Number(product.stock || 0) + delta);
    }

    try {
      await api(`/api/products/${product.id}/adjust-stock`, {
        method: 'POST',
        body: { stock: newStock },
      });
      setSuccess(`Stock pour "${product.name}" mis à jour : ${newStock} unités.`);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleCustomStock = async (product) => {
    const input = await promptDialog({
      title: `Modifier le Stock: ${product.name}`,
      message: `Stock actuel: ${product.stock || 0} unités.\nEntrez la nouvelle quantité totale en stock :`,
      placeholder: 'Ex: 150',
      inputType: 'number',
      defaultValue: String(product.stock || 0),
      confirmText: '💾 Enregistrer le Stock',
      cancelText: 'Annuler',
      variant: 'prompt',
      icon: '🏢',
    });

    if (input === null || input === undefined || input === '') return;
    const num = Number(input);
    if (isNaN(num) || num < 0) {
      setError('Veuillez entrer une quantité valide supérieure ou égale à 0.');
      return;
    }

    adjustStock(product, 0, num);
  };

  // KPIs Calculations
  const kpis = useMemo(() => {
    let totalUnits = 0;
    let totalValuation = 0;
    let potentialRevenue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    products.forEach((p) => {
      const stock = Number(p.stock || 0);
      const cost = Number(p.cost || 0);
      const price = Number(p.price || 0);
      const alertLimit = Number(p.min_stock_alert || 15);

      totalUnits += stock;
      totalValuation += stock * cost;
      potentialRevenue += stock * price;

      if (stock === 0) {
        outOfStockCount++;
      } else if (stock <= alertLimit) {
        lowStockCount++;
      }
    });

    return {
      totalUnits,
      totalValuation,
      potentialRevenue,
      lowStockCount,
      outOfStockCount,
      totalProducts: products.length,
    };
  }, [products]);

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const stock = Number(p.stock || 0);
      const alertLimit = Number(p.min_stock_alert || 15);

      // Search query filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchName = p.name?.toLowerCase().includes(q);
        const matchBrand = p.brand_name?.toLowerCase().includes(q);
        const matchId = String(p.id).includes(q);
        if (!matchName && !matchBrand && !matchId) return false;
      }

      // Status filter
      if (statusFilter === 'out') return stock === 0;
      if (statusFilter === 'low') return stock > 0 && stock <= alertLimit;
      if (statusFilter === 'instock') return stock > alertLimit;

      return true;
    });
  }, [products, searchQuery, statusFilter]);

  return (
    <Shell title="🏢 Stock & Gestion d'Inventaire">
      {error && <div className="error" style={{ marginBottom: 16 }}>⚠️ {error}</div>}
      {success && (
        <div className="card" style={{ borderLeft: '4px solid var(--green)', padding: '12px 18px', marginBottom: 20 }}>
          <strong style={{ color: 'var(--green-text)' }}>✅ {success}</strong>
        </div>
      )}

      {/* Top Stock KPIs */}
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 24 }}>
        
        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon-wrap blue">🏢</div>
            <span className="kpi-trend neutral">Inventaire</span>
          </div>
          <div className="kpi-label">Total Unités en Stock</div>
          <div className="kpi-value">{kpis.totalUnits} <span style={{ fontSize: 13, color: 'var(--ink-muted)' }}>unités</span></div>
        </div>

        {user?.role === 'confirmer' ? (
          <div className="kpi-card">
            <div className="kpi-top">
              <div className="kpi-icon-wrap purple">🛍️</div>
              <span className="kpi-trend neutral">Catalogue</span>
            </div>
            <div className="kpi-label">Total Produits Référencés</div>
            <div className="kpi-value brand">{kpis.totalProducts} <span style={{ fontSize: 13, color: 'var(--ink-muted)' }}>produits</span></div>
          </div>
        ) : (
          <>
            <div className="kpi-card">
              <div className="kpi-top">
                <div className="kpi-icon-wrap purple">💰</div>
                <span className="kpi-trend neutral">Valeur d'Achat</span>
              </div>
              <div className="kpi-label">Valeur du Stock (Coût)</div>
              <div className="kpi-value brand">{dh(kpis.totalValuation)}</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-top">
                <div className="kpi-icon-wrap green">💵</div>
                <span className="kpi-trend positive">Valeur Vente</span>
              </div>
              <div className="kpi-label">Revenus Potentiels</div>
              <div className="kpi-value green">{dh(kpis.potentialRevenue)}</div>
            </div>
          </>
        )}

        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon-wrap amber">⚠️</div>
            <span className="kpi-trend negative">Seuil d'Alerte</span>
          </div>
          <div className="kpi-label">Stock Faible (&le; 15)</div>
          <div className={`kpi-value ${kpis.lowStockCount > 0 ? 'amber' : 'green'}`}>
            {kpis.lowStockCount} <span style={{ fontSize: 13, color: 'var(--ink-muted)' }}>produits</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon-wrap red">🚨</div>
            <span className="kpi-trend negative">Rupture</span>
          </div>
          <div className="kpi-label">Rupture de Stock (0)</div>
          <div className={`kpi-value ${kpis.outOfStockCount > 0 ? 'red' : 'green'}`}>
            {kpis.outOfStockCount} <span style={{ fontSize: 13, color: 'var(--ink-muted)' }}>produits</span>
          </div>
        </div>

      </div>

      {/* Main Stock Table Card */}
      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h2>📦 État des Stocks par Produit ({filteredProducts.length})</h2>
            <p className="muted" style={{ fontSize: 13, marginTop: 2 }}>
              Ajustez facilement les quantités et suivez la disponibilité de chaque landing page
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            
            {/* Filter Pills */}
            <div style={{ display: 'flex', gap: 6, background: 'var(--bg)', padding: 4, borderRadius: 8 }}>
              <button 
                className={`btn small ${statusFilter === 'all' ? '' : 'ghost'}`}
                onClick={() => setStatusFilter('all')}
              >
                Tous ({products.length})
              </button>
              <button 
                className={`btn small ${statusFilter === 'low' ? '' : 'ghost'}`}
                style={statusFilter === 'low' ? { background: '#f59e0b', borderColor: '#f59e0b' } : { color: '#f59e0b' }}
                onClick={() => setStatusFilter('low')}
              >
                ⚠️ Stock Faible ({kpis.lowStockCount})
              </button>
              <button 
                className={`btn small ${statusFilter === 'out' ? '' : 'ghost'}`}
                style={statusFilter === 'out' ? { background: '#ef4444', borderColor: '#ef4444' } : { color: '#ef4444' }}
                onClick={() => setStatusFilter('out')}
              >
                🚨 Rupture ({kpis.outOfStockCount})
              </button>
            </div>

            <input
              type="search"
              className="input"
              placeholder="🔍 Rechercher produit ou ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: 220, padding: '8px 12px', fontSize: 13 }}
            />
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Produit</th>
                {user?.role === 'admin' && <th>Marque</th>}
                <th>Prix Vente</th>
                {user?.role !== 'confirmer' && <th>Coût Unitaire</th>}
                <th style={{ minWidth: 160 }}>Niveau de Stock</th>
                <th>Statut</th>
                {user?.role !== 'confirmer' && <th>Valeur Stock</th>}
                <th>Commandes Totales</th>
                {user?.role === 'admin' && <th style={{ textAlign: 'center' }}>Ajustement Rapide</th>}
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((p) => {
                const stock = Number(p.stock || 0);
                const cost = Number(p.cost || 0);
                const alertLimit = Number(p.min_stock_alert || 15);
                const stockValue = stock * cost;

                let statusBadge = <span className="badge green">🟢 En Stock</span>;
                if (stock === 0) {
                  statusBadge = <span className="badge red">🚨 Rupture</span>;
                } else if (stock <= alertLimit) {
                  statusBadge = <span className="badge amber">⚠️ Stock Faible</span>;
                }

                return (
                  <tr key={p.id}>
                    <td>
                      <span className="apikey" style={{ fontWeight: 800, color: 'var(--brand)' }}>
                        #{p.id}
                      </span>
                    </td>
                    <td>
                      <strong style={{ fontSize: 14.5 }}>{p.name}</strong>
                    </td>
                    {user?.role === 'admin' && (
                      <td>
                        <span className="badge purple" style={{ fontWeight: 600 }}>
                          🏷️ {p.brand_name || '—'}
                        </span>
                      </td>
                    )}
                    <td><strong style={{ color: 'var(--green-text)' }}>{dh(p.price)}</strong></td>
                    {user?.role !== 'confirmer' && <td className="muted">{dh(p.cost)}</td>}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 17, fontWeight: 800, minWidth: 36, color: stock === 0 ? 'var(--red)' : stock <= alertLimit ? '#f59e0b' : 'var(--text)' }}>
                          {stock}
                        </span>
                        <div className="progress-bar-wrap" style={{ width: 90, height: 6 }}>
                          <div 
                            className={`progress-bar-fill ${stock === 0 ? 'red' : stock <= alertLimit ? 'amber' : 'green'}`}
                            style={{ width: `${Math.min(100, (stock / 150) * 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td>{statusBadge}</td>
                    {user?.role !== 'confirmer' && <td><strong style={{ color: 'var(--brand)' }}>{dh(stockValue)}</strong></td>}
                    <td>
                      <span className="badge blue">{p.total_units_ordered || 0} vendus</span>
                    </td>
                    {user?.role === 'admin' && (
                      <td>
                        <div className="row-actions" style={{ justifyContent: 'center' }}>
                          <button
                            className="btn ghost small"
                            style={{ padding: '3px 8px', fontWeight: 800 }}
                            title="Diminuer de 10 unités"
                            onClick={() => adjustStock(p, -10)}
                          >
                            -10
                          </button>
                          <button
                            className="btn ghost small"
                            style={{ padding: '3px 8px', fontWeight: 800 }}
                            title="Diminuer de 1 unité"
                            onClick={() => adjustStock(p, -1)}
                          >
                            -1
                          </button>
                          <button
                            className="btn ghost small"
                            style={{ color: 'var(--brand)', borderColor: 'var(--brand)', padding: '3px 8px', fontWeight: 800 }}
                            title="Modifier la quantité exacte"
                            onClick={() => handleCustomStock(p)}
                          >
                            ✏️ Définir
                          </button>
                          <button
                            className="btn ghost small"
                            style={{ padding: '3px 8px', fontWeight: 800, color: 'var(--green-hover)' }}
                            title="Ajouter 1 unité"
                            onClick={() => adjustStock(p, 1)}
                          >
                            +1
                          </button>
                          <button
                            className="btn ghost small"
                            style={{ padding: '3px 8px', fontWeight: 800, color: 'var(--green-hover)' }}
                            title="Ajouter 50 unités"
                            onClick={() => adjustStock(p, 50)}
                          >
                            +50
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {!filteredProducts.length && !loading && (
                <tr>
                  <td colSpan={user?.role === 'admin' ? 10 : 8} className="muted" style={{ textAlign: 'center', padding: 36 }}>
                    Aucun produit trouvé selon vos critères.
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

