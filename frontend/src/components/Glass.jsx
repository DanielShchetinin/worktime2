import { cn } from "@/lib/utils";
import { rateColor } from "@/lib/format";

export const GlassCard = ({ className, strong, children, ...p }) => (
  <div className={cn(strong ? "glass-strong" : "glass", "rounded-[28px]", className)} {...p}>
    {children}
  </div>
);

export const Label = ({ children, className }) => (
  <div className={cn("text-[11px] uppercase tracking-[0.16em] font-semibold txt-2", className)}>{children}</div>
);

export const RateBadge = ({ rate, className }) => {
  const c = rateColor(rate);
  return (
    <span
      className={cn("num inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border", className)}
      style={{ color: c, background: `${c}1f`, borderColor: `${c}40` }}
    >
      {Math.round(Number(rate))}%
    </span>
  );
};

export const TypePill = ({ type, className, ...p }) =>
  type ? (
    <span
      className={cn("inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border", className)}
      style={{ color: type.color, background: `${type.color}1c`, borderColor: `${type.color}3d` }}
      {...p}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: type.color }} />
      {type.name}
    </span>
  ) : null;

export const Kpi = ({ label, value, sub, color = "#0A84FF", icon: Icon, testId, delay = 0 }) => (
  <GlassCard className="p-5 fade-up overflow-hidden" style={{ animationDelay: `${delay}ms` }} data-testid={testId}>
    <div className="flex items-center justify-between">
      <Label>{label}</Label>
      {Icon && (
        <span className="w-8 h-8 rounded-full grid place-items-center" style={{ background: `${color}22`, color }}>
          <Icon size={16} strokeWidth={2.2} />
        </span>
      )}
    </div>
    <div className="num text-2xl sm:text-[28px] font-semibold mt-3 leading-none">{value}</div>
    {sub && <div className="text-xs txt-2 mt-2">{sub}</div>}
    <div className="absolute -right-10 -bottom-10 w-28 h-28 rounded-full blur-2xl opacity-30" style={{ background: color }} />
  </GlassCard>
);

export const Spinner = () => (
  <div className="w-full py-16 grid place-items-center">
    <div className="w-8 h-8 rounded-full border-2 border-[#0A84FF] border-t-transparent animate-spin" />
  </div>
);
