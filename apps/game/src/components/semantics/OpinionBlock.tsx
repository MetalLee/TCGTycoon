import type { ReactNode } from "react";

export type OpinionBlockProps = {
  title: string;
  source: string;
  children: ReactNode;
};

export function OpinionBlock({ title, source, children }: OpinionBlockProps) {
  return (
    <blockquote
      data-semantic="OPINION"
      className="rounded-lg border border-fuchsia-900/70 bg-fuchsia-950/20 p-4"
    >
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-fuchsia-300">
        <span aria-label="Opinion">Opinion</span>
        <span className="text-slate-400">{source}</span>
      </div>
      <p className="mt-3 font-semibold">{title}</p>
      <div className="mt-2 text-sm text-slate-300">{children}</div>
    </blockquote>
  );
}
