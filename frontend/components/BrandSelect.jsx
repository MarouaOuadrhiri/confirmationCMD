'use client';
import { useState, useRef, useEffect } from 'react';
import { BrandIcon } from './BrandBadge';

export default function BrandSelect({ 
  value, 
  onChange, 
  brands = [], 
  includeAll = true, 
  allLabel = 'All brands',
  placeholder = 'Sélectionner une marque',
  className = '',
  style = {},
  disabled = false,
  collapsed = false,
  variant = 'default',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedBrand = brands.find((b) => String(b.id) === String(value));
  const isAll = includeAll && (value === 'all' || !value);
  const isSidebar = variant === 'sidebar' || className.includes('sidebar');

  const handleSelect = (val) => {
    if (onChange) {
      onChange({ target: { value: val } });
    }
    setIsOpen(false);
  };

  return (
    <div 
      ref={containerRef} 
      className={`brand-custom-select-wrap ${isSidebar ? 'variant-sidebar' : ''} ${className}`} 
      style={{ position: 'relative', width: '100%', ...style }}
    >
      <button
        type="button"
        className={`brand-custom-select-trigger ${isSidebar ? 'sidebar-select-trigger' : 'input'}`}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        title={collapsed ? (selectedBrand ? selectedBrand.name : allLabel) : undefined}
        style={collapsed ? { padding: 6, justifyContent: 'center', minWidth: 38 } : undefined}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, overflow: 'hidden' }}>
          {isAll ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <span className="brand-select-logos-preview" style={{ display: 'inline-flex', gap: 3, alignItems: 'center', flexShrink: 0 }}>
                {brands.length > 0 ? (
                  brands.slice(0, 3).map((b) => <BrandIcon key={b.id || b.name} brand={b.name} size={15} />)
                ) : (
                  <>
                    <BrandIcon brand="Noria" size={15} />
                    <BrandIcon brand="Atlas Studio" size={15} />
                    <BrandIcon brand="Lumera" size={15} />
                  </>
                )}
              </span>
              {!collapsed && (
                <span style={{ fontWeight: 600, fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {allLabel}
                </span>
              )}
            </div>
          ) : selectedBrand ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
              <BrandIcon brand={selectedBrand.name} size={17} />
              {!collapsed && (
                <span style={{ fontWeight: 600, fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {selectedBrand.name}
                </span>
              )}
            </div>
          ) : (
            <span style={{ color: 'var(--ink-muted)', fontSize: 12.5 }}>{placeholder}</span>
          )}
        </div>
        {!collapsed && (
          <span 
            style={{ 
              fontSize: 9, 
              color: isSidebar ? '#94a3b8' : 'var(--ink-muted)', 
              transform: isOpen ? 'rotate(180deg)' : 'none', 
              transition: 'transform 0.2s ease',
              marginLeft: 'auto',
              paddingLeft: 4,
              flexShrink: 0,
            }}
          >
            ▼
          </span>
        )}
      </button>

      {isOpen && (
        <div 
          className={`brand-custom-select-dropdown ${isSidebar ? 'sidebar-dropdown' : ''}`} 
          role="listbox"
          style={isSidebar ? { minWidth: 180, left: 0, zIndex: 1100 } : undefined}
        >
          {includeAll && (
            <div
              className={`brand-custom-select-option ${isAll ? 'active' : ''}`}
              onClick={() => handleSelect('all')}
              role="option"
              aria-selected={isAll}
            >
              <span className="brand-select-logos-preview" style={{ display: 'inline-flex', gap: 3, alignItems: 'center', flexShrink: 0 }}>
                {brands.length > 0 ? (
                  brands.slice(0, 3).map((b) => <BrandIcon key={b.id || b.name} brand={b.name} size={15} />)
                ) : (
                  <>
                    <BrandIcon brand="Noria" size={15} />
                    <BrandIcon brand="Atlas Studio" size={15} />
                    <BrandIcon brand="Lumera" size={15} />
                  </>
                )}
              </span>
              <span style={{ fontWeight: isAll ? 700 : 500, whiteSpace: 'nowrap' }}>{allLabel}</span>
            </div>
          )}

          {brands.map((b) => {
            const isSelected = String(b.id) === String(value);
            return (
              <div
                key={b.id}
                className={`brand-custom-select-option ${isSelected ? 'active' : ''}`}
                onClick={() => handleSelect(String(b.id))}
                role="option"
                aria-selected={isSelected}
              >
                <BrandIcon brand={b.name} size={17} />
                <span style={{ fontWeight: isSelected ? 700 : 500, whiteSpace: 'nowrap' }}>{b.name}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

