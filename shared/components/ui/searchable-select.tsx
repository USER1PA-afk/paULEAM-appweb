"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { ChevronDown, Search, X } from "lucide-react";

export interface SearchableOption {
  value: string;
  label: string;
  group?: string;
  /** Short secondary text shown next to the label (e.g. unit, SKU) */
  meta?: string;
}

interface SearchableSelectProps {
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
  emptyMessage?: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Seleccionar...",
  searchPlaceholder = "Escriba para buscar...",
  required,
  disabled,
  className = "",
  id,
  "aria-label": ariaLabel,
  emptyMessage = "Sin resultados",
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [dropUp, setDropUp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const keyboardNav = useRef(false);

  const selectedOption = options.find((o) => o.value === value);

  // Group options
  const groups = useMemo(() => {
    const map = new Map<string | null, SearchableOption[]>();
    for (const opt of options) {
      const key = opt.group ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(opt);
    }
    return map;
  }, [options]);

  // Filter — searches both label and meta
  const filteredGroups = useMemo(() => {
    const q = search.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const result = new Map<string | null, SearchableOption[]>();
    for (const [group, opts] of groups) {
      const filtered = opts.filter((o) => {
        const norm = o.label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const metaNorm = o.meta?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") ?? "";
        return norm.includes(q) || metaNorm.includes(q);
      });
      if (filtered.length > 0) result.set(group, filtered);
    }
    return result;
  }, [groups, search]);

  const flatFiltered = useMemo(() => {
    const arr: SearchableOption[] = [];
    for (const opts of filteredGroups.values()) arr.push(...opts);
    return arr;
  }, [filteredGroups]);

  // Reset highlight when search changes
  useEffect(() => {
    keyboardNav.current = false;
    setHighlightIdx(flatFiltered.length > 0 ? 0 : -1);
  }, [search, flatFiltered.length]);

  // Scroll highlighted item into view — only for keyboard navigation
  useEffect(() => {
    if (keyboardNav.current && highlightIdx >= 0 && listRef.current) {
      const allChildren = Array.from(listRef.current.querySelectorAll('[role="option"]'));
      const item = allChildren[highlightIdx] as HTMLElement | undefined;
      item?.scrollIntoView({ block: "nearest" });
    }
    keyboardNav.current = false;
  }, [highlightIdx]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [open]);

  const openDropdown = useCallback(() => {
    if (disabled) return;
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setDropUp(spaceBelow < 320 && rect.top > 320);
    }
    setOpen(true);
    setSearch("");
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [disabled]);

  const selectValue = useCallback(
    (val: string) => {
      onChange(val);
      setOpen(false);
      setSearch("");
    },
    [onChange]
  );

  const clearValue = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange("");
      setOpen(false);
      setSearch("");
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDropdown();
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          keyboardNav.current = true;
          setHighlightIdx((i) => (i + 1 < flatFiltered.length ? i + 1 : 0));
          break;
        case "ArrowUp":
          e.preventDefault();
          keyboardNav.current = true;
          setHighlightIdx((i) => (i - 1 >= 0 ? i - 1 : flatFiltered.length - 1));
          break;
        case "Enter":
          e.preventDefault();
          if (highlightIdx >= 0 && highlightIdx < flatFiltered.length) {
            selectValue(flatFiltered[highlightIdx].value);
          }
          break;
        case "Escape":
          e.preventDefault();
          setOpen(false);
          setSearch("");
          break;
        case "Tab":
          setOpen(false);
          setSearch("");
          break;
      }
    },
    [open, flatFiltered, highlightIdx, openDropdown, selectValue]
  );

  return (
    <div ref={containerRef} className="relative min-w-0" onKeyDown={handleKeyDown}>
      {/* Trigger button */}
      <button
        type="button"
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        aria-required={required}
        onClick={open ? () => { setOpen(false); setSearch(""); } : openDropdown}
        disabled={disabled}
        className={`flex items-center gap-2 w-full text-left overflow-hidden min-w-0 ${className} ${
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
        }`}
      >
        {selectedOption ? (
          <span className="flex-1 flex items-center gap-1.5 min-w-0">
            <span className="truncate">{selectedOption.label}</span>
            {selectedOption.meta && (
              <span className="shrink-0 text-[10px] font-medium text-muted-foreground bg-muted rounded px-1 py-px">
                {selectedOption.meta}
              </span>
            )}
          </span>
        ) : (
          <span className="flex-1 truncate text-muted-foreground">{placeholder}</span>
        )}
        {value && !disabled && (
          <span
            role="button"
            tabIndex={-1}
            onClick={clearValue}
            className="shrink-0 p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Limpiar selección"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        )}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {/* Hidden input for form validation */}
      {required && (
        <input
          tabIndex={-1}
          value={value}
          onChange={() => {}}
          className="sr-only"
          aria-hidden="true"
          required
        />
      )}

      {/* Dropdown */}
      {open && (
        <div
          className={`absolute z-50 w-full rounded-lg border border-border bg-popover shadow-lg ${
            dropUp ? "bottom-full mb-1" : "mt-1"
          }`}
          role="presentation"
        >
          {/* Search input */}
          <div className="relative border-b border-border px-2.5 py-2">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full h-8 pl-7 pr-3 rounded-md bg-background text-sm outline-none placeholder:text-muted-foreground/60"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>

          {/* Options list — NO truncation, full labels visible */}
          <ul
            ref={listRef}
            role="listbox"
            className="max-h-52 overflow-y-auto overscroll-contain py-1"
          >
            {flatFiltered.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground/60 select-none">
                {emptyMessage}
              </li>
            ) : (
              (() => {
                let idx = -1;
                return Array.from(filteredGroups.entries()).map(([group, opts]) => (
                  <li key={group ?? "__nogroup__"} role="group" aria-label={group ?? undefined}>
                    {group && (
                      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 bg-muted/40 sticky top-0">
                        {group}
                      </div>
                    )}
                    {opts.map((opt) => {
                      idx++;
                      const i = idx;
                      const isSelected = opt.value === value;
                      const isHighlighted = i === highlightIdx;
                      return (
                        <div
                          key={opt.value}
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => selectValue(opt.value)}
                          onPointerEnter={() => {
                            if (!keyboardNav.current) setHighlightIdx(i);
                          }}
                          className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer select-none transition-colors ${
                            isHighlighted ? "bg-accent text-accent-foreground" : ""
                          } ${isSelected ? "font-medium" : ""}`}
                        >
                          <span className="flex-1">{opt.label}</span>
                          {opt.meta && (
                            <span className="shrink-0 text-[10px] text-muted-foreground/70">{opt.meta}</span>
                          )}
                          {isSelected && (
                            <span className="shrink-0 text-brand-600 text-xs">✓</span>
                          )}
                        </div>
                      );
                    })}
                  </li>
                ));
              })()
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
