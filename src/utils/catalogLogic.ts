export interface Product {
  id: string;
  sku: string;
  name: string;
  oem: string;
  category: string;
  system: string;
  application: string;
  stock: number;
  demo: boolean;
}

export interface CartItem extends Product {
  quantity: number;
  manual?: boolean;
}

export interface OrderCustomer {
  name: string;
  phone: string;
  city: string;
}

export interface VehicleIdentification {
  model: string;
  year: string;
  plate: string;
  chassis: string;
}

export interface OrderItemPayload {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  manual: boolean;
  demo: boolean;
}

export interface OrderDraftInput {
  customer: OrderCustomer;
  vehicle: string;
  notes: string;
  items: OrderItemPayload[];
}

export interface OrderRecord extends OrderDraftInput {
  id: string;
  protocol: string;
  createdAt: string;
  status: 'Pendente de Cotação';
  cloudState: 'local' | 'pending' | 'synced';
}

export type SubsystemId = 'all' | 'brake' | 'engine' | 'transmission' | 'spring';

export interface CameraKeyframe {
  cameraPos: [number, number, number];
  lookAt: [number, number, number];
  modelRot: [number, number, number];
  modelPos: [number, number, number];
  explosion: number;
  fov: number;
  stageLabel: string;
  angleTitle: string;
}

export const WHATSAPP_NUMBER = '5571983978870';
export const WHATSAPP_DISPLAY = '+55 (71) 98397-8870';
export const SECONDARY_PHONE_DISPLAY = '+55 (71) 8952-1165';

export const PRODUCTS_DB_KEY = 'mangueiras_products_db';
export const ORDERS_DB_KEY = 'mangueiras_orders_db';
export const QUOTE_DRAFT_KEY = 'mangueiras_quote_draft';
export const VEHICLE_DRAFT_KEY = 'mangueiras_vehicle_draft';
export const SEEDED_FLAG_KEY = 'mangueiras_seeded_v1';

export const SHOWCASE_CATEGORIES: readonly string[] = [
  'Linha Pesada / Diesel (Caminhões e Ônibus)',
  'Máquinas Pesadas & Agrícolas (Tratores, Guindastes, Motoniveladoras)',
  'Utilitários (Pick-ups e Vans)',
  'Linha Leve (Carros de Passeio)',
  'Embarcações',
];

export const CATEGORIES: readonly string[] = [
  'Todos',
  ...SHOWCASE_CATEGORIES,
];

export const SYSTEMS: readonly string[] = [
  'Todos',
  'Componentes de Motor',
  'Sistemas de Freio',
  'Suspensão e Direção',
  'Transmissão e Hidráulica',
  'Mangueiras e Conexões',
];

export const SEED_PRODUCTS: Product[] = [
  {
    id: 'MNG-MOT-001',
    sku: 'MNG-MOT-001',
    name: 'Kit Pistão e Anéis Diesel Forged',
    category: SHOWCASE_CATEGORIES[0],
    system: SYSTEMS[1],
    application: 'Motor Mercedes-Benz OM 366 / OM 352; caminhões e ônibus rodoviários. Confirmar diâmetro, sobremedida e versão.',
    stock: 8,
    oem: 'A3660300417',
    demo: true,
  },
  {
    id: 'MNG-MOT-002',
    sku: 'MNG-MOT-002',
    name: 'Filtro de Óleo Blindado Diesel Pick-ups & Vans',
    category: SHOWCASE_CATEGORIES[2],
    system: SYSTEMS[1],
    application: 'Motores Cummins ISF 2.8 / 3.8 e turbodiesel; pick-ups, vans e utilitários de carga. Confirmar rosca e referência.',
    stock: 24,
    oem: 'LF16015',
    demo: true,
  },
  {
    id: 'MNG-FRE-003',
    sku: 'MNG-FRE-003',
    name: 'Válvula Pneumática Pedal de Freio',
    category: SHOWCASE_CATEGORIES[0],
    system: SYSTEMS[2],
    application: 'Sistemas de freio a ar de caminhões e ônibus pesados. Conferir circuito duplo, pressão de trabalho e conexões.',
    stock: 4,
    oem: 'II-35197',
    demo: true,
  },
  {
    id: 'MNG-HID-004',
    sku: 'MNG-HID-004',
    name: 'Bomba Hidráulica de Engrenagens Dupla',
    category: SHOWCASE_CATEGORIES[1],
    system: SYSTEMS[4],
    application: 'Tratores agrícolas, pás-carregadeiras e motoniveladoras. Conferir vazão (cm³/rev), flange SAE, eixo estriado e rotação.',
    stock: 0,
    oem: '9510080',
    demo: true,
  },
  {
    id: 'MNG-MOT-005',
    sku: 'MNG-MOT-005',
    name: 'Filtro Separador de Água e Combustível',
    category: SHOWCASE_CATEGORIES[1],
    system: SYSTEMS[1],
    application: 'Tratores, colheitadeiras e escavadeiras com motores diesel de alta pressão Common Rail.',
    stock: 16,
    oem: 'R120LJ-10M',
    demo: true,
  },
  {
    id: 'MNG-SUS-006',
    sku: 'MNG-SUS-006',
    name: 'Amortecedor Dianteiro Pressurizado Heavy-Duty',
    category: SHOWCASE_CATEGORIES[2],
    system: SYSTEMS[3],
    application: 'Toyota Hilux 2.8 Diesel 4x4, S10, Ranger e utilitários de carga; verificar ano, versão e posição antes da compra.',
    stock: 6,
    oem: '48510-09A10',
    demo: true,
  },
  {
    id: 'MNG-MOT-007',
    sku: 'MNG-MOT-007',
    name: 'Kit Correia Dentada e Tensor Rolamentado',
    category: SHOWCASE_CATEGORIES[3],
    system: SYSTEMS[1],
    application: 'Volkswagen Gol, Voyage, Saveiro e Fox com motor EA111 1.0/1.6 8V. Conferir ano e código do motor.',
    stock: 12,
    oem: '030198119E',
    demo: true,
  },
  {
    id: 'MNG-FRE-008',
    sku: 'MNG-FRE-008',
    name: 'Disco de Freio Dianteiro Ventilado e Perfurado',
    category: SHOWCASE_CATEGORIES[3],
    system: SYSTEMS[2],
    application: 'Chevrolet Onix, Prisma e carros de passeio. Liga de alto carbono com aletas internas de dissipação térmica.',
    stock: 10,
    oem: '94752854',
    demo: true,
  },
  {
    id: 'MNG-MAR-009',
    sku: 'MNG-MAR-009',
    name: 'Filtro Racor Marítimo Separador com Copo Metálico',
    category: SHOWCASE_CATEGORIES[4],
    system: SYSTEMS[1],
    application: 'Motores diesel marítimos de centro, lanchas, rebocadores e embarcações de trabalho. Conexões anticorrosivas.',
    stock: 9,
    oem: '500FG-MAR',
    demo: true,
  },
  {
    id: 'MNG-MAN-010',
    sku: 'MNG-MAN-010',
    name: 'Mangueira Hidráulica Alta Pressão SAE 100R2AT / 2SN',
    category: SHOWCASE_CATEGORIES[1],
    system: SYSTEMS[5],
    application: 'Linha hidráulica de máquinas pesadas; bitola 1/2 pol, dupla trama de aço de alta tenacidade. Prensagem sob medida.',
    stock: 30,
    oem: 'DIN-EN853-2SN',
    demo: true,
  },
  {
    id: 'MNG-MAN-011',
    sku: 'MNG-MAN-011',
    name: 'Conexão Hidráulica Prensável JIC 37° Fêmea Giratória',
    category: SHOWCASE_CATEGORIES[0],
    system: SYSTEMS[5],
    application: 'Terminais de alta pressão para mangueiras de implementos rodoviários, guindastes e caminhões basculantes.',
    stock: 40,
    oem: 'JIC-37F-08',
    demo: true,
  },
  {
    id: 'MNG-MOT-012',
    sku: 'MNG-MOT-012',
    name: 'Rotor de Bomba de Água Marítima em Neoprene',
    category: SHOWCASE_CATEGORIES[4],
    system: SYSTEMS[1],
    application: 'Sistema de arrefecimento de motores centro-rabeta e diesel marítimo. Conferir eixo estriado e número de pás.',
    stock: 5,
    oem: '3862567',
    demo: true,
  },
];

export function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function clampQuantity(value: unknown): number {
  const num = Math.floor(Number(value) || 1);
  return Math.max(1, Math.min(999, num));
}

export function matchesShowcaseCategory(productCategory: string, targetCategory: string): boolean {
  if (productCategory === targetCategory) return true;
  const pNorm = normalizeText(productCategory).trim();
  const tNorm = normalizeText(targetCategory).trim();
  if (!pNorm || !tNorm) return false;
  if (pNorm === tNorm || pNorm.includes(tNorm) || tNorm.includes(pNorm)) return true;

  if (tNorm.startsWith('linha pesada')) {
    return pNorm.includes('linha pesada') || pNorm.includes('diesel') || pNorm.includes('caminh') || pNorm.includes('onibus');
  }
  if (tNorm.startsWith('maquinas pesadas')) {
    return pNorm.includes('maquina') || pNorm.includes('agricol') || pNorm.includes('trator') || pNorm.includes('guindaste');
  }
  if (tNorm.startsWith('utilitarios')) {
    return pNorm.includes('utilitar') || pNorm.includes('pick-up') || pNorm.includes('pickup') || pNorm.includes('van');
  }
  if (tNorm.startsWith('linha leve')) {
    return pNorm.includes('leve') || pNorm.includes('passeio') || pNorm.includes('carro');
  }
  if (tNorm.startsWith('embarcacoes')) {
    return pNorm.includes('embarcac') || pNorm.includes('maritim') || pNorm.includes('nautic') || pNorm.includes('barco') || pNorm.includes('lancha');
  }
  return false;
}

export function sanitizeProducts(rows: unknown[]): Product[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(
          item &&
            typeof item === 'object' &&
            (item as Record<string, unknown>).id &&
            (item as Record<string, unknown>).name
        )
    )
    .map((p) => {
      const rawId = String(p.id);
      const isDemo = p.demo === true;

      // Migrate legacy demo item MNG-TRA-009 (Motos) to MNG-MAR-009 (Embarcações)
      if (rawId === 'MNG-TRA-009' && isDemo) {
        return {
          id: 'MNG-MAR-009',
          sku: 'MNG-MAR-009',
          name: 'Filtro Racor Marítimo Separador com Copo Metálico',
          oem: '500FG-MAR',
          category: SHOWCASE_CATEGORIES[4],
          system: SYSTEMS[1],
          application:
            'Motores diesel marítimos de centro, lanchas, rebocadores e embarcações de trabalho. Conexões anticorrosivas.',
          stock: 9,
          demo: true,
        };
      }

      // Migrate legacy demo item MNG-MOT-002 to Utilitários so Utilitários has 2 items
      if (rawId === 'MNG-MOT-002' && isDemo) {
        return {
          id: 'MNG-MOT-002',
          sku: 'MNG-MOT-002',
          name: 'Filtro de Óleo Blindado Diesel Pick-ups & Vans',
          oem: String(p.oem || 'LF16015'),
          category: SHOWCASE_CATEGORIES[2],
          system: SYSTEMS[1],
          application:
            'Motores Cummins ISF 2.8 / 3.8 e turbodiesel; pick-ups, vans e utilitários de carga. Confirmar rosca e referência.',
          stock: Math.max(0, Math.floor(Number(p.stock) || 24)),
          demo: true,
        };
      }

      return {
        id: rawId,
        sku: String(p.sku || rawId),
        name: String(p.name),
        oem: String(p.oem || ''),
        category: String(p.category || SHOWCASE_CATEGORIES[0]),
        system: String(p.system || SYSTEMS[1]),
        application: String(p.application || ''),
        stock: Math.max(0, Math.floor(Number(p.stock) || 0)),
        demo: isDemo,
      };
    })
    .filter((p) => {
      const catNorm = normalizeText(p.category).trim();
      return catNorm !== 'motos' && catNorm !== 'moto';
    });
}

export function selectRandomShowcaseProducts(
  products: Product[],
  perCategory: number = 2
): Product[] {
  const selected: Product[] = [];
  const usedIds = new Set<string>();

  for (const category of SHOWCASE_CATEGORIES) {
    const candidates = products.filter(
      (p) => !usedIds.has(p.id) && matchesShowcaseCategory(p.category, category)
    );

    // Fisher-Yates shuffle on a shallow copy
    const shuffled = [...candidates];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const picked = shuffled.slice(0, perCategory);
    for (const item of picked) {
      usedIds.add(item.id);
      selected.push(item);
    }
  }

  return selected;
}

export type SearchMatchField = 'SKU' | 'OEM' | 'NOME' | 'CATEGORIA' | 'SISTEMA' | 'APLICAÇÃO';

export function getSearchMatchField(product: Product, query: string): SearchMatchField | null {
  const tokens = normalizeText(query)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return null;

  const skuNorm = normalizeText(product.sku);
  const oemNorm = normalizeText(product.oem);
  const nameNorm = normalizeText(product.name);
  const catNorm = normalizeText(product.category);
  const sysNorm = normalizeText(product.system);

  if (tokens.some((t) => skuNorm.includes(t))) return 'SKU';
  if (tokens.some((t) => oemNorm.includes(t))) return 'OEM';
  if (tokens.some((t) => nameNorm.includes(t))) return 'NOME';
  if (tokens.some((t) => catNorm.includes(t))) return 'CATEGORIA';
  if (tokens.some((t) => sysNorm.includes(t))) return 'SISTEMA';
  return 'APLICAÇÃO';
}

function scoreProductMatch(product: Product, tokens: string[]): number {
  if (tokens.length === 0) return 0;
  const skuNorm = normalizeText(product.sku);
  const oemNorm = normalizeText(product.oem);
  const nameNorm = normalizeText(product.name);
  const catNorm = normalizeText(product.category);
  const sysNorm = normalizeText(product.system);

  let score = 0;
  for (const token of tokens) {
    if (skuNorm === token) score += 120;
    else if (skuNorm.startsWith(token)) score += 90;
    else if (skuNorm.includes(token)) score += 70;

    if (oemNorm.includes(token)) score += 60;

    if (nameNorm.startsWith(token)) score += 55;
    else if (nameNorm.includes(token)) score += 40;

    if (catNorm.includes(token)) score += 30;
    if (sysNorm.includes(token)) score += 25;
  }
  return score;
}

export function filterProducts(
  products: Product[],
  query: string,
  category: string,
  system: string
): Product[] {
  const needle = normalizeText(query).trim();
  const tokens = needle ? needle.split(/\s+/).filter(Boolean) : [];

  const matched = products.filter((p) => {
    const matchCategory =
      !category ||
      category === 'Todos' ||
      matchesShowcaseCategory(p.category, category);
    const matchSystem = !system || system === 'Todos' || p.system === system;
    if (!matchCategory || !matchSystem) return false;
    if (tokens.length === 0) return true;
    const haystack = normalizeText(
      [p.name, p.sku, p.oem, p.application, p.category, p.system].join(' ')
    );
    return tokens.every((token) => haystack.includes(token));
  });

  if (tokens.length === 0) return matched;

  return [...matched].sort((a, b) => scoreProductMatch(b, tokens) - scoreProductMatch(a, tokens));
}

export function validatePhone(phone: string): boolean {
  const digits = String(phone ?? '').replace(/\D/g, '');
  return /^(?:55)?\d{10,11}$/.test(digits);
}

export function formatVehicleIdentification(info: VehicleIdentification): string {
  const parts: string[] = [];
  if (info.model?.trim()) parts.push(`Modelo: ${info.model.trim()}`);
  if (info.year?.trim()) parts.push(`Ano: ${info.year.trim()}`);
  if (info.plate?.trim()) parts.push(`Placa: ${info.plate.trim().toUpperCase()}`);
  if (info.chassis?.trim()) parts.push(`Chassi: ${info.chassis.trim().toUpperCase()}`);
  return parts.join(' | ').slice(0, 240);
}

export function generateUid(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function createOrderRecord(
  draft: OrderDraftInput,
  id: string = generateUid(),
  nowIso: string = new Date().toISOString(),
  cloudEnabled: boolean = false
): OrderRecord {
  const year = new Date(nowIso).getUTCFullYear();
  const shortCode = id.split('-')[0].toUpperCase();
  return {
    id,
    protocol: `#PED-${year}-${shortCode}`,
    createdAt: nowIso,
    status: 'Pendente de Cotação',
    cloudState: cloudEnabled ? 'pending' : 'local',
    customer: {
      name: draft.customer.name.trim(),
      phone: draft.customer.phone.trim(),
      city: draft.customer.city.trim(),
    },
    vehicle: draft.vehicle.trim(),
    notes: draft.notes.trim(),
    items: draft.items.map((item) => ({
      id: String(item.id),
      sku: String(item.sku || 'MANUAL'),
      name: String(item.name).trim(),
      quantity: clampQuantity(item.quantity),
      manual: Boolean(item.manual),
      demo: Boolean(item.demo),
    })),
  };
}

export const STANDARD_WHATSAPP_TEMPLATE =
  'Olá, gostaria de solicitar um orçamento sob demanda. Veículo: [Modelo]. Peça: [Descrição].';

export function formatPartsAsVerticalList(rawParts: string | string[]): string {
  const rawList = Array.isArray(rawParts)
    ? rawParts.map((p) => String(p || '').trim()).filter(Boolean)
    : String(rawParts || '')
        .split(/\s*\|\s*|\r?\n/)
        .map((p) => p.trim())
        .filter(Boolean);

  if (rawList.length === 0) return '• [Descrição]';

  return rawList
    .map((item, idx) => {
      const cleaned = item.replace(/^\d+\.\s*/, '').replace(/^[•\-*]\s*/, '').trim();
      return `• ${idx + 1}. ${cleaned}`;
    })
    .join('\n');
}

export function buildWhatsAppMessage(order: OrderRecord): string {
  let formattedDate = order.createdAt;
  try {
    formattedDate = new Date(order.createdAt).toLocaleString('pt-BR', {
      timeZone: 'America/Bahia',
    });
  } catch {
    formattedDate = order.createdAt;
  }

  const veiculoStr = order.vehicle?.trim() || '[Modelo]';
  const itemLines =
    order.items.length > 0
      ? order.items.map((p, idx) => `• ${idx + 1}. ${p.name} (Qtd: ${p.quantity})`).join('\n')
      : formatPartsAsVerticalList(order.notes || '[Descrição]');

  return [
    `Olá, gostaria de solicitar um orçamento sob demanda.`,
    '',
    '*SOLICITAÇÃO DE ORÇAMENTO — TEM DE TUDO AUTO PEÇAS E SERVIÇOS LTDA*',
    `• *Protocolo:* ${order.protocol}`,
    `• *Data:* ${formattedDate}`,
    `• *Cliente:* ${order.customer.name} (${order.customer.phone})`,
    `• *Veículo:* ${veiculoStr}`,
    '',
    '*PEÇAS SOLICITADAS:*',
    itemLines,
  ].join('\n');
}

export function buildWhatsAppUrl(order: OrderRecord, phone: string = WHATSAPP_NUMBER): string {
  const cleanPhone = phone.replace(/\D/g, '') || WHATSAPP_NUMBER;
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(buildWhatsAppMessage(order))}`;
}

export function buildDirectQuoteWhatsAppUrl(
  contextOrDraft?:
    | string
    | {
        contextLabel?: string;
        modelo?: string;
        ano?: string;
        peca?: string;
        pecasLista?: string[];
      },
  phone: string = WHATSAPP_NUMBER
): string {
  const cleanPhone = phone.replace(/\D/g, '') || WHATSAPP_NUMBER;

  let modeloText = '[Modelo]';
  let pecaText = '[Descrição]';
  let multiPartsList: string[] = [];

  if (typeof contextOrDraft === 'object' && contextOrDraft !== null) {
    const rawModelo = [contextOrDraft.modelo?.trim(), contextOrDraft.ano?.trim()]
      .filter(Boolean)
      .join(' ');
    if (rawModelo) modeloText = rawModelo;
    if (Array.isArray(contextOrDraft.pecasLista) && contextOrDraft.pecasLista.length > 0) {
      multiPartsList = contextOrDraft.pecasLista.map((p) => p.trim()).filter(Boolean);
    }
    if (contextOrDraft.peca?.trim()) {
      pecaText = contextOrDraft.peca.trim();
      if (multiPartsList.length === 0 && pecaText.includes('|')) {
        multiPartsList = pecaText
          .split('|')
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }
  }

  const message =
    multiPartsList.length > 1
      ? [
          `Olá, gostaria de solicitar um orçamento sob demanda.`,
          `*Veículo:* ${modeloText}`,
          '',
          '*Peças Solicitadas:*',
          formatPartsAsVerticalList(multiPartsList),
        ].join('\n')
      : `Olá, gostaria de solicitar um orçamento sob demanda. Veículo: ${modeloText}. Peça: ${pecaText}.`;

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

export function buildFollowUpWhatsAppUrl(
  params: {
    protocol: string;
    nome: string;
    telefone: string;
    veiculo: string;
    peca: string;
    pecasLista?: string[];
  },
  phone: string = WHATSAPP_NUMBER
): string {
  const cleanPhone = phone.replace(/\D/g, '') || WHATSAPP_NUMBER;
  const veiculoStr = params.veiculo?.trim() || '[Modelo]';
  const verticalParts =
    params.pecasLista && params.pecasLista.length > 0
      ? formatPartsAsVerticalList(params.pecasLista)
      : formatPartsAsVerticalList(params.peca || '[Descrição]');

  const message = [
    `Olá, gostaria de acompanhar meu orçamento sob demanda na *Tem de Tudo Auto Peças e Serviços LTDA*.`,
    '',
    `• *Protocolo no Site:* ${params.protocol}`,
    `• *Cliente:* ${params.nome} (${params.telefone})`,
    `• *Veículo:* ${veiculoStr}`,
    '',
    `*Peças Solicitadas:*`,
    verticalParts,
  ].join('\n');

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

const SCROLL_KEYFRAMES: CameraKeyframe[] = [
  // 0.00 — Section 01: Hero (Dynamic right-offset showcase, hero perspective)
  {
    cameraPos: [0.15, 0.2, 8.8],
    lookAt: [0.45, -0.05, 0],
    modelRot: [0.18, -0.48, -0.06],
    modelPos: [1.95, 0.05, 0],
    explosion: 0.06,
    fov: 35,
    stageLabel: '01. PRESENÇA // CONJUNTO M-02',
    angleTitle: 'PERSPECTIVA ISOMÉTRICA PRINCIPAL',
  },
  // 0.25 — Section 02: Cotação Sob Demanda (Sweeping lateral shift & closer inspection of rotor/caliper)
  {
    cameraPos: [-0.25, 0.35, 8.4],
    lookAt: [-0.55, 0.0, 0],
    modelRot: [0.28, 0.78, 0.08],
    modelPos: [-2.1, 0.1, -0.2],
    explosion: 0.32,
    fov: 34,
    stageLabel: '02. ORÇAMENTO // SOB DEMANDA',
    angleTitle: 'PERFIL DE ROTOR & PINÇA DE 6 PISTÕES',
  },
  // 0.52 — Section 03: Engenharia & Linhas (Dramatic overhead-angled macro exploded anatomy)
  {
    cameraPos: [0.0, 0.45, 9.4],
    lookAt: [0.0, 0.05, 0],
    modelRot: [0.32, 2.05, -0.1],
    modelPos: [0.0, 0.1, 0.1],
    explosion: 0.95,
    fov: 36,
    stageLabel: '03. ENGENHARIA // VISTA EXPLODIDA',
    angleTitle: 'SEPARAÇÃO AXIAL DE SUBSISTEMAS',
  },
  // 0.78 — Section 04: Spotlight 3D Studio (Centered studio hero framing, ready for 360° orbit & subsystem focus)
  {
    cameraPos: [0.0, 0.15, 8.8],
    lookAt: [0.0, -0.05, 0],
    modelRot: [0.14, 3.35, -0.05],
    modelPos: [0.0, 0.1, 0],
    explosion: 0.38,
    fov: 35,
    stageLabel: '04. ESTÚDIO 3D // INSPEÇÃO 360°',
    angleTitle: 'ENQUADRAMENTO CENTRAL DE ESTÚDIO',
  },
  // 1.00 — Section 05: Cotação Direta (Tight low-angle heroic monument lockup)
  {
    cameraPos: [0.25, -0.3, 8.5],
    lookAt: [0.55, 0.0, 0],
    modelRot: [-0.1, 4.55, 0.05],
    modelPos: [1.85, 0.0, 0.1],
    explosion: 0.15,
    fov: 34,
    stageLabel: '05. COTAÇÃO // PRONTO PARA OPERAÇÃO',
    angleTitle: 'FECHAMENTO MONUMENTAL DE PRECISÃO',
  },
];

const SUBSYSTEM_PRESETS: Record<Exclude<SubsystemId, 'all'>, Omit<CameraKeyframe, 'stageLabel'>> = {
  brake: {
    cameraPos: [-0.55, -0.1, 4.4],
    lookAt: [-0.55, -0.15, 0.5],
    modelRot: [0.06, 0.12, -0.02],
    modelPos: [0, 0.15, 0],
    explosion: 0.35,
    fov: 32,
    angleTitle: 'ZOOM MACRO: DISCO VENTILADO & PINÇA 6 PISTÕES',
  },
  engine: {
    cameraPos: [1.1, 1.25, 4.3],
    lookAt: [1.0, 1.1, -0.3],
    modelRot: [0.12, -0.25, 0.0],
    modelPos: [0, 0.15, 0],
    explosion: 0.45,
    fov: 32,
    angleTitle: 'ZOOM MACRO: PISTÃO DIESEL & BIELA FORJADA',
  },
  transmission: {
    cameraPos: [1.05, -1.0, 4.4],
    lookAt: [0.95, -1.05, -0.4],
    modelRot: [-0.08, -0.22, 0.04],
    modelPos: [0, 0.15, 0],
    explosion: 0.45,
    fov: 32,
    angleTitle: 'ZOOM MACRO: ENGRENAGEM & EIXO ESTRIADO',
  },
  spring: {
    cameraPos: [-2.1, 0.85, 4.6],
    lookAt: [-2.0, 0.8, -0.4],
    modelRot: [0.1, 0.32, -0.02],
    modelPos: [0, 0.15, 0],
    explosion: 0.4,
    fov: 32,
    angleTitle: 'ZOOM MACRO: SUSPENSÃO HELICOIDAL & MANGUEIRA 2SN',
  },
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

export function computeScrollCameraKeyframe(
  scrollProgress: number,
  focusedSubsystem: SubsystemId = 'all',
  explosionOverride: number | null = null
): CameraKeyframe {
  if (focusedSubsystem !== 'all' && SUBSYSTEM_PRESETS[focusedSubsystem]) {
    const preset = SUBSYSTEM_PRESETS[focusedSubsystem];
    return {
      ...preset,
      explosion: explosionOverride !== null ? explosionOverride : preset.explosion,
      stageLabel: `INSPEÇÃO DE SUBSISTEMA // ${focusedSubsystem.toUpperCase()}`,
    };
  }

  const clamped = Math.max(0, Math.min(1, Number(scrollProgress) || 0));
  const segments = SCROLL_KEYFRAMES.length - 1;
  const scaled = clamped * segments;
  const index = Math.min(segments - 1, Math.floor(scaled));
  const localT = smoothstep(scaled - index);

  const k0 = SCROLL_KEYFRAMES[index];
  const k1 = SCROLL_KEYFRAMES[index + 1];

  return {
    cameraPos: [
      lerp(k0.cameraPos[0], k1.cameraPos[0], localT),
      lerp(k0.cameraPos[1], k1.cameraPos[1], localT),
      lerp(k0.cameraPos[2], k1.cameraPos[2], localT),
    ],
    lookAt: [
      lerp(k0.lookAt[0], k1.lookAt[0], localT),
      lerp(k0.lookAt[1], k1.lookAt[1], localT),
      lerp(k0.lookAt[2], k1.lookAt[2], localT),
    ],
    modelRot: [
      lerp(k0.modelRot[0], k1.modelRot[0], localT),
      lerp(k0.modelRot[1], k1.modelRot[1], localT),
      lerp(k0.modelRot[2], k1.modelRot[2], localT),
    ],
    modelPos: [
      lerp(k0.modelPos[0], k1.modelPos[0], localT),
      lerp(k0.modelPos[1], k1.modelPos[1], localT),
      lerp(k0.modelPos[2], k1.modelPos[2], localT),
    ],
    explosion:
      explosionOverride !== null
        ? Math.max(0, Math.min(1, explosionOverride))
        : lerp(k0.explosion, k1.explosion, localT),
    fov: lerp(k0.fov, k1.fov, localT),
    stageLabel: localT < 0.5 ? k0.stageLabel : k1.stageLabel,
    angleTitle: localT < 0.5 ? k0.angleTitle : k1.angleTitle,
  };
}
