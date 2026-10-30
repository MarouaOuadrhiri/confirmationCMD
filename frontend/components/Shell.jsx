'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useApp } from './AppContext';
import { BrandIcon, BrandBadge, getBrandConfig } from './BrandBadge';
import BrandSelect from './BrandSelect';

const BRAND_NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/orders', label: 'Commandes', icon: '📦' },
  { href: '/products', label: 'Produits', icon: '🛍️' },
  { href: '/stock', label: 'Stock / Inventaire', icon: '🏢' },
  { href: '/shipping-companies', label: 'Sociétés Livraison', icon: '🚚' },
  { href: '/blacklist', label: 'Liste Noire', icon: '🚫' },
];

const ADMIN_NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/orders', label: 'Commandes', icon: '📦' },
  { href: '/products', label: 'Produits', icon: '🛍️' },
  { href: '/stock', label: 'Stock / Inventaire', icon: '🏢' },
  { href: '/confirmers', label: 'Confirmateurs', icon: '🎧' },
  { href: '/shipping-companies', label: 'Sociétés Livraison', icon: '🚚' },
  { href: '/blacklist', label: 'Liste Noire', icon: '🚫' },
  { href: '/expenses', label: 'Dépenses & Ads', icon: '💸' },
  { href: '/settings', label: 'Marques & Accès', icon: '⚙️' },
];

const CONFIRMER_NAV = [
  { href: '/orders', label: 'Mes Commandes', icon: '📦' },
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/products', label: 'Produits', icon: '🛍️' },
  { href: '/stock', label: 'Stock / Inventaire', icon: '🏢' },
  { href: '/blacklist', label: 'Liste Noire', icon: '🚫' },
];

export default function Shell({ title, children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { 
    user, 
    ready, 
    logout, 
    brands, 
    brandId, 
    setBrandId, 
    brandLabel,
    collapsed,
    toggleCollapse,
    theme,
    toggleTheme
  } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Automatically close mobile menu when navigating
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const handleSidebarToggle = () => {
    if (typeof window !== 'undefined' && window.innerWidth <= 860) {
      setMobileOpen((prev) => !prev);
    } else {
      toggleCollapse();
    }
  };

  const closeMobile = () => {
    setMobileOpen(false);
  };

  useEffect(() => {
    if (ready && !user) {
      router.replace('/login');
    }
  }, [ready, user, router]);

  if (!ready) {
    return (
      <div className="shell">
        <div className="main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
          <p className="muted" style={{ fontSize: 15, fontWeight: 600 }}>Loading Mediast…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  let nav = BRAND_NAV;
  if (user.role === 'admin') nav = ADMIN_NAV;
  else if (user.role === 'confirmer') nav = CONFIRMER_NAV;

  const userInitial = (user.email ? user.email[0] : 'U').toUpperCase();

  return (
    <div className={`shell ${collapsed ? 'sidebar-collapsed' : ''} ${mobileOpen ? 'mobile-menu-active' : ''}`}>
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div 
          className="sidebar-backdrop" 
          onClick={closeMobile}
          title="Fermer le menu"
          aria-label="Fermer le menu"
        />
      )}
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        
        {/* Brand Header */}
        <div className="brand-header">
          <div className="brand-logo-row">
            <div className="brand-icon-box" onClick={handleSidebarToggle} style={{ cursor: 'pointer', background: '#fff', padding: 2, overflow: 'hidden' }} title="Mediast Dashboard">
              <img src="/mediast-logo.jpg" alt="Mediast" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            {(!collapsed || mobileOpen) && (
              <div className="brand-title-wrap">
                <div className="brand-name">Mediast</div>
                {(() => {
                  const activeBrandObj = brandId !== 'all' ? brands.find((b) => String(b.id) === String(brandId)) : null;
                  const isConfirmer = user.role === 'confirmer';
                  const confirmerBrandsList = user.brands && user.brands.length > 0 
                    ? user.brands 
                    : (user.brand ? [user.brand] : (brands.length > 0 ? brands : []));

                  if (isConfirmer) {
                    // Confirmer selected a specific brand
                    if (brandId !== 'all' && activeBrandObj) {
                      const conf = getBrandConfig(activeBrandObj.name);
                      return (
                        <div 
                          className="brand-sub-badge" 
                          style={{ background: conf.bgAlpha, borderColor: conf.borderAlpha, color: conf.color }}
                          title={`Espace de travail : ${activeBrandObj.name}`}
                        >
                          <BrandIcon brand={activeBrandObj.name} size={14} />
                          <span>{activeBrandObj.name}</span>
                        </div>
                      );
                    }
                    // Confirmer with a single brand
                    if (confirmerBrandsList.length === 1) {
                      const singleBrand = confirmerBrandsList[0];
                      const conf = getBrandConfig(singleBrand.name);
                      return (
                        <div 
                          className="brand-sub-badge" 
                          style={{ background: conf.bgAlpha, borderColor: conf.borderAlpha, color: conf.color }}
                          title={`Confirmatrice dédiée ${singleBrand.name}`}
                        >
                          <BrandIcon brand={singleBrand.name} size={14} />
                          <span>{singleBrand.name}</span>
                        </div>
                      );
                    }
                    // Multi-brand confirmer viewing all brands
                    return (
                      <div className="brand-sub-badge multi-brand" title={`Marques assignées (${confirmerBrandsList.length})`}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          {confirmerBrandsList.map((b) => (
                            <BrandIcon key={b.id || b.name} brand={b.name} size={12} />
                          ))}
                        </div>
                        <span>Mes marques ({confirmerBrandsList.length})</span>
                      </div>
                    );
                  }

                  // Brand User role
                  if (user.role === 'brand' && user.brand) {
                    const conf = getBrandConfig(user.brand.name);
                    return (
                      <div 
                        className="brand-sub-badge" 
                        style={{ background: conf.bgAlpha, borderColor: conf.borderAlpha, color: conf.color }}
                      >
                        <BrandIcon brand={user.brand.name} size={14} />
                        <span>{user.brand.name}</span>
                      </div>
                    );
                  }

                  // Admin with specific brand selected
                  if (activeBrandObj) {
                    const conf = getBrandConfig(activeBrandObj.name);
                    return (
                      <div 
                        className="brand-sub-badge" 
                        style={{ background: conf.bgAlpha, borderColor: conf.borderAlpha, color: conf.color }}
                      >
                        <BrandIcon brand={activeBrandObj.name} size={14} />
                        <span>{activeBrandObj.name}</span>
                      </div>
                    );
                  }

                  // Admin viewing All Brands
                  return (
                    <div className="brand-sub-badge">
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <BrandIcon brand="Noria" size={12} />
                        <BrandIcon brand="Atlas Studio" size={12} />
                        <BrandIcon brand="Lumera" size={12} />
                      </div>
                      <span>All brands</span>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
          <button 
            type="button" 
            className="sidebar-toggle-btn" 
            onClick={handleSidebarToggle}
            title={collapsed ? 'Expand Sidebar (Ctrl+B)' : 'Collapse Sidebar'}
            aria-label={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {collapsed ? '▶' : '◀'}
          </button>
        </div>

        {/* Brand Filter (Admin & Multi-brand Confirmer) */}
        {(user.role === 'admin' || (user.role === 'confirmer' && brands.length > 1)) && (
          <div className="brand-filter-box">
            {(!collapsed || mobileOpen) && <label>{user.role === 'admin' ? 'Filtrer Marque' : 'Mes Marques'}</label>}
            <BrandSelect
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              brands={brands}
              includeAll={true}
              allLabel={user.role === 'confirmer' ? `Toutes mes marques (${brands.length})` : 'All brands'}
              collapsed={collapsed && !mobileOpen}
              variant="sidebar"
            />
          </div>
        )}

        {/* Nav links */}
        <nav>
          {nav.map((n) => {
            const isActive = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={isActive ? 'active' : ''}
                title={n.label}
              >
                <span className="nav-icon">{n.icon}</span>
                {(!collapsed || mobileOpen) && <span className="nav-label">{n.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User Box / Footer */}
        <div className="userbox">
          <div className="user-info-row" title={user.email}>
            <div className="user-avatar">{userInitial}</div>
            {(!collapsed || mobileOpen) && (
              <div className="user-details">
                <div className="user-email">{user.email}</div>
                <div className="user-role">
                  {user.role === 'admin' 
                    ? '👑 Administrator' 
                    : user.role === 'confirmer'
                    ? `🎧 Confirmer (${user.confirmer_name || 'Agent'})`
                    : `🏷️ Brand: ${user.brand?.name || ''}`}
                </div>
              </div>
            )}
          </div>
          
          <div className="user-actions-row">
            <button 
              className="theme-toggle-btn" 
              onClick={toggleTheme} 
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? '☀️' : '🌙'} {(!collapsed || mobileOpen) && (theme === 'dark' ? 'Light' : 'Dark')}
            </button>
            <button 
              className="logout-btn" 
              onClick={logout} 
              title="Sign out"
            >
              {(!collapsed || mobileOpen) ? 'Sign out' : '🚪'}
            </button>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button 
              type="button" 
              className="topbar-collapse-btn" 
              onClick={handleSidebarToggle}
              title={collapsed ? 'Ouvrir le menu (Ctrl+B)' : 'Réduire le menu'}
              aria-label="Toggle navigation menu"
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>☰</span>
            </button>
            <h1 className="page-title">{title}</h1>
          </div>
          <div className="topbar-right">
            <div className="active-brand-chip">
              {user.role === 'confirmer' ? (
                <div className="brand-chip-inner">
                  <span style={{ fontSize: 13 }}>🎧</span>
                  <span className="brand-chip-confirmer-name">{user.confirmer_name || user.email}</span>
                  <span className="brand-chip-divider" style={{ opacity: 0.4 }}>|</span>
                  {brandId !== 'all' ? (
                    <BrandBadge brand={brandLabel} size="sm" />
                  ) : (
                    <span className="brand-chip-all">
                      <span className="brand-chip-icons">
                        {((user.brands && user.brands.length > 0) ? user.brands : (user.brand ? [user.brand] : [])).map((b) => (
                          <BrandIcon key={b.id || b.name} brand={b.name} size={15} />
                        ))}
                      </span>
                      <span className="brand-chip-text-full" style={{ color: 'var(--ink-muted)' }}>
                        ({((user.brands && user.brands.length > 0) ? user.brands : (user.brand ? [user.brand] : [])).length} marques)
                      </span>
                      <span className="brand-chip-text-short" style={{ color: 'var(--ink-muted)' }}>
                        {((user.brands && user.brands.length > 0) ? user.brands : (user.brand ? [user.brand] : [])).length}M
                      </span>
                    </span>
                  )}
                </div>
              ) : user.role === 'admin' ? (
                <div className="brand-chip-inner">
                  <span className="brand-chip-prefix">Espace :</span>
                  {brandId === 'all' ? (
                    <span className="brand-chip-all">
                      <span className="brand-chip-icons">
                        <BrandIcon brand="Noria" size={15} />
                        <BrandIcon brand="Atlas Studio" size={15} />
                        <BrandIcon brand="Lumera" size={15} />
                      </span>
                      <span className="brand-chip-text-full">Toutes les marques</span>
                      <span className="brand-chip-text-short">Toutes</span>
                    </span>
                  ) : (
                    <BrandBadge brand={brandLabel} size="sm" />
                  )}
                </div>
              ) : (
                <BrandBadge brand={user.brand?.name} size="sm" />
              )}
            </div>
          </div>
        </header>
        <div className="content-container">
          {children}
        </div>
      </main>
    </div>
  );
}

