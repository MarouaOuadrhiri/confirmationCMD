'use client';
import { useState } from 'react';
import { useApp } from '../../components/AppContext';
import { BrandIcon } from '../../components/BrandBadge';
import './portal.css';

const spaces = [
  { id: 'brand', title: 'Brand', icon: '◇', description: 'Pilotez votre marque, vos commandes et vos performances.', detail: 'Votre activité, en un seul endroit.', email: 'lumera@dashboard.local', password: 'Brand123!' },
  { id: 'confirmer', title: 'Confirmatrice', icon: '◉', description: 'Retrouvez vos commandes et simplifiez chaque confirmation.', detail: 'Une journée organisée, des clients bien accompagnés.', email: 'confirmer1@dashboard.local', password: 'Confirmer123!' },
  { id: 'admin', title: 'Admin', icon: '▦', description: 'Supervisez les marques, les équipes et les accès.', detail: 'Une vision complète de vos opérations.', email: 'admin@dashboard.local', password: 'Admin123!' },
];

export default function LoginPage() {
  const { login } = useApp();
  const [role, setRole] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const space = spaces.find(item => item.id === role);
  function choose(id) { setRole(id); setEmail(''); setPassword(''); setError(''); setVisible(false); }
  async function submit(event) {
    event.preventDefault(); setError(''); setLoading(true);
    try { await login(email, password, role); }
    catch (err) { setError(err.message || 'Connexion impossible. Veuillez réessayer.'); }
    finally { setLoading(false); }
  }
  return <main className="portal">
    <header className="portal-header"><a href="/login" className="portal-wordmark"><span className="portal-mark">m<span>↗</span></span>mediast<span className="portal-wordmark-caption">CONFIRMATION</span></a><span className="portal-header-note"><i /> Votre espace de travail COD</span></header>
    <div className="portal-layout">
      <section className="portal-story">
        <span className="portal-eyebrow">MOINS DE FRICTION. PLUS DE CROISSANCE.</span>
        <h1>Chaque commande.<br />Chaque équipe.<br /><em>Le même élan.</em></h1>
        <p>De la première confirmation à la livraison, gardez une longueur d’avance sur votre activité.</p>
        <div className="portal-preview" aria-label="Aperçu avec données fictives">
          <div className="portal-preview-head"><span>Vue d’ensemble</span><span className="portal-demo-label">Données fictives</span></div>
          <div className="portal-preview-value">128 450 <small>DH</small><span>Revenus ce mois-ci</span></div>
          <div className="portal-chart" aria-hidden="true">{[32, 48, 40, 65, 55, 72, 64, 88, 76, 94, 86, 100].map((height, i) => <span key={i} style={{ height: `${height}%` }} />)}</div>
          <div className="portal-preview-bottom"><span><strong>842</strong> commandes</span><span><strong>87,4 %</strong> confirmées</span></div>
        </div>
        <div className="portal-brands"><span>Marques de démonstration</span><div>{['Lumera', 'Noria', 'Atlas Studio'].map(brand => <span key={brand}><BrandIcon brand={brand} size={28} />{brand}</span>)}</div></div>
      </section>
      <section className="portal-access" aria-labelledby="access-title">
        <div className="portal-step">ESPACE DE CONNEXION <span>{space ? '02 / 02' : '01 / 02'}</span></div>
        {space ? <>
          <button type="button" className="portal-back" onClick={() => choose(null)} disabled={loading}>← Changer d’espace</button>
          <span className="portal-role-icon" aria-hidden="true">{space.icon}</span>
          <h2 id="access-title">Connexion {space.title}</h2><p className="portal-intro">{space.detail}</p>
          <div className="portal-demo-access">
            <button type="button" disabled={loading} onClick={() => { setEmail(space.email); setPassword(space.password); setError(''); }}>Remplir les accès démo {space.title} <span aria-hidden="true">↗</span></button>
            <p>Compte de démonstration{role === 'brand' ? ' Lumera' : ''} · Cliquez puis connectez-vous.</p>
          </div>
          <form onSubmit={submit} className="portal-form">
            <label htmlFor="portal-email">Adresse e-mail</label><input id="portal-email" type="email" autoComplete="username" autoFocus required placeholder={space.email} value={email} onChange={e => setEmail(e.target.value)} disabled={loading} />
            <label htmlFor="portal-password">Mot de passe</label><div className="portal-password"><input id="portal-password" type={visible ? 'text' : 'password'} autoComplete="current-password" required placeholder="Votre mot de passe" value={password} onChange={e => setPassword(e.target.value)} disabled={loading} /><button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} aria-pressed={visible}>{visible ? 'Masquer' : 'Afficher'}</button></div>
            {error && <p role="alert" className="portal-error">{error}</p>}
            <button className="portal-submit" disabled={loading}>{loading ? 'Connexion en cours…' : `Accéder à mon espace ${space.title}`} <span aria-hidden="true">→</span></button>
          </form><p className="portal-help">Besoin d’un accès ? Contactez votre administrateur.</p>
        </> : <>
          <h2 id="access-title">Bienvenue chez vous.</h2><p className="portal-intro">Choisissez votre espace pour vous connecter.</p>
          <div className="portal-roles">{spaces.map(item => <button key={item.id} type="button" className="portal-role" onClick={() => choose(item.id)}><span className="portal-role-icon" aria-hidden="true">{item.icon}</span><span><strong>Espace {item.title}</strong><small>{item.description}</small></span><span className="portal-role-arrow" aria-hidden="true">↗</span></button>)}</div>
          <div className="portal-security"><span aria-hidden="true">♧</span><p><strong>Un accès dédié à chaque rôle</strong><br />Vos outils et vos données, selon vos permissions.</p></div>
        </>}
      </section>
    </div>
    <footer className="portal-footer"><span>© {new Date().getFullYear()} Mediast</span><span>Confirmation · Suivi · Performance</span></footer>
  </main>;
}


