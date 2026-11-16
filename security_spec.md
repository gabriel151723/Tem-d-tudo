# Security Specification — Mangueiras Storefront & Cross-App ERP Sync

## 1. Data Invariants
- **Products (`/products/{productId}`)**:
  - Document ID `productId` must match `^[a-zA-Z0-9_\-]+$` with length `1..128` and equal `data.id`.
  - Every product must strictly contain only the allowed keys `['id', 'sku', 'name', 'oem', 'category', 'system', 'application', 'stock', 'demo']` and require `['id', 'sku', 'name', 'category', 'system', 'stock', 'demo']`.
  - All string fields are strictly bounded (`sku <= 64`, `name <= 200`, `oem <= 120`, `category <= 160`, `system <= 120`, `application <= 600`) and `stock >= 0 && stock <= 1000000`.
- **Orders (`/orders/{orderId}`)**:
  - Document ID `orderId` must match `^[a-zA-Z0-9_\-]+$` with length `1..128` and equal `data.id`.
  - Every order created from the public storefront must have `status == 'Pendente de Cotação'`, strictly bounded string sizes (`protocol <= 40`, `customerName <= 120`, `customerPhone <= 30`, `customerCity <= 100`, `vehicle <= 240`, `notes <= 1200`, `itemsSummary <= 4000`), and `itemsCount >= 1 && itemsCount <= 100`.

## 2. The "Dirty Dozen" Payloads
1. **Shadow Field Injection on Product**: `{ id: "MNG-01", sku: "MNG-01", name: "Peça", category: "Leve", system: "Motor", stock: 1, demo: false, isAdmin: true }` -> Rejected by `.keys().hasOnly(...)`.
2. **Oversized Product Name (Denial of Wallet)**: `{ id: "MNG-01", name: "A".repeat(5000), ... }` -> Rejected by `data.name.size() <= 200`.
3. **Invalid Product ID Poisoning**: `/products/../../evil` -> Rejected by `isValidId(productId)`.
4. **Mismatched Product ID**: `/products/MNG-01` with `data.id = "MNG-02"` -> Rejected by `incoming().id == productId`.
5. **Negative Stock Value**: `{ id: "MNG-01", stock: -50, ... }` -> Rejected by `data.stock >= 0`.
6. **Non-Boolean Demo Flag**: `{ id: "MNG-01", demo: "yes", ... }` -> Rejected by `data.demo is bool`.
7. **Shadow Field Injection on Order**: `{ id: "ORD-1", ..., role: "admin" }` -> Rejected by `.keys().hasOnly(...)`.
8. **Order Status Shortcutting on Create**: Creating an order with `status: "Concluído"` -> Rejected by `incoming().status == 'Pendente de Cotação'`.
9. **Empty Order Items**: Creating an order with `itemsCount: 0` -> Rejected by `data.itemsCount >= 1`.
10. **Oversized Order Notes (1MB Payload)**: `notes` > 1200 chars -> Rejected by `data.notes.size() <= 1200`.
11. **Immutable Order ID/Protocol Mutation on Update**: Changing `id` or `protocol` or `createdAt` during update -> Rejected by `incoming().id == existing().id && incoming().protocol == existing().protocol && incoming().createdAt == existing().createdAt`.
12. **Unmapped Collection Access**: Reading or writing `/random_collection/doc1` -> Rejected by global default-deny catch-all `match /{document=**} { allow read, write: if false; }`.
