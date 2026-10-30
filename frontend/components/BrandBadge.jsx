'use client';

export function getBrandConfig(brandNameOrSlug) {
  const norm = String(brandNameOrSlug || '').trim().toLowerCase();
  if (norm.includes('noria')) {
    return {
      name: 'Noria',
      slug: 'noria',
      iconUrl: '/brands/noria-icon.svg',
      logoUrl: '/brands/noria-icon.svg',
      color: '#35617b',
      lightColor: '#35617b',
      bgAlpha: 'rgba(53, 97, 123, 0.14)',
      borderAlpha: 'rgba(53, 97, 123, 0.32)',
      symbol: 'N',
      tagline: 'Beauty & Skincare',
    };
  }
  if ((norm.includes('atlas-studio') || norm.includes('atlas studio'))) {
    return {
      name: 'Atlas Studio',
      slug: 'atlas-studio',
      iconUrl: '/brands/atlas-studio-icon.svg',
      logoUrl: '/brands/atlas-studio-icon.svg',
      color: '#98623c',
      lightColor: '#98623c',
      bgAlpha: 'rgba(152, 98, 60, 0.14)',
      borderAlpha: 'rgba(152, 98, 60, 0.35)',
      symbol: '✦',
      tagline: 'Cosmetics',
    };
  }
  if (norm.includes('lumera')) {
    return {
      name: 'Lumera',
      slug: 'lumera',
      iconUrl: '/brands/lumera-icon.svg',
      logoUrl: '/brands/lumera-icon.svg',
      color: '#526848',
      lightColor: '#526848',
      bgAlpha: 'rgba(82, 104, 72, 0.14)',
      borderAlpha: 'rgba(82, 104, 72, 0.35)',
      symbol: 'L',
      tagline: 'Cosmetics',
    };
  }
  return {
    name: brandNameOrSlug || 'Brand',
    slug: norm,
    iconUrl: null,
    logoUrl: null,
    color: '#818cf8',
    lightColor: '#4f46e5',
    bgAlpha: 'rgba(99, 102, 241, 0.14)',
    borderAlpha: 'rgba(99, 102, 241, 0.35)',
    symbol: (brandNameOrSlug ? String(brandNameOrSlug)[0] : '🏷️').toUpperCase(),
    tagline: '',
  };
}

export function BrandIcon({ brand, size = 16, style = {}, className = '' }) {
  const conf = getBrandConfig(typeof brand === 'string' ? brand : brand?.name || brand?.slug);
  
  if (conf.iconUrl) {
    return (
      <span
        className={`brand-icon-wrapper ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size,
          height: size,
          flexShrink: 0,
          verticalAlign: 'middle',
          ...style,
        }}
      >
        <img
          src={conf.iconUrl}
          alt={conf.name}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block',
          }}
        />
      </span>
    );
  }

  return (
    <span
      className={`brand-fallback-icon ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: 4,
        background: conf.bgAlpha,
        color: conf.color,
        fontSize: Math.max(9, Math.round(size * 0.65)),
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1,
        flexShrink: 0,
        ...style,
      }}
    >
      {conf.symbol}
    </span>
  );
}

export function BrandBadge({ brand, showText = true, size = 'sm', className = '', style = {} }) {
  const conf = getBrandConfig(typeof brand === 'string' ? brand : brand?.name || brand?.slug);
  const iconSize = size === 'lg' ? 20 : size === 'md' ? 16 : 14;

  return (
    <span
      className={`brand-badge-pill ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: size === 'lg' ? '4px 12px' : size === 'md' ? '3px 9px' : '2px 8px',
        borderRadius: '9999px',
        background: conf.bgAlpha,
        border: `1px solid ${conf.borderAlpha}`,
        color: conf.color,
        fontSize: size === 'lg' ? '13px' : size === 'md' ? '12px' : '11px',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      <BrandIcon brand={conf.name} size={iconSize} />
      {showText && <span>{conf.name}</span>}
    </span>
  );
}



