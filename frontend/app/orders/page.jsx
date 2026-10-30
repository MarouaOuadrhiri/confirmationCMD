'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Shell from '../../components/Shell';
import BrandSelect from '../../components/BrandSelect';
import { useApp } from '../../components/AppContext';
import { api, dh } from '../../lib/api';
import { BrandBadge, BrandIcon } from '../../components/BrandBadge';

const ALL_CHANNELS = [
  { id: 'WhatsApp', label: 'WhatsApp', icon: '💬', badgeClass: 'badge-source-whatsapp' },
  { id: 'Instagram', label: 'Instagram', icon: '📸', badgeClass: 'badge-source-instagram' },
  { id: 'Facebook', label: 'Facebook', icon: '👤', badgeClass: 'badge-source-facebook' },
  { id: 'Landing Page', label: 'Landing Page', icon: '🌐', badgeClass: 'badge-source-landing' },
  { id: 'Direct / Other', label: 'Direct / Autre', icon: '📞', badgeClass: 'badge-source-direct' },
];

const MANUAL_CHANNELS = [
  { id: 'WhatsApp', label: 'WhatsApp', icon: '💬', badgeClass: 'badge-source-whatsapp' },
  { id: 'Instagram', label: 'Instagram', icon: '📸', badgeClass: 'badge-source-instagram' },
  { id: 'Facebook', label: 'Facebook', icon: '👤', badgeClass: 'badge-source-facebook' },
  { id: 'Direct / Other', label: 'Direct / Autre', icon: '📞', badgeClass: 'badge-source-direct' },
];

const QUICK_TAGS = [
  '💬 Confirmé via WhatsApp',
  '📸 Confirmé via Instagram',
  '👤 Confirmé via Facebook',
  '📞 Rappeler plus tard',
  '📍 Adresse & Ville confirmées',
  '🚚 Demande livraison expresse',
  '⏰ Reporté à une date ultérieure',
  '❌ Injoignable après 2 appels',
  '⚠️ Vérifier contenu du colis',
];

function getCallPillClass(status) {
  if (!status) return 'pill-default';
  if (status.includes('Confirmé')) return 'pill-confirmed';
  if (status.includes('Nouveau')) return 'pill-new';
  if (status.includes('Appel') || status.includes('Whatsapp') || status.includes('SMS')) return 'pill-call';
  if (status.includes('Annulé') || status.includes('Fake') || status.includes('Pas sérieux') || status.includes('Double')) return 'pill-cancelled';
  if (status.includes('Reporté') || status.includes('Pas de réponse') || status.includes('Injoignable') || status.includes('Boîte')) return 'pill-pending';
  return 'pill-default';
}

function getShipPillClass(status) {
  if (!status) return 'pill-default';
  if (status.includes('Livré')) return 'pill-delivered';
  if (status.includes('Mise En Distribution')) return 'pill-distribute';
  if (status.includes('En attente')) return 'pill-pending';
  if (status.includes('Retourné') || status.includes('Refusé')) return 'pill-returned';
  if (status.includes('Annulé')) return 'pill-cancelled';
  if (status.includes('Reporté') || status.includes('Injoignable') || status.includes('Pas de réponse')) return 'pill-pending';
  return 'pill-default';
}

function getSourceBadge(source) {
  const s = source ? String(source).trim() : 'WhatsApp';
  const found = ALL_CHANNELS.find((c) => c.id.toLowerCase() === s.toLowerCase() || (s === 'landing' && c.id === 'Landing Page'));
  if (found) {
    return (
      <span className={`badge-source ${found.badgeClass}`} title={`Canal: ${found.label}`}>
        <span>{found.icon}</span>
        <span>{found.label}</span>
      </span>
    );
  }
  return (
    <span className="badge-source badge-source-direct" title={`Canal: ${s}`}>
      <span>📞</span>
      <span>{s}</span>
    </span>
  );
}

export default function OrdersPage() {
  const { brandParam, brandId, setBrandId, brands, user, promptDialog } = useApp();
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [callStatus, setCallStatus] = useState('');
  const [shipStatus, setShipStatus] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [confirmerFilter, setConfirmerFilter] = useState('');
  const [blacklistFilter, setBlacklistFilter] = useState('');
  const [statuses, setStatuses] = useState({ call_statuses: [], shipping_statuses: [] });
  const [products, setProducts] = useState([]);
  const [confirmers, setConfirmers] = useState([]);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Blacklist & Customer Risk Modal State
  const [customerRiskOrder, setCustomerRiskOrder] = useState(null);
  const [blacklisting, setBlacklisting] = useState(false);

  // Shipping Companies & Confirmation Modal State
  const [shippingCompanies, setShippingCompanies] = useState([]);
  const [shippingModalOrder, setShippingModalOrder] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [trackingCode, setTrackingCode] = useState('');
  const [savingShipping, setSavingShipping] = useState(false);

  // Note Modal State
  const [activeNoteOrder, setActiveNoteOrder] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // New Order Modal State
  const [showForm, setShowForm] = useState(false);
  const [formBrandId, setFormBrandId] = useState('');
  const [form, setForm] = useState({
    source: 'WhatsApp',
    product_id: '',
    quantity: 1,
    price: '',
    delivery_fee: '0',
    confirmer_id: '',
    customer_name: '',
    phone: '',
    city: '',
    address: '',
    call_status: 'Nouveau',
    shipping_status: 'En attente',
    shipping_company: '',
    tracking_number: '',
    note: '',
  });

  // Duplicate & Blacklist Check State
  const [dupStatus, setDupStatus] = useState({
    loading: false,
    found: false,
    count: 0,
    has_exact_duplicate: false,
    exact_duplicates: [],
    has_different_product: false,
    different_products: [],
    older_orders: [],
    is_blacklisted: false,
    refusal_count: 0,
    refusal_orders: [],
    delivered_count: 0,
    orders: [],
  });
  const [duplicateConfirmModal, setDuplicateConfirmModal] = useState(false);

  const load = (p = page) => {
    setLoading(true);
    const params = new URLSearchParams({ page: p, limit: 25 });
    if (q) params.set('q', q);
    if (callStatus) params.set('call_status', callStatus);
    if (shipStatus) params.set('shipping_status', shipStatus);
    if (sourceFilter) params.set('source', sourceFilter);
    if (confirmerFilter) params.set('confirmer_id', confirmerFilter);
    if (blacklistFilter) params.set('blacklist', blacklistFilter);

    api(`/api/orders?${params}${brandParam}`)
      .then((d) => {
        setOrders(d.orders || []);
        setTotal(d.total || 0);
        setPage(d.page || 1);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!user) return;
    api('/api/orders/meta/statuses').then(setStatuses).catch(() => {});
    api('/api/products').then((d) => setProducts(d.products || [])).catch(() => {});
    api(`/api/confirmers?x=1${brandParam}`).then((d) => setConfirmers(d.confirmers || [])).catch(() => {});
    api('/api/shipping-companies').then((d) => setShippingCompanies(d.companies || [])).catch(() => {});
  }, [user, brandId]);

  useEffect(() => {
    if (!user) return;
    load(1);
  }, [user, brandId, callStatus, shipStatus, sourceFilter, confirmerFilter, blacklistFilter]);

  // Initial brand selection for new order form
  useEffect(() => {
    if (brands.length > 0 && !formBrandId) {
      if (user?.role === 'brand' || user?.role === 'confirmer') {
        setFormBrandId(String(user.brand_id || brands[0]?.id || ''));
      } else if (brandId && brandId !== 'all') {
        setFormBrandId(String(brandId));
      } else {
        setFormBrandId(String(brands[0]?.id || ''));
      }
    }
  }, [brands, user, brandId]);

  // Real-time debounced duplicate & blacklist check
  useEffect(() => {
    if (!showForm || !form.phone) {
      setDupStatus({ loading: false, found: false, count: 0, has_exact_duplicate: false, exact_duplicates: [], has_different_product: false, different_products: [], older_orders: [], is_blacklisted: false, refusal_count: 0, refusal_orders: [], delivered_count: 0, orders: [] });
      return;
    }
    const clean = form.phone.replace(/[^0-9]/g, '');
    if (clean.length < 8) {
      setDupStatus({ loading: false, found: false, count: 0, has_exact_duplicate: false, exact_duplicates: [], has_different_product: false, different_products: [], older_orders: [], is_blacklisted: false, refusal_count: 0, refusal_orders: [], delivered_count: 0, orders: [] });
      return;
    }

    const effectiveBid = user?.brand_id || Number(formBrandId);
    const selectedProd = products.find((p) => p.id === Number(form.product_id));
    const prodName = selectedProd?.name || '';

    const timer = setTimeout(() => {
      setDupStatus((prev) => ({ ...prev, loading: true }));
      const params = new URLSearchParams({
        phone: form.phone,
        brand_id: effectiveBid ? String(effectiveBid) : '',
        product_id: form.product_id ? String(form.product_id) : '',
        product_name: prodName,
        customer_name: form.customer_name || '',
      });
      api(`/api/orders/check-duplicate?${params}`)
        .then((res) => {
          setDupStatus({
            loading: false,
            found: res.found,
            count: res.count,
            has_exact_duplicate: res.has_exact_duplicate,
            exact_duplicates: res.exact_duplicates || [],
            has_different_product: res.has_different_product,
            different_products: res.different_products || [],
            older_orders: res.older_orders || [],
            is_blacklisted: res.is_blacklisted || false,
            refusal_count: res.refusal_count || 0,
            refusal_orders: res.refusal_orders || [],
            delivered_count: res.delivered_count || 0,
            orders: res.orders || [],
          });
        })
        .catch(() => setDupStatus((prev) => ({ ...prev, loading: false })));
    }, 250);

    return () => clearTimeout(timer);
  }, [form.phone, form.product_id, form.customer_name, formBrandId, showForm, user, products]);

  const setStatus = async (id, patch) => {
    try {
      await api(`/api/orders/${id}`, { method: 'PUT', body: patch });
      setOrders((prev) =>
        prev.map((o) => (o.id === id ? { ...o, ...patch } : o))
      );
    } catch (e) {
      setError(e.message);
    }
  };

  const openShippingModal = (order) => {
    setShippingModalOrder(order);
    setSelectedCompany(order.shipping_company || (shippingCompanies[0]?.name || 'Ozon Express'));
    setTrackingCode(order.tracking_number || '');
  };

  const handleCallStatusChange = (order, newStatus) => {
    if (newStatus === 'Confirmé') {
      openShippingModal(order);
    } else {
      setStatus(order.id, { call_status: newStatus });
    }
  };

  const saveOrderWithShipping = async (withCompany = true) => {
    if (!shippingModalOrder) return;
    setSavingShipping(true);
    try {
      const patch = {
        call_status: 'Confirmé',
        shipping_company: withCompany ? selectedCompany : null,
        tracking_number: withCompany && trackingCode.trim() ? trackingCode.trim() : null,
      };
      const res = await api(`/api/orders/${shippingModalOrder.id}`, {
        method: 'PUT',
        body: patch,
      });
      const updatedOrder = res.order || { ...shippingModalOrder, ...patch };
      setOrders((prev) =>
        prev.map((o) => (o.id === shippingModalOrder.id ? { ...o, ...updatedOrder } : o))
      );

      let msg = withCompany && selectedCompany
        ? `✅ Commande #${shippingModalOrder.id} confirmée avec ${selectedCompany} !`
        : `✅ Commande #${shippingModalOrder.id} confirmée avec succès !`;

      if (res.ozon_sync) {
        if (res.ozon_sync.success) {
          msg += res.ozon_sync.tracking ? ` (⚡ Colis Ozon créé: ${res.ozon_sync.tracking})` : ` (⚡ Colis envoyé à Ozon Express)`;
        } else if (res.ozon_sync.error) {
          console.warn('[Ozon Express API response]:', res.ozon_sync.error);
        }
      }

      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(''), 5000);
      setShippingModalOrder(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingShipping(false);
    }
  };

  const openCustomerRiskModal = (order) => {
    setCustomerRiskOrder(order);
  };

  const toggleBlacklistForCustomer = async (phone, isCurrentlyBlacklisted, customerName) => {
    if (!phone) return;
    setBlacklisting(true);
    setError('');
    try {
      if (isCurrentlyBlacklisted) {
        const adminPassword = await promptDialog({
          title: '🔓 Débloquer de la Liste Noire',
          message: `Veuillez saisir votre mot de passe administrateur pour débloquer le numéro ${phone} :`,
          placeholder: 'Mot de passe administrateur...',
          inputType: 'password',
          confirmText: 'Débloquer le numéro',
          cancelText: 'Annuler',
          variant: 'prompt',
          icon: '🔓',
        });
        if (!adminPassword) {
          setBlacklisting(false);
          return;
        }
        await api(`/api/blacklist/${encodeURIComponent(phone)}`, {
          method: 'DELETE',
          headers: { 'x-admin-password': adminPassword },
        });
        setSuccessMsg(`Numéro ${phone} retiré de la liste noire.`);
      } else {
        await api('/api/blacklist', {
          method: 'POST',
          body: {
            phone,
            customer_name: customerName,
            reason: 'Ajouté suite à retours/refus répétés',
          },
        });
        setSuccessMsg(`Numéro ${phone} ajouté à la Liste Noire 🚫.`);
      }
      setTimeout(() => setSuccessMsg(''), 4000);
      setCustomerRiskOrder(null);
      load(page);
    } catch (e) {
      setError(e.message);
    } finally {
      setBlacklisting(false);
    }
  };

  const handleConfirmerAssign = async (orderId, newConfirmerId) => {
    const confirmerVal = newConfirmerId ? Number(newConfirmerId) : null;
    const selectedConfirmer = confirmers.find((c) => c.id === confirmerVal);
    try {
      await api(`/api/orders/${orderId}`, {
        method: 'PUT',
        body: { confirmer_id: confirmerVal },
      });
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, confirmer_id: confirmerVal, confirmer_name: selectedConfirmer?.name || null }
            : o
        )
      );
    } catch (e) {
      setError(e.message);
    }
  };

  // Open Note Modal for an order
  const openNoteModal = (order) => {
    setActiveNoteOrder(order);
    setNoteDraft(order.note || '');
  };

  const saveOrderNote = async () => {
    if (!activeNoteOrder) return;
    setSavingNote(true);
    try {
      await api(`/api/orders/${activeNoteOrder.id}`, {
        method: 'PUT',
        body: { note: noteDraft.trim() || null },
      });
      setOrders((prev) =>
        prev.map((o) => (o.id === activeNoteOrder.id ? { ...o, note: noteDraft.trim() || null } : o))
      );
      setActiveNoteOrder(null);
      setSuccessMsg('Note enregistrée avec succès.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingNote(false);
    }
  };

  const addQuickTag = (tag) => {
    setNoteDraft((prev) => (prev ? `${prev} · ${tag}` : tag));
  };

  const fillFromHistory = (histOrder) => {
    setForm((prev) => ({
      ...prev,
      customer_name: histOrder.customer_name || prev.customer_name,
      city: histOrder.city || prev.city,
      address: histOrder.address || prev.address,
    }));
  };

  const onProductSelect = (pId, currentQty = form.quantity) => {
    const p = products.find((prod) => prod.id === Number(pId));
    if (p) {
      const unitPrice = Number(p.price) || 0;
      const q = Math.max(1, Number(currentQty) || 1);
      setForm((prev) => ({
        ...prev,
        product_id: String(p.id),
        price: String(unitPrice * q),
      }));
    } else {
      setForm((prev) => ({ ...prev, product_id: '', price: '' }));
    }
  };

  const onQuantityChange = (newQty) => {
    const q = Math.max(1, Number(newQty) || 1);
    const selectedProd = products.find((p) => p.id === Number(form.product_id));
    if (selectedProd) {
      const unitPrice = Number(selectedProd.price) || 0;
      setForm((prev) => ({
        ...prev,
        quantity: newQty,
        price: String(unitPrice * q),
      }));
    } else {
      setForm((prev) => ({ ...prev, quantity: newQty }));
    }
  };

  const onFormBrandChange = (newBid) => {
    setFormBrandId(newBid);
    const brandProds = products.filter((p) => String(p.brand_id) === String(newBid));
    const firstProd = brandProds[0];
    const q = Math.max(1, Number(form.quantity) || 1);
    setForm((prev) => ({
      ...prev,
      product_id: firstProd ? String(firstProd.id) : '',
      price: firstProd ? String((Number(firstProd.price) || 0) * q) : '',
      delivery_fee: '0',
    }));
  };

  const openNewOrderDrawer = () => {
    const defaultBid = (brandId !== 'all' ? brandId : '') || user?.brand?.id || brands[0]?.id || '';
    const initialBrandProds = products.filter((p) => String(p.brand_id) === String(defaultBid));
    const firstProd = initialBrandProds[0];

    setFormBrandId(String(defaultBid));
    setDupStatus({ loading: false, found: false, count: 0, has_exact_duplicate: false, exact_duplicates: [], has_different_product: false, different_products: [], older_orders: [], orders: [] });
    setDuplicateConfirmModal(false);
    setForm({
      source: 'WhatsApp',
      product_id: firstProd ? String(firstProd.id) : '',
      quantity: 1,
      price: firstProd ? String(firstProd.price) : '',
      delivery_fee: '0',
      confirmer_id: user?.role === 'confirmer' && user.confirmer_id ? String(user.confirmer_id) : '',
      customer_name: '',
      phone: '',
      city: '',
      address: '',
      call_status: 'Nouveau',
      shipping_status: 'En attente',
      note: '',
    });
    setShowForm(true);
  };

  const createOrder = async (bypassDuplicateWarning = false) => {
    setError('');
    if (!form.customer_name || !form.phone) {
      setError('Nom du client et numéro de téléphone sont obligatoires.');
      return;
    }

    const effectiveBrandId = Number(formBrandId) || user?.brand?.id || (brands.length === 1 ? brands[0]?.id : null);
    if (!effectiveBrandId) {
      setError('Veuillez sélectionner une marque pour cette commande.');
      return;
    }

    // Resolve product ID and price reliably
    let finalProductId = form.product_id ? Number(form.product_id) : undefined;
    let finalPrice = form.price !== '' && !isNaN(Number(form.price)) ? Number(form.price) : undefined;
    const q = Math.max(1, Number(form.quantity) || 1);

    if (!finalProductId) {
      const brandProds = products.filter((p) => String(p.brand_id) === String(effectiveBrandId));
      if (brandProds.length > 0) {
        finalProductId = brandProds[0].id;
        if (finalPrice === undefined || finalPrice <= 0) {
          finalPrice = (Number(brandProds[0].price) || 0) * q;
        }
      }
    } else if (finalPrice === undefined || finalPrice <= 0) {
      const chosenProd = products.find((p) => p.id === finalProductId);
      if (chosenProd) {
        finalPrice = (Number(chosenProd.price) || 0) * q;
      }
    }

    // Only block if an EXACT duplicate for the SAME product was created recently (<48h)
    if (!bypassDuplicateWarning && dupStatus.has_exact_duplicate) {
      setDuplicateConfirmModal(true);
      return;
    }

    try {
      await api('/api/orders', {
        method: 'POST',
        body: {
          brand_id: effectiveBrandId,
          source: form.source,
          product_id: finalProductId,
          quantity: q,
          price: finalPrice,
          delivery_fee: form.delivery_fee !== '' ? Number(form.delivery_fee) : 0,
          confirmer_id: form.confirmer_id ? Number(form.confirmer_id) : null,
          customer_name: form.customer_name.trim(),
          phone: form.phone.trim(),
          city: form.city.trim() || undefined,
          address: form.address.trim() || undefined,
          call_status: form.call_status,
          shipping_status: form.shipping_status,
          note: form.note.trim() || undefined,
        },
      });
      setShowForm(false);
      setDuplicateConfirmModal(false);
      setSuccessMsg(`Commande ${form.source} créée avec succès !`);
      setTimeout(() => setSuccessMsg(''), 4000);
      load(1);
    } catch (e) {
      setError(e.message);
    }
  };

  const remove = async (o) => {
    if (user?.role !== 'admin') {
      setError('Action interdite. Seul le compte Administrateur peut supprimer des commandes.');
      return;
    }

    const id = typeof o === 'object' ? o.id : o;
    const customer = typeof o === 'object' ? o.customer_name : '';
    const product = typeof o === 'object' ? o.product_name : '';

    const adminPassword = await promptDialog({
      title: `🔐 Suppression Sécurisée — Commande #${id}`,
      message: `Veuillez saisir votre mot de passe administrateur pour confirmer la suppression définitive de la commande #${id} :`,
      detail: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
          <div><strong>👤 Client :</strong> {customer || 'N/A'}</div>
          <div><strong>🛍️ Produit :</strong> {product || 'N/A'}</div>
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
      await api(`/api/orders/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-password': adminPassword },
      });
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const filteredProducts = products.filter((p) => {
    if (!formBrandId) return true;
    return String(p.brand_id) === String(formBrandId);
  });

  const filteredConfirmers = confirmers.filter((c) => {
    if (!formBrandId) return true;
    return String(c.brand_id) === String(formBrandId);
  });

  const pages = Math.max(1, Math.ceil(total / 25));

  return (
    <Shell title={user?.role === 'confirmer' ? '📦 Mes Commandes Assignées' : '📦 Commandes & Suivi Multi-Canaux'}>
      {error && <div className="error">{error}</div>}
      {successMsg && (
        <div className="card" style={{ background: 'rgba(37, 211, 102, 0.12)', border: '1px solid rgba(37, 211, 102, 0.4)', color: '#25d366', padding: '12px 16px', marginBottom: 16, borderRadius: 'var(--radius-md)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>✅</span>
          <span>{successMsg}</span>
        </div>
      )}

      {/* Filter and Action Bar */}
      <div className="filters">
        <div className="field search-field">
          <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--ink-muted)' }}>Recherche Client / Tel / Note</span>
          <input
            className="input"
            placeholder="🔍 Nom, téléphone, produit ou note…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load(1)}
          />
        </div>

        {(user?.role === 'admin' || (user?.role === 'confirmer' && brands.length > 1)) && (
          <div className="field" style={{ minWidth: 150 }}>
            <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--ink-muted)' }}>Marque</span>
            <BrandSelect
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              brands={brands}
              includeAll={true}
              allLabel={user?.role === 'confirmer' ? `Toutes mes marques (${brands.length})` : 'Toutes les marques'}
            />
          </div>
        )}

        {/* Source / Canal Filter */}
        <div className="field" style={{ minWidth: 140 }}>
          <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--ink-muted)' }}>Canal / Source</span>
          <select className="input" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
            <option value="">🌐 Tous les canaux</option>
            {ALL_CHANNELS.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.icon} {ch.label}
              </option>
            ))}
          </select>
        </div>

        {/* Statut Appel */}
        <div className="field" style={{ minWidth: 130 }}>
          <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--ink-muted)' }}>Statut Appel</span>
          <select className="input" value={callStatus} onChange={(e) => setCallStatus(e.target.value)}>
            <option value="">Tous les statuts</option>
            {statuses.call_statuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Statut Livraison */}
        <div className="field" style={{ minWidth: 130 }}>
          <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--ink-muted)' }}>Livraison</span>
          <select className="input" value={shipStatus} onChange={(e) => setShipStatus(e.target.value)}>
            <option value="">Toutes livraisons</option>
            {statuses.shipping_statuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Confirmer Filter (Only for Admin & Brands, as confirmers already have their view scoped) */}
        {user?.role !== 'confirmer' && (
          <div className="field" style={{ minWidth: 140 }}>
            <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--ink-muted)' }}>Confirmateur</span>
            <select className="input" value={confirmerFilter} onChange={(e) => setConfirmerFilter(e.target.value)}>
              <option value="">🎧 Tous les confirmateurs</option>
              {confirmers.map((c) => (
                <option key={c.id} value={c.id}>
                  🎧 {c.name} {user?.role === 'admin' && c.brand_name ? `(${c.brand_name})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="field" style={{ minWidth: 140 }}>
          <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--ink-muted)' }}>Risque / Client</span>
          <select className="input" value={blacklistFilter} onChange={(e) => setBlacklistFilter(e.target.value)}>
            <option value="">Tous les clients</option>
            <option value="1">🚫 Liste Noire (3+ refus/bloqué)</option>
          </select>
        </div>

        <div className="filter-actions">
          <button className="btn" onClick={() => load(1)}>Filtrer</button>
          <button 
            className="btn brand" 
            style={{ fontWeight: 700 }}
            onClick={openNewOrderDrawer}
          >
            {showForm ? '✕ Fermer' : '+ Nouvelle Commande'}
          </button>
        </div>
      </div>

      {/* New Manual Order Form (Admin, Brand, Confirmer) */}
      {showForm && (
        <div className="card" style={{ border: '2px solid var(--brand-border)', background: 'var(--card)', marginBottom: 24, boxShadow: 'var(--shadow-lg)' }}>
          <div className="card-header" style={{ paddingBottom: 12 }}>
            <div>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>➕</span>
                <span>Créer une Commande Directe</span>
              </h2>
              <p className="muted" style={{ fontSize: 13, margin: '4px 0 0 0' }}>
                Enregistrez une commande provenant de WhatsApp, Instagram, Facebook ou appel direct.
              </p>
            </div>
            <span className="badge brand" style={{ padding: '6px 12px', fontSize: 12 }}>
              {user?.role === 'admin' ? '🛡️ Admin' : user?.role === 'confirmer' ? '🎧 Confirmateur' : '🏷️ Marque'}
            </span>
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 8 }}>
              Sélectionner le Canal d'Origine *
            </label>
            <div className="channel-selector-grid">
              {MANUAL_CHANNELS.map((ch) => {
                const isActive = form.source === ch.id;
                return (
                  <div
                    key={ch.id}
                    className={`channel-selector-card ${isActive ? 'active' : ''}`}
                    onClick={() => setForm({ ...form, source: ch.id })}
                  >
                    <span style={{ fontSize: 20 }}>{ch.icon}</span>
                    <strong style={{ fontSize: 13, color: isActive ? 'var(--brand)' : 'var(--ink)' }}>{ch.label}</strong>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="form-grid">
            {/* Brand Selection for Admin & Multi-brand Confirmer */}
            {(user?.role === 'admin' || (user?.role === 'confirmer' && brands.length > 1)) ? (
              <label className="field">
                Marque (Boutique) *
                <select
                  className="input"
                  value={formBrandId}
                  onChange={(e) => onFormBrandChange(e.target.value)}
                  required
                >
                  <option value="">— Sélectionner la marque —</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="field">
                <span>Marque</span>
                <div className="input" style={{ background: 'var(--bg-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <BrandIcon brand={brands[0]?.name || user?.brand?.name} size={15} />
                  <span>{brands[0]?.name || user?.brand?.name || 'Votre Marque'}</span>
                </div>
              </div>
            )}

            <label className="field">
              Produit Associé
              <select className="input" value={form.product_id} onChange={(e) => onProductSelect(e.target.value)}>
                <option value="">— Sélectionner le produit —</option>
                {filteredProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {dh(p.price)}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              Quantité
              <input
                type="number"
                min="1"
                className="input"
                value={form.quantity}
                onChange={(e) => onQuantityChange(e.target.value)}
              />
            </label>

            <label className="field">
              Prix Total Produit (DH)
              <input
                type="number"
                className="input"
                placeholder="Prix en DH"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </label>

            <label className="field">
              Frais de Livraison (DH)
              <input
                type="number"
                className="input"
                placeholder="0 ou 35"
                value={form.delivery_fee}
                onChange={(e) => setForm({ ...form, delivery_fee: e.target.value })}
              />
            </label>

            {user?.role !== 'confirmer' && (
              <label className="field">
                Confirmateur Assigné
                <select
                  className="input"
                  value={form.confirmer_id}
                  onChange={(e) => setForm({ ...form, confirmer_id: e.target.value })}
                >
                  <option value="">— Non assigné (Automatique) —</option>
                  {filteredConfirmers.map((c) => (
                    <option key={c.id} value={c.id}>
                      🎧 {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="field">
              Numéro de Téléphone *
              <input
                className="input"
                placeholder="ex: 0661000000"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
              />
            </label>

            <label className="field">
              Nom & Prénom du Client *
              <input
                className="input"
                placeholder="ex: Ahmed Benali"
                value={form.customer_name}
                onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                required
              />
            </label>

            <label className="field">
              Ville
              <input
                className="input"
                placeholder="ex: Casablanca / Rabat / Alger"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </label>

            <label className="field">
              Adresse de Livraison
              <input
                className="input"
                placeholder="Rue, Quartier, N° appartement..."
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </label>

            <label className="field">
              Statut d'Appel Initial
              <select
                className="input"
                value={form.call_status}
                onChange={(e) => setForm({ ...form, call_status: e.target.value })}
              >
                {statuses.call_statuses.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>

            <label className="field">
              Statut Livraison Initial
              <select
                className="input"
                value={form.shipping_status}
                onChange={(e) => setForm({ ...form, shipping_status: e.target.value })}
              >
                {statuses.shipping_statuses.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>

            {/* CASE 0: BLACKLIST DETECTION (3+ Refus/Retours or Blocked) */}
            {dupStatus.is_blacklisted && (
              <div className="duplicate-alert-box blacklist">
                <div className="dup-header">
                  <div className="dup-header-info">
                    <span style={{ fontSize: 26 }}>🚨</span>
                    <div>
                      <h4 style={{ color: '#ef4444', fontSize: 15, fontWeight: 800 }}>
                        ALERTE LISTE NOIRE : CLIENT BLOQUÉ / {dupStatus.refusal_count} COLIS REFUSÉS !
                      </h4>
                      <p style={{ color: 'var(--ink)', fontWeight: 600 }}>
                        Ce numéro de téléphone ({form.phone}) a déjà accumulé <strong>{dupStatus.refusal_count} commandes retournées ou refusées</strong>.
                      </p>
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--ink)', marginTop: 4, lineHeight: 1.5 }}>
                  ⚠️ <strong>Recommandation :</strong> Ne confirmez pas cette commande sans paiement d'avance (acompte) ou vérification vocale stricte sur WhatsApp pour éviter des frais de livraison perdus.
                </div>
                {dupStatus.refusal_orders?.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {dupStatus.refusal_orders.slice(0, 3).map((ro) => (
                      <span key={ro.id} className="badge red" style={{ fontSize: 11 }}>
                        #{ro.id} {ro.product_name} ({ro.shipping_status || ro.call_status})
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Minor Warning: 1 or 2 past returns */}
            {dupStatus.refusal_count > 0 && !dupStatus.is_blacklisted && (
              <div className="duplicate-alert-box" style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1.5px solid rgba(245, 158, 11, 0.5)' }}>
                <div className="dup-header">
                  <div className="dup-header-info">
                    <span style={{ fontSize: 22 }}>⚠️</span>
                    <div>
                      <h4 style={{ color: '#d97706', fontSize: 14 }}>
                        Attention : Client avec Antécédent de Retour ({dupStatus.refusal_count} retour{dupStatus.refusal_count > 1 ? 's' : ''})
                      </h4>
                      <p>
                        Ce client a déjà eu {dupStatus.refusal_count} commande{dupStatus.refusal_count > 1 ? 's' : ''} non aboutie{dupStatus.refusal_count > 1 ? 's' : ''} dans le passé. Soyez attentif lors de la confirmation.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CASE 1: EXACT DUPLICATE (Same Product + Recent < 48h) */}
            {dupStatus.found && dupStatus.has_exact_duplicate && (
              <div className="duplicate-alert-box recent">
                <div className="dup-header">
                  <div className="dup-header-info">
                    <span style={{ fontSize: 24 }}>⚠️</span>
                    <div>
                      <h4 style={{ color: '#ef4444' }}>ATTENTION : MÊME PRODUIT DÉJÀ ENREGISTRÉ RÉCEMMENT !</h4>
                      <p>
                        Une commande pour <strong>« {dupStatus.exact_duplicates[0]?.product_name} »</strong> a été créée <strong>{dupStatus.exact_duplicates[0]?.time_ago}</strong> via <strong>{dupStatus.exact_duplicates[0]?.source}</strong>.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="dup-orders-list">
                  {dupStatus.exact_duplicates.slice(0, 2).map((o) => (
                    <div key={o.id} className="dup-order-card">
                      <div className="dup-order-row">
                        <span><strong>Commande #{o.id}</strong> — {o.customer_name}</span>
                        <span className="badge amber" style={{ fontSize: 11 }}>{o.time_ago}</span>
                      </div>
                      <div className="dup-order-meta">
                        <span>🛍️ Produit : <strong style={{ color: '#f87171' }}>{o.product_name || 'Produit direct'}</strong> (x{o.quantity})</span>
                        <span>💰 {dh((Number(o.price) || 0) * (Number(o.quantity) || 1) + (Number(o.delivery_fee) || 0))}</span>
                        <span>📱 Canal: {o.source}</span>
                        {o.confirmer_name && <span>🎧 Saisie par: <strong>{o.confirmer_name}</strong></span>}
                        <span>📞 {o.call_status} · 🚚 {o.shipping_status}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="dup-tip">
                  <span>💡</span>
                  <span>
                    <strong>Vérification d'équipe :</strong> Si un(e) collègue a déjà saisi cette même commande sur Instagram / WhatsApp partagé, <u>ne réenregistrez pas</u> pour éviter un double envoi. S'il s'agit d'un réachat distinct demandé par le client, vous pouvez forcer la validation.
                  </span>
                </div>
              </div>
            )}

            {/* CASE 2: DIFFERENT PRODUCT ORDERED RECENTLY (ma3lich -> Valid new order) */}
            {dupStatus.found && dupStatus.has_different_product && (
              <div className="duplicate-alert-box" style={{ background: 'rgba(99, 102, 241, 0.09)', border: '1.5px solid rgba(99, 102, 241, 0.45)', boxShadow: '0 4px 16px rgba(99, 102, 241, 0.12)' }}>
                <div className="dup-header">
                  <div className="dup-header-info">
                    <span style={{ fontSize: 22 }}>🛍️</span>
                    <div>
                      <h4 style={{ color: '#818cf8' }}>Autre Produit Commandé Précédemment (Nouvelle Commande Valide)</h4>
                      <p>
                        Ce numéro a commandé un autre produit (<strong>« {dupStatus.different_products[0]?.product_name} »</strong>) {dupStatus.different_products[0]?.time_ago}.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() => fillFromHistory(dupStatus.different_products[0])}
                    style={{ whiteSpace: 'nowrap', fontSize: 11.5 }}
                    title="Remplir le nom et l'adresse depuis la précédente commande"
                  >
                    ✨ Remplir Coordonnées
                  </button>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 4 }}>
                  ✅ <strong>Produit différent :</strong> Vous pouvez enregistrer cette nouvelle commande en toute tranquillité sans blocage.
                </div>
              </div>
            )}

            {/* CASE 3: RETURNING CUSTOMER (> 48h) */}
            {dupStatus.found && !dupStatus.has_exact_duplicate && !dupStatus.has_different_product && (
              <div className="duplicate-alert-box history">
                <div className="dup-header">
                  <div className="dup-header-info">
                    <span style={{ fontSize: 22 }}>💎</span>
                    <div>
                      <h4 style={{ color: '#60a5fa' }}>Client Fidèle Détecté ({dupStatus.count} commande{dupStatus.count > 1 ? 's' : ''} passée{dupStatus.count > 1 ? 's' : ''})</h4>
                      <p>
                        Dernière commande : #{dupStatus.orders[0]?.id} ({dupStatus.orders[0]?.product_name}) passée {dupStatus.orders[0]?.time_ago}.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() => fillFromHistory(dupStatus.orders[0])}
                    style={{ whiteSpace: 'nowrap', fontSize: 11.5 }}
                    title="Remplir le nom et l'adresse depuis la dernière commande"
                  >
                    ✨ Remplir Coordonnées
                  </button>
                </div>
              </div>
            )}

            <label className="field" style={{ gridColumn: '1 / -1' }}>
              Note & Instructions sur la commande
              <input
                className="input"
                placeholder="Remarques du client (ex: livré après 17h, message vocal WhatsApp reçu...)"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </label>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--card-border)' }}>
            <button className="btn brand" onClick={() => createOrder(false)} style={{ padding: '10px 24px', fontWeight: 700 }}>
              💾 Enregistrer la Commande
            </button>
            <button className="btn ghost" onClick={() => setShowForm(false)}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Orders Data Table */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2>📦 Liste des Commandes ({total})</h2>
            <p className="muted" style={{ fontSize: 13, margin: '2px 0 0 0' }}>
              {user?.role === 'confirmer'
                ? 'Commandes qui vous sont assignées par l\'administrateur et créées manuellement.'
                : 'Toutes les commandes centralisées (Landing page, WhatsApp, Instagram, Facebook, Direct).'}
            </p>
          </div>
          <span className="badge blue">Page {page} sur {pages}</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Canal</th>
                <th>Client & Coordonnées</th>
                <th>Produit</th>
                {(user?.role === 'admin' || (user?.role === 'confirmer' && (user?.brands?.length > 1 || brands.length > 1))) && <th>Marque</th>}
                <th>Montant Total</th>
                <th>Statut Appel</th>
                <th>Livraison</th>
                {user?.role !== 'confirmer' && <th>Confirmateur Assigné</th>}
                <th>📝 Note</th>
                <th>Date</th>
                {user?.role === 'admin' && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const itemTotal = Number(o.price || 0) * Number(o.quantity || 1);
                const fee = Number(o.delivery_fee || 0);
                const totalOrder = itemTotal + fee;

                return (
                  <tr key={o.id}>
                    <td className="muted" style={{ fontWeight: 700 }}>#{o.id}</td>
                    <td>
                      {getSourceBadge(o.source)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: 13.5 }}>{o.customer_name}</strong>
                          {/* Blacklist / Customer Risk Badge */}
                          {o.is_blacklisted ? (
                            <button
                              type="button"
                              className="badge-blacklist"
                              onClick={() => openCustomerRiskModal(o)}
                              title="🚨 Client sur Liste Noire (3+ refus/retours ou bloqué). Cliquez pour inspecter l'historique."
                            >
                              <span>🚫 LISTE NOIRE</span>
                              <span>({o.refusal_count} refus)</span>
                            </button>
                          ) : o.refusal_count > 0 ? (
                            <button
                              type="button"
                              className="badge-warning-risk"
                              onClick={() => openCustomerRiskModal(o)}
                              title="⚠️ Client à risque (a déjà refusé/retourné des colis). Cliquez pour inspecter."
                            >
                              <span>⚠️ {o.refusal_count} retour{o.refusal_count > 1 ? 's' : ''}</span>
                            </button>
                          ) : o.delivered_count >= 2 ? (
                            <span className="badge-vip" title="Client fidèle (plusieurs commandes livrées avec succès)">
                              ⭐ Fidèle ({o.delivered_count} livrés)
                            </span>
                          ) : null}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }} className="muted">
                          <a 
                            href={`tel:${o.phone}`} 
                            style={{ color: 'var(--ink)', textDecoration: 'none', fontWeight: 500 }}
                            title="Appeler"
                          >
                            📞 {o.phone}
                          </a>
                          {o.phone && (
                            <a
                              href={`https://wa.me/${o.phone.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              title="Ouvrir sur WhatsApp"
                              style={{ color: '#25d366', fontSize: 11, fontWeight: 600 }}
                            >
                              💬 WA
                            </a>
                          )}
                        </div>
                        {o.city && (
                          <span className="muted" style={{ fontSize: 11.5 }}>
                            📍 {o.city} {o.address ? `(${o.address})` : ''}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div>
                        <strong>{o.product_name || 'Produit direct'}</strong>
                        <div className="muted" style={{ fontSize: 11 }}>Qte: {o.quantity || 1}</div>
                      </div>
                    </td>
                    {(user?.role === 'admin' || (user?.role === 'confirmer' && (user?.brands?.length > 1 || brands.length > 1))) && (
                      <td>
                        <BrandBadge brand={o.brand_name} size="sm" />
                      </td>
                    )}
                    <td>
                      <div>
                        <strong style={{ color: 'var(--brand)', fontSize: 14 }}>{dh(totalOrder)}</strong>
                        {fee > 0 ? (
                          <span className="muted" style={{ fontSize: 11, display: 'block', color: 'var(--amber-text)' }}>
                            ({dh(itemTotal)} + {dh(fee)} livr.)
                          </span>
                        ) : (
                          <span className="muted" style={{ fontSize: 11, display: 'block', color: 'var(--green-text)' }}>
                            (Livraison Gratuite)
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="status-pill-select-wrapper">
                        <select
                          className={`status-pill-select ${getCallPillClass(o.call_status)}`}
                          value={o.call_status}
                          onChange={(e) => handleCallStatusChange(o, e.target.value)}
                        >
                          {statuses.call_statuses.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td>
                      <div className="status-pill-select-wrapper">
                        <select
                          className={`status-pill-select ${getShipPillClass(o.shipping_status)}`}
                          value={o.shipping_status}
                          onChange={(e) => setStatus(o.id, { shipping_status: e.target.value })}
                        >
                          {statuses.shipping_statuses.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                      {/* Shipping Company Agency Badge */}
                      {o.shipping_company ? (
                        <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <button
                            type="button"
                            className="shipping-agency-badge"
                            onClick={() => openShippingModal(o)}
                            title="Modifier l'agence ou le numéro de suivi"
                          >
                            <span>🚚</span>
                            <span>{o.shipping_company}</span>
                            {o.tracking_number && <span style={{ opacity: 0.8, fontSize: 10 }}>#{o.tracking_number}</span>}
                          </button>
                        </div>
                      ) : o.call_status === 'Confirmé' ? (
                        <button
                          type="button"
                          className="shipping-agency-badge-empty"
                          onClick={() => openShippingModal(o)}
                          title="Assigner une société de livraison (Ozon, Sendit...)"
                        >
                          <span>+ 🚚 Agence</span>
                        </button>
                      ) : null}
                    </td>
                    {user?.role !== 'confirmer' && (
                      <td>
                        <select
                          className="input small"
                          value={o.confirmer_id || ''}
                          onChange={(e) => handleConfirmerAssign(o.id, e.target.value)}
                          style={{
                            borderRadius: 'var(--radius-pill)',
                            padding: '4px 10px',
                            fontSize: 12,
                            background: o.confirmer_id ? 'var(--card)' : 'var(--bg-secondary)',
                            border: o.confirmer_id ? '1px solid var(--brand-border)' : '1px dashed var(--card-border)',
                            color: o.confirmer_id ? 'var(--ink)' : 'var(--ink-muted)',
                          }}
                        >
                          <option value="">— Non assigné —</option>
                          {confirmers
                            .filter((c) => !o.brand_id || c.brand_id === o.brand_id || c.brand_ids?.includes(o.brand_id))
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                🎧 {c.name}
                              </option>
                            ))}
                        </select>
                      </td>
                    )}
                    <td>
                      {/* Interactive Note capsule / trigger */}
                      {o.note ? (
                        <button
                          type="button"
                          className="note-chip"
                          onClick={() => openNoteModal(o)}
                          title={`Note complète: ${o.note}`}
                        >
                          <span>📝</span>
                          <span className="note-text-truncate">{o.note}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="note-chip-empty"
                          onClick={() => openNoteModal(o)}
                          title="Ajouter une note à cette commande"
                        >
                          <span>+</span>
                          <span>Note</span>
                        </button>
                      )}
                    </td>
                    <td className="muted" style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>
                      {o.created_at ? new Date(o.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    {user?.role === 'admin' && (
                      <td>
                        <button
                          className="btn danger small"
                          title="Supprimer la commande (Admin uniquement)"
                          onClick={() => remove(o)}
                          style={{ padding: '4px 8px', fontSize: 11 }}
                        >
                          ✕
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {!orders.length && !loading && (
                <tr>
                  <td colSpan={user?.role === 'admin' ? 12 : user?.role === 'confirmer' ? 9 : 10} className="muted" style={{ textAlign: 'center', padding: '36px' }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>🔍</div>
                    Aucune commande trouvée selon vos critères.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="pagination">
          <button className="btn ghost small" disabled={page <= 1} onClick={() => load(page - 1)}>
            ← Précédent
          </button>
          <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>
            Page {page} sur {pages} ({total} commandes au total)
          </span>
          <button className="btn ghost small" disabled={page >= pages} onClick={() => load(page + 1)}>
            Suivant →
          </button>
        </div>
      </div>

      {/* Note Editor Modal (Admin, Noria, Lumera, Confirmers) */}
      {mounted && typeof document !== 'undefined' && activeNoteOrder && createPortal(
        <div className="modal-overlay" onClick={() => setActiveNoteOrder(null)}>
          <div className="modal-container" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>📝</span>
                  <span>Note — Commande #{activeNoteOrder.id}</span>
                </h3>
                <div className="muted" style={{ fontSize: 13 }}>
                  👤 <strong>{activeNoteOrder.customer_name}</strong> · 📞 {activeNoteOrder.phone}
                  {activeNoteOrder.brand_name ? ` · 🏷️ ${activeNoteOrder.brand_name}` : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveNoteOrder(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--ink-muted)',
                  fontSize: 18,
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-muted)', marginBottom: 6 }}>
                Texte de la note :
              </label>
              <textarea
                className="input"
                rows="4"
                placeholder="Écrivez vos instructions, remarques ou détails sur le client..."
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                autoFocus
                style={{ resize: 'vertical', minHeight: 90 }}
              />
            </div>

            {/* Quick Tag Insertion Chips */}
            <div style={{ marginBottom: 20 }}>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6 }}>
                ⚡ Tags rapides :
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {QUICK_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="quick-tag-chip"
                    onClick={() => addQuickTag(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setActiveNoteOrder(null)}
                disabled={savingNote}
              >
                Fermer
              </button>
              <button
                type="button"
                className="btn brand"
                onClick={saveOrderNote}
                disabled={savingNote}
                style={{ fontWeight: 700 }}
              >
                {savingNote ? 'Enregistrement…' : '💾 Enregistrer la Note'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ANTI-DUPLICATE WARNING MODAL (On Submit Protection) */}
      {mounted && typeof document !== 'undefined' && duplicateConfirmModal && createPortal(
        <div className="modal-overlay" onClick={() => setDuplicateConfirmModal(false)}>
          <div className="modal-container" style={{ maxWidth: 560, border: '2px solid #ef4444', boxShadow: '0 25px 60px rgba(239, 68, 68, 0.25)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                ⚠️
              </div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#f87171' }}>
                  Doublon Récent Détecté (Même Produit) !
                </h3>
                <p style={{ fontSize: 13, color: 'var(--ink-muted)', margin: '2px 0 0 0' }}>
                  Une commande pour <strong>« {dupStatus.exact_duplicates[0]?.product_name || 'ce produit'} »</strong> existe déjà récemment.
                </p>
              </div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '14px', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 8 }}>
                📋 Commande existante pour le même produit :
              </div>
              {(dupStatus.exact_duplicates.length > 0 ? dupStatus.exact_duplicates : dupStatus.orders).slice(0, 1).map((o) => (
                <div key={o.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                  <div><strong>👤 Client :</strong> {o.customer_name} {o.city ? `(${o.city})` : ''}</div>
                  <div><strong>🛍️ Produit :</strong> <strong style={{ color: '#f87171' }}>{o.product_name || 'Produit direct'}</strong> (x{o.quantity}) — <strong style={{ color: 'var(--brand)' }}>{dh((Number(o.price)||0)*(Number(o.quantity)||1) + (Number(o.delivery_fee)||0))}</strong></div>
                  <div><strong>📱 Canal & Création :</strong> {o.source} · <span style={{ color: 'var(--amber-text)', fontWeight: 600 }}>{o.time_ago}</span></div>
                  {o.confirmer_name && <div><strong>🎧 Saisie par :</strong> {o.confirmer_name}</div>}
                  <div><strong>📞 Statut :</strong> {o.call_status} · 🚚 {o.shipping_status}</div>
                </div>
              ))}
            </div>

            <p style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5, marginBottom: 20 }}>
              S'agit-il d'un doublon de saisie (ex: collègue ayant déjà traité la même conversation Instagram/WhatsApp) ou d'un nouvel achat séparé souhaité par le client ?
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type="button"
                className="btn danger"
                style={{ width: '100%', padding: '12px 18px', fontWeight: 700, justifyContent: 'center' }}
                onClick={() => {
                  setDuplicateConfirmModal(false);
                  setShowForm(false);
                }}
              >
                ❌ Annuler — C'est un doublon (Ne pas créer)
              </button>
              <button
                type="button"
                className="btn ghost"
                style={{ width: '100%', padding: '10px 18px', justifyContent: 'center' }}
                onClick={() => createOrder(true)}
              >
                ✅ Confirmer quand même (Nouveau réachat distinct)
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* POPUP MODAL: CHOIX DE LA SOCIÉTÉ DE LIVRAISON (Ozon, Sendit, Cathedis, etc.) */}
      {mounted && typeof document !== 'undefined' && shippingModalOrder && createPortal(
        <div className="modal-overlay" onClick={() => setShippingModalOrder(null)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(2, 132, 199, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, border: '1px solid rgba(2, 132, 199, 0.3)' }}>
                  🚚
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--ink)' }}>
                    Société de Livraison pour l'Expédition
                  </h3>
                  <p style={{ fontSize: 13, color: 'var(--ink-muted)', margin: '2px 0 0 0' }}>
                    Sélectionnez l'agence qui prendra en charge la commande <strong>#{shippingModalOrder.id}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShippingModalOrder(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--ink-muted)',
                  fontSize: 18,
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                ✕
              </button>
            </div>

            {/* Order Summary Capsule */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '12px 14px', marginBottom: 18, display: 'flex', flexWrap: 'wrap', gap: '8px 16px', fontSize: 13 }}>
              <div>👤 <strong>{shippingModalOrder.customer_name}</strong></div>
              <div>📞 {shippingModalOrder.phone}</div>
              {shippingModalOrder.city && <div>📍 <strong>{shippingModalOrder.city}</strong></div>}
              <div>🛍️ {shippingModalOrder.product_name || 'Produit direct'} (x{shippingModalOrder.quantity || 1})</div>
              <div>💰 <strong style={{ color: 'var(--brand)' }}>{dh(Number(shippingModalOrder.price || 0) * Number(shippingModalOrder.quantity || 1) + Number(shippingModalOrder.delivery_fee || 0))}</strong></div>
            </div>

            {/* Companies Selector Grid */}
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 8 }}>
              Choisir la Société de Livraison *
            </label>
            
            <div className="shipping-company-selector-grid">
              {shippingCompanies.map((comp) => {
                const isSelected = selectedCompany === comp.name;
                return (
                  <div
                    key={comp.id}
                    className={`shipping-company-card ${isSelected ? 'active' : ''}`}
                    onClick={() => setSelectedCompany(comp.name)}
                  >
                    {isSelected && <span className="shipping-company-check">✓</span>}
                    <span className="shipping-company-icon">
                      {comp.name.toLowerCase().includes('ozon') ? '⚡' : comp.name.toLowerCase().includes('send') ? '📦' : comp.name.toLowerCase().includes('cath') ? '🚚' : comp.name.toLowerCase().includes('amana') ? '📬' : '🚛'}
                    </span>
                    <span className="shipping-company-name">{comp.name}</span>
                    {comp.phone && <span className="muted" style={{ fontSize: 11, marginTop: 2 }}>{comp.phone}</span>}
                  </div>
                );
              })}
            </div>

            {/* Optional Tracking Code */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-muted)' }}>
                  Numéro / Code de Suivi Tracking (Optionnel) :
                </label>
                {selectedCompany.toLowerCase().includes('ozon') && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)', background: 'var(--brand-light)', padding: '2px 8px', borderRadius: 'var(--radius-pill)' }}>
                    ⚡ API Ozon Connectée (ID: 97465)
                  </span>
                )}
              </div>
              <input
                className="input"
                placeholder={selectedCompany.toLowerCase().includes('ozon') ? 'Laisser vide pour générer automatiquement via Ozon Express' : 'ex: OZ-98421948 / SD-548102'}
                value={trackingCode}
                onChange={(e) => setTrackingCode(e.target.value)}
              />
              {selectedCompany.toLowerCase().includes('ozon') && (
                <p style={{ fontSize: 11.5, color: 'var(--ink-muted)', marginTop: 4, marginBottom: 0 }}>
                  💡 La commande sera automatiquement transmise à Ozon Express (ID: 97465) lors de la validation.
                </p>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 14, borderTop: '1px solid var(--card-border)' }}>
              <button
                type="button"
                className="btn ghost"
                onClick={() => saveOrderWithShipping(false)}
                disabled={savingShipping}
                style={{ fontSize: 12.5 }}
                title="Confirmer la commande sans spécifier d'agence de livraison"
              >
                Confirmer sans agence
              </button>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setShippingModalOrder(null)}
                  disabled={savingShipping}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  className="btn brand"
                  onClick={() => saveOrderWithShipping(true)}
                  disabled={savingShipping || !selectedCompany}
                  style={{ fontWeight: 700, padding: '10px 20px' }}
                >
                  {savingShipping ? 'Enregistrement…' : `🚚 Confirmer avec ${selectedCompany || 'l\'agence'}`}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* CUSTOMER RISK & BLACKLIST DOSSIER MODAL */}
      {mounted && typeof document !== 'undefined' && customerRiskOrder && createPortal(
        <div className="modal-overlay" onClick={() => setCustomerRiskOrder(null)}>
          <div className="modal-container" style={{ maxWidth: 600, border: customerRiskOrder.is_blacklisted ? '2px solid #ef4444' : '1px solid var(--card-border)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: customerRiskOrder.is_blacklisted ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                  {customerRiskOrder.is_blacklisted ? '🚫' : '⚠️'}
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: customerRiskOrder.is_blacklisted ? '#ef4444' : 'var(--ink)' }}>
                    {customerRiskOrder.is_blacklisted ? 'Dossier Client Liste Noire' : 'Historique & Risque Client'}
                  </h3>
                  <p style={{ fontSize: 13, color: 'var(--ink-muted)', margin: '2px 0 0 0' }}>
                    👤 <strong>{customerRiskOrder.customer_name}</strong> · 📞 {customerRiskOrder.phone}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCustomerRiskOrder(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--ink-muted)',
                  fontSize: 18,
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                ✕
              </button>
            </div>

            {/* Metrics Breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
              <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: 10, textAlign: 'center', border: '1px solid var(--card-border)' }}>
                <span className="muted" style={{ fontSize: 11, textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Refus / Retours</span>
                <strong style={{ fontSize: 20, color: customerRiskOrder.refusal_count > 0 ? '#ef4444' : 'var(--ink)' }}>
                  ❌ {customerRiskOrder.refusal_count || 0}
                </strong>
              </div>
              <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: 10, textAlign: 'center', border: '1px solid var(--card-border)' }}>
                <span className="muted" style={{ fontSize: 11, textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Colis Livrés</span>
                <strong style={{ fontSize: 20, color: '#10b981' }}>
                  ✅ {customerRiskOrder.delivered_count || 0}
                </strong>
              </div>
              <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: 10, textAlign: 'center', border: '1px solid var(--card-border)' }}>
                <span className="muted" style={{ fontSize: 11, textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Statut</span>
                <strong style={{ fontSize: 14, color: customerRiskOrder.is_blacklisted ? '#ef4444' : 'var(--amber-text)', display: 'block', marginTop: 4 }}>
                  {customerRiskOrder.is_blacklisted ? '🚫 Bloqué' : '⚠️ Vigilance'}
                </strong>
              </div>
            </div>

            {/* Advice / Note */}
            <div style={{ background: customerRiskOrder.is_blacklisted ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)', border: customerRiskOrder.is_blacklisted ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 10, padding: '12px 14px', marginBottom: 20, fontSize: 13, lineHeight: 1.5 }}>
              {customerRiskOrder.is_blacklisted ? (
                <span>
                  🚫 <strong>Attention :</strong> Ce client est classé sur la <strong>Liste Noire</strong> car il a cumulé au moins 3 retours / refus de livraison (ou a été bloqué manuellement). Il est fortement conseillé de demander un acompte ou d'annuler la commande pour éviter de payer des frais d'expédition inutiles.
                </span>
              ) : (
                <span>
                  ⚠️ <strong>Vigilance :</strong> Ce client a déjà retourné ou refusé {customerRiskOrder.refusal_count} commande(s) par le passé. Assurez-vous de confirmer l'adresse exacte et la disponibilité du client par appel ou message vocal.
                </span>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 14, borderTop: '1px solid var(--card-border)' }}>
              {user?.role === 'admin' ? (
                <button
                  type="button"
                  className={customerRiskOrder.is_blacklisted ? 'btn ghost small' : 'btn danger small'}
                  onClick={() => toggleBlacklistForCustomer(customerRiskOrder.phone, customerRiskOrder.is_blacklisted, customerRiskOrder.customer_name)}
                  disabled={blacklisting}
                  style={{ fontSize: 12 }}
                >
                  {customerRiskOrder.is_blacklisted ? '🔓 Débloquer / Retirer de la Liste Noire' : '🚫 Ajouter Manuellement à la Liste Noire'}
                </button>
              ) : <div />}

              <button
                type="button"
                className="btn brand"
                onClick={() => setCustomerRiskOrder(null)}
                style={{ fontWeight: 700 }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </Shell>
  );
}


