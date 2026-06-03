import type { PropsWithChildren, ReactNode } from "react";

export const themeTokens = {
  shell: "bg-[#1e1e1e] text-[#cccccc]",
  panel: "border border-[#3c3c3c] bg-[#252526]",
  panelMuted: "border border-[#3c3c3c] bg-[#2d2d30]",
  accent: "text-[#569cd6]",
  accentSurface: "border-blue-500/30 bg-blue-500/8 text-blue-200",
  subtle: "text-[#858585]"
} as const;

export function Panel({
  title,
  eyebrow,
  actions,
  children,
  className = ""
}: PropsWithChildren<{
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
}>) {
  return (
    <section className={`${themeTokens.panel} ${className}`.trim()}>
      <header className="flex items-center justify-between gap-4 border-b border-[#3c3c3c] px-4 py-2">
        <div>
          {eyebrow ? (
            <p className="text-[10px] uppercase tracking-wider text-[#858585]">{eyebrow}</p>
          ) : null}
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#bbbbbb]">{title}</h2>
        </div>
        {actions ? <div>{actions}</div> : null}
      </header>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

export function StatusBadge({
  label,
  tone = "neutral"
}: {
  label: string;
  tone?: "neutral" | "info" | "success" | "warning";
}) {
  const toneClasses = {
    neutral: "border-[#454545] bg-[#3a3d41] text-[#cccccc]",
    info: "border-blue-500/30 bg-blue-500/10 text-blue-300",
    success: "border-emerald-600/40 bg-emerald-600/10 text-emerald-300",
    warning: "border-amber-600/40 bg-amber-600/10 text-amber-300"
  } satisfies Record<string, string>;

  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${toneClasses[tone]}`}
    >
      {label}
    </span>
  );
}

export function MetricPill({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px]">
      <span className="text-[#858585]">{label}:</span>
      <span className="text-white">{value}</span>
    </span>
  );
}
