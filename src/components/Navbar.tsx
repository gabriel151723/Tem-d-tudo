import React, { useState } from 'react';
import { Menu, X, ShoppingBag, Eye, MessageSquare } from 'lucide-react';
import { buildDirectQuoteWhatsAppUrl } from '../utils/catalogLogic';

interface NavbarProps {
  cartCount: number;
  onOpenCart: () => void;
  accessibilityMode: boolean;
  onToggleAccessibility: () => void;
}

export const Navbar: React.FC<NavbarProps> = React.memo(({
  cartCount: _cartCount,
  onOpenCart,
  accessibilityMode,
  onToggleAccessibility,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { href: '#presenca', label: '01. Presença' },
    { href: '#catalogo', label: '02. Orçamento Sob Demanda' },
    { href: '#engenharia', label: '03. Engenharia' },
    { href: '#spotlight', label: '04. Estúdio 3D' },
    { href: '#cotacao', label: '05. Atendimento' },
  ];

  return (
    <header className="liquid-glass-nav fixed top-0 left-0 right-0 z-30 border-b border-white/15">
      <div className="max-w-[1360px] mx-auto px-3.5 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-2 sm:gap-4 lg:gap-6">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#presenca"
          className="font-display text-base sm:text-xl font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          aria-label="Tem de Tudo Auto Peças e Serviços LTDA — Início"
        >
          TEM DE TUDO
        </a>

        {/* Zone 2: 5 concise single-line text navigation links */}
        <nav
          id="navigation"
          aria-label="Principal"
          className="hidden xl:flex items-center gap-5 2xl:gap-6 font-mono text-xs text-slate-300"
        >
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="hover:text-white hover:underline underline-offset-8 decoration-[#ea580c] transition-colors whitespace-nowrap shrink-0"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Zone 3: Accessibility Mode toggle + WhatsApp Direct + Quote action */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <button
            type="button"
            id="accessibility-toggle"
            data-testid="accessibility-toggle"
            aria-pressed={accessibilityMode}
            aria-label={
              accessibilityMode
                ? 'Desativar Modo de Acessibilidade (Alto Contraste e Fonte Ampliada)'
                : 'Ativar Modo de Acessibilidade (Alto Contraste e Fonte Ampliada)'
            }
            title="Alternar Modo de Acessibilidade: Alto Contraste e Fonte Ampliada para baixa visão"
            onClick={onToggleAccessibility}
            className={`min-h-[40px] sm:min-h-[42px] inline-flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 border font-mono text-xs font-semibold tracking-wider transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              accessibilityMode
                ? 'bg-[#facc15] text-[#030614] border-[#facc15] font-bold'
                : 'bg-[#0a1931] hover:bg-[#162a4a] text-white border-white/25 hover:border-[#facc15]'
            }`}
          >
            <Eye className="w-4 h-4 shrink-0" />
            <span className="hidden lg:inline">
              {accessibilityMode ? 'Acessibilidade: ON (A+)' : 'Modo de Acessibilidade'}
            </span>
            <span className="lg:hidden">A+</span>
          </button>

          <a
            href={buildDirectQuoteWhatsAppUrl('Menu Topo')}
            target="_blank"
            rel="noopener noreferrer"
            className="animate-whatsapp-pulse hidden md:inline-flex min-h-[42px] items-center gap-2 px-3 sm:px-3.5 py-2 bg-[#0a1931] hover:bg-[#162a4a] text-white border border-[#10b981]/50 font-mono text-xs font-semibold tracking-wider transition-colors whitespace-nowrap shrink-0"
          >
            <MessageSquare className="w-4 h-4 text-[#10b981] shrink-0" />
            <span>WhatsApp Direto</span>
          </a>

          <a
            href="#catalogo"
            onClick={(e) => {
              e.preventDefault();
              setMobileOpen(false);
              onOpenCart();
            }}
            data-cart
            className="min-h-[40px] sm:min-h-[42px] inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-[#10b981] hover:bg-[#34d399] text-[#03251b] font-mono text-xs font-semibold tracking-wider transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4 shrink-0" />
            <span>Cotar Peça</span>
          </a>

          <button
            type="button"
            id="menu"
            aria-label={mobileOpen ? 'Fechar menu de navegação' : 'Abrir menu de navegação'}
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="xl:hidden min-h-[40px] min-w-[40px] sm:min-h-[42px] sm:min-w-[42px] inline-flex items-center justify-center p-2 border border-white/15 text-slate-200 hover:text-white hover:border-white/30 transition-colors cursor-pointer"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile & Tablet Navigation Drawer */}
      {mobileOpen && (
        <nav
          id="mobile-navigation"
          aria-label="Menu Mobile"
          className="liquid-glass xl:hidden border-b border-white/20 px-4 sm:px-6 py-4 sm:py-5 max-h-[calc(100svh-4rem)] sm:max-h-[calc(100svh-5rem)] overflow-y-auto flex flex-col gap-3 font-mono text-xs"
        >
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className="py-2.5 text-slate-200 hover:text-white border-b border-white/10 flex items-center justify-between"
            >
              <span>{item.label}</span>
              <span className="text-[#ea580c]">→</span>
            </a>
          ))}
          <a
            href={buildDirectQuoteWhatsAppUrl('Menu Mobile')}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMobileOpen(false)}
            className="animate-whatsapp-pulse py-3 px-4 bg-[#10b981] text-[#03251b] font-mono text-xs font-bold flex flex-wrap items-center justify-between gap-2"
          >
            <span>Fazer Orçamento Direto no WhatsApp</span>
            <span className="whitespace-nowrap">71 98397-8870 ↗</span>
          </a>
          <button
            type="button"
            aria-pressed={accessibilityMode}
            onClick={onToggleAccessibility}
            className={`mt-1 py-3 px-4 border font-mono text-xs font-semibold flex flex-wrap items-center justify-between gap-2 text-left cursor-pointer ${
              accessibilityMode
                ? 'bg-[#facc15] text-[#030614] border-[#facc15] font-bold'
                : 'bg-[#0a1931] text-white border-white/25'
            }`}
          >
            <span>Modo de Acessibilidade (Alto Contraste + Fonte Maior)</span>
            <span className="shrink-0 font-bold">{accessibilityMode ? 'ATIVO' : 'ATIVAR'}</span>
          </button>
        </nav>
      )}
    </header>
  );
});
