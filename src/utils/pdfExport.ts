import type { jsPDF } from 'jspdf';
import {
  CartItem,
  OrderRecord,
  SECONDARY_PHONE_DISPLAY,
  WHATSAPP_DISPLAY,
  generateUid,
} from './catalogLogic';

export interface QuotePdfPayload {
  protocol: string;
  createdAt: string;
  customerName: string;
  phone: string;
  city: string;
  vehicle: string;
  notes: string;
  items: Array<{
    sku: string;
    name: string;
    oem?: string;
    category?: string;
    system?: string;
    quantity: number;
    manual?: boolean;
  }>;
}

export function buildQuotePdfFilename(protocol: string, customerName?: string): string {
  const cleanProtocol = String(protocol || 'COTACAO')
    .replace(/[^a-zA-Z0-9-_]/g, '')
    .toUpperCase();
  const cleanCustomer = String(customerName || 'CLIENTE')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 28)
    .toUpperCase();

  return `TEM-DE-TUDO-${cleanProtocol || 'COTACAO'}-${cleanCustomer || 'CLIENTE'}.pdf`;
}

export function createDraftPdfPayload(params: {
  cart: CartItem[];
  customerName: string;
  phone: string;
  city: string;
  vehicle: string;
  notes: string;
  protocol?: string;
}): QuotePdfPayload {
  const nowIso = new Date().toISOString();
  const year = new Date(nowIso).getUTCFullYear();
  const shortCode = generateUid().split('-')[0].toUpperCase();

  return {
    protocol: params.protocol || `#COT-${year}-${shortCode}`,
    createdAt: nowIso,
    customerName: params.customerName.trim() || 'Cliente / Oficina (Em Preenchimento)',
    phone: params.phone.trim() || 'Não informado',
    city: params.city.trim() || 'Atendimento Nacional',
    vehicle: params.vehicle.trim() || 'A confirmar na revisão técnica',
    notes: params.notes.trim() || 'Sem observações técnicas adicionais.',
    items: params.cart.map((item) => ({
      sku: item.sku || 'SOB-DEMANDA',
      name: item.name,
      oem: item.oem,
      category: item.category,
      system: item.system,
      quantity: item.quantity,
      manual: true,
    })),
  };
}

export function createOrderPdfPayload(order: OrderRecord): QuotePdfPayload {
  return {
    protocol: order.protocol,
    createdAt: order.createdAt,
    customerName: order.customer.name || 'Cliente / Empresa',
    phone: order.customer.phone || 'Não informado',
    city: order.customer.city || 'Atendimento Nacional',
    vehicle: order.vehicle || 'Não informado',
    notes: order.notes || 'Sem observações técnicas adicionais.',
    items: order.items.map((item) => ({
      sku: item.sku || 'SOB-DEMANDA',
      name: item.name,
      quantity: item.quantity,
      manual: true,
    })),
  };
}

function drawHeader(doc: jsPDF, payload: QuotePdfPayload): void {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Top dark navy corporate header
  doc.setFillColor(7, 17, 34);
  doc.rect(0, 0, pageWidth, 43, 'F');

  // Safety orange bottom accent stripe on header
  doc.setFillColor(234, 88, 12);
  doc.rect(0, 43, pageWidth, 1.8, 'F');

  // Vertical precision accent bar on the left (replaces the old 'M' box)
  doc.setFillColor(234, 88, 12);
  doc.rect(14, 10, 2.5, 24, 'F');

  // Brand title & corporate identification
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14.5);
  doc.text('TEM DE TUDO', 20, 16.2);

  doc.setTextColor(234, 88, 12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.text('AUTO PEÇAS E SERVIÇOS LTDA', 20, 21.4);

  doc.setTextColor(186, 199, 218);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.text(
    'Fornecimento Sob Demanda · Linha Diesel, Pesados, Agrícola, Hidráulica 2SN/4SH & Leves',
    20,
    27.2
  );
  doc.text(
    `Central de Cotações WhatsApp: ${WHATSAPP_DISPLAY} · Comercial: ${SECONDARY_PHONE_DISPLAY}`,
    20,
    32.2
  );

  // Right-side Protocol & Formal Request Box
  const boxWidth = 60;
  const boxX = pageWidth - 14 - boxWidth;
  doc.setFillColor(12, 26, 48);
  doc.setDrawColor(234, 88, 12);
  doc.setLineWidth(0.4);
  doc.roundedRect(boxX, 9.5, boxWidth, 25, 1.5, 1.5, 'FD');

  doc.setTextColor(234, 88, 12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.6);
  doc.text('REQUISIÇÃO DE COTAÇÃO SOB DEMANDA', boxX + boxWidth / 2, 14.8, {
    align: 'center',
  });

  doc.setTextColor(255, 255, 255);
  doc.setFont('courier', 'bold');
  doc.setFontSize(10);
  doc.text(payload.protocol, boxX + boxWidth / 2, 21.2, { align: 'center' });

  let formattedDate = payload.createdAt;
  try {
    formattedDate = new Date(payload.createdAt).toLocaleString('pt-BR', {
      timeZone: 'America/Bahia',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    formattedDate = payload.createdAt.slice(0, 16);
  }

  doc.setTextColor(168, 184, 208);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.text(`Registro: ${formattedDate}`, boxX + boxWidth / 2, 27.2, { align: 'center' });
  doc.text('Status: Recebido na Gestão', boxX + boxWidth / 2, 31.4, { align: 'center' });
}

function drawFooter(doc: jsPDF, pageNumber: number, totalPages: number): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setDrawColor(210, 218, 228);
  doc.setLineWidth(0.3);
  doc.line(14, pageHeight - 18, pageWidth - 14, pageHeight - 18);

  doc.setTextColor(90, 102, 121);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.text(
    `TEM DE TUDO AUTO PEÇAS E SERVIÇOS LTDA · WhatsApp: ${WHATSAPP_DISPLAY} · Atendimento Nacional`,
    14,
    pageHeight - 12.5
  );
  doc.text(
    'Comprovante de solicitação sob demanda integrado ao Sistema de Gestão. Proposta com valores e frete enviada ao cliente.',
    14,
    pageHeight - 8.5
  );

  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.text(`PÁG. ${pageNumber}/${totalPages}`, pageWidth - 14, pageHeight - 10.5, {
    align: 'right',
  });
}

export async function exportQuoteToPdf(payload: QuotePdfPayload): Promise<string> {
  const { jsPDF: JsPdfConstructor } = await import('jspdf');
  const doc = new JsPdfConstructor({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  drawHeader(doc, payload);

  let cursorY = 51;

  // Section 1: Dados do Cliente e Aplicação Técnica
  doc.setFillColor(244, 246, 250);
  doc.setDrawColor(212, 220, 232);
  doc.setLineWidth(0.35);
  doc.roundedRect(margin, cursorY, contentWidth, 34, 1.5, 1.5, 'FD');

  // Left vertical orange accent bar
  doc.setFillColor(234, 88, 12);
  doc.rect(margin, cursorY, 2.2, 34, 'F');

  doc.setTextColor(7, 17, 34);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('01. IDENTIFICAÇÃO DO CLIENTE E APLICAÇÃO MECÂNICA', margin + 6, cursorY + 6.5);

  doc.setFontSize(8);
  // Row 1
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENTE / EMPRESA:', margin + 6, cursorY + 13.5);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'normal');
  doc.text(doc.splitTextToSize(payload.customerName, 75)[0] || '-', margin + 39, cursorY + 13.5);

  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'bold');
  doc.text('WHATSAPP / TEL:', margin + 118, cursorY + 13.5);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'normal');
  doc.text(doc.splitTextToSize(payload.phone, 38)[0] || '-', margin + 145, cursorY + 13.5);

  // Row 2
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'bold');
  doc.text('VEÍCULO / MÁQUINA:', margin + 6, cursorY + 21);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'normal');
  doc.text(doc.splitTextToSize(payload.vehicle, 75)[0] || '-', margin + 39, cursorY + 21);

  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'bold');
  doc.text('CIDADE / UF:', margin + 118, cursorY + 21);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'normal');
  doc.text(doc.splitTextToSize(payload.city, 42)[0] || '-', margin + 145, cursorY + 21);

  // Row 3
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'bold');
  doc.text('MODALIDADE:', margin + 6, cursorY + 28.5);
  doc.setTextColor(16, 145, 100);
  doc.setFont('helvetica', 'bold');
  doc.text('COTAÇÃO TÉCNICA & VERIFICAÇÃO DE COMPATIBILIDADE OEM', margin + 39, cursorY + 28.5);

  cursorY += 41;

  // Section 2: Items Table Header
  const totalQuantity = payload.items.reduce((acc, item) => acc + (Number(item.quantity) || 1), 0);

  doc.setTextColor(7, 17, 34);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('02. RELAÇÃO DE PEÇAS, COMPONENTES E MANGUEIRAS SOLICITADAS', margin, cursorY);

  doc.setFont('courier', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(234, 88, 12);
  doc.text(
    `ITENS: ${payload.items.length}  |  VOLUME TOTAL: ${totalQuantity} UN.`,
    pageWidth - margin,
    cursorY,
    { align: 'right' }
  );

  cursorY += 4;

  const drawTableHeader = (y: number): number => {
    doc.setFillColor(7, 17, 34);
    doc.rect(margin, y, contentWidth, 8.5, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('#', margin + 3, y + 5.6);
    doc.text('CÓDIGO / SKU', margin + 12, y + 5.6);
    doc.text('DESCRIÇÃO TÉCNICA DO COMPONENTE / ESPECIFICAÇÃO', margin + 46, y + 5.6);
    doc.text('TIPO', margin + 142, y + 5.6);
    doc.text('QTD', pageWidth - margin - 4, y + 5.6, { align: 'right' });

    return y + 8.5;
  };

  cursorY = drawTableHeader(cursorY);

  payload.items.forEach((item, index) => {
    const subInfo = [
      item.oem ? `Ref. OEM: ${item.oem}` : '',
      item.system ? `Sistema: ${item.system}` : '',
    ]
      .filter(Boolean)
      .join('  ·  ');

    const titleLines = doc.splitTextToSize(item.name, 91);
    const subLines = subInfo ? doc.splitTextToSize(subInfo, 91) : [];
    const rowHeight = Math.max(10, titleLines.length * 4.2 + subLines.length * 3.6 + 3.5);

    if (cursorY + rowHeight > pageHeight - 52) {
      doc.addPage();
      drawHeader(doc, payload);
      cursorY = 50;
      cursorY = drawTableHeader(cursorY);
    }

    // Zebra background
    if (index % 2 === 0) {
      doc.setFillColor(250, 251, 253);
    } else {
      doc.setFillColor(242, 245, 250);
    }
    doc.rect(margin, cursorY, contentWidth, rowHeight, 'F');

    // Bottom row divider
    doc.setDrawColor(222, 228, 238);
    doc.setLineWidth(0.25);
    doc.line(margin, cursorY + rowHeight, pageWidth - margin, cursorY + rowHeight);

    // Index
    doc.setTextColor(100, 116, 139);
    doc.setFont('courier', 'bold');
    doc.setFontSize(8);
    doc.text(String(index + 1).padStart(2, '0'), margin + 3, cursorY + 6);

    // SKU
    doc.setTextColor(234, 88, 12);
    doc.setFont('courier', 'bold');
    doc.setFontSize(8);
    const skuText = doc.splitTextToSize(item.sku || 'MANUAL', 31)[0] || 'MANUAL';
    doc.text(skuText, margin + 12, cursorY + 6);

    // Item Name & Sub-info
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.text(titleLines, margin + 46, cursorY + 5.6);

    if (subLines.length > 0) {
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(subLines, margin + 46, cursorY + 5.6 + titleLines.length * 4.1);
    }

    // Origin badge
    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.text('Sob Demanda', margin + 142, cursorY + 6);

    // Quantity
    doc.setTextColor(7, 17, 34);
    doc.setFont('courier', 'bold');
    doc.setFontSize(9.5);
    doc.text(`${item.quantity} un`, pageWidth - margin - 4, cursorY + 6, { align: 'right' });

    cursorY += rowHeight;
  });

  // Summary bar under table
  doc.setFillColor(15, 29, 52);
  doc.rect(margin, cursorY, contentWidth, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.text(
    'RESUMO QUANTITATIVO DA SOLICITAÇÃO PARA COTAÇÃO SOB DEMANDA',
    margin + 4,
    cursorY + 5.3
  );
  doc.setFont('courier', 'bold');
  doc.text(
    `${payload.items.length} ITEM(NS)  |  TOTAL: ${totalQuantity} UNIDADE(S)`,
    pageWidth - margin - 4,
    cursorY + 5.3,
    { align: 'right' }
  );

  cursorY += 14;

  // Check if notes + signatures fit on current page
  if (cursorY + 58 > pageHeight - 24) {
    doc.addPage();
    drawHeader(doc, payload);
    cursorY = 52;
  }

  // Section 3: Observações Técnicas e Condições
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(212, 220, 232);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, cursorY, contentWidth, 24, 1.5, 1.5, 'FD');

  doc.setTextColor(7, 17, 34);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('03. OBSERVAÇÕES TÉCNICAS E ESPECIFICAÇÕES DO PEDIDO:', margin + 4, cursorY + 6);

  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  const noteLines = doc.splitTextToSize(payload.notes, contentWidth - 8).slice(0, 3);
  doc.text(noteLines, margin + 4, cursorY + 11.5);

  cursorY += 30;

  // Section 4: Formalization & Signatures
  doc.setFillColor(255, 247, 237);
  doc.setDrawColor(251, 146, 60);
  doc.roundedRect(margin, cursorY, contentWidth, 16, 1.2, 1.2, 'FD');
  doc.setTextColor(154, 52, 18);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.text('PROCESSAMENTO NO SISTEMA DE GESTÃO E ENVIO DE PROPOSTA:', margin + 4, cursorY + 5);
  doc.setFont('helvetica', 'normal');
  const engineeringDisclaimer = doc.splitTextToSize(
    'Este pedido sob demanda foi registrado no Sistema de Gestão da Tem de Tudo Auto Peças e Serviços LTDA. A proposta oficial com valores unitários, impostos e opções de frete será encaminhada ao WhatsApp do cliente.',
    contentWidth - 8
  );
  doc.text(engineeringDisclaimer, margin + 4, cursorY + 9.5);

  cursorY += 27;

  // Signature lines
  const sigWidth = 76;
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.35);
  doc.line(margin + 6, cursorY, margin + 6 + sigWidth, cursorY);
  doc.line(pageWidth - margin - 6 - sigWidth, cursorY, pageWidth - margin - 6, cursorY);

  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('TEM DE TUDO AUTO PEÇAS E SERVIÇOS LTDA', margin + 6 + sigWidth / 2, cursorY + 4.5, {
    align: 'center',
  });
  doc.text('CLIENTE / SOLICITANTE DA COTAÇÃO', pageWidth - margin - 6 - sigWidth / 2, cursorY + 4.5, {
    align: 'center',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Central de Atendimento e Cotação Sob Demanda', margin + 6 + sigWidth / 2, cursorY + 8.5, {
    align: 'center',
  });
  doc.text(
    doc.splitTextToSize(payload.customerName, sigWidth)[0] || 'Cliente',
    pageWidth - margin - 6 - sigWidth / 2,
    cursorY + 8.5,
    { align: 'center' }
  );

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(doc, p, totalPages);
  }

  const filename = buildQuotePdfFilename(payload.protocol, payload.customerName);
  doc.save(filename);
  return filename;
}
