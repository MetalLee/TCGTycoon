type PlaceholderPageProps = {
  title: string;
};

export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <section>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
        Publisher Workbench
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-4 max-w-xl text-slate-400">
        This workspace will be implemented in its dedicated phase.
      </p>
    </section>
  );
}
