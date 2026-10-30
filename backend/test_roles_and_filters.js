const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const opts = { ...options, path: encodeURI(options.path) };
    const req = http.request(opts, (res) => {
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

async function run() {
  console.log('================================================================');
  console.log('🧪 TEST DES ROLES & FILTRAGES : ADMIN, VINILLIA, OKINSO, CONFIRMERS');
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
    // ------------------------------------------------------------------------
    // 1. ADMIN TESTS (admin@dashboard.local)
    // ------------------------------------------------------------------------
    console.log('--- 1. TESTS RÔLE ADMIN ---');
    const adminLogin = await request({
      hostname: 'localhost', port: 4000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'admin@dashboard.local', password: 'Admin123!' });
    
    assert('Admin Login', adminLogin.status === 200 && adminLogin.data?.user?.role === 'admin', 'Authentifié avec rôle Admin');
    const adminToken = adminLogin.data.token;
    const adminHeaders = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken };

    // Admin voit toutes les marques
    const adminBrands = await request({ hostname: 'localhost', port: 4000, path: '/api/brands', method: 'GET', headers: adminHeaders });
    assert('Admin Liste Marques', adminBrands.status === 200 && adminBrands.data?.brands?.length >= 3, `Marques: ${adminBrands.data?.brands?.map(b => b.name).join(', ')}`);

    // Admin filtre par toutes les commandes
    const adminAllOrders = await request({ hostname: 'localhost', port: 4000, path: '/api/orders?page=1&limit=50', method: 'GET', headers: adminHeaders });
    assert('Admin Vue Globale Commandes', adminAllOrders.status === 200, `Total commandes système: ${adminAllOrders.data?.total}`);

    // Admin filtre spécifiquement par Vinillia (brand_id=2)
    const adminVinilliaOrders = await request({ hostname: 'localhost', port: 4000, path: '/api/orders?brand_id=2', method: 'GET', headers: adminHeaders });
    const allAreVinillia = adminVinilliaOrders.data?.orders?.every(o => o.brand_id === 2);
    assert('Admin Filtrage Marque Vinillia', adminVinilliaOrders.status === 200 && allAreVinillia, `Commandes Vinillia: ${adminVinilliaOrders.data?.orders?.length}`);

    // Admin filtre spécifiquement par Okinso (brand_id=1)
    const adminOkinsoOrders = await request({ hostname: 'localhost', port: 4000, path: '/api/orders?brand_id=1', method: 'GET', headers: adminHeaders });
    const allAreOkinso = adminOkinsoOrders.data?.orders?.every(o => o.brand_id === 1);
    assert('Admin Filtrage Marque Okinso', adminOkinsoOrders.status === 200 && allAreOkinso, `Commandes Okinso: ${adminOkinsoOrders.data?.orders?.length}`);

    // ------------------------------------------------------------------------
    // 2. VINILLIA BRAND ROLE TESTS (vinillia@dashboard.local)
    // ------------------------------------------------------------------------
    console.log('\n--- 2. TESTS RÔLE MARQUE VINILLIA ---');
    const vinilliaLogin = await request({
      hostname: 'localhost', port: 4000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'vinillia@dashboard.local', password: 'Brand123!' });

    assert('Vinillia Login', vinilliaLogin.status === 200 && vinilliaLogin.data?.user?.role === 'brand', `Connecté en tant que Brand: ${vinilliaLogin.data?.user?.brand?.name}`);
    const vinilliaToken = vinilliaLogin.data.token;
    const vinilliaHeaders = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + vinilliaToken };

    // Vinillia ne voit QUE ses commandes
    const vinilliaOrders = await request({ hostname: 'localhost', port: 4000, path: '/api/orders', method: 'GET', headers: vinilliaHeaders });
    const onlyVinillia = vinilliaOrders.data?.orders?.every(o => o.brand_id === 2);
    assert('Isolation Données Vinillia (Aucune commande Okinso visible)', vinilliaOrders.status === 200 && onlyVinillia, `Commandes Vinillia visibles: ${vinilliaOrders.data?.orders?.length}`);

    // Vinillia filtre par statut d'appel (ex: Nouveau, Confirmé)
    const vinilliaConfirmed = await request({ hostname: 'localhost', port: 4000, path: '/api/orders?call_status=Confirmé', method: 'GET', headers: vinilliaHeaders });
    const allVinilliaConfirmed = vinilliaConfirmed.data?.orders?.every(o => o.call_status === 'Confirmé');
    assert('Vinillia Filtrage par Statut Appel (Confirmé)', vinilliaConfirmed.status === 200 && allVinilliaConfirmed, `Trouvé: ${vinilliaConfirmed.data?.orders?.length} commandes`);

    // Vinillia filtre par statut de livraison (ex: En attente, Livré)
    const vinilliaDelivered = await request({ hostname: 'localhost', port: 4000, path: '/api/orders?shipping_status=Livré', method: 'GET', headers: vinilliaHeaders });
    const allVinilliaDelivered = vinilliaDelivered.data?.orders?.every(o => o.shipping_status === 'Livré');
    assert('Vinillia Filtrage par Statut Livraison (Livré)', vinilliaDelivered.status === 200 && allVinilliaDelivered, `Trouvé: ${vinilliaDelivered.data?.orders?.length} livrées`);

    // ------------------------------------------------------------------------
    // 3. OKINSO BRAND ROLE TESTS (okinso@dashboard.local)
    // ------------------------------------------------------------------------
    console.log('\n--- 3. TESTS RÔLE MARQUE OKINSO ---');
    const okinsoLogin = await request({
      hostname: 'localhost', port: 4000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'okinso@dashboard.local', password: 'Brand123!' });

    assert('Okinso Login', okinsoLogin.status === 200 && okinsoLogin.data?.user?.role === 'brand', `Connecté en tant que Brand: ${okinsoLogin.data?.user?.brand?.name}`);
    const okinsoToken = okinsoLogin.data.token;
    const okinsoHeaders = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + okinsoToken };

    // Okinso ne voit QUE ses commandes
    const okinsoOrders = await request({ hostname: 'localhost', port: 4000, path: '/api/orders', method: 'GET', headers: okinsoHeaders });
    const onlyOkinso = okinsoOrders.data?.orders?.every(o => o.brand_id === 1);
    assert('Isolation Données Okinso (Aucune commande Vinillia visible)', okinsoOrders.status === 200 && onlyOkinso, `Commandes Okinso visibles: ${okinsoOrders.data?.orders?.length}`);

    // Okinso filtre par statut d'appel
    const okinsoNew = await request({ hostname: 'localhost', port: 4000, path: '/api/orders?call_status=Nouveau', method: 'GET', headers: okinsoHeaders });
    const allOkinsoNew = okinsoNew.data?.orders?.every(o => o.call_status === 'Nouveau');
    assert('Okinso Filtrage par Statut Appel (Nouveau)', okinsoNew.status === 200 && allOkinsoNew, `Trouvé: ${okinsoNew.data?.orders?.length} nouvelles commandes`);

    // ------------------------------------------------------------------------
    // 4. MULTI-BRAND CONFIRMER TESTS (Okinso + Vinillia)
    // ------------------------------------------------------------------------
    console.log('\n--- 4. TESTS CONFIRMATRICE MULTI-MARQUES (OKINSO + VINILLIA) ---');
    
    // Création d'une confirmatrice dédiée aux tests multi-marques
    const multiConfirmerEmail = 'confirmer_multi_' + Date.now() + '@dashboard.local';
    const multiConfirmerPass = 'MultiPass123!';
    
    const createMultiRes = await request({
      hostname: 'localhost', port: 4000, path: '/api/confirmers', method: 'POST',
      headers: adminHeaders
    }, {
      name: 'Kawtar Multi-Brand',
      phone: '0665544332',
      brand_ids: [1, 2], // Okinso (1) + Vinillia (2)
      email: multiConfirmerEmail,
      password: multiConfirmerPass
    });
    assert('Création Confiramtice Multi-Marques (1=Okinso, 2=Vinillia)', createMultiRes.status === 201 && !!createMultiRes.data?.confirmer?.id, `ID: ${createMultiRes.data?.confirmer?.id}`);
    const multiConfId = createMultiRes.data?.confirmer?.id;

    // Login de la confirmatrice multi-marques
    const multiLogin = await request({
      hostname: 'localhost', port: 4000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: multiConfirmerEmail, password: multiConfirmerPass });

    assert('Login Confirmatrice Multi-Marques', multiLogin.status === 200 && multiLogin.data?.user?.brands?.length === 2, `Marques assignées: ${multiLogin.data?.user?.brands?.map(b => b.name).join(' & ')}`);
    const multiToken = multiLogin.data.token;
    const multiHeaders = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + multiToken };

    // Création de 2 commandes Okinso et 2 commandes Vinillia assignées à cette confirmatrice
    const ord1 = await request({
      hostname: 'localhost', port: 4000, path: '/api/orders', method: 'POST', headers: multiHeaders
    }, {
      brand_id: 1, product_id: 3, customer_name: 'Client Okinso En Attente', phone: '0611111111', city: 'Casablanca',
      call_status: 'Nouveau', shipping_status: 'En attente', source: 'WhatsApp'
    });
    
    const ord2 = await request({
      hostname: 'localhost', port: 4000, path: '/api/orders', method: 'POST', headers: multiHeaders
    }, {
      brand_id: 1, product_id: 4, customer_name: 'Client Okinso Confirmé', phone: '0622222222', city: 'Rabat',
      call_status: 'Confirmé', shipping_status: 'Mise En Distribution', shipping_company: 'Ozon Express', tracking_number: 'OZ-1122', source: 'WhatsApp'
    });

    const ord3 = await request({
      hostname: 'localhost', port: 4000, path: '/api/orders', method: 'POST', headers: multiHeaders
    }, {
      brand_id: 2, product_id: 7, customer_name: 'Client Vinillia En Attente', phone: '0633333333', city: 'Marrakech',
      call_status: 'Nouveau', shipping_status: 'En attente', source: 'WhatsApp'
    });

    const ord4 = await request({
      hostname: 'localhost', port: 4000, path: '/api/orders', method: 'POST', headers: multiHeaders
    }, {
      brand_id: 2, product_id: 8, customer_name: 'Client Vinillia Confirmé Livré', phone: '0644444444', city: 'Tanger',
      call_status: 'Confirmé', shipping_status: 'Livré', shipping_company: 'Sendit Delivery', tracking_number: 'SN-3344', source: 'WhatsApp'
    });

    assert('Création Commandes Multi-Marques pour Tests', ord1.status === 201 && ord2.status === 201 && ord3.status === 201 && ord4.status === 201, '4 commandes créées (2 Okinso, 2 Vinillia)');

    // 4.1 TEST FILTRAGE : Toutes les marques assignées
    const confAllBrands = await request({ hostname: 'localhost', port: 4000, path: '/api/orders', method: 'GET', headers: multiHeaders });
    assert('Confirmatrice : Vue "Toutes mes marques"', confAllBrands.status === 200 && confAllBrands.data?.orders?.length >= 4, `Total commandes assignées: ${confAllBrands.data?.orders?.length}`);

    // 4.2 TEST FILTRAGE : Filtrer UNIQUEMENT sur la marque OKINSO (brand_id=1)
    const confOkinsoOnly = await request({ hostname: 'localhost', port: 4000, path: '/api/orders?brand_id=1', method: 'GET', headers: multiHeaders });
    const isStrictlyOkinso = confOkinsoOnly.data?.orders?.every(o => o.brand_id === 1);
    assert('Confirmatrice : Filtrage par marque OKINSO (brand_id=1)', confOkinsoOnly.status === 200 && isStrictlyOkinso && confOkinsoOnly.data?.orders?.length >= 2, `Commandes Okinso filtrées: ${confOkinsoOnly.data?.orders?.length}`);

    // 4.3 TEST FILTRAGE : Filtrer UNIQUEMENT sur la marque VINILLIA (brand_id=2)
    const confVinilliaOnly = await request({ hostname: 'localhost', port: 4000, path: '/api/orders?brand_id=2', method: 'GET', headers: multiHeaders });
    const isStrictlyVinillia = confVinilliaOnly.data?.orders?.every(o => o.brand_id === 2);
    assert('Confirmatrice : Filtrage par marque VINILLIA (brand_id=2)', confVinilliaOnly.status === 200 && isStrictlyVinillia && confVinilliaOnly.data?.orders?.length >= 2, `Commandes Vinillia filtrées: ${confVinilliaOnly.data?.orders?.length}`);

    // 4.4 TEST FILTRAGE : Filtrer par Statut Appel "Confirmé" sur TOUTES ses marques
    const confAllConfirmed = await request({ hostname: 'localhost', port: 4000, path: '/api/orders?call_status=Confirmé', method: 'GET', headers: multiHeaders });
    const allAreConfirmed = confAllConfirmed.data?.orders?.every(o => o.call_status === 'Confirmé');
    assert('Confirmatrice : Filtrage par Statut Appel "Confirmé"', confAllConfirmed.status === 200 && allAreConfirmed && confAllConfirmed.data?.orders?.length >= 2, `Commandes confirmées: ${confAllConfirmed.data?.orders?.length}`);

    // 4.5 TEST FILTRAGE : Filtrer par Statut Livraison "En attente" sur TOUTES ses marques
    const confAllPendingShip = await request({ hostname: 'localhost', port: 4000, path: '/api/orders?shipping_status=En attente', method: 'GET', headers: multiHeaders });
    const allArePending = confAllPendingShip.data?.orders?.every(o => o.shipping_status === 'En attente');
    assert('Confirmatrice : Filtrage par Statut Livraison "En attente"', confAllPendingShip.status === 200 && allArePending && confAllPendingShip.data?.orders?.length >= 2, `Commandes en attente: ${confAllPendingShip.data?.orders?.length}`);

    // 4.6 TEST FILTRAGE COMBINÉ : Marque OKINSO (brand_id=1) + Statut Appel "Confirmé"
    const confCombined = await request({ hostname: 'localhost', port: 4000, path: '/api/orders?brand_id=1&call_status=Confirmé', method: 'GET', headers: multiHeaders });
    const isOkinsoAndConfirmed = confCombined.data?.orders?.every(o => o.brand_id === 1 && o.call_status === 'Confirmé');
    assert('Confirmatrice : Filtrage Combiné (Okinso + Confirmé)', confCombined.status === 200 && isOkinsoAndConfirmed && confCombined.data?.orders?.length >= 1, `Trouvé: ${confCombined.data?.orders?.length} commandes correspondantes`);

    // 4.7 TEST FILTRAGE COMBINÉ : Marque VINILLIA (brand_id=2) + Statut Livraison "Livré"
    const confVinilliaDelivered = await request({ hostname: 'localhost', port: 4000, path: '/api/orders?brand_id=2&shipping_status=Livré', method: 'GET', headers: multiHeaders });
    const isVinilliaDelivered = confVinilliaDelivered.data?.orders?.every(o => o.brand_id === 2 && o.shipping_status === 'Livré');
    assert('Confirmatrice : Filtrage Combiné (Vinillia + Livré)', confVinilliaDelivered.status === 200 && isVinilliaDelivered && confVinilliaDelivered.data?.orders?.length >= 1, `Trouvé: ${confVinilliaDelivered.data?.orders?.length} commandes correspondantes`);

    // 4.8 TEST SÉCURITÉ : Tentative d'accès à une marque NON assignée (Marjad: brand_id=3)
    const confUnauthorizedBrand = await request({ hostname: 'localhost', port: 4000, path: '/api/orders?brand_id=3', method: 'GET', headers: multiHeaders });
    assert('Confirmatrice : Blocage sécurisé d\'une marque non assignée (Marjad)', confUnauthorizedBrand.status === 200 && confUnauthorizedBrand.data?.orders?.length === 0, 'Accès refusé / 0 commandes retournées');

    // RÉSUMÉ FINAL
    console.log('\n================================================================');
    console.log(`🏁 RÉSULTAT FINAL DES TESTS : ${passed} RÉUSSIS / ${failed} ÉCHOUÉS`);
    console.log('================================================================');

    if (failed === 0) {
      console.log('✨ TOUS LES TESTS DE RÔLES ET DE FILTRAGES SONT 100% FONCTIONNELS !');
    }
  } catch (err) {
    console.error('Erreur test roles:', err);
  } finally {
    process.exit(0);
  }
}

run();
