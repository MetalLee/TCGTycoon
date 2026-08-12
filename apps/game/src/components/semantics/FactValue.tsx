import type { ReactNode } from "react";

export type FactValueProps = {
  label: string;
  value: ReactNode;
  compact?: boolean;
};

export function FactValue({ label, value, compact = false }: FactValueProps) {
  return (
    <div
      data-semantic="FACT"
      className={
        compact
          ? "min-w-20"
          : "rounded-lg border border-slate-800 bg-slate-900/70 p-4"
      }
    >
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-sky-300">
        <span aria-label="Fact">Fact</span>
        <span className="text-slate-400">{label}</span>
      </div>
      <p
        className={
          compact ? "mt-1 font-semibold" : "mt-3 text-2xl font-semibold"
        }
      >
        {value}
      </p>
    </div>
  );
}
