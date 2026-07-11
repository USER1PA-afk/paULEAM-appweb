"use client";

import { Minus, Plus } from "lucide-react";

interface QuantityStepperProps {
  value: number;
  /** Máximo permitido (p.ej. cantidad actual + stock disponible restante). */
  max: number;
  min?: number;
  onChange: (quantity: number) => void;
  disabled?: boolean;
}

/**
 * Control −/+ para ajustar cantidades (estilo carrito de e-commerce).
 * Acota el valor entre `min` y `max`; deshabilita los botones en los topes.
 */
export function QuantityStepper({
  value,
  max,
  min = 1,
  onChange,
  disabled = false,
}: QuantityStepperProps) {
  const decrement = () => {
    if (!disabled && value > min) onChange(value - 1);
  };
  const increment = () => {
    if (!disabled && value < max) onChange(value + 1);
  };

  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-background">
      <button
        type="button"
        onClick={decrement}
        disabled={disabled || value <= min}
        aria-label="Disminuir cantidad"
        className="flex h-8 w-8 items-center justify-center rounded-l-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
      >
        <Minus aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
      <span className="min-w-[2.5rem] text-center text-sm font-semibold tabular-nums">
        {value}
      </span>
      <button
        type="button"
        onClick={increment}
        disabled={disabled || value >= max}
        aria-label="Aumentar cantidad"
        className="flex h-8 w-8 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
      >
        <Plus aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
