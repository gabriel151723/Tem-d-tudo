import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import {
  Product,
  OrderRecord,
  PRODUCTS_DB_KEY,
  ORDERS_DB_KEY,
  sanitizeProducts,
} from './catalogLogic';
import { db, handleFirestoreError, OperationType } from '../firebase';

export interface SolicitacaoOrcamentoInput {
  cliente: {
    nome: string;
    telefone: string;
  };
  veiculo: {
    modelo: string;
    ano: string;
  };
  peca_solicitada: string;
}

export class DataSyncService extends EventTarget {
  readonly productsKey = PRODUCTS_DB_KEY;
  readonly ordersKey = ORDERS_DB_KEY;
  products: Product[] = [];
  statusText = 'CENTRAL DE COTAÇÃO SOB DEMANDA ATIVA';
  storageOK = true;
  private lastJson = '';
  private bus: BroadcastChannel | null = null;
  private onStorageBound: (e: StorageEvent) => void;
  private onMessageBound: (e: MessageEvent) => void;

  constructor() {
    super();
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this.bus = new BroadcastChannel('mangueiras_erp_sync');
      }
    } catch {
      this.bus = null;
    }

    this.onStorageBound = (e: StorageEvent) => {
      if (e.key === this.ordersKey || e.key === null) {
        this.dispatchEvent(new CustomEvent('orders-updated', { detail: this.getOrders() }));
      }
    };

    this.onMessageBound = (e: MessageEvent) => {
      const data = e.data;
      if (data?.key === this.ordersKey || data?.type === 'order:created') {
        this.dispatchEvent(new CustomEvent('orders-updated', { detail: this.getOrders() }));
      }
    };
  }

  private setState(text: string) {
    this.statusText = text;
    this.dispatchEvent(new CustomEvent('status', { detail: text }));
  }

  readRaw<T>(key: string, fallback: T): T {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) {
      throw new Error(`Formato inválido em ${key}`);
    }
    return data as unknown as T;
  }

  writeRaw(key: string, value: unknown): void {
    localStorage.setItem(key, JSON.stringify(value));
  }

  announce(type: string, extra: Record<string, unknown> = {}): void {
    const message = { type, ...extra };
    try {
      this.bus?.postMessage(message);
    } catch {
      // Ignore BroadcastChannel errors
    }
    window.dispatchEvent(new CustomEvent('mangueiras:sync', { detail: message }));
  }

  publish(rows: unknown[]): void {
    const clean = sanitizeProducts(rows);
    const json = JSON.stringify(clean);
    if (json === this.lastJson) return;
    this.lastJson = json;
    this.products = clean;
    this.dispatchEvent(new CustomEvent('products', { detail: clean }));
  }

  readLocal(): void {
    // Catalog database disabled: operating exclusively on on-demand quote model
    this.products = [];
  }

  init(): void {
    this.products = [];
    this.setState('COTAÇÃO SOB DEMANDA CONECTADA AO SISTEMA DE GESTÃO');
    window.addEventListener('storage', this.onStorageBound);
    this.bus?.addEventListener('message', this.onMessageBound);
  }

  dispose(): void {
    window.removeEventListener('storage', this.onStorageBound);
    this.bus?.removeEventListener('message', this.onMessageBound);
  }

  getOrders(): OrderRecord[] {
    try {
      return this.readRaw<OrderRecord[]>(this.ordersKey, []);
    } catch {
      return [];
    }
  }

  async submitSolicitacaoOrcamento(input: SolicitacaoOrcamentoInput): Promise<string> {
    const collectionPath = 'solicitacoes_orcamento';
    const payload = {
      cliente: {
        nome: (String(input.cliente.nome || '').trim() || 'Cliente').slice(0, 120),
        telefone: String(input.cliente.telefone || '')
          .trim()
          .slice(0, 40),
      },
      veiculo: {
        modelo: (String(input.veiculo.modelo || '').trim() || 'Não informado').slice(0, 160),
        ano: (String(input.veiculo.ano || '').trim() || 'Não informado').slice(0, 40),
      },
      peca_solicitada: (String(input.peca_solicitada || '').trim() || 'Sob consulta').slice(
        0,
        4000
      ),
      status: 'pendente' as const,
      data_criacao: serverTimestamp(),
    };

    try {
      const docRef = await addDoc(collection(db, collectionPath), payload);
      this.announce('solicitacao:created', {
        id: docRef.id,
        cliente: payload.cliente,
        veiculo: payload.veiculo,
        peca_solicitada: payload.peca_solicitada,
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, collectionPath);
    }
  }

  async saveOrder(order: OrderRecord): Promise<OrderRecord> {
    const writeOperation = () => {
      const orders = this.readRaw<OrderRecord[]>(this.ordersKey, []);
      if (!orders.some((o) => o.id === order.id)) {
        orders.unshift(order);
        this.writeRaw(this.ordersKey, orders);
      }
    };

    if (typeof navigator !== 'undefined' && navigator.locks?.request) {
      await navigator.locks.request('mangueiras-orders-write', async () => {
        writeOperation();
      });
    } else {
      writeOperation();
    }

    const cleanId = String(order.id)
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .slice(0, 128);
    const itemsSummary = order.items
      .map((item, idx) => `${idx + 1}. [${item.sku}] ${item.name} (Qtd: ${item.quantity})`)
      .join(' | ')
      .slice(0, 4000);

    const firestoreOrderPayload = {
      id: cleanId,
      protocol: String(order.protocol || '#PED').slice(0, 40),
      status: 'Pendente de Cotação' as const,
      customerName: String(order.customer.name || 'Cliente').slice(0, 120),
      customerPhone: String(order.customer.phone || '0000000000').slice(0, 30),
      customerCity: String(order.customer.city || 'Atendimento Nacional').slice(0, 100),
      vehicle: String(order.vehicle || '').slice(0, 240),
      notes: String(order.notes || '').slice(0, 4000),
      itemsCount: Math.max(1, Math.min(100, order.items.length || 1)),
      itemsSummary: itemsSummary || '1 item solicitado',
      createdAt: String(order.createdAt || new Date().toISOString()).slice(0, 64),
    };

    try {
      await setDoc(doc(db, 'orders', cleanId), firestoreOrderPayload);
      order.cloudState = 'synced';
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `orders/${cleanId}`);
    }

    this.announce('order:created', {
      key: this.ordersKey,
      orderId: order.id,
      protocol: order.protocol,
    });
    this.dispatchEvent(new CustomEvent('orders-updated', { detail: this.getOrders() }));

    const saved = this.getOrders().find((o) => o.id === order.id);
    return saved || order;
  }
}

export const dataSync = new DataSyncService();

declare global {
  interface Window {
    DataSyncService?: typeof DataSyncService;
    mangueirasDataSync?: DataSyncService;
  }
}

if (typeof window !== 'undefined') {
  window.DataSyncService = DataSyncService;
  window.mangueirasDataSync = dataSync;
}
