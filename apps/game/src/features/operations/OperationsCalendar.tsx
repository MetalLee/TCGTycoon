import type { CalendarItem } from "./operations-model";

export type OperationsCalendarProps = {
  currentDay: number;
  items: readonly CalendarItem[];
};

export function OperationsCalendar({
  currentDay,
  items,
}: OperationsCalendarProps) {
  const grouped = new Map<number, CalendarItem[]>();
  for (const item of items)
    grouped.set(item.day, [...(grouped.get(item.day) ?? []), item]);
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <h2 className="font-semibold">Next 30 days</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">
          No scheduled commitments through Day {currentDay + 30}.
        </p>
      ) : (
        <ol className="mt-4 space-y-3">
          {[...grouped.entries()]
            .sort(([left], [right]) => left - right)
            .map(([day, dayItems]) => (
              <li key={day} className="grid grid-cols-[5rem_1fr] gap-3">
                <span className="text-sm font-semibold text-emerald-300">
                  Day {day}
                </span>
                <ul className="space-y-2">
                  {dayItems.map((item) => (
                    <li
                      key={item.id}
                      className="rounded border border-slate-800 p-2 text-sm"
                    >
                      {item.label}{" "}
                      <span className="text-slate-500">· {item.status}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
        </ol>
      )}
    </section>
  );
}
