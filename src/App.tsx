import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import {
  ArrowUp,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Compass,
  Layers,
  Grid,
  Maximize2,
  FileText,
  Clock,
  Truck,
  Wrench,
  ShieldCheck,
  Headset,
  MessageSquare,
} from 'lucide-react';
import {
  CartItem,
  OrderRecord,
  SubsystemId,
  VehicleIdentification,
  QUOTE_DRAFT_KEY,
  VEHICLE_DRAFT_KEY,
  WHATSAPP_DISPLAY,
  SECONDARY_PHONE_DISPLAY,
  clampQuantity,
  formatVehicleIdentification,
  buildDirectQuoteWhatsAppUrl,
  generateUid,
} from './utils/catalogLogic';
import { dataSync } from './utils/dataSync';
import { FullSiteScene3D, SceneTelemetry } from './components/FullSiteScene3D';
import { Navbar } from './components/Navbar';
import { CatalogSection } from './components/CatalogSection';

const QuoteDialog = lazy(() =>
  import('./components/QuoteDialog').then((mod) => ({ default: mod.QuoteDialog }))
);

export default function App() {
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(QUOTE_DRAFT_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((x) => x && x.id && x.name)
        .slice(0, 100)
        .map((x) => ({ ...x, quantity: clampQuantity(x.quantity) }));
    } catch {
      return [];
    }
  });

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [focusManualInModal, setFocusManualInModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [accessibilityMode, setAccessibilityMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('mangueiras_a11y_mode') === '1';
    } catch {
      return false;
    }
  });
  const [vehicleInfo, setVehicleInfo] = useState<VehicleIdentification>(() => {
    try {
      const raw = localStorage.getItem(VEHICLE_DRAFT_KEY);
      if (!raw) return { model: '', year: '', plate: '', chassis: '' };
      const parsed = JSON.parse(raw);
      return {
        model: String(parsed?.model || ''),
        year: String(parsed?.year || ''),
        plate: String(parsed?.plate || ''),
        chassis: String(parsed?.chassis || ''),
      };
    } catch {
      return { model: '', year: '', plate: '', chassis: '' };
    }
  });

  // 3D Scene Choreography State
  const [scrollProgress, setScrollProgress] = useState(0);
  const [focusedSubsystem, setFocusedSubsystem] = useState<SubsystemId>('all');
  const [explosionOverride, setExplosionOverride] = useState<number | null>(null);
  const [wireframe, setWireframe] = useState(false);
  const [manualOrbit, setManualOrbit] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [telemetry, setTelemetry] = useState<SceneTelemetry>({
    fps: 60,
    stageLabel: '01. PRESENÇA // CONJUNTO M-02',
    angleTitle: 'PERSPECTIVA ISOMÉTRICA PRINCIPAL',
    explosionPct: 5,
    webglActive: true,
  });

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const t = window.setTimeout(() => setToastMessage(null), 4000);
    return () => window.clearTimeout(t);
  }, [toastMessage]);

  // Sync Accessibility Mode (High Contrast + Enlarged Font) with <html> and localStorage
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('a11y-mode', accessibilityMode);
    root.setAttribute('data-a11y-mode', accessibilityMode ? 'active' : 'default');
    try {
      localStorage.setItem('mangueiras_a11y_mode', accessibilityMode ? '1' : '0');
    } catch {
      // Ignore storage quota errors
    }
  }, [accessibilityMode]);

  // Persist quote draft in localStorage (debounced to keep main thread fluid on low-end devices)
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(QUOTE_DRAFT_KEY, JSON.stringify(cart));
      } catch {
        // Ignore storage quota errors
      }
    }, 280);
    return () => window.clearTimeout(t);
  }, [cart]);

  // Persist vehicle identification draft in localStorage (debounced to avoid keystroke lag)
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(VEHICLE_DRAFT_KEY, JSON.stringify(vehicleInfo));
      } catch {
        // Ignore storage quota errors
      }
    }, 280);
    return () => window.clearTimeout(t);
  }, [vehicleInfo]);

  // Initialize on-demand quote service
  useEffect(() => {
    dataSync.init();
  }, []);

  // Track continuous window scroll progress (0.0 -> 1.0) throttled via requestAnimationFrame
  useEffect(() => {
    let rafId = 0;

    const updateScroll = () => {
      rafId = 0;
      const docHeight = Math.max(
        document.documentElement.scrollHeight - window.innerHeight,
        1
      );
      const progress = Math.max(0, Math.min(1, window.scrollY / docHeight));
      setScrollProgress((prev) =>
        Math.abs(progress - prev) >= 0.001 ? progress : prev
      );
      const shouldShowTop = window.scrollY > 360;
      setShowBackToTop((prev) => (prev !== shouldShowTop ? shouldShowTop : prev));
    };

    const onScrollOrResize = () => {
      if (rafId === 0) {
        rafId = window.requestAnimationFrame(updateScroll);
      }
    };

    updateScroll();
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
      if (rafId !== 0) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, []);

  // Scroll-triggered fade-in and slide-up entrance animations for section cards
  useEffect(() => {
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>('[data-reveal-id]')
    );
    if (elements.length === 0) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion || typeof IntersectionObserver === 'undefined') {
      const allRevealed: Record<string, boolean> = {};
      elements.forEach((el) => {
        const id = el.dataset.revealId;
        if (id) allRevealed[id] = true;
      });
      setRevealedIds(allRevealed);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        setRevealedIds((prev) => {
          let changed = false;
          const next = { ...prev };
          for (const entry of entries) {
            if (entry.isIntersecting) {
              const id = (entry.target as HTMLElement).dataset.revealId;
              if (id && !next[id]) {
                next[id] = true;
                changed = true;
              }
              observer.unobserve(entry.target);
            }
          }
          return changed ? next : prev;
        });
      },
      {
        threshold: 0.14,
        rootMargin: '0px 0px -48px 0px',
      }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Keyboard shortcut 'H' to collapse/expand bottom 3D studio dock
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.key === 'h' || e.key === 'H') &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName || '')
      ) {
        setDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleAddManualItem = (name: string) => {
    const newItem: CartItem = {
      id: `manual-${generateUid()}`,
      sku: 'SOB-DEMANDA',
      name,
      oem: '',
      category: 'Cotação Sob Demanda',
      system: 'Solicitação Manual',
      application:
        formatVehicleIdentification(vehicleInfo) || 'Especificação informada pelo cliente',
      stock: 1,
      demo: false,
      quantity: 1,
      manual: true,
    };
    setCart((prev) => [...prev, newItem]);
    showToast('Peça incluída na sua lista de cotação.');
  };

  const handleUpdateCartQuantity = (index: number, quantity: number) => {
    setCart((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, quantity } : item))
    );
  };

  const handleRemoveCartItem = (index: number) => {
    setCart((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleOpenCart = useCallback(() => {
    setManualOrbit(false);
    setIsCartOpen(false);
    const section = document.getElementById('catalogo');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    window.setTimeout(() => {
      const firstInput =
        document.querySelector<HTMLInputElement>('#section-customer') ||
        document.querySelector<HTMLTextAreaElement>('#section-notes');
      firstInput?.focus({ preventScroll: true });
    }, 350);
  }, []);

  const handleToggleAccessibility = useCallback(() => {
    setAccessibilityMode((prev) => {
      const next = !prev;
      showToast(
        next
          ? 'Modo de Acessibilidade ativado: alto contraste e fonte ampliada.'
          : 'Modo de Acessibilidade desativado.'
      );
      return next;
    });
  }, [showToast]);

  const handleExitManualOrbit = useCallback(() => {
    setManualOrbit(false);
  }, []);

  const handleTelemetryChange = useCallback((next: SceneTelemetry) => {
    setTelemetry((prev) => {
      if (
        prev.fps === next.fps &&
        prev.stageLabel === next.stageLabel &&
        prev.angleTitle === next.angleTitle &&
        prev.explosionPct === next.explosionPct &&
        prev.webglActive === next.webglActive
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  const handleSaveOrder = useCallback((order: OrderRecord) => {
    return dataSync.saveOrder(order);
  }, []);

  const handleFocusSubsystemFromCatalog = useCallback((sub: SubsystemId) => {
    setFocusedSubsystem(sub);
    if (sub === 'all') setExplosionOverride(null);
  }, []);

  const totalCartItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div
      className="min-h-screen relative text-slate-100"
      data-scroll-stage={telemetry.stageLabel}
      data-explosion-pct={telemetry.explosionPct}
    >
      <a
        href="#catalogo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-slate-950 font-mono text-xs"
      >
        Pular para o formulário de orçamento
      </a>

      {/* Persistent Full-Site Interactive 3D Canvas */}
      <FullSiteScene3D
        scrollProgress={scrollProgress}
        focusedSubsystem={focusedSubsystem}
        explosionOverride={explosionOverride}
        wireframe={wireframe}
        manualOrbit={manualOrbit}
        onExitManualOrbit={handleExitManualOrbit}
        onTelemetryChange={handleTelemetryChange}
      />

      {/* Top Navigation Bar */}
      <Navbar
        cartCount={totalCartItems}
        onOpenCart={handleOpenCart}
        accessibilityMode={accessibilityMode}
        onToggleAccessibility={handleToggleAccessibility}
      />

      <main className="relative z-10">
        {/* SECTION 01: PRESENÇA (HERO) */}
        <section
          id="presenca"
          className="min-h-svh pt-20 sm:pt-28 pb-12 sm:pb-16 flex flex-col justify-between relative"
        >
          <div className="max-w-[1360px] mx-auto px-4 sm:px-6 w-full my-auto">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center">
              {/* Left Column: High-Impact Industrial Proposition */}
              <div className="liquid-glass lg:col-span-7 space-y-5 sm:space-y-6 border border-white/18 p-5 sm:p-10">
                <div className="font-mono text-[11px] sm:text-xs text-[#ea580c] tracking-wider leading-relaxed">
                  TEM DE TUDO AUTO PEÇAS E SERVIÇOS LTDA · DESDE 2024 · TODO O BRASIL
                </div>

                <h1 className="font-display text-3xl sm:text-5xl xl:text-6xl font-bold text-white leading-[1.08] sm:leading-[1.06] text-balance">
                  Peças automotivas para{' '}
                  <span className="text-[#ea580c]">caminhões, tratores,</span>{' '}
                  utilitários e linha leve.
                </h1>

                <p className="text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
                  Especialistas no fornecimento sob demanda para Linha Diesel,
                  Pesados e Leves: Ônibus, Caminhões, Tratores, Guindastes,
                  Embarcações, Motoniveladoras, Máquinas Agrícolas, Pick-ups e
                  Utilitários. Solicite pelo site ou fale direto no WhatsApp.
                </p>

                <div className="pt-1 sm:pt-2 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 sm:gap-3.5">
                  <a
                    href="#catalogo"
                    className="w-full sm:w-auto min-h-[46px] inline-flex items-center justify-center gap-2.5 px-5 sm:px-6 py-3.5 sm:py-4 bg-[#10b981] hover:bg-[#34d399] text-[#03251b] font-mono text-xs font-bold tracking-wider text-center transition-colors sm:whitespace-nowrap"
                  >
                    <span>FAZER ORÇAMENTO PELO SITE</span>
                    <ArrowUpRight className="w-4 h-4 shrink-0" />
                  </a>

                  <a
                    href={buildDirectQuoteWhatsAppUrl('Botão Principal do Topo')}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="hero-whatsapp-cta"
                    className="animate-whatsapp-pulse w-full sm:w-auto min-h-[46px] inline-flex items-center justify-center gap-2.5 px-4 sm:px-6 py-3.5 sm:py-4 bg-[#0a1931] hover:bg-[#162a4a] text-white border border-[#10b981]/60 font-mono text-xs font-semibold tracking-wider text-center transition-colors sm:whitespace-nowrap"
                  >
                    <MessageSquare className="w-4 h-4 text-[#10b981] shrink-0" />
                    <span>ORÇAR DIRETO NO WHATSAPP {WHATSAPP_DISPLAY}</span>
                  </a>
                </div>

                <div className="pt-4 border-t border-white/10 flex flex-wrap items-center gap-x-4 sm:gap-x-6 gap-y-2 font-mono text-[11px] sm:text-xs text-slate-400">
                  <span>WhatsApp Direto: {WHATSAPP_DISPLAY}</span>
                  <span aria-hidden="true" className="hidden sm:inline">·</span>
                  <span>Prensagem de Mangueiras 2SN / 4SH</span>
                  <span aria-hidden="true" className="hidden sm:inline">·</span>
                  <span>Envio Nacional com NF</span>
                </div>
              </div>

              {/* Right Column: Unobstructed Viewport Window for the Full-Site 3D Model */}
              <div className="lg:col-span-5 flex flex-col items-stretch sm:items-end justify-end min-h-[220px] sm:min-h-[320px] lg:min-h-[500px] pointer-events-none">
                <div className="liquid-glass-sub pointer-events-auto border border-white/20 p-4 sm:max-w-xs w-full space-y-2.5">
                  <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-slate-400">
                    <span className="text-[#ea580c] font-semibold">CONJUNTO M-02 ATIVO</span>
                    <span>{telemetry.fps} FPS</span>
                  </div>
                  <div className="font-mono text-xs text-white truncate">
                    {telemetry.angleTitle}
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10 font-mono text-[11px]">
                    <span className="text-slate-400">
                      Separação Axial: {telemetry.explosionPct}%
                    </span>
                    <a
                      href="#spotlight"
                      className="text-[#60a5fa] hover:text-white underline underline-offset-4 shrink-0"
                    >
                      Estúdio 360° ↗
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Full-width 4-Column Industrial Spec Strip below Hero Split */}
          <div className="max-w-[1360px] mx-auto px-4 sm:px-6 w-full mt-8 sm:mt-12">
            <div className="liquid-glass grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-white/18">
              <div className="p-4 sm:p-5 border-b border-white/15 sm:border-r lg:border-b-0">
                <div className="font-mono text-xs text-[#ea580c]">01. LINHA PESADA</div>
                <div className="font-display text-sm sm:text-base font-semibold text-white mt-1">
                  Diesel, Caminhões & Ônibus
                </div>
              </div>
              <div className="p-4 sm:p-5 border-b border-white/15 lg:border-r lg:border-b-0">
                <div className="font-mono text-xs text-[#ea580c]">02. LINHA AMARELA</div>
                <div className="font-display text-sm sm:text-base font-semibold text-white mt-1">
                  Tratores, Guindastes & Agrícolas
                </div>
              </div>
              <div className="p-4 sm:p-5 border-b border-white/15 sm:border-b-0 sm:border-r">
                <div className="font-mono text-xs text-[#ea580c]">03. HIDRÁULICA</div>
                <div className="font-display text-sm sm:text-base font-semibold text-white mt-1">
                  Mangueiras de Alta Pressão & JIC
                </div>
              </div>
              <div className="p-4 sm:p-5">
                <div className="font-mono text-xs text-[#ea580c]">04. LEVES, UTILITÁRIOS & MARÍTIMO</div>
                <div className="font-display text-sm sm:text-base font-semibold text-white mt-1">
                  Carros, Pick-ups, Vans & Embarcações
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TRUST BADGES SECTION BELOW HERO */}
        <section
          id="selos-confianca"
          data-testid="trust-badges-section"
          aria-label="Selos de confiança e garantias operacionais"
          className="relative z-10 pb-8"
        >
          <div className="max-w-[1360px] mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
              <article
                data-reveal-id="trust-badge-1"
                data-revealed={revealedIds['trust-badge-1'] ? 'true' : 'false'}
                className={`liquid-glass group p-6 border border-white/18 hover:border-[#10b981] hover:shadow-[0_0_26px_-4px_rgba(16,185,129,0.45),inset_0_0_16px_-8px_rgba(16,185,129,0.3)] hover:-translate-y-0.5 flex items-start gap-4 transition-all duration-300 ease-out delay-0 ${
                  revealedIds['trust-badge-1']
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-6'
                }`}
              >
                <div className="w-11 h-11 shrink-0 bg-[#08221e]/90 border border-[#10b981]/40 group-hover:border-[#10b981] group-hover:shadow-[0_0_14px_rgba(16,185,129,0.45)] flex items-center justify-center text-[#10b981] transition-all duration-300">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="space-y-1.5">
                  <div className="font-mono text-[11px] text-[#10b981] tracking-wider">
                    GARANTIA COMERCIAL · NF-E
                  </div>
                  <h2 className="font-display text-lg font-bold text-white">
                    Pagamento Seguro
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Negociação transparente, faturamento corporativo e emissão de
                    Nota Fiscal em todas as cotações para sua empresa ou oficina.
                  </p>
                </div>
              </article>

              <article
                data-reveal-id="trust-badge-2"
                data-revealed={revealedIds['trust-badge-2'] ? 'true' : 'false'}
                className={`liquid-glass group p-6 border border-white/18 hover:border-[#ea580c] hover:shadow-[0_0_26px_-4px_rgba(234,88,12,0.45),inset_0_0_16px_-8px_rgba(234,88,12,0.3)] hover:-translate-y-0.5 flex items-start gap-4 transition-all duration-300 ease-out delay-100 ${
                  revealedIds['trust-badge-2']
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-6'
                }`}
              >
                <div className="w-11 h-11 shrink-0 bg-[#261209]/90 border border-[#ea580c]/40 group-hover:border-[#ea580c] group-hover:shadow-[0_0_14px_rgba(234,88,12,0.45)] flex items-center justify-center text-[#ea580c] transition-all duration-300">
                  <Truck className="w-5 h-5" />
                </div>
                <div className="space-y-1.5">
                  <div className="font-mono text-[11px] text-[#ea580c] tracking-wider">
                    LOGÍSTICA RÁPIDA · TODO O BRASIL
                  </div>
                  <h2 className="font-display text-lg font-bold text-white">
                    Envio Nacional
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Despacho ágil para todas as regiões do país com embalagem
                    reforçada e rastreamento para reduzir o tempo de máquina parada.
                  </p>
                </div>
              </article>

              <article
                data-reveal-id="trust-badge-3"
                data-revealed={revealedIds['trust-badge-3'] ? 'true' : 'false'}
                className={`liquid-glass group p-6 border border-white/18 hover:border-[#60a5fa] hover:shadow-[0_0_26px_-4px_rgba(96,165,250,0.45),inset_0_0_16px_-8px_rgba(96,165,250,0.3)] hover:-translate-y-0.5 flex items-start gap-4 transition-all duration-300 ease-out delay-200 ${
                  revealedIds['trust-badge-3']
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-6'
                }`}
              >
                <div className="w-11 h-11 shrink-0 bg-[#091c3a]/90 border border-[#60a5fa]/40 group-hover:border-[#60a5fa] group-hover:shadow-[0_0_14px_rgba(96,165,250,0.45)] flex items-center justify-center text-[#60a5fa] transition-all duration-300">
                  <Headset className="w-5 h-5" />
                </div>
                <div className="space-y-1.5">
                  <div className="font-mono text-[11px] text-[#60a5fa] tracking-wider">
                    PRECISÃO OEM · ATENDIMENTO DIRETO
                  </div>
                  <h2 className="font-display text-lg font-bold text-white">
                    Suporte Técnico Especializado
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Especialistas prontos para validar referências OEM, medidas de
                    prensagem 2SN/4SH e compatibilidade pelo chassi ou motor.
                  </p>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* SECTION 02: COTAÇÃO & ORÇAMENTO SOB DEMANDA */}
        <CatalogSection
          onSaveOrder={handleSaveOrder}
          onToast={showToast}
          onFocusSubsystem={handleFocusSubsystemFromCatalog}
          focusedSubsystem={focusedSubsystem}
          vehicleInfo={vehicleInfo}
          onUpdateVehicleInfo={setVehicleInfo}
        />

        {/* SECTION 03: ENGENHARIA & LINHAS (SCROLL EXPLODED ANATOMY) */}
        <section id="engenharia" className="py-16 sm:py-24 lg:py-28 scroll-mt-16 sm:scroll-mt-20 relative">
          <div className="max-w-[1360px] mx-auto px-4 sm:px-6 space-y-8 sm:space-y-12">
            <div
              data-reveal-id="eng-header"
              data-revealed={revealedIds['eng-header'] ? 'true' : 'false'}
              className={`liquid-glass grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-8 items-end border border-white/18 p-5 sm:p-10 transition-all duration-700 ease-out ${
                revealedIds['eng-header']
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-8'
              }`}
            >
              <div className="lg:col-span-6 space-y-2.5 sm:space-y-3">
                <div className="font-mono text-xs text-[#ea580c] tracking-wider">
                  03. Engenharia & Subsistemas
                </div>
                <h2 className="font-display text-2xl sm:text-5xl font-bold text-white leading-tight text-balance">
                  Quem entende, mantém em{' '}
                  <span className="text-[#ea580c]">movimento.</span>
                </h2>
              </div>
              <div className="lg:col-span-6">
                <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                  Conforme você navega pela página, o conjunto mecânico 3D se
                  expande em vista explodida. Selecione qualquer subsistema
                  abaixo para dar zoom macro diretamente no componente 3D.
                </p>
              </div>
            </div>

            {/* Open Viewport Corridor so the user can admire the Exploded 3D Model mid-scroll */}
            <div className="min-h-[240px] sm:min-h-[360px] lg:min-h-[400px] flex flex-col sm:flex-row sm:items-end justify-end sm:justify-between gap-3 p-4 sm:p-6 border border-white/10 bg-gradient-to-t from-[#030614]/90 via-transparent to-transparent pointer-events-none">
              <div className="pointer-events-auto space-y-1">
                <div className="font-mono text-[11px] sm:text-xs text-[#ea580c]">
                  ANATOMIA DO MOVIMENTO · VISTA EXPLODIDA AUTOMÁTICA NO SCROLL
                </div>
                <div className="font-mono text-xs text-slate-300">
                  Clique em um subsistema abaixo para aproximar a câmera 3D:
                </div>
              </div>
              {focusedSubsystem !== 'all' && (
                <button
                  type="button"
                  onClick={() => {
                    setFocusedSubsystem('all');
                    setExplosionOverride(null);
                  }}
                  className="pointer-events-auto self-start sm:self-auto min-h-[40px] px-4 py-2 bg-[#ea580c] text-white font-mono text-xs font-semibold cursor-pointer"
                >
                  Restaurar Câmera Geral
                </button>
              )}
            </div>

            {/* Interactive 4-Subsystem Engineering Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              {(
                [
                  {
                    id: 'engine' as SubsystemId,
                    index: '01. MOTOR DIESEL',
                    title: 'Pistões, Camisas & Kits',
                    desc: 'Pistões usinados em liga leve, anéis de segmento, bronzinas, juntas e filtros para motores OM, Cummins, MWM e Perkins.',
                    delayClass: 'delay-0',
                  },
                  {
                    id: 'brake' as SubsystemId,
                    index: '02. SISTEMAS DE FREIO',
                    title: 'Discos, Pinças & Válvulas',
                    desc: 'Discos ventilados e perfurados, pastilhas, pinças de alto torque, cuícas e válvulas pneumáticas para frenagem segura.',
                    delayClass: 'delay-100',
                  },
                  {
                    id: 'transmission' as SubsystemId,
                    index: '03. TRANSMISSÃO',
                    title: 'Engrenagens & Eixos',
                    desc: 'Engrenagens helicoidais, eixos estriados, rolamentos cônicos, embreagens e kits de relação de aço temperado.',
                    delayClass: 'delay-200',
                  },
                  {
                    id: 'spring' as SubsystemId,
                    index: '04. HIDRÁULICA & SUSPENSÃO',
                    title: 'Mangueiras 2SN & Amortecedores',
                    desc: 'Mangueiras hidráulicas de dupla trama de aço, terminais prensáveis JIC 37°, bombas de engrenagem e amortecedores pesados.',
                    delayClass: 'delay-300',
                  },
                ]
              ).map((card) => {
                const isActive = focusedSubsystem === card.id;
                const revealKey = `eng-card-${card.id}`;
                const isRevealed = Boolean(revealedIds[revealKey]);
                return (
                  <article
                    key={card.id}
                    data-reveal-id={revealKey}
                    data-revealed={isRevealed ? 'true' : 'false'}
                    className={`liquid-glass p-6 border flex flex-col justify-between gap-5 transition-all duration-700 ease-out ${
                      card.delayClass
                    } ${
                      isRevealed
                        ? 'opacity-100 translate-y-0'
                        : 'opacity-0 translate-y-8'
                    } ${
                      isActive
                        ? 'border-[#ea580c] shadow-[0_0_28px_-4px_rgba(234,88,12,0.5)]'
                        : 'border-white/18 hover:border-white/35 hover:-translate-y-1'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="font-mono text-xs text-[#ea580c]">{card.index}</div>
                      <h3 className="font-display text-xl font-bold text-white">
                        {card.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                        {card.desc}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setFocusedSubsystem((prev) => (prev === card.id ? 'all' : card.id))
                      }
                      className={`w-full py-2.5 px-3 font-mono text-xs border transition-colors ${
                        isActive
                          ? 'bg-[#ea580c] text-white border-[#ea580c] font-bold'
                          : 'bg-[#0a1931] text-slate-200 border-white/15 hover:border-[#ea580c]'
                      }`}
                    >
                      {isActive ? 'Subsistema em Foco (Resetar)' : 'Dar Zoom 3D neste Subsistema'}
                    </button>
                  </article>
                );
              })}
            </div>

            {/* Operational Advantages */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <article
                data-reveal-id="eng-adv-1"
                data-revealed={revealedIds['eng-adv-1'] ? 'true' : 'false'}
                className={`p-7 liquid-glass border border-[#2563eb]/40 hover:border-[#60a5fa]/70 space-y-3 transition-all duration-700 ease-out delay-100 ${
                  revealedIds['eng-adv-1']
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-8'
                }`}
              >
                <div className="font-mono text-xs text-[#60a5fa]">
                  01. CONFIANÇA EM CADA COMPONENTE
                </div>
                <h3 className="font-display text-2xl font-bold text-white">
                  Garantia de Fábrica e Procedência
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Trabalhamos exclusivamente com componentes testados e fornecedores
                  homologados para garantir durabilidade extrema em operações
                  severas. Todas as peças acompanham nota fiscal.
                </p>
              </article>

              <article
                data-reveal-id="eng-adv-2"
                data-revealed={revealedIds['eng-adv-2'] ? 'true' : 'false'}
                className={`p-7 liquid-glass border border-[#ea580c]/40 hover:border-[#ea580c]/80 space-y-3 transition-all duration-700 ease-out delay-200 ${
                  revealedIds['eng-adv-2']
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-8'
                }`}
              >
                <div className="font-mono text-xs text-[#fdba74]">
                  02. SUA OPERAÇÃO NÃO PODE PARAR
                </div>
                <h3 className="font-display text-2xl font-bold text-white">
                  Integração Direta com Gestão e WhatsApp
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Sabemos que caminhão ou máquina parada é prejuízo. Seu orçamento
                  chega na hora em nossa central de gestão e nossa equipe técnica
                  retorna rapidamente no WhatsApp {WHATSAPP_DISPLAY}.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* SECTION 04: SPOTLIGHT 3D STUDIO (100% Unobstructed Center + Collapsible Bottom Dock) */}
        <section
          id="spotlight"
          className="min-h-svh py-16 sm:py-24 flex flex-col justify-between relative border-y border-white/12 scroll-mt-16"
        >
          {/* Minimal Top Spec Header */}
          <div className="max-w-[1360px] mx-auto px-4 sm:px-6 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 liquid-glass border border-white/18 p-5 sm:p-6">
              <div>
                <div className="font-mono text-xs text-[#ea580c]">
                  04. Estúdio de Inspeção 3D Interativo
                </div>
                <h2 className="font-display text-2xl sm:text-4xl font-bold text-white mt-1">
                  Engenharia em Outra Dimensão.
                </h2>
              </div>
              <div className="font-mono text-[11px] sm:text-xs text-slate-300 space-y-1 sm:text-right">
                <div>ESTÁGIO: {telemetry.stageLabel}</div>
                <div className="text-slate-400">
                  EXPLOSÃO: {telemetry.explosionPct}% · {telemetry.fps} FPS TARGET
                </div>
              </div>
            </div>
          </div>

          {/* 100% Unobstructed Central 3D Viewport Area */}
          <div className="my-auto min-h-[260px] sm:min-h-[420px] pointer-events-none" />

          {/* Unified Collapsible Bottom Control Dock */}
          <div className="max-w-[960px] mx-auto px-3.5 sm:px-4 w-full z-30">
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setDockCollapsed((prev) => !prev)}
                className="min-h-[38px] inline-flex items-center gap-2 px-3.5 sm:px-4 py-1.5 bg-[#071326] border border-b-0 border-white/20 font-mono text-[11px] sm:text-xs text-slate-300 hover:text-white cursor-pointer"
              >
                {dockCollapsed ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5 text-[#ea580c] shrink-0" />
                    <span>Mostrar Controles 3D</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5 text-[#ea580c] shrink-0" />
                    <span>Ocultar Controles 3D (Modo Cinema)</span>
                  </>
                )}
              </button>
            </div>

            {!dockCollapsed && (
              <div
                role="group"
                aria-label="Controles do Estúdio 3D"
                className="liquid-glass border border-white/25 p-3.5 sm:p-5 shadow-2xl space-y-4"
              >
                <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center gap-2 sm:gap-2.5">
                  <button
                    type="button"
                    id="manual-control"
                    aria-pressed={manualOrbit}
                    onClick={() => setManualOrbit((prev) => !prev)}
                    className={`w-full sm:w-auto min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2.5 font-mono text-xs font-semibold border transition-colors cursor-pointer ${
                      manualOrbit
                        ? 'bg-[#10b981] text-[#03251b] border-[#10b981]'
                        : 'bg-[#ea580c] hover:bg-[#f97316] text-white border-[#ea580c]'
                    }`}
                  >
                    <Compass className="w-4 h-4 shrink-0" />
                    <span>
                      {manualOrbit
                        ? 'DESATIVAR ÓRBITA 360° MANUAL'
                        : 'ATIVAR CONTROLE MANUAL 360°'}
                    </span>
                  </button>

                  <div className="grid grid-cols-1 xs:grid-cols-3 sm:flex sm:flex-wrap gap-2">
                    <button
                      type="button"
                      id="assembled"
                      aria-pressed={explosionOverride === 0}
                      onClick={() => {
                        setFocusedSubsystem('all');
                        setExplosionOverride(0);
                      }}
                      className={`min-h-[40px] inline-flex items-center justify-center gap-2 px-3.5 py-2 font-mono text-xs border transition-colors whitespace-nowrap cursor-pointer ${
                        explosionOverride === 0
                          ? 'bg-[#162a4a] text-white border-[#ea580c]'
                          : 'bg-[#0a1931] text-slate-300 border-white/15 hover:border-white/30'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5 shrink-0" />
                      <span>Visão Montada</span>
                    </button>

                    <button
                      type="button"
                      id="exploded"
                      aria-pressed={explosionOverride === 1}
                      onClick={() => {
                        setFocusedSubsystem('all');
                        setExplosionOverride(1);
                      }}
                      className={`min-h-[40px] inline-flex items-center justify-center gap-2 px-3.5 py-2 font-mono text-xs border transition-colors whitespace-nowrap cursor-pointer ${
                        explosionOverride === 1
                          ? 'bg-[#162a4a] text-white border-[#ea580c]'
                          : 'bg-[#0a1931] text-slate-300 border-white/15 hover:border-white/30'
                      }`}
                    >
                      <Maximize2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Vista Explodida</span>
                    </button>

                    <button
                      type="button"
                      id="wireframe"
                      aria-pressed={wireframe}
                      onClick={() => setWireframe((prev) => !prev)}
                      className={`min-h-[40px] inline-flex items-center justify-center gap-2 px-3.5 py-2 font-mono text-xs border transition-colors whitespace-nowrap cursor-pointer ${
                        wireframe
                          ? 'bg-[#162a4a] text-white border-[#ea580c]'
                          : 'bg-[#0a1931] text-slate-300 border-white/15 hover:border-white/30'
                      }`}
                    >
                      <Grid className="w-3.5 h-3.5 shrink-0" />
                      <span>Modo Wireframe</span>
                    </button>
                  </div>
                </div>

                {/* Continuous Explosion Slider + Camera Subsystem Selector */}
                <div className="pt-3 border-t border-white/10 grid grid-cols-1 sm:grid-cols-12 gap-3.5 sm:gap-4 items-center">
                  <div className="sm:col-span-5 flex items-center gap-3">
                    <label
                      htmlFor="explosion-slider"
                      className="font-mono text-xs text-slate-300 whitespace-nowrap"
                    >
                      Explosão ({telemetry.explosionPct}%):
                    </label>
                    <input
                      id="explosion-slider"
                      type="range"
                      min={0}
                      max={100}
                      value={
                        explosionOverride !== null
                          ? Math.round(explosionOverride * 100)
                          : telemetry.explosionPct
                      }
                      onChange={(e) => setExplosionOverride(Number(e.target.value) / 100)}
                      className="w-full accent-[#ea580c] cursor-pointer"
                    />
                  </div>

                  <div className="sm:col-span-7 flex flex-wrap items-center justify-center sm:justify-end gap-1.5">
                    {(
                      [
                        ['all', 'Câmera Scroll'],
                        ['brake', 'Freio'],
                        ['engine', 'Pistão'],
                        ['transmission', 'Transmissão'],
                        ['spring', 'Suspensão'],
                      ] as [SubsystemId, string][]
                    ).map(([subId, label]) => (
                      <button
                        key={subId}
                        type="button"
                        onClick={() => {
                          setFocusedSubsystem(subId);
                          if (subId === 'all') setExplosionOverride(null);
                        }}
                        className={`min-h-[36px] px-2.5 py-1.5 font-mono text-[11px] border transition-colors whitespace-nowrap cursor-pointer ${
                          focusedSubsystem === subId && (subId !== 'all' || explosionOverride === null)
                            ? 'bg-[#ea580c] text-white border-[#ea580c] font-semibold'
                            : 'bg-[#091529] text-slate-300 border-white/12 hover:border-white/30'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <p
                  id="inspection-help"
                  className="text-center font-mono text-[11px] text-slate-400 leading-relaxed"
                >
                  {manualOrbit
                    ? 'Arraste para girar em 360° e use o scroll/pinça para zoom. Pressione ESC ou clique no botão superior para voltar ao scroll da página.'
                    : 'Role a página para ver a coreografia 3D automática ou ative o controle manual 360° para inspecionar cada detalhe.'}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* SECTION 05: FLUXO DE ATENDIMENTO & WHATSAPP DIRETO */}
        <section id="cotacao" className="py-16 sm:py-24 lg:py-28 bg-[#040b18]/92 relative scroll-mt-16 sm:scroll-mt-20">
          <div className="max-w-[1360px] mx-auto px-4 sm:px-6 space-y-10 sm:space-y-14">
            <div
              data-reveal-id="cotacao-header"
              data-revealed={revealedIds['cotacao-header'] ? 'true' : 'false'}
              className={`flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-8 border-b border-white/12 transition-all duration-700 ease-out ${
                revealedIds['cotacao-header']
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-8'
              }`}
            >
              <div className="space-y-2.5 sm:space-y-3">
                <div className="font-mono text-xs text-[#ea580c] tracking-wider">
                  05. Atendimento Técnico & Acompanhamento no WhatsApp
                </div>
                <h2 className="font-display text-2xl sm:text-5xl font-bold text-white leading-tight text-balance">
                  Menos tempo parado.{' '}
                  <span className="text-[#10b981]">Mais estrada.</span>
                </h2>
              </div>

              <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 w-full lg:w-auto">
                <a
                  href="#catalogo"
                  className="w-full sm:w-auto min-h-[46px] inline-flex items-center justify-center gap-2.5 px-5 sm:px-6 py-3.5 sm:py-4 bg-[#10b981] hover:bg-[#34d399] text-[#03251b] font-mono text-xs font-bold tracking-wider text-center transition-colors sm:whitespace-nowrap"
                >
                  <span>PREENCHER COTAÇÃO NO SITE</span>
                  <ArrowUpRight className="w-4 h-4 shrink-0" />
                </a>

                <a
                  href={buildDirectQuoteWhatsAppUrl('Seção 05 - Atendimento Direto')}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="section5-whatsapp-cta"
                  className="animate-whatsapp-pulse w-full sm:w-auto min-h-[46px] inline-flex items-center justify-center gap-2.5 px-4 sm:px-6 py-3.5 sm:py-4 bg-[#0a1931] hover:bg-[#162a4a] text-white border border-[#10b981]/60 font-mono text-xs font-medium tracking-wider text-center transition-colors sm:whitespace-nowrap"
                >
                  <MessageSquare className="w-4 h-4 text-[#10b981] shrink-0" />
                  <span>FAZER ORÇAMENTO NO WHATSAPP {WHATSAPP_DISPLAY}</span>
                  <ArrowUpRight className="w-4 h-4 text-[#10b981] shrink-0" />
                </a>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-8">
              <article
                data-reveal-id="cotacao-card-1"
                data-revealed={revealedIds['cotacao-card-1'] ? 'true' : 'false'}
                className={`space-y-3 p-6 liquid-glass hover:border-[#ea580c]/50 hover:-translate-y-1 transition-all duration-700 ease-out delay-0 ${
                  revealedIds['cotacao-card-1']
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-8'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-2xl font-bold text-[#ea580c]">01.</span>
                  <Wrench className="w-5 h-5 text-slate-400" />
                </div>
                <h3 className="font-display text-xl font-bold text-white">
                  Solicite pelo Site ou WhatsApp
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Informe seu veículo (modelo, ano, placa ou chassi) e a peça que
                  procura no formulário acima, ou clique em qualquer botão de
                  WhatsApp para fazer seu orçamento direto com nossa equipe.
                </p>
              </article>

              <article
                data-reveal-id="cotacao-card-2"
                data-revealed={revealedIds['cotacao-card-2'] ? 'true' : 'false'}
                className={`space-y-3 p-6 liquid-glass hover:border-[#ea580c]/50 hover:-translate-y-1 transition-all duration-700 ease-out delay-150 ${
                  revealedIds['cotacao-card-2']
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-8'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-2xl font-bold text-[#ea580c]">02.</span>
                  <FileText className="w-5 h-5 text-slate-400" />
                </div>
                <h3 className="font-display text-xl font-bold text-white">
                  Recebimento na Central de Gestão
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Sua cotação chega instantaneamente ao nosso sistema secundário de
                  gestão, que dispara automaticamente os dados da sua peça para o
                  WhatsApp da nossa equipe técnica.
                </p>
              </article>

              <article
                data-reveal-id="cotacao-card-3"
                data-revealed={revealedIds['cotacao-card-3'] ? 'true' : 'false'}
                className={`space-y-3 p-6 liquid-glass hover:border-[#ea580c]/50 hover:-translate-y-1 transition-all duration-700 ease-out delay-300 ${
                  revealedIds['cotacao-card-3']
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-8'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-2xl font-bold text-[#ea580c]">03.</span>
                  <Truck className="w-5 h-5 text-slate-400" />
                </div>
                <h3 className="font-display text-xl font-bold text-white">
                  Acompanhamento no {WHATSAPP_DISPLAY}
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Você vê na tela a confirmação de que o orçamento chegou e pode
                  acompanhar o atendimento a qualquer momento pelo nosso WhatsApp{' '}
                  {WHATSAPP_DISPLAY}.
                </p>
              </article>
            </div>
          </div>
        </section>
      </main>

      {/* QUIET FOOTER */}
      <footer className="relative z-10 bg-[#020510] border-t border-white/12 py-12 sm:py-14">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-10 pb-8 sm:pb-10 border-b border-white/10">
            <div className="space-y-3">
              <a
                href="#presenca"
                className="font-display text-xl font-bold text-white tracking-tight"
              >
                TEM DE TUDO
              </a>
              <p className="text-xs font-mono text-slate-400">
                TEM DE TUDO AUTO PEÇAS E SERVIÇOS LTDA
              </p>
              <p className="text-sm text-slate-300">
                Linha diesel, pesados, máquinas agrícolas, utilitários, linha
                leve e embarcações. Peças sob demanda para todo o Brasil.
              </p>
            </div>

            <div className="space-y-2.5 text-sm">
              <h3 className="font-display text-base font-semibold text-white">
                Canais de Atendimento e Cotação
              </h3>
              <a
                href={buildDirectQuoteWhatsAppUrl('Rodapé do Site')}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-[#34d399] hover:underline font-mono text-xs break-words"
              >
                WhatsApp Orçamentos: {WHATSAPP_DISPLAY} (Mensagem Pronta) ↗
              </a>
              <a
                href="tel:+557189521165"
                className="block text-slate-300 hover:text-white font-mono text-xs"
              >
                Central: {SECONDARY_PHONE_DISPLAY}
              </a>
              <a
                href="tel:+5571987491709"
                className="block text-slate-300 hover:text-white font-mono text-xs"
              >
                Comercial: +55 (71) 98749-1709
              </a>
            </div>

            <div className="space-y-3 text-sm">
              <h3 className="font-display text-base font-semibold text-white">
                Horário de Atendimento
              </h3>
              <p className="text-slate-300 flex items-center gap-2 text-xs font-mono">
                <Clock className="w-4 h-4 text-[#ea580c] shrink-0" />
                <span>Segunda a Sexta, 08:00 às 18:00</span>
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Atendimento especializado sob demanda para frotas, oficinas
                mecânicas, empresas de engenharia e compradores em todo o
                território nacional.
              </p>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 font-mono text-[11px] sm:text-xs text-slate-400 text-center sm:text-left">
            <span>
              © {new Date().getFullYear()} TEM DE TUDO AUTO PEÇAS E SERVIÇOS LTDA
            </span>
            <span>PRECISÃO QUE CONECTA · QUALIDADE QUE MOVE</span>
          </div>
        </div>
      </footer>

      {/* Quote Drawer Modal (Lazy-loaded on demand) */}
      {isCartOpen && (
        <Suspense fallback={null}>
          <QuoteDialog
            isOpen={isCartOpen}
            focusManualInput={focusManualInModal}
            onClose={() => setIsCartOpen(false)}
            cart={cart}
            onUpdateQuantity={handleUpdateCartQuantity}
            onRemoveItem={handleRemoveCartItem}
            onAddManualItem={handleAddManualItem}
            onClearCart={() => setCart([])}
            onSaveOrder={handleSaveOrder}
            onSubmitSolicitacao={(input) => dataSync.submitSolicitacaoOrcamento(input)}
            onToast={showToast}
            vehicleInfo={vehicleInfo}
            onUpdateVehicleInfo={setVehicleInfo}
          />
        </Suspense>
      )}

      {/* Floating Back to Top Button */}
      {showBackToTop && !isCartOpen && (
        <button
          type="button"
          id="back-to-top"
          data-testid="back-to-top-btn"
          aria-label="Voltar ao topo da página"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="group fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 min-h-[42px] inline-flex items-center gap-2 px-3 sm:px-3.5 py-2.5 sm:py-3 bg-[#071326]/95 hover:bg-[#ea580c] text-white border border-[#ea580c]/70 hover:border-[#ea580c] shadow-2xl font-mono text-xs font-bold tracking-wider transition-all cursor-pointer"
        >
          <ArrowUp className="w-4 h-4 text-[#ea580c] group-hover:text-white shrink-0 transition-colors" />
          <span className="hidden sm:inline">Voltar ao Topo</span>
          <span className="sm:hidden">Topo</span>
        </button>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div
          id="toast"
          role="status"
          aria-live="polite"
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-[calc(100vw-2rem)] sm:w-auto max-w-md px-4 sm:px-5 py-3 bg-[#06281e] border border-[#10b981] text-white font-mono text-xs text-center shadow-2xl"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
