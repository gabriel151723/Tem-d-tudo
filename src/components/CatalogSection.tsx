import React, { useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  FileDown,
  MessageSquare,
  Plus,
  Trash2,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  OrderRecord,
  SubsystemId,
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
import {
  createDraftPdfPayload,
  createOrderPdfPayload,
  exportQuoteToPdf,
} from '../utils/pdfExport';

interface AdditionalPartEntry {
  id: string;
  description: string;
  quantity: number;
}

interface CatalogSectionProps {
  onSaveOrder?: (order: OrderRecord) => Promise<OrderRecord>;
  onToast: (msg: string) => void;
  onFocusSubsystem: (sub: SubsystemId) => void;
  focusedSubsystem: SubsystemId;
  vehicleInfo: VehicleIdentification;
  onUpdateVehicleInfo: (info: VehicleIdentification) => void;
}

export const CatalogSection: React.FC<CatalogSectionProps> = React.memo(({
  onSaveOrder,
  onToast,
  onFocusSubsystem,
  focusedSubsystem,
  vehicleInfo,
  onUpdateVehicleInfo,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [partDescription, setPartDescription] = useState('');
  const [partQuantity, setPartQuantity] = useState<number>(1);
  const [additionalParts, setAdditionalParts] = useState<AdditionalPartEntry[]>([]);

  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [vehicleError, setVehicleError] = useState('');
  const [partError, setPartError] = useState('');
  const [networkError, setNetworkError] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const [submittedQuote, setSubmittedQuote] = useState<{
    docId: string;
    order: OrderRecord;
    followUpWhatsappUrl: string;
    pecaResumo: string;
  } | null>(null);

  const handleAddAnotherPart = () => {
    setAdditionalParts((prev) => [
      ...prev,
      {
        id: `part-${generateUid()}`,
        description: '',
        quantity: 1,
      },
    ]);
    if (partError) setPartError('');
  };

  const handleUpdateAdditionalPart = (
    id: string,
    patch: Partial<Pick<AdditionalPartEntry, 'description' | 'quantity'>>
  ) => {
    setAdditionalParts((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
    if (partError) setPartError('');
  };

  const handleRemoveAdditionalPart = (id: string) => {
    setAdditionalParts((prev) => prev.filter((item) => item.id !== id));
  };

  const collectValidParts = (): { description: string; quantity: number }[] => {
    const list: { description: string; quantity: number }[] = [];
    if (partDescription.trim()) {
      list.push({
        description: partDescription.trim(),
        quantity: clampQuantity(partQuantity),
      });
    }
    for (const extra of additionalParts) {
      if (extra.description.trim()) {
        list.push({
          description: extra.description.trim(),
          quantity: clampQuantity(extra.quantity),
        });
      }
    }
    return list;
  };

  const buildCompletePartDescription = (): string => {
    const validParts = collectValidParts();
    const partsText =
      validParts.length === 1
        ? validParts[0].quantity > 1
          ? `${validParts[0].description} (Qtd: ${validParts[0].quantity})`
          : validParts[0].description
        : validParts
            .map((p, idx) => `${idx + 1}. ${p.description} (Qtd: ${p.quantity})`)
            .join(' | ');

    const extraTags = [
      vehicleInfo.plate.trim() ? `Placa: ${vehicleInfo.plate.trim()}` : '',
      vehicleInfo.chassis.trim() ? `Chassi: ${vehicleInfo.chassis.trim()}` : '',
    ]
      .filter(Boolean)
      .join(' · ');

    if (!extraTags) return partsText.slice(0, 2000);
    return `${partsText} (${extraTags})`.slice(0, 2000);
  };

  const handleExportPdf = async () => {
    if (exportingPdf) return;

    const validParts = collectValidParts();

    if (validParts.length === 0 && submittedQuote) {
      setExportingPdf(true);
      try {
        const filename = await exportQuoteToPdf(createOrderPdfPayload(submittedQuote.order));
        onToast(`PDF formal gerado: ${filename}`);
      } catch {
        onToast('Não foi possível gerar o PDF da cotação.');
      } finally {
        setExportingPdf(false);
      }
      return;
    }

    if (validParts.length === 0) {
      setPartError('Descreva a peça solicitada antes de gerar o PDF.');
      onToast('Preencha a descrição da peça para exportar o PDF.');
      return;
    }

    setExportingPdf(true);
    try {
      const payload = createDraftPdfPayload({
        cart: validParts.map((item) => ({
          id: `ondemand-${generateUid()}`,
          sku: 'SOB-DEMANDA',
          name: item.description.slice(0, 180),
          oem: '',
          category: 'Cotação Sob Demanda',
          system: 'Solicitação Direta',
          application:
            formatVehicleIdentification(vehicleInfo) ||
            'Especificação informada pelo cliente',
          stock: 1,
          demo: false,
          quantity: item.quantity,
          manual: true,
        })),
        customerName: customerName.trim() || 'Cliente',
        phone: phone.trim() || WHATSAPP_DISPLAY,
        city: 'Atendimento Nacional',
        vehicle: formatVehicleIdentification(vehicleInfo),
        notes: buildCompletePartDescription(),
      });
      const filename = await exportQuoteToPdf(payload);
      onToast(`PDF timbrado gerado com sucesso (${filename})`);
    } catch {
      onToast('Não foi possível exportar o PDF no momento.');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setNameError('');
    setPhoneError('');
    setVehicleError('');
    setPartError('');
    setNetworkError('');

    const cleanNome = customerName.trim();
    const cleanPhone = phone.trim();
    const cleanModelo = vehicleInfo.model.trim();
    const cleanAno = vehicleInfo.year.trim();
    const validParts = collectValidParts();

    if (cleanNome.length < 2) {
      setNameError('Informe seu nome completo ou o nome da sua empresa/oficina.');
      onToast('Preencha o nome do cliente.');
      return;
    }

    if (!validatePhone(cleanPhone)) {
      setPhoneError(
        'Informe um WhatsApp / Telefone válido com DDD (ex: 71 98397-8870).'
      );
      onToast('Verifique o WhatsApp com DDD.');
      return;
    }

    if (!cleanModelo || !cleanAno) {
      setVehicleError(
        'Preencha obrigatoriamente a Marca/Modelo/Motor e o Ano do veículo ou máquina.'
      );
      onToast('Informe o Modelo/Motor e o Ano do veículo.');
      return;
    }

    if (validParts.length === 0 || validParts[0].description.length < 2) {
      setPartError(
        'Descreva a peça solicitada, código original OEM, medidas ou observações.'
      );
      onToast('Descreva a peça que você precisa.');
      return;
    }

    setSubmitting(true);

    try {
      const pecaSolicitadaFormatted = buildCompletePartDescription();
      const formattedVehicle = formatVehicleIdentification(vehicleInfo);

      // 1. Direct write to Firestore "solicitacoes_orcamento" via addDoc + serverTimestamp()
      let docId = '';
      try {
        const docRef = await addDoc(collection(db, 'solicitacoes_orcamento'), {
          cliente: {
            nome: (cleanNome || 'Cliente').slice(0, 120),
            telefone: cleanPhone.slice(0, 40),
          },
          veiculo: {
            modelo: (cleanModelo || 'Não informado').slice(0, 160),
            ano: (cleanAno || 'Não informado').slice(0, 40),
          },
          peca_solicitada: (pecaSolicitadaFormatted || 'Sob consulta').slice(0, 4000),
          status: 'pendente',
          data_criacao: serverTimestamp(),
        });
        docId = docRef.id;
      } catch (firestoreErr) {
        handleFirestoreError(
          firestoreErr,
          OperationType.CREATE,
          'solicitacoes_orcamento'
        );
      }

      // 2. Create OrderRecord for PDF receipt and secondary management system sync
      const orderRecord = createOrderRecord(
        {
          customer: {
            name: cleanNome,
            phone: cleanPhone,
            city: 'Atendimento Nacional',
          },
          vehicle: formattedVehicle,
          notes: pecaSolicitadaFormatted,
          items: validParts.map((item) => ({
            id: `ondemand-${generateUid()}`,
            sku: 'SOB-DEMANDA',
            name: item.description.slice(0, 180),
            quantity: item.quantity,
            manual: true,
            demo: false,
          })),
        },
        generateUid(),
        new Date().toISOString(),
        false
      );

      let savedOrder = orderRecord;
      if (onSaveOrder) {
        try {
          savedOrder = await onSaveOrder(orderRecord);
        } catch {
          // Keep primary solicitacoes_orcamento submission intact
        }
      }

      const pecasListaVertical = validParts.map(
        (p) => `${p.description} (Qtd: ${p.quantity})`
      );

      const followUpWhatsappUrl = buildFollowUpWhatsAppUrl({
        protocol: savedOrder.protocol,
        nome: cleanNome,
        telefone: cleanPhone,
        veiculo: formattedVehicle || `${cleanModelo} (${cleanAno})`,
        peca: pecaSolicitadaFormatted,
        pecasLista: pecasListaVertical,
      });

      setSubmittedQuote({
        docId,
        order: savedOrder,
        followUpWhatsappUrl,
        pecaResumo: pecaSolicitadaFormatted,
      });

      // Clear all form inputs after successful submission
      setCustomerName('');
      setPhone('');
      setPartDescription('');
      setPartQuantity(1);
      setAdditionalParts([]);
      onUpdateVehicleInfo({ model: '', year: '', plate: '', chassis: '' });

      onToast(
        'Solicitação enviada com sucesso! O orçamento será encaminhado ao seu WhatsApp.'
      );
    } catch {
      setNetworkError(
        'Não foi possível concluir o envio pelo site no momento. Verifique sua conexão com a internet ou clique abaixo para solicitar seu orçamento diretamente pelo WhatsApp.'
      );
      onToast('Erro ao enviar solicitação. Tente novamente ou chame no WhatsApp.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="catalogo" className="relative z-10 py-16 sm:py-24 lg:py-28 scroll-mt-16 sm:scroll-mt-20">
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-10 items-start">
          {/* Left Column: Sticky Editorial Side Card */}
          <div className="liquid-glass lg:col-span-4 lg:sticky lg:top-28 space-y-5 sm:space-y-6 border border-white/18 p-5 sm:p-7">
            <div className="font-mono text-xs text-[#ea580c] tracking-wider">
              02. Cotação & Orçamento Sob Demanda
            </div>
            <h2 className="font-display text-2xl sm:text-4xl font-bold text-white leading-tight text-balance">
              A peça certa.{' '}
              <span className="text-[#60a5fa]">Sem rodeios.</span>
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Na <strong>Tem de Tudo Auto Peças e Serviços LTDA</strong>, você
              digita exatamente a peça que precisa para o seu veículo ou máquina.
              Seu pedido cai direto no nosso <strong>Sistema de Gestão</strong> e
              nossa equipe envia a proposta com valores e frete para o seu WhatsApp.
            </p>

            {/* Commercial Trust Highlight */}
            <div className="pt-3 border-t border-white/10 font-mono text-xs text-slate-300 flex items-start sm:items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#10b981] shrink-0 mt-0.5 sm:mt-0" />
              <span>Peças sob demanda com garantia e envio para todo o Brasil</span>
            </div>

            {/* Direct WhatsApp CTA inside Side Card */}
            <div className="pt-4 border-t border-white/10 space-y-2.5">
              <div className="font-mono text-xs text-slate-300">
                Prefere fazer o orçamento direto no WhatsApp?
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Se preferir falar diretamente com um especialista ou enviar foto da
                peça, clique abaixo:
              </p>
              <a
                href={buildDirectQuoteWhatsAppUrl('Card Lateral - Cotação Sob Demanda')}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="sidecard-whatsapp-cta"
                className="animate-whatsapp-pulse w-full min-h-[44px] py-3 px-4 bg-[#10b981] hover:bg-[#34d399] text-[#03251b] font-mono text-xs font-bold tracking-wider inline-flex items-center justify-center gap-2 text-center transition-colors"
              >
                <MessageSquare className="w-4 h-4 shrink-0" />
                <span>ORÇAR DIRETO NO WHATSAPP</span>
                <ArrowUpRight className="w-4 h-4 shrink-0" />
              </a>
            </div>

            {/* Interactive 3D Subsystem Camera Focus */}
            <div className="pt-4 border-t border-white/10 space-y-2.5">
              <div className="font-mono text-xs text-slate-400">
                Ângulo 3D do Subsistema em Foco:
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2">
                {(
                  [
                    ['all', 'Conjunto Completo'],
                    ['brake', 'Freios & Pinça'],
                    ['engine', 'Motor Diesel'],
                    ['spring', 'Suspensão & 2SN'],
                  ] as [SubsystemId, string][]
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onFocusSubsystem(id)}
                    className={`min-h-[40px] px-3 py-2 font-mono text-xs text-left border transition-colors whitespace-nowrap truncate cursor-pointer ${
                      focusedSubsystem === id
                        ? 'bg-[#ea580c] text-white border-[#ea580c] font-semibold'
                        : 'bg-[#0a1931]/80 text-slate-300 border-white/12 hover:border-white/30'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Streamlined On-Demand Quote Form */}
          <div className="liquid-glass lg:col-span-8 border border-white/18 p-4 sm:p-8 space-y-5 sm:space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 pb-4 sm:pb-5 border-b border-white/12">
              <div>
                <div className="font-mono text-[11px] sm:text-xs text-[#ea580c] tracking-wider break-words">
                  TEM DE TUDO AUTO PEÇAS E SERVIÇOS LTDA · WHATSAPP {WHATSAPP_DISPLAY}
                </div>
                <h3 className="font-display text-2xl sm:text-3xl font-bold text-white mt-1">
                  Solicitar Orçamento Rápido
                </h3>
              </div>

              <button
                type="button"
                onClick={handleExportPdf}
                disabled={exportingPdf}
                title="Exportar cotação como PDF formal"
                className="w-full sm:w-auto min-h-[42px] px-3.5 py-2.5 bg-[#0f1f38] hover:bg-[#162b4d] border border-[#ea580c]/50 text-white font-mono text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <FileDown className="w-4 h-4 text-[#ea580c] shrink-0" />
                <span>Exportar PDF</span>
              </button>
            </div>

            {/* Friendly Network Error Alert */}
            {networkError && (
              <div
                role="alert"
                data-testid="section-quote-error"
                className="p-5 bg-[#2c1215] border border-red-500/60 space-y-3 text-red-200"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs sm:text-sm leading-relaxed">
                    <div className="font-mono font-bold text-red-300">
                      ALERTA DE CONEXÃO
                    </div>
                    <p>{networkError}</p>
                  </div>
                </div>
                <div className="pt-1">
                  <a
                    href={buildDirectQuoteWhatsAppUrl('Fallback de Conexão')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#10b981] text-[#03251b] font-mono text-xs font-bold"
                  >
                    <span>Solicitar Orçamento pelo WhatsApp ({WHATSAPP_DISPLAY})</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </a>
                </div>
              </div>
            )}

            {/* Intuitive On-Demand Quote Form */}
            <form
              id="main-quote-form"
              data-testid="on-demand-quote-section-form"
              onSubmit={handleSubmit}
              className="space-y-5"
            >
              {/* 1. Dados de Contato (Nome e WhatsApp) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="section-customer"
                    className="block font-mono text-xs text-slate-300 mb-1.5"
                  >
                    1. NOME DO CLIENTE / EMPRESA *
                  </label>
                  <input
                    id="section-customer"
                    name="customer"
                    type="text"
                    required
                    minLength={2}
                    maxLength={120}
                    value={customerName}
                    onChange={(e) => {
                      setCustomerName(e.target.value);
                      if (nameError) setNameError('');
                    }}
                    placeholder="Ex.: João Silva / Transportadora Bahia Diesel"
                    className="liquid-glass-input w-full px-3.5 py-3 border border-white/20 text-sm text-white placeholder:text-slate-400 focus:border-[#ea580c] focus:outline-none"
                  />
                  {nameError && (
                    <p className="text-xs text-amber-400 font-mono mt-1">
                      {nameError}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="section-phone"
                    className="block font-mono text-xs text-slate-300 mb-1.5"
                  >
                    2. WHATSAPP / TELEFONE COM DDD *
                  </label>
                  <input
                    id="section-phone"
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
                    className="liquid-glass-input w-full px-3.5 py-3 border border-white/20 text-sm text-white placeholder:text-slate-400 focus:border-[#ea580c] focus:outline-none"
                  />
                  {phoneError && (
                    <p className="text-xs text-amber-400 font-mono mt-1">
                      {phoneError}
                    </p>
                  )}
                </div>
              </div>

              {/* 2. Dados do Veículo / Máquina */}
              <div className="liquid-glass-sub p-4 sm:p-5 border border-white/16 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
                  <span className="font-mono text-xs text-[#ea580c] font-semibold">
                    3. DADOS DO VEÍCULO / MÁQUINA (MARCA, MODELO, MOTOR E ANO) *
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">
                    Placa e Chassi opcionais para conferência técnica
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                  <div className="sm:col-span-8">
                    <label
                      htmlFor="section-vehicle-model"
                      className="block font-mono text-xs text-slate-300 mb-1.5"
                    >
                      MARCA, MODELO E MOTOR DO VEÍCULO / MÁQUINA *
                    </label>
                    <input
                      id="section-vehicle-model"
                      name="vehicle"
                      type="text"
                      required
                      maxLength={160}
                      value={vehicleInfo.model}
                      onChange={(e) => {
                        onUpdateVehicleInfo({
                          ...vehicleInfo,
                          model: e.target.value,
                        });
                        if (vehicleError) setVehicleError('');
                      }}
                      placeholder="Ex.: Mercedes-Benz Atego 2426 Motor OM 926 / Trator Valtra BH180 / Hilux 2.8"
                      className="liquid-glass-input w-full px-3.5 py-2.5 border border-white/20 text-sm text-white placeholder:text-slate-400 focus:border-[#ea580c] focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <label
                      htmlFor="section-vehicle-year"
                      className="block font-mono text-xs text-slate-300 mb-1.5"
                    >
                      ANO *
                    </label>
                    <input
                      id="section-vehicle-year"
                      name="vehicleYear"
                      type="text"
                      required
                      maxLength={20}
                      value={vehicleInfo.year}
                      onChange={(e) => {
                        onUpdateVehicleInfo({
                          ...vehicleInfo,
                          year: e.target.value,
                        });
                        if (vehicleError) setVehicleError('');
                      }}
                      placeholder="Ex.: 2021/2022"
                      className="liquid-glass-input w-full px-3.5 py-2.5 border border-white/20 text-sm text-white placeholder:text-slate-400 focus:border-[#ea580c] focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-5">
                    <label
                      htmlFor="section-vehicle-plate"
                      className="block font-mono text-xs text-slate-300 mb-1.5"
                    >
                      PLACA (OPCIONAL)
                    </label>
                    <input
                      id="section-vehicle-plate"
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
                      className="liquid-glass-input w-full px-3.5 py-2.5 border border-white/20 text-sm text-white font-mono uppercase placeholder:text-slate-400 focus:border-[#ea580c] focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-7">
                    <label
                      htmlFor="section-vehicle-chassis"
                      className="block font-mono text-xs text-slate-300 mb-1.5"
                    >
                      CHASSI / Nº DE SÉRIE (OPCIONAL)
                    </label>
                    <input
                      id="section-vehicle-chassis"
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
                      className="liquid-glass-input w-full px-3.5 py-2.5 border border-white/20 text-sm text-white font-mono uppercase placeholder:text-slate-400 focus:border-[#ea580c] focus:outline-none"
                    />
                  </div>
                </div>

                {vehicleError && (
                  <p className="text-xs text-amber-400 font-mono">{vehicleError}</p>
                )}
              </div>

              {/* 4. Descrição da Peça Solicitada + Botão "+ Incluir outra peça" + Card Verde de Sucesso */}
              <div className="liquid-glass-sub p-4 sm:p-5 border border-white/16 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-white/10 pb-3">
                  <label
                    htmlFor="section-notes"
                    className="font-mono text-xs text-[#ea580c] font-semibold leading-relaxed"
                  >
                    4. DESCRIÇÃO DA PEÇA SOLICITADA (CÓDIGO ORIGINAL, MEDIDAS OU OBSERVAÇÕES) *
                  </label>
                  <button
                    type="button"
                    data-testid="add-another-part-btn"
                    onClick={handleAddAnotherPart}
                    className="w-full sm:w-auto min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#0f2442] hover:bg-[#ea580c] text-white border border-[#ea580c]/60 font-mono text-xs font-bold transition-colors cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                    <span>+ Incluir outra peça</span>
                  </button>
                </div>

                {/* Primary Part Input + Quantity */}
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                    <div className="sm:col-span-9">
                      <textarea
                        id="section-notes"
                        name="peca_solicitada"
                        required
                        maxLength={1200}
                        rows={3}
                        value={partDescription}
                        onChange={(e) => {
                          setPartDescription(e.target.value);
                          if (partError) setPartError('');
                        }}
                        placeholder="Descreva a peça ou mangueira que você precisa, código original OEM (se tiver), medidas ou especificações técnicas..."
                        className="liquid-glass-input w-full px-3.5 py-2.5 border border-white/20 text-sm text-white placeholder:text-slate-400 focus:border-[#ea580c] focus:outline-none resize-y"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label
                        htmlFor="section-part-qty"
                        className="block font-mono text-[11px] text-slate-400 mb-1"
                      >
                        QUANTIDADE
                      </label>
                      <div className="liquid-glass-input flex items-center border border-white/20 min-h-[42px]">
                        <button
                          type="button"
                          aria-label="Diminuir quantidade da peça principal"
                          onClick={() =>
                            setPartQuantity((prev) => clampQuantity(prev - 1))
                          }
                          className="min-w-[40px] min-h-[40px] px-3 py-2 text-slate-300 hover:text-white font-mono text-sm cursor-pointer"
                        >
                          -
                        </button>
                        <input
                          id="section-part-qty"
                          type="number"
                          min={1}
                          max={999}
                          value={partQuantity}
                          onChange={(e) =>
                            setPartQuantity(clampQuantity(e.target.value))
                          }
                          className="w-full text-center bg-transparent text-white font-mono text-sm py-2 focus:outline-none"
                        />
                        <button
                          type="button"
                          aria-label="Aumentar quantidade da peça principal"
                          onClick={() =>
                            setPartQuantity((prev) => clampQuantity(prev + 1))
                          }
                          className="min-w-[40px] min-h-[40px] px-3 py-2 text-slate-300 hover:text-white font-mono text-sm cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Additional Parts Dynamically Added */}
                  {additionalParts.length > 0 && (
                    <div className="space-y-3 pt-2 border-t border-white/10">
                      <div className="font-mono text-xs text-slate-300">
                        PEÇAS ADICIONAIS PARA O MESMO VEÍCULO ({additionalParts.length}):
                      </div>
                      {additionalParts.map((item, idx) => (
                        <div
                          key={item.id}
                          data-testid={`additional-part-row-${idx}`}
                          className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end p-3 liquid-glass-sub"
                        >
                          <div className="sm:col-span-8">
                            <label
                              htmlFor={`extra-part-desc-${item.id}`}
                              className="block font-mono text-[11px] text-[#60a5fa] mb-1"
                            >
                              PEÇA #{idx + 2} (NOME, CÓDIGO OEM OU MEDIDA)
                            </label>
                            <input
                              id={`extra-part-desc-${item.id}`}
                              type="text"
                              maxLength={300}
                              value={item.description}
                              onChange={(e) =>
                                handleUpdateAdditionalPart(item.id, {
                                  description: e.target.value,
                                })
                              }
                              placeholder={`Ex.: Peça adicional #${idx + 2} (filtro, válvula, mangueira, retentor...)`}
                              className="w-full min-h-[42px] px-3 py-2 liquid-glass-input border border-white/20 text-sm text-white placeholder:text-slate-400 focus:border-[#ea580c] focus:outline-none"
                            />
                          </div>

                          <div className="sm:col-span-4 flex items-end gap-2">
                            <div className="flex-1">
                              <label
                                htmlFor={`extra-part-qty-${item.id}`}
                                className="block font-mono text-[11px] text-slate-400 mb-1"
                              >
                                QTD
                              </label>
                              <div className="flex items-center liquid-glass-input border border-white/20 min-h-[42px]">
                                <button
                                  type="button"
                                  aria-label={`Diminuir quantidade da peça ${idx + 2}`}
                                  onClick={() =>
                                    handleUpdateAdditionalPart(item.id, {
                                      quantity: clampQuantity(item.quantity - 1),
                                    })
                                  }
                                  className="min-w-[36px] min-h-[40px] px-2.5 py-1.5 text-slate-300 hover:text-white font-mono text-xs cursor-pointer"
                                >
                                  -
                                </button>
                                <input
                                  id={`extra-part-qty-${item.id}`}
                                  type="number"
                                  min={1}
                                  max={999}
                                  value={item.quantity}
                                  onChange={(e) =>
                                    handleUpdateAdditionalPart(item.id, {
                                      quantity: clampQuantity(e.target.value),
                                    })
                                  }
                                  className="w-full text-center bg-transparent text-white font-mono text-xs py-1.5 focus:outline-none"
                                />
                                <button
                                  type="button"
                                  aria-label={`Aumentar quantidade da peça ${idx + 2}`}
                                  onClick={() =>
                                    handleUpdateAdditionalPart(item.id, {
                                      quantity: clampQuantity(item.quantity + 1),
                                    })
                                  }
                                  className="min-w-[36px] min-h-[40px] px-2.5 py-1.5 text-slate-300 hover:text-white font-mono text-xs cursor-pointer"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            <button
                              type="button"
                              aria-label={`Remover peça adicional ${idx + 2}`}
                              onClick={() => handleRemoveAdditionalPart(item.id)}
                              className="min-h-[42px] min-w-[42px] inline-flex items-center justify-center p-2.5 text-slate-300 hover:text-red-400 border border-white/15 hover:border-red-400/50 transition-colors cursor-pointer shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleAddAnotherPart}
                      className="inline-flex items-center gap-1.5 font-mono text-xs text-[#60a5fa] hover:text-white underline underline-offset-4 cursor-pointer text-left"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#ea580c] shrink-0" />
                      <span>+ Incluir outra peça ao mesmo orçamento</span>
                    </button>
                    {additionalParts.length > 0 && (
                      <span className="font-mono text-[11px] text-slate-400">
                        Total de itens no pedido: {1 + additionalParts.length}
                      </span>
                    )}
                  </div>
                </div>

                {partError && (
                  <p className="text-xs text-amber-400 font-mono mt-1">{partError}</p>
                )}

                {/* Friendly Success Feedback Card placed at the bottom of the 4. DESCRIÇÃO DA PEÇA SOLICITADA card */}
                {submittedQuote && (
                  <div
                    id="section-order-result"
                    data-testid="section-quote-success"
                    role="status"
                    aria-live="polite"
                    className="mt-4 p-4 sm:p-6 bg-[#06281e] border-2 border-[#10b981] space-y-4 shadow-2xl"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#10b981]/30 pb-3">
                      <div className="flex items-start sm:items-center gap-2 text-[#34d399] font-mono text-xs sm:text-sm font-bold">
                        <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 sm:mt-0" />
                        <span className="break-words">
                          SOLICITAÇÃO RECEBIDA COM SUCESSO! ({submittedQuote.order.protocol})
                        </span>
                      </div>
                      <span className="self-start sm:self-auto px-2.5 py-1 bg-[#03251b] border border-[#10b981]/50 font-mono text-[11px] text-[#34d399] whitespace-nowrap">
                        ENVIADO AO SISTEMA DE GESTÃO
                      </span>
                    </div>

                    <div className="space-y-2 text-xs sm:text-sm text-slate-100 leading-relaxed">
                      <p>
                        Olá <strong>{submittedQuote.order.customer.name}</strong>! Seu
                        pedido já chegou ao nosso <strong>Sistema de Gestão</strong> da{' '}
                        <strong>Tem de Tudo Auto Peças e Serviços LTDA</strong>.
                      </p>
                      <p className="text-slate-200">
                        Nossa equipe enviará a proposta com valores e frete diretamente
                        para o seu WhatsApp (
                        <strong>{submittedQuote.order.customer.phone}</strong>). Se
                        desejar acompanhar o orçamento agora mesmo no nosso WhatsApp{' '}
                        <strong>{WHATSAPP_DISPLAY}</strong>, clique no botão abaixo:
                      </p>
                    </div>

                    <div className="p-3.5 bg-[#041d15] border border-[#10b981]/30 font-mono text-xs text-slate-200 space-y-1.5 break-words">
                      <div>
                        <span className="text-slate-400">PROTOCOLO:</span>{' '}
                        <strong className="text-white">
                          {submittedQuote.order.protocol}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400">VEÍCULO / MÁQUINA:</span>{' '}
                        <strong className="text-white">
                          {submittedQuote.order.vehicle}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400">PEÇA SOLICITADA:</span>{' '}
                        <strong className="text-[#34d399]">
                          {submittedQuote.pecaResumo}
                        </strong>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 pt-1">
                      <a
                        href={submittedQuote.followUpWhatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid="section-followup-whatsapp-link"
                        className="animate-whatsapp-pulse w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-3.5 bg-[#10b981] hover:bg-[#34d399] text-[#03251b] font-mono text-xs font-bold tracking-wider text-center transition-colors"
                      >
                        <MessageSquare className="w-4 h-4 shrink-0" />
                        <span>
                          ACOMPANHAR ORÇAMENTO NO WHATSAPP ({WHATSAPP_DISPLAY})
                        </span>
                        <ArrowUpRight className="w-4 h-4 shrink-0" />
                      </a>

                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const filename = await exportQuoteToPdf(
                              createOrderPdfPayload(submittedQuote.order)
                            );
                            onToast(
                              `PDF ${submittedQuote.order.protocol} gerado (${filename})`
                            );
                          } catch {
                            onToast('Erro ao gerar o PDF do pedido.');
                          }
                        }}
                        className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-3.5 bg-[#0b172b] border border-white/25 hover:border-[#ea580c] text-white font-mono text-xs font-bold transition-colors cursor-pointer"
                      >
                        <FileDown className="w-4 h-4 text-[#ea580c] shrink-0" />
                        <span>Baixar Comprovante em PDF</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit & Alternative Actions */}
              <div className="space-y-3 pt-2">
                <button
                  type="submit"
                  data-testid="quick-quote-submit-btn"
                  disabled={submitting}
                  className="w-full py-4 px-6 bg-[#10b981] hover:bg-[#34d399] text-[#03251b] font-mono text-xs sm:text-sm font-bold tracking-wider inline-flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
                >
                  <span>
                    {submitting
                      ? 'ENVIANDO SOLICITAÇÃO...'
                      : 'SOLICITAR COTAÇÃO SOB DEMANDA'}
                  </span>
                  <ArrowUpRight className="w-4 h-4 shrink-0" />
                </button>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleExportPdf}
                    disabled={exportingPdf}
                    className="w-full py-3.5 px-4 bg-[#0f1f38] hover:bg-[#162b4d] border border-[#ea580c]/70 text-white font-mono text-xs font-bold tracking-wider inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <FileDown className="w-4 h-4 text-[#ea580c] shrink-0" />
                    <span>
                      {exportingPdf
                        ? 'GERANDO PDF...'
                        : 'BAIXAR COTAÇÃO EM PDF TIMBRADO'}
                    </span>
                  </button>

                  <a
                    href={buildDirectQuoteWhatsAppUrl({
                      modelo: vehicleInfo.model,
                      ano: vehicleInfo.year,
                      peca: buildCompletePartDescription() || partDescription,
                      pecasLista: collectValidParts().map(
                        (p) => `${p.description} (Qtd: ${p.quantity})`
                      ),
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="direct-whatsapp-fallback-btn"
                    className="animate-whatsapp-pulse w-full py-3.5 px-4 bg-[#0a1931] hover:bg-[#162a4a] border border-[#10b981]/60 text-white font-mono text-xs font-bold tracking-wider inline-flex items-center justify-center gap-2 transition-colors text-center"
                  >
                    <MessageSquare className="w-4 h-4 text-[#10b981] shrink-0" />
                    <span>ORÇAR DIRETO PELO WHATSAPP</span>
                  </a>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
});
