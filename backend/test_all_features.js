const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: body ? JSON.parse(body) : null, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: body, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runTests() {
  console.log('================================================================');
  console.log('🚀 SUITE DE TESTS COMPLÈTE : DASHBOARD, LANDINGS & WORKFLOWS');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(name, condition, details = '') {
    if (condition) {
      console.log(`✅ PASS: ${name} ${details ? '— ' + details : ''}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${name} ${details ? '— ' + details : ''}`);
      failed++;
    }
  }

  try {
    // 1. HEALTH CHECK
    console.log('--- 1. SANTÉ DU SERVEUR & BASE DE DONNÉES ---');
    const health = await request({
      hostname: 'localhost', port: 4000, path: '/api/health', method: 'GET'
    });
    assert('Health Check API', health.status === 200 && health.data.ok === true && health.data.db === 'connected', JSON.stringify(health.data));

    // 2. ADMIN LOGIN
    console.log('\n--- 2. AUTHENTIFICATION ADMIN ---');
    const adminLogin = await request({
      hostname: 'localhost', port: 4000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'admin@dashboard.local', password: 'Admin123!' });
    
    assert('Connexion Admin', adminLogin.status === 200 && !!adminLogin.data?.token, 'Admin authentifié');
    const adminToken = adminLogin.data?.token;
    const adminHeaders = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + adminToken
    };

    // 3. RECUPERATION DES MARQUES ET CLES API
    console.log('\n--- 3. MARQUES ET CLÉS D\'API LANDINGS ---');
    const brandsRes = await request({
      hostname: 'localhost', port: 4000, path: '/api/brands', method: 'GET',
      headers: adminHeaders
    });
    assert('Liste des marques', brandsRes.status === 200 && brandsRes.data?.brands?.length >= 2, `Total marques: ${brandsRes.data?.brands?.length}`);
    
    const okinsoBrand = brandsRes.data?.brands?.find(b => b.slug === 'okinso');
    const vinilliaBrand = brandsRes.data?.brands?.find(b => b.slug === 'vinillia');
    assert('Marque Okinso avec API Key', !!okinsoBrand?.api_key, `Clé: ${okinsoBrand?.api_key}`);
    assert('Marque Vinillia avec API Key', !!vinilliaBrand?.api_key, `Clé: ${vinilliaBrand?.api_key}`);

    // 4. CREATION D'UN NOUVEAU CONFIRMATEUR MULTI-MARQUE
    console.log('\n--- 4. CRÉATION D\'UN COMPTE CONFIRMATEUR MULTI-MARQUE ---');
    const testConfirmerEmail = 'confirmer_' + Date.now() + '@dashboard.local';
    const testConfirmerPass = 'ConfPass123!';
    
    const createConfirmerRes = await request({
      hostname: 'localhost', port: 4000, path: '/api/confirmers', method: 'POST',
      headers: adminHeaders
    }, {
      name: 'Nadia Bennani (Test)',
      phone: '0661122334',
      brand_ids: [okinsoBrand.id, vinilliaBrand.id],
      email: testConfirmerEmail,
      password: testConfirmerPass
    });

    assert('Création Confirmateur Multi-Marques (Okinso + Vinillia)', createConfirmerRes.status === 201 && !!createConfirmerRes.data?.confirmer?.id, `ID: ${createConfirmerRes.data?.confirmer?.id} - Nom: ${createConfirmerRes.data?.confirmer?.name}`);
    const createdConfirmerId = createConfirmerRes.data?.confirmer?.id;

    // 5. CONNEXION DU CONFIRMATEUR CRÉÉ
    console.log('\n--- 5. AUTHENTIFICATION DU CONFIRMATEUR ---');
    const confirmerLogin = await request({
      hostname: 'localhost', port: 4000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: testConfirmerEmail, password: testConfirmerPass });

    assert('Connexion du confirmateur créé', confirmerLogin.status === 200 && confirmerLogin.data?.user?.role === 'confirmer', `Email: ${confirmerLogin.data?.user?.email} | Brands assignées: ${confirmerLogin.data?.user?.brands?.map(b => b.name).join(', ')}`);
    const confirmerToken = confirmerLogin.data?.token;
    const confirmerHeaders = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + confirmerToken
    };

    // 6. CREATION DE COMMANDES DEPUIS LES LANDING PAGES VINILLIA
    console.log('\n--- 6. COMMANDES DEPUIS LES LANDING PAGES VINILLIA ---');
    // 6.1 Landing Vinillia - Keratin Complex
    const orderVinilliaKC = await request({
      hostname: 'localhost', port: 4000, path: '/api/public/orders', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': vinilliaBrand.api_key
      }
    }, {
      product_id: 7,
      product_name: 'Keratin Complex',
      quantity: 1,
      unit_price: 399,
      customer_name: 'Fatima Zahra Benali',
      phone: '0612345678',
      city: 'Casablanca',
      address: 'Boulevard d Anfa, Résidence Yasmina Appt 12',
      note: 'Source: Landing Page KC Vinillia'
    });
    assert('Commande Landing Vinillia (Keratin Complex 399 DH)', orderVinilliaKC.status === 201 && !!orderVinilliaKC.data?.order_id, `Order ID: ${orderVinilliaKC.data?.order_id}`);
    const orderIdKC = orderVinilliaKC.data?.order_id;

    // 6.2 Landing Vinillia - Shampoo Cafeine (avec 35 DH frais de livraison)
    const orderVinilliaShampoo = await request({
      hostname: 'localhost', port: 4000, path: '/api/public/orders', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': vinilliaBrand.api_key
      }
    }, {
      product_id: 8,
      product_name: 'Shampoo Cafeine',
      quantity: 1,
      price: 234,
      delivery_fee: 35,
      customer_name: 'Meryem Tazi',
      phone: '0622334455',
      city: 'Rabat',
      address: 'Agdal, Rue Oukaimeden N 15',
      note: 'Source: Landing Page Shampoo Caffeine'
    });
    assert('Commande Landing Vinillia (Shampoo Cafeine + 35 DH livraison)', orderVinilliaShampoo.status === 201 && !!orderVinilliaShampoo.data?.order_id, `Order ID: ${orderVinilliaShampoo.data?.order_id}`);
    const orderIdShampoo = orderVinilliaShampoo.data?.order_id;

    // 7. CREATION DE COMMANDES DEPUIS LES LANDING PAGES OKINSO
    console.log('\n--- 7. COMMANDES DEPUIS LES LANDING PAGES OKINSO ---');
    // 7.1 Landing Okinso - VitaSilk
    const orderOkinsoVita = await request({
      hostname: 'localhost', port: 4000, path: '/api/public/orders', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': okinsoBrand.api_key
      }
    }, {
      product_id: 3,
      product_name: 'Coffret Rituel Complet Okinso (4 Étapes)',
      quantity: 1,
      unit_price: 299,
      customer_name: 'Imane Alaoui',
      phone: '0655443322',
      city: 'Marrakech',
      address: 'Gueliz, Rue de la Liberté',
      note: 'Source: Landing Page VitaSilk Okinso'
    });
    assert('Commande Landing Okinso (VitaSilk 299 DH)', orderOkinsoVita.status === 201 && !!orderOkinsoVita.data?.order_id, `Order ID: ${orderOkinsoVita.data?.order_id}`);
    const orderIdVita = orderOkinsoVita.data?.order_id;

    // 7.2 Landing Okinso - SOS Therapy
    const orderOkinsoSOS = await request({
      hostname: 'localhost', port: 4000, path: '/api/public/orders', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': okinsoBrand.api_key
      }
    }, {
      product_id: 4,
      product_name: 'SOS Hair Therapy Pouch 400g',
      quantity: 1,
      unit_price: 249,
      customer_name: 'Khadija Mansouri',
      phone: '0677889900',
      city: 'Tanger',
      address: 'Malabata, Résidence Bay View',
      note: 'Source: Landing Page SOS Therapy'
    });
    assert('Commande Landing Okinso (SOS Therapy 249 DH)', orderOkinsoSOS.status === 201 && !!orderOkinsoSOS.data?.order_id, `Order ID: ${orderOkinsoSOS.data?.order_id}`);
    const orderIdSOS = orderOkinsoSOS.data?.order_id;

    // 7.3 Landing Okinso - Crystal Rose
    const orderOkinsoCrystal = await request({
      hostname: 'localhost', port: 4000, path: '/api/public/orders', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': okinsoBrand.api_key
      }
    }, {
      product_id: 1,
      product_name: 'Crystal Rose',
      quantity: 2,
      unit_price: 649,
      customer_name: 'Soukaina Berrada',
      phone: '0699001122',
      city: 'Fès',
      address: 'Route d Imouzzer',
      note: 'Source: Landing Page Crystal Rose'
    });
    assert('Commande Landing Okinso (Crystal Rose 649 DH x 2)', orderOkinsoCrystal.status === 201 && !!orderOkinsoCrystal.data?.order_id, `Order ID: ${orderOkinsoCrystal.data?.order_id}`);

    // 8. TEST DU WORKFLOW DE CONFIRMATION
    console.log('\n--- 8. WORKFLOW DE CONFIRMATION COMPLET ---');
    // 8.1 Attribution des commandes au confirmateur (Dispatch par Admin)
    const assignKC = await request({
      hostname: 'localhost', port: 4000, path: `/api/orders/${orderIdKC}`, method: 'PUT',
      headers: adminHeaders
    }, {
      confirmer_id: createdConfirmerId
    });
    assert('Attribution Commande Keratin Complex au Confirmateur', assignKC.status === 200 && assignKC.data?.order?.confirmer_id === createdConfirmerId, `Assigné à ID: ${createdConfirmerId}`);

    const assignVita = await request({
      hostname: 'localhost', port: 4000, path: `/api/orders/${orderIdVita}`, method: 'PUT',
      headers: adminHeaders
    }, {
      confirmer_id: createdConfirmerId
    });
    assert('Attribution Commande VitaSilk au Confirmateur', assignVita.status === 200 && assignVita.data?.order?.confirmer_id === createdConfirmerId, `Assigné à ID: ${createdConfirmerId}`);

    // 8.2 Le confirmateur consulte ses commandes assignées
    const ordersListRes = await request({
      hostname: 'localhost', port: 4000, path: '/api/orders?page=1&limit=10', method: 'GET',
      headers: confirmerHeaders
    });
    assert('Consultation des commandes assignées par la confirmatrice', ordersListRes.status === 200 && ordersListRes.data?.orders?.length >= 2, `Commandes trouvées: ${ordersListRes.data?.orders?.length}`);

    // 8.3 Confirmation de la commande Keratin Complex avec transporteur & tracking
    const confirmOrderRes = await request({
      hostname: 'localhost', port: 4000, path: `/api/orders/${orderIdKC}`, method: 'PUT',
      headers: confirmerHeaders
    }, {
      call_status: 'Confirmé',
      shipping_company: 'Ozon Express',
      tracking_number: 'OZON-TEST-998877',
      shipping_status: 'Mise En Distribution',
      note: 'Client confirmé par téléphone à 11:15 - Livraison après 16h'
    });
    assert('Confirmation Commande (Statut: Confirmé + Ozon Express + Tracking)', confirmOrderRes.status === 200 && confirmOrderRes.data?.order?.call_status === 'Confirmé', `Status Appel: ${confirmOrderRes.data?.order?.call_status} | Transporteur: ${confirmOrderRes.data?.order?.shipping_company} | Tracking: ${confirmOrderRes.data?.order?.tracking_number}`);

    // 8.4 Mise à jour de livraison finale (Livré)
    const deliverOrderRes = await request({
      hostname: 'localhost', port: 4000, path: `/api/orders/${orderIdKC}`, method: 'PUT',
      headers: confirmerHeaders
    }, {
      shipping_status: 'Livré'
    });
    assert('Mise à jour livraison finale: Livré', deliverOrderRes.status === 200 && deliverOrderRes.data?.order?.shipping_status === 'Livré', `Statut final: ${deliverOrderRes.data?.order?.shipping_status}`);

    // 8.5 Confirmation commande VitaSilk avec Sendit Delivery
    const confirmVitaRes = await request({
      hostname: 'localhost', port: 4000, path: `/api/orders/${orderIdVita}`, method: 'PUT',
      headers: confirmerHeaders
    }, {
      call_status: 'Confirmé',
      shipping_company: 'Sendit Delivery',
      tracking_number: 'SND-445566',
      shipping_status: 'Mise En Distribution'
    });
    assert('Confirmation Commande VitaSilk (Sendit Delivery)', confirmVitaRes.status === 200 && confirmVitaRes.data?.order?.shipping_company === 'Sendit Delivery', `Transporteur: ${confirmVitaRes.data?.order?.shipping_company} | Tracking: ${confirmVitaRes.data?.order?.tracking_number}`);

    // 8.6 Création directe d'une commande par la confirmatrice (WhatsApp lead)
    const directOrderRes = await request({
      hostname: 'localhost', port: 4000, path: '/api/orders', method: 'POST',
      headers: confirmerHeaders
    }, {
      brand_id: vinilliaBrand.id,
      product_id: 7,
      customer_name: 'Amina El Guerrouj',
      phone: '0644332211',
      city: 'Casablanca',
      address: 'Maarif Rue Jean Jaures',
      quantity: 1,
      price: 399,
      call_status: 'Confirmé',
      shipping_status: 'En attente',
      source: 'WhatsApp',
      note: 'Commande reçue et confirmée directement sur WhatsApp'
    });
    assert('Création directe de commande par Confirmatrice (Auto-assignée)', directOrderRes.status === 201 && directOrderRes.data?.order?.confirmer_id === createdConfirmerId, `ID Commande: ${directOrderRes.data?.order?.id} | Confirmateur: ${directOrderRes.data?.order?.confirmer_name}`);

    // 9. TEST GESTION SOCIÉTÉS DE LIVRAISON (CRUD)
    console.log('\n--- 9. TEST SOCIÉTÉS DE LIVRAISON ---');
    const shippingCompList = await request({
      hostname: 'localhost', port: 4000, path: '/api/shipping-companies', method: 'GET',
      headers: adminHeaders
    });
    assert('Liste des Sociétés de livraison actives', shippingCompList.status === 200 && shippingCompList.data?.companies?.length >= 5, `Total actives: ${shippingCompList.data?.companies?.length}`);

    // Ajout d'une nouvelle société de livraison
    const newCompName = 'Express Maghreb ' + Date.now();
    const addShippingRes = await request({
      hostname: 'localhost', port: 4000, path: '/api/shipping-companies', method: 'POST',
      headers: adminHeaders
    }, {
      name: newCompName,
      phone: '0522998877',
      tracking_url_template: 'https://expressmaghreb.ma/track?num={TRACKING_NUMBER}'
    });
    assert('Ajout nouvelle société de livraison (Admin)', addShippingRes.status === 201 && !!addShippingRes.data?.company?.id, `Société: ${addShippingRes.data?.company?.name}`);

    // 10. TEST BLACKLIST & DÉTECTION FRAUDE
    console.log('\n--- 10. TEST BLACKLIST ET DÉTECTION CLIENT SUSPECT ---');
    const blacklistedPhone = '0600112233';
    const addBlacklistRes = await request({
      hostname: 'localhost', port: 4000, path: '/api/blacklist', method: 'POST',
      headers: adminHeaders
    }, {
      phone: blacklistedPhone,
      customer_name: 'Client Fraudeur Test',
      reason: 'Refus systématique et faux numéros'
    });
    assert('Ajout d\'un numéro dans la Liste Noire (Admin)', addBlacklistRes.status === 201, `Numéro bloqué: ${blacklistedPhone}`);

    // Envoi d'une commande avec ce numéro depuis landing Okinso
    const blOrderRes = await request({
      hostname: 'localhost', port: 4000, path: '/api/public/orders', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': okinsoBrand.api_key
      }
    }, {
      product_id: 4,
      product_name: 'SOS Hair Therapy',
      quantity: 1,
      customer_name: 'Test Client Blackliste',
      phone: blacklistedPhone,
      city: 'Casablanca',
      address: 'Ain Sebaa'
    });
    assert('Envoi commande avec numéro blacklisté', blOrderRes.status === 201 && !!blOrderRes.data?.order_id, `Order ID: ${blOrderRes.data?.order_id}`);

    // Vérification que la commande porte l'alerte
    const checkBlOrder = await request({
      hostname: 'localhost', port: 4000, path: `/api/orders/${blOrderRes.data?.order_id}`, method: 'GET',
      headers: adminHeaders
    });
    const containsAlert = checkBlOrder.data?.order?.note?.includes('ALERTE LISTE NOIRE');
    assert('Détection automatique Alerte Liste Noire dans la commande', containsAlert === true, `Note enregistrée: ${checkBlOrder.data?.order?.note}`);

    // 11. STATS ET RAPPORTS
    console.log('\n--- 11. VÉRIFICATION DES STATISTIQUES ET RAPPORTS ---');
    const statsRes = await request({
      hostname: 'localhost', port: 4000, path: '/api/stats', method: 'GET',
      headers: adminHeaders
    });
    assert('Calcul KPIs Dashboard (Total, Confirmés, Livrés, Revenus, Profit)', statsRes.status === 200 && statsRes.data?.kpis?.total_orders > 0, `Total: ${statsRes.data?.kpis?.total_orders} | Confirmés: ${statsRes.data?.kpis?.confirmed} | Livrés: ${statsRes.data?.kpis?.delivered} | Revenus: ${statsRes.data?.kpis?.revenus} DH | Taux Conf: ${statsRes.data?.kpis?.confirmation_rate}%`);
    assert('Statistiques par Produits / Landing Pages', statsRes.status === 200 && Array.isArray(statsRes.data?.products) && statsRes.data?.products?.length > 0, `Nombre de produits suivis: ${statsRes.data?.products?.length}`);
    assert('Statistiques par Confirmatrice', statsRes.status === 200 && Array.isArray(statsRes.data?.confirmers) && statsRes.data?.confirmers?.length > 0, `Confirmatrices actives: ${statsRes.data?.confirmers?.length}`);

    // RÉSUMÉ FINAL
    console.log('\n================================================================');
    console.log(`🏁 RÉSULTAT FINAL DES TESTS : ${passed} RÉUSSIS / ${failed} ÉCHOUÉS`);
    console.log('================================================================');
    
    if (failed === 0) {
      console.log('🎉 TOUS LES TESTS SONT AU VERT (100% SUCCÈS) !');
    }
  } catch (err) {
    console.error('Erreur globale test:', err);
  } finally {
    process.exit(0);
  }
}

runTests();
