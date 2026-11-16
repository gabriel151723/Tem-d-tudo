import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Trash2,
  Plus,
  ArrowUpRight,
  CheckCircle2,
  FileDown,
  AlertTriangle,
  MessageSquare,
} from 'lucide-react';
import {
  CartItem,
  OrderRecord,
  VehicleIdentification,
  WHATSAPP_DISPLAY,
  clampQuantity,
  validatePhone,
  formatVehicleIdentification,
  createOrderRecord,
  buildDirectQuoteWhatsAppUrl,
  buildFollowUpWhatsAppUrl,
  generateUid,
} from '../utils/catalogLogic';
import { SolicitacaoOrcamentoInput } from '../utils/dataSync';
import {
  createDraftPdfPayload,
  createOrderPdfPayload,
  exportQuoteToPdf,
} from '../utils/pdfExport';

interface QuoteDialogProps {
  isOpen: boolean;
  focusManualInput: boolean;
  onClose: () => void;
  cart: CartItem[];
  onUpdateQuantity: (index: number, quantity: number) => void;
  onRemoveItem: (index: number) => void;
  onAddManualItem: (name: string) => void;
  onClearCart: () => void;
  onSaveOrder: (order: OrderRecord) => Promise<OrderRecord>;
  onSubmitSolicitacao: (input: SolicitacaoOrcamentoInput) => Promise<string>;
  onToast: (msg: string) => void;
  vehicleInfo: VehicleIdentification;
  onUpdateVehicleInfo: (info: VehicleIdentification) => void;
}

export const QuoteDialog: React.FC<QuoteDialogProps> = ({
  isOpen,
  focusManualInput,
  onClose,
  cart,
  onUpdateQuantity,
  onRemoveItem,
  onAddManualItem,
  onClearCart,
  onSaveOrder,
  onSubmitSolicitacao,
  onToast,
  vehicleInfo,
  onUpdateVehicleInfo,
}) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const manualInputRef = useRef<HTMLInputElement | null>(null);

  const [manualName, setManualName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [notes, setNotes] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [vehicleError, setVehicleError] = useState('');
  const [partError, setPartError] = useState('');
  const [networkError, setNetworkError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [lastSubmittedOrder, setLastSubmittedOrder] = useState<{
    order: OrderRecord;
    followUpWhatsappUrl: string;
    pecaResumo: string;
    solicitacaoId?: string;
  } | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
      document.body.style.overflow = 'hidden';
      if (focusManualInput) {
        setTimeout(() => manualInputRef.current?.focus(), 60);
      }
    } else if (!isOpen && dialog.open) {
      dialog.close();
      document.body.style.overflow = '';
    }
  }, [isOpen, focusManualInput]);

  useEffect(() => {
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleManualAdd = () => {
    const trimmed = manualName.trim();
    if (!trimmed) {
      manualInputRef.current?.focus();
      onToast('Descreva a peça ou mangueira que você procura.');
      return;
    }
    onAddManualItem(trimmed);
    setManualName('');
    if (partError) setPartError('');
  };

  const buildEffectiveCart = (): CartItem[] => {
    if (cart.length > 0) return cart;
    const directPartText = notes.trim() || manualName.trim();
    if (!directPartText) return [];
    return [
      {
        id: `manual-${generateUid()}`,
        sku: 'SOB-DEMANDA',
        name: directPartText.slice(0, 180),
        oem: '',
        category: 'Cotação Sob Demanda',
        system: 'Solicitação Direta',
        application:
          formatVehicleIdentification(vehicleInfo) || 'Especificação informada pelo cliente',
        stock: 1,
        demo: false,
        quantity: 1,
        manual: true,
      },
    ];
  };

  const buildPecaSolicitadaString = (effectiveCart: CartItem[]): string => {
    const cartSummary =
      cart.length > 0
        ? cart
            .map(
              (item) =>
                `${item.name}${item.sku && item.sku !== 'MANUAL' ? ` [${item.sku}]` : ''} (Qtd: ${
                  item.quantity
                })`
            )
            .join('; ')
        : '';

    const extraNotes = notes.trim() || manualName.trim();
    const extraVehicleTags = [
      vehicleInfo.plate.trim() ? `Placa: ${vehicleInfo.plate.trim()}` : '',
      vehicleInfo.chassis.trim() ? `Chassi: ${vehicleInfo.chassis.trim()}` : '',
      city.trim() ? `Cidade/UF: ${city.trim()}` : '',
    ]
      .filter(Boolean)
      .join(' · ');

    const segments = [
      cartSummary,
      extraNotes && extraNotes !== cartSummary ? extraNotes : '',
      extraVehicleTags,
    ].filter(Boolean);

    if (segments.length > 0) {
      return segments.join(' — ').slice(0, 2000);
    }

    return effectiveCart
      .map((item) => `${item.name} (Qtd: ${item.quantity})`)
      .join('; ')
      .slice(0, 2000);
  };

  const handleExportCurrentPdf = async () => {
    if (exportingPdf) return;

    if (cart.length === 0 && !notes.trim() && lastSubmittedOrder) {
      setExportingPdf(true);
      try {
        const filename = await exportQuoteToPdf(createOrderPdfPayload(lastSubmittedOrder.order));
        onToast(`PDF formal gerado: ${filename}`);
      } catch {
        onToast('Não foi possível gerar o PDF da cotação.');
      } finally {
        setExportingPdf(false);
      }
      return;
    }

    const effectiveCart = buildEffectiveCart();
    if (effectiveCart.length === 0) {
      onToast('Adicione ou descreva ao menos uma peça antes de exportar o PDF.');
      manualInputRef.current?.focus();
      return;
    }

    setExportingPdf(true);
    try {
      const payload = createDraftPdfPayload({
        cart: effectiveCart,
        customerName,
        phone,
        city: city.trim() || 'Atendimento Nacional',
        vehicle: formatVehicleIdentification(vehicleInfo),
        notes,
      });
      const filename = await exportQuoteToPdf(payload);
      onToast(`PDF formal gerado com sucesso (${filename})`);
    } catch {
      onToast('Não foi possível exportar o PDF no momento.');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportOrderPdf = async (order: OrderRecord) => {
    try {
      const filename = await exportQuoteToPdf(createOrderPdfPayload(order));
      onToast(`PDF ${order.protocol} exportado (${filename})`);
    } catch {
      onToast('Erro ao gerar o PDF do pedido.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setPhoneError('');
    setVehicleError('');
    setPartError('');
    setNetworkError('');

    if (customerName.trim().length < 2) {
      onToast('Preencha o nome do cliente ou empresa.');
      return;
    }

    if (!validatePhone(phone)) {
      setPhoneError('Informe DDD + telefone válido com 10 ou 11 dígitos (ex: 71 98397-8870).');
      onToast('Verifique o WhatsApp / Telefone com DDD.');
      return;
    }

    if (!vehicleInfo.model.trim() || !vehicleInfo.year.trim()) {
      setVehicleError(
        'Informe obrigatoriamente o Veículo (Marca, Modelo e Motor) e o Ano.'
      );
      onToast('Informe o Modelo/Motor e o Ano do veículo para enviar a cotação.');
      return;
    }

    const effectiveCart = buildEffectiveCart();
    const pecaSolicitada = buildPecaSolicitadaString(effectiveCart);

    if (!pecaSolicitada.trim() || effectiveCart.length === 0) {
      setPartError(
        'Descreva a peça solicitada (código original, medidas ou observações) ou adicione um item acima.'
      );
      onToast('Informe a peça solicitada antes de enviar.');
      return;
    }

    setSubmitting(true);

    try {
      const cleanNome = customerName.trim();
      const cleanPhone = phone.trim();
      const cleanModelo = vehicleInfo.model.trim();
      const cleanAno = vehicleInfo.year.trim();
      const formattedVehicle = formatVehicleIdentification(vehicleInfo);

      // 1. Write directly to "solicitacoes_orcamento" collection using addDoc + serverTimestamp()
      const solicitacaoId = await onSubmitSolicitacao({
        cliente: {
          nome: cleanNome,
          telefone: cleanPhone,
        },
        veiculo: {
          modelo: cleanModelo,
          ano: cleanAno,
        },
        peca_solicitada: pecaSolicitada,
      });

      // 2. Also create OrderRecord for secondary ERP compatibility and PDF generation
      const orderRecord = createOrderRecord(
        {
          customer: {
            name: cleanNome,
            phone: cleanPhone,
            city: city.trim() || 'Atendimento Nacional',
          },
          vehicle: formattedVehicle,
          notes: notes.trim() || pecaSolicitada,
          items: effectiveCart.map((item) => ({
            id: item.id,
            sku: item.sku,
            name: item.name,
            quantity: item.quantity,
            manual: Boolean(item.manual),
            demo: Boolean(item.demo),
          })),
        },
        generateUid(),
        new Date().toISOString(),
        false
      );

      let saved = orderRecord;
      try {
        saved = await onSaveOrder(orderRecord);
      } catch {
        // Keep primary solicitacoes_orcamento success intact
      }

      const followUpWhatsappUrl = buildFollowUpWhatsAppUrl({
        protocol: saved.protocol,
        nome: cleanNome,
        telefone: cleanPhone,
        veiculo: formattedVehicle || `${cleanModelo} (${cleanAno})`,
        peca: pecaSolicitada,
      });

      setLastSubmittedOrder({
        order: saved,
        followUpWhatsappUrl,
        pecaResumo: pecaSolicitada,
        solicitacaoId,
      });

      // Clear all form fields and cart upon success
      setCustomerName('');
      setPhone('');
      setCity('');
      setNotes('');
      setManualName('');
      onUpdateVehicleInfo({ model: '', year: '', plate: '', chassis: '' });
      onClearCart();

      onToast(
        `Orçamento ${saved.protocol} recebido no sistema de gestão! Retornaremos no seu WhatsApp.`
      );
    } catch {
      setNetworkError(
        'Não foi possível enviar sua solicitação no momento. Verifique sua conexão ou clique abaixo para fazer seu orçamento direto pelo WhatsApp.'
      );
      onToast('Erro de conexão ao enviar cotação. Tente novamente ou chame no WhatsApp.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      id="quote-dialog"
      aria-labelledby="quote-title"
      onClose={onClose}
      className="m-0 ml-auto p-0 w-full max-w-[600px] h-dvh max-h-dvh bg-[#071122] text-white border-l border-white/20 shadow-2xl overflow-y-auto backdrop:bg-black/75"
    >
      {/* Sticky Drawer Header */}
      <div className="sticky top-0 z-10 bg-[#071122] px-6 py-5 border-b border-white/12 flex items-center justify-between gap-4">
        <div>
          <div className="font-mono text-xs text-[#ea580c] tracking-wider">
            Cotação Sob Demanda · WhatsApp {WHATSAPP_DISPLAY}
          </div>
          <h2 id="quote-title" className="font-display text-2xl font-bold text-white mt-1">
            Solicitar Cotação Rápida
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            id="header-export-pdf"
            onClick={handleExportCurrentPdf}
            title="Exportar cotação atual como documento PDF com logo"
            className="px-3 py-2 bg-[#0f1f38] hover:bg-[#162b4d] border border-[#ea580c]/50 text-white font-mono text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            <FileDown className="w-4 h-4 text-[#ea580c]" />
            <span className="hidden sm:inline">Exportar PDF</span>
          </button>
          <button
            type="button"
            id="close-cart"
            aria-label="Fechar orçamento"
            onClick={onClose}
            className="p-2.5 border border-white/15 text-slate-300 hover:text-white hover:border-white/30 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Immediate Visual Feedback Banner on Success */}
        {lastSubmittedOrder && (
          <div
            id="order-result"
            data-testid="quote-success-banner"
            role="status"
            aria-live="polite"
            className="p-5 bg-[#06281e] border-2 border-[#10b981] space-y-3.5"
          >
            <div className="flex items-center gap-2 text-[#34d399] font-mono text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                SEU ORÇAMENTO CHEGOU NA CENTRAL ({lastSubmittedOrder.order.protocol})
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-100 leading-relaxed">
              Recebemos sua solicitação,{' '}
              <strong>{lastSubmittedOrder.order.customer.name}</strong>! Seu pedido
              já chegou ao nosso <strong>Sistema Secundário de Gestão</strong> e a
              mensagem da cotação está sendo disparada automaticamente para nossa
              equipe comercial no WhatsApp.
            </p>
            <p className="text-xs text-slate-200 leading-relaxed">
              Você receberá o retorno no seu WhatsApp (
              <strong>{lastSubmittedOrder.order.customer.phone}</strong>). Se quiser{' '}
              <strong className="text-[#34d399]">
                acompanhar seu orçamento diretamente pelo WhatsApp {WHATSAPP_DISPLAY}
              </strong>
              , clique abaixo:
            </p>
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <a
                href={lastSubmittedOrder.followUpWhatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="whatsapp-dispatch-link"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#10b981] text-[#03251b] font-mono text-xs font-bold hover:bg-[#34d399] transition-colors"
              >
                <MessageSquare className="w-4 h-4 shrink-0" />
                <span>Acompanhar no WhatsApp ({WHATSAPP_DISPLAY})</span>
                <ArrowUpRight className="w-4 h-4 shrink-0" />
              </a>
              <button
                type="button"
                data-testid="submitted-order-pdf-btn"
                onClick={() => handleExportOrderPdf(lastSubmittedOrder.order)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0b172b] border border-white/25 hover:border-[#ea580c] text-white font-mono text-xs font-bold transition-colors"
              >
                <FileDown className="w-4 h-4 text-[#ea580c]" />
                <span>Baixar PDF ({lastSubmittedOrder.order.protocol})</span>
              </button>
            </div>
          </div>
        )}

        {/* Friendly Network Error Alert */}
        {networkError && (
          <div
            role="alert"
            data-testid="quote-error-banner"
            className="p-4 bg-[#2c1215] border border-red-500/60 space-y-3 text-red-200"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs leading-relaxed">
                <div className="font-mono font-bold text-red-300">
                  FALHA DE COMUNICAÇÃO COM O SERVIDOR
                </div>
                <p>{networkError}</p>
              </div>
            </div>
            <a
              href={buildDirectQuoteWhatsAppUrl('Modal de Cotação Rápida')}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#10b981] text-[#03251b] font-mono text-xs font-bold"
            >
              <span>Fazer Orçamento Direto no WhatsApp ({WHATSAPP_DISPLAY})</span>
              <ArrowUpRight className="w-4 h-4" />
            </a>
          </div>
        )}

        {/* Cart Items List + Linked Vehicle Summary */}
        <div id="cart-items" className="space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="font-mono text-xs text-slate-400">
              PEÇAS NA LISTA ({cart.reduce((acc, i) => acc + i.quantity, 0)})
            </div>
            <a
              href={buildDirectQuoteWhatsAppUrl('Atalho Modal de Orçamento')}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[11px] text-[#34d399] hover:underline"
            >
              Prefere pedir direto no WhatsApp? ↗
            </a>
          </div>

          {/* Visual Vehicle Identification Summary Card in Cart */}
          {(cart.length > 0 ||
            Boolean(
              vehicleInfo.model.trim() ||
                vehicleInfo.year.trim() ||
                vehicleInfo.plate.trim() ||
                vehicleInfo.chassis.trim()
            )) && (
            <div
              data-testid="cart-vehicle-summary"
              className="p-3.5 bg-[#091830] border border-[#ea580c]/40 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
                <span className="font-mono text-[11px] text-[#ea580c] font-semibold tracking-wider">
                  DADOS DO VEÍCULO VINCULADO À COTAÇÃO
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('vehicle');
                    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el?.focus();
                  }}
                  className="font-mono text-[11px] text-[#60a5fa] hover:text-white underline underline-offset-4 cursor-pointer"
                >
                  {vehicleInfo.model.trim() ? 'Editar dados ↓' : 'Preencher dados ↓'}
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
                <div className="bg-[#061020] border border-white/10 p-2">
                  <span className="block text-[10px] text-slate-400">MODELO</span>
                  <span
                    data-testid="cart-vehicle-model"
                    className="block text-white font-semibold truncate mt-0.5"
                    title={vehicleInfo.model.trim() || 'A informar abaixo'}
                  >
                    {vehicleInfo.model.trim() || 'A informar'}
                  </span>
                </div>

                <div className="bg-[#061020] border border-white/10 p-2">
                  <span className="block text-[10px] text-slate-400">ANO</span>
                  <span
                    data-testid="cart-vehicle-year"
                    className="block text-white font-semibold truncate mt-0.5"
                  >
                    {vehicleInfo.year.trim() || 'A informar'}
                  </span>
                </div>

                <div className="bg-[#061020] border border-white/10 p-2">
                  <span className="block text-[10px] text-slate-400">PLACA</span>
                  <span
                    data-testid="cart-vehicle-plate"
                    className="block text-[#34d399] font-semibold truncate mt-0.5 uppercase"
                  >
                    {vehicleInfo.plate.trim() || 'Opcional'}
                  </span>
                </div>

                <div className="bg-[#061020] border border-white/10 p-2">
                  <span className="block text-[10px] text-slate-400">CHASSI / SÉRIE</span>
                  <span
                    data-testid="cart-vehicle-chassis"
                    className="block text-[#60a5fa] font-semibold truncate mt-0.5 uppercase"
                    title={vehicleInfo.chassis.trim() || 'Opcional'}
                  >
                    {vehicleInfo.chassis.trim() || 'Opcional'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {cart.length === 0 ? (
            <p className="text-sm text-slate-400 py-3 border-y border-white/10">
              Descreva a peça diretamente no formulário abaixo ou adicione múltiplos
              itens na caixa a seguir.
            </p>
          ) : (
            <div className="divide-y divide-white/10 border-y border-white/10">
              {cart.map((item, idx) => {
                const formattedVeh = formatVehicleIdentification(vehicleInfo);
                return (
                  <div
                    key={item.id}
                    className="py-3.5 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <strong className="block text-sm font-medium text-white truncate">
                        {item.name}
                      </strong>
                      <div className="font-mono text-xs text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-[#ea580c]">{item.sku}</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#fdba74]">Cotação Sob Demanda</span>
                      </div>
                      {(formattedVeh || item.application) && (
                        <div
                          data-testid={`cart-item-vehicle-${idx}`}
                          className="font-mono text-[11px] text-slate-300 bg-[#0b182e] border border-white/10 px-2.5 py-1.5 leading-relaxed"
                        >
                          {formattedVeh ? (
                            <span>
                              <strong className="text-[#60a5fa]">Veículo:</strong> {formattedVeh}
                            </span>
                          ) : (
                            <span>
                              <strong className="text-slate-400">Aplicação:</strong>{' '}
                              {item.application}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 pt-0.5">
                      <input
                        aria-label={`Quantidade no orçamento de ${item.name}`}
                        type="number"
                        min={1}
                        max={999}
                        value={item.quantity}
                        onChange={(e) => onUpdateQuantity(idx, clampQuantity(e.target.value))}
                        className="w-16 px-2.5 py-1.5 bg-[#0b172b] border border-white/20 text-xs font-mono text-center text-white"
                      />

                      <button
                        type="button"
                        aria-label={`Remover ${item.name}`}
                        onClick={() => onRemoveItem(idx)}
                        className="p-2 border border-white/15 text-slate-300 hover:text-red-400 hover:border-red-400/40 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Manual Item Addition */}
        <div className="bg-[#0a1830] border border-white/12 p-4">
          <label
            htmlFor="manual-name"
            className="block font-mono text-xs text-slate-300 mb-2"
          >
            INCLUIR MÚLTIPLAS PEÇAS NA LISTA (OPCIONAL)
          </label>
          <div className="flex gap-2">
            <input
              ref={manualInputRef}
              id="manual-name"
              type="text"
              maxLength={160}
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleManualAdd();
                }
              }}
              placeholder="Ex.: Mangueira hidráulica 2SN 1/2 pol, 2 metros com JIC 37°"
              className="flex-1 px-3.5 py-2.5 bg-[#0b172b] border border-white/20 text-xs sm:text-sm text-white placeholder:text-slate-400"
            />
            <button
              type="button"
              id="add-manual"
              aria-label="Adicionar peça manual"
              onClick={handleManualAdd}
              className="px-4 py-2.5 bg-[#ea580c] hover:bg-[#f97316] text-white font-mono text-xs font-bold inline-flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Incluir</span>
            </button>
          </div>
        </div>

        {/* On-Demand Quote Submission Form */}
        <form id="quote-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="customer"
              className="block font-mono text-xs text-slate-300 mb-1.5"
            >
              NOME DO CLIENTE / EMPRESA OU OFICINA *
            </label>
            <input
              id="customer"
              name="customer"
              type="text"
              required
              minLength={2}
              maxLength={120}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Ex.: João Silva / Transportadora Bahia Diesel"
              className="w-full px-3.5 py-3 bg-[#0b172b] border border-white/20 text-sm text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="phone"
                className="block font-mono text-xs text-slate-300 mb-1.5"
              >
                WHATSAPP / TELEFONE COM DDD *
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                inputMode="tel"
                required
                maxLength={22}
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (phoneError) setPhoneError('');
                }}
                placeholder="(71) 98397-8870"
                className="w-full px-3.5 py-3 bg-[#0b172b] border border-white/20 text-sm text-white"
              />
              {phoneError && (
                <p className="text-xs text-amber-400 font-mono mt-1">{phoneError}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="city"
                className="block font-mono text-xs text-slate-300 mb-1.5"
              >
                CIDADE / ESTADO (OPCIONAL)
              </label>
              <input
                id="city"
                name="city"
                type="text"
                maxLength={100}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Salvador / BA"
                className="w-full px-3.5 py-3 bg-[#0b172b] border border-white/20 text-sm text-white"
              />
            </div>
          </div>

          {/* Structured Vehicle Identification (Marca, Modelo, Motor, Ano + Optional Placa, Chassi) */}
          <div className="p-4 bg-[#09162b] border border-white/15 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
              <span className="font-mono text-xs text-[#ea580c] font-semibold">
                VEÍCULO (MARCA, MODELO, MOTOR E ANO) *
              </span>
              <span className="font-mono text-[11px] text-slate-400">
                Marca/Modelo/Motor e Ano obrigatórios
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
              <div className="sm:col-span-8">
                <label
                  htmlFor="vehicle"
                  className="block font-mono text-xs text-slate-300 mb-1.5"
                >
                  VEÍCULO (MARCA, MODELO E MOTOR) *
                </label>
                <input
                  id="vehicle"
                  name="vehicle"
                  type="text"
                  required
                  maxLength={160}
                  value={vehicleInfo.model}
                  onChange={(e) => {
                    onUpdateVehicleInfo({ ...vehicleInfo, model: e.target.value });
                    if (vehicleError) setVehicleError('');
                  }}
                  placeholder="Ex.: Mercedes-Benz Atego 2426 Motor OM 926 / Trator Valtra BH180"
                  className="w-full px-3.5 py-2.5 bg-[#0b172b] border border-white/20 text-sm text-white"
                />
              </div>

              <div className="sm:col-span-4">
                <label
                  htmlFor="vehicle-year"
                  className="block font-mono text-xs text-slate-300 mb-1.5"
                >
                  ANO *
                </label>
                <input
                  id="vehicle-year"
                  name="vehicleYear"
                  type="text"
                  required
                  maxLength={20}
                  value={vehicleInfo.year}
                  onChange={(e) => {
                    onUpdateVehicleInfo({ ...vehicleInfo, year: e.target.value });
                    if (vehicleError) setVehicleError('');
                  }}
                  placeholder="Ex.: 2021/2022"
                  className="w-full px-3.5 py-2.5 bg-[#0b172b] border border-white/20 text-sm text-white"
                />
              </div>

              <div className="sm:col-span-5">
                <label
                  htmlFor="vehicle-plate"
                  className="block font-mono text-xs text-slate-300 mb-1.5"
                >
                  PLACA (OPCIONAL)
                </label>
                <input
                  id="vehicle-plate"
                  name="vehiclePlate"
                  type="text"
                  maxLength={12}
                  value={vehicleInfo.plate}
                  onChange={(e) =>
                    onUpdateVehicleInfo({
                      ...vehicleInfo,
                      plate: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder="Ex.: ABC1D23"
                  className="w-full px-3.5 py-2.5 bg-[#0b172b] border border-white/20 text-sm text-white font-mono uppercase"
                />
              </div>

              <div className="sm:col-span-7">
                <label
                  htmlFor="vehicle-chassis"
                  className="block font-mono text-xs text-slate-300 mb-1.5"
                >
                  CHASSI / Nº DE SÉRIE (OPCIONAL)
                </label>
                <input
                  id="vehicle-chassis"
                  name="vehicleChassis"
                  type="text"
                  maxLength={40}
                  value={vehicleInfo.chassis}
                  onChange={(e) =>
                    onUpdateVehicleInfo({
                      ...vehicleInfo,
                      chassis: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder="Ex.: 9BM958... (para conferência exata da aplicação)"
                  className="w-full px-3.5 py-2.5 bg-[#0b172b] border border-white/20 text-sm text-white font-mono uppercase"
                />
              </div>
            </div>

            {vehicleError && (
              <p className="text-xs text-amber-400 font-mono">{vehicleError}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="notes"
              className="block font-mono text-xs text-slate-300 mb-1.5"
            >
              PEÇA SOLICITADA (DESCRIÇÃO, CÓDIGO ORIGINAL OU OBSERVAÇÕES){' '}
              {cart.length === 0 ? '*' : '(COMPLEMENTAR)'}
            </label>
            <textarea
              id="notes"
              name="notes"
              required={cart.length === 0}
              maxLength={1200}
              rows={3}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                if (partError) setPartError('');
              }}
              placeholder={
                cart.length > 0
                  ? 'Adicione observações, código OEM ou especificações adicionais para os itens selecionados...'
                  : 'Descreva a peça solicitada, código original OEM, medidas de rosca ou especificações técnicas...'
              }
              className="w-full px-3.5 py-3 bg-[#0b172b] border border-white/20 text-sm text-white resize-y"
            />
            {partError && (
              <p className="text-xs text-amber-400 font-mono mt-1">{partError}</p>
            )}
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Ao enviar, seu pedido chega em tempo real em nosso{' '}
            <strong className="text-slate-200">Sistema de Gestão</strong>, que dispara
            sua cotação para nosso WhatsApp oficial{' '}
            <strong className="text-slate-200">{WHATSAPP_DISPLAY}</strong>.
          </p>

          <div className="space-y-2.5 pt-1">
            <button
              type="submit"
              id="submit-order"
              disabled={submitting}
              className="w-full py-4 px-5 bg-[#10b981] hover:bg-[#34d399] text-[#03251b] font-mono text-xs font-bold tracking-wider inline-flex items-center justify-center gap-2 transition-colors"
            >
              <span>
                {submitting
                  ? 'ENVIANDO SOLICITAÇÃO...'
                  : 'SOLICITAR COTAÇÃO SOB DEMANDA'}
              </span>
              <ArrowUpRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              id="export-quote-pdf"
              data-testid="export-quote-pdf-btn"
              disabled={exportingPdf}
              onClick={handleExportCurrentPdf}
              className="w-full py-3.5 px-5 bg-[#0f1f38] hover:bg-[#162b4d] border border-[#ea580c]/70 text-white font-mono text-xs font-bold tracking-wider inline-flex items-center justify-center gap-2 transition-colors"
            >
              <FileDown className="w-4 h-4 text-[#ea580c]" />
              <span>
                {exportingPdf
                  ? 'GERANDO DOCUMENTO PDF...'
                  : 'EXPORTAR COTAÇÃO EM PDF (TIMBRADO COM LOGO)'}
              </span>
            </button>

            <a
              href={buildDirectQuoteWhatsAppUrl({
                modelo: vehicleInfo.model,
                ano: vehicleInfo.year,
                peca: notes || manualName,
              })}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 px-5 bg-[#0a1931] hover:bg-[#162a4a] border border-white/20 text-white font-mono text-xs font-semibold tracking-wider inline-flex items-center justify-center gap-2 transition-colors"
            >
              <MessageSquare className="w-4 h-4 text-[#10b981]" />
              <span>FAZER ORÇAMENTO DIRETO PELO WHATSAPP ({WHATSAPP_DISPLAY})</span>
            </a>
          </div>
        </form>
      </div>
    </dialog>
  );
};
