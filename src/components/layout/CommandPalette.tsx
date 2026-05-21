"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight } from "lucide-react";
import { NAV_GROUPS } from "./nav-items";

const ALL_ITEMS = NAV_GROUPS.flatMap((g) =>
  g.items.map((item) => ({ ...item, group: g.group }))
);

interface Props {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}

export default function CommandPalette({ open, onOpen, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? ALL_ITEMS.filter((item) =>
        item.label.toLowerCase().includes(query.toLowerCase())
      )
    : ALL_ITEMS;

  const closePalette = useCallback(() => {
    onClose();
    setQuery("");
  }, [onClose]);

  const navigate = useCallback(
    (href: string) => {
      closePalette();
      router.push(href);
    },
    [closePalette, router]
  );

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        open ? closePalette() : onOpen();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onOpen, closePalette]);

  useEffect(() => {
    if (open) {
      const id = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(id);
    }
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      closePalette();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[activeIndex]) {
      navigate(filtered[activeIndex].href);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh] bg-black/50 backdrop-blur-sm"
      onClick={closePalette}
    >
      <div
        className="w-full max-w-lg bg-card rounded-xl shadow-2xl overflow-hidden border border-border"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
          <Search size={17} className="text-muted-foreground/70 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Buscar página..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            className="flex-1 text-sm text-foreground placeholder-[#94A3B8] outline-none bg-transparent"
          />
          <kbd className="flex items-center px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground bg-muted rounded border border-border">
            ESC
          </kbd>
        </div>

        {/* Lista */}
        <div className="max-h-80 overflow-y-auto py-1.5">
          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground/70">
              No se encontraron resultados
            </p>
          ) : (
            filtered.map((item, i) => {
              const Icon = item.icon;
              const active = i === activeIndex;
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => navigate(item.href)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    active
                      ? "bg-[#0088D1] text-white"
                      : "text-[#1E293B] hover:bg-muted"
                  }`}
                >
                  <Icon
                    size={16}
                    className={active ? "text-white" : "text-muted-foreground/70"}
                  />
                  <span className="flex-1 text-sm font-medium">{item.label}</span>
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wider ${
                      active ? "text-white/60" : "text-muted-foreground/70"
                    }`}
                  >
                    {item.group}
                  </span>
                  {active && (
                    <ArrowRight size={13} className="text-white/70 shrink-0" />
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-border bg-muted/40">
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
            <kbd className="px-1 py-0.5 bg-card rounded border border-border font-mono text-[10px]">↑↓</kbd>
            navegar
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
            <kbd className="px-1 py-0.5 bg-card rounded border border-border font-mono text-[10px]">↵</kbd>
            ir
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
            <kbd className="px-1.5 py-0.5 bg-card rounded border border-border font-mono text-[10px]">ESC</kbd>
            cerrar
          </span>
        </div>
      </div>
    </div>
  );
}
