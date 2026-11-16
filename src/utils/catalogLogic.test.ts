import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SEED_PRODUCTS,
  CATEGORIES,
  SYSTEMS,
  WHATSAPP_NUMBER,
  clampQuantity,
  sanitizeProducts,
  filterProducts,
  getSearchMatchField,
  validatePhone,
  createOrderRecord,
  buildWhatsAppUrl,
  computeScrollCameraKeyframe,
} from './catalogLogic';
import {
  buildQuotePdfFilename,
  createDraftPdfPayload,
} from './pdfExport';

test('clampQuantity enforces 1..999 integer bounds', () => {
  assert.equal(clampQuantity(0), 1);
  assert.equal(clampQuantity(-15), 1);
  assert.equal(clampQuantity('12.9'), 12);
  assert.equal(clampQuantity(1500), 999);
  assert.equal(clampQuantity('invalid'), 1);
});

test('sanitizeProducts cleans malformed records and preserves valid fields', () => {
  const raw = [
    null,
    { id: 'P1', name: 'Mangueira 2SN', stock: '15.8', demo: false },
    { id: '', name: 'Invalid without id' },
  ];
  const cleaned = sanitizeProducts(raw);
  assert.equal(cleaned.length, 1);
  assert.equal(cleaned[0].id, 'P1');
  assert.equal(cleaned[0].sku, 'P1');
  assert.equal(cleaned[0].stock, 15);
  assert.equal(cleaned[0].demo, false);
});

test('filterProducts filters by search query, multi-token, SKU, category, and system', () => {
  const byQuery = filterProducts(SEED_PRODUCTS, 'pistao', 'Todos', 'Todos');
  assert.equal(byQuery.length, 1);
  assert.equal(byQuery[0].sku, 'MNG-MOT-001');
  assert.equal(getSearchMatchField(byQuery[0], 'pistao'), 'NOME');

  const bySku = filterProducts(SEED_PRODUCTS, 'MNG-MAN-010', 'Todos', 'Todos');
  assert.equal(bySku.length, 1);
  assert.equal(bySku[0].sku, 'MNG-MAN-010');
  assert.equal(getSearchMatchField(bySku[0], 'MNG-MAN-010'), 'SKU');

  const byMultiTokenCategoryAndName = filterProducts(
    SEED_PRODUCTS,
    'tratores mangueira 2sn',
    'Todos',
    'Todos'
  );
  assert.equal(byMultiTokenCategoryAndName.length, 1);
  assert.equal(byMultiTokenCategoryAndName[0].sku, 'MNG-MAN-010');

  const byCategoryAndSystem = filterProducts(
    SEED_PRODUCTS,
    '',
    CATEGORIES[1],
    SYSTEMS[5]
  );
  assert.equal(byCategoryAndSystem.length, 1);
  assert.equal(byCategoryAndSystem[0].sku, 'MNG-MAN-011');
});

test('validatePhone accepts valid Brazilian phone numbers with or without 55 prefix', () => {
  assert.equal(validatePhone('(71) 98397-8870'), true);
  assert.equal(validatePhone('+55 71 98397-8870'), true);
  assert.equal(validatePhone('7133334444'), true);
  assert.equal(validatePhone('12345'), false);
});

test('createOrderRecord and buildWhatsAppUrl target +55 71 98397-8870 and format protocol', () => {
  const order = createOrderRecord(
    {
      customer: {
        name: 'Oficina Diesel Bahia',
        phone: '(71) 99999-8888',
        city: 'Salvador / BA',
      },
      vehicle: 'Scania R450 2022',
      notes: 'Urgente para frota',
      items: [
        {
          id: 'MNG-MAN-010',
          sku: 'MNG-MAN-010',
          name: 'Mangueira Hidráulica Alta Pressão SAE 100R2AT / 2SN',
          quantity: 4,
          manual: false,
          demo: true,
        },
      ],
    },
    'abc12345-0000-4000-8000-000000000000',
    '2026-11-03T14:00:00.000Z'
  );

  assert.equal(order.protocol, '#PED-2026-ABC12345');
  assert.equal(order.status, 'Pendente de Cotação');
  const url = buildWhatsAppUrl(order);
  assert.ok(url.startsWith(`https://wa.me/${WHATSAPP_NUMBER}?text=`));
  assert.ok(decodeURIComponent(url).includes('Oficina Diesel Bahia'));
  assert.ok(decodeURIComponent(url).includes('Mangueira Hidráulica Alta Pressão'));
});


test('computeScrollCameraKeyframe interpolates explosion, rotation, and subsystem zoom', () => {
  const heroFrame = computeScrollCameraKeyframe(0, 'all');
  const engFrame = computeScrollCameraKeyframe(0.5, 'all');
  assert.ok(engFrame.explosion > heroFrame.explosion);
  assert.notEqual(engFrame.modelRot[1], heroFrame.modelRot[1]);

  const brakeFocus = computeScrollCameraKeyframe(0.2, 'brake');
  assert.ok(brakeFocus.stageLabel.includes('BRAKE'));
  assert.equal(brakeFocus.fov, 32);
});

test('buildQuotePdfFilename and createDraftPdfPayload generate clean formal PDF metadata', () => {
  const filename = buildQuotePdfFilename('#PED-2026-ABC12345', 'Transportadora São José & Filhos');
  assert.equal(filename, 'TEM-DE-TUDO-PED-2026-ABC12345-TRANSPORTADORA-SAO-JOSE-FILH.pdf');

  const draft = createDraftPdfPayload({
    cart: [{ ...SEED_PRODUCTS[0], quantity: 3 }],
    customerName: '',
    phone: '',
    city: '',
    vehicle: '',
    notes: '',
    protocol: '#COT-2026-TEST01',
  });
  assert.equal(draft.protocol, '#COT-2026-TEST01');
  assert.equal(draft.items.length, 1);
  assert.equal(draft.items[0].quantity, 3);
  assert.ok(draft.customerName.includes('Cliente'));
});

