import { useUiStore, type UiTheme } from "../state/ui-store";

export function SettingsPage() {
  const theme = useUiStore((state) => state.theme);
  const setTheme = useUiStore((state) => state.setTheme);
  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-semibold">Settings</h1>
      <label className="grid max-w-sm gap-2">
        <span>Theme</span>
        <select
          value={theme}
          onChange={(event) => setTheme(event.target.value as UiTheme)}
          className="rounded border border-slate-700 bg-slate-950 px-3 py-2"
        >
          <option value="SYSTEM">System</option>
          <option value="LIGHT">Light</option>
          <option value="DARK">Dark</option>
        </select>
      </label>
      <p className="text-sm text-slate-400">
        UI preferences are separate from deterministic save data.
      </p>
    </section>
  );
}
