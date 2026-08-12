import type { ReactNode } from "react";

export type EstimateValueProps = {
  label: string;
  value: ReactNode;
  basis: string;
};

export function EstimateValue({ label, value, basis }: EstimateValueProps) {
  return (
    <div
      data-semantic="ESTIMATE"
      className="rounded-lg border border-amber-800/70 bg-amber-950/20 p-4"
    >
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-amber-300">
        <span aria-label="Estimate">Estimate</span>
        <span className="text-slate-400">{label}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
      <p className="mt-2 text-xs text-slate-400">Basis: {basis}</p>
    </div>
  );
}
