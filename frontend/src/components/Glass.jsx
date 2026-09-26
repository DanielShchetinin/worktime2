import { cn } from "@/lib/utils";
import { rateColor } from "@/lib/format";

export const GlassCard = ({ className, strong, children, ...p }) => (
  <div className={cn(strong ? "glass-strong" : "glass", "rounded-[20px]", className)} {...p}>
    {children}
  </div>
);

export const Label = ({ children, className }) => (
  <div className={cn("text-[12px] uppercase tracking-[0.03em] font-medium txt-2", className)}>{children}</div>
);

export const RateBadge = ({ rate, className }) => {
  const c = rateColor(rate);
  return (
    <span
      className={cn("num inline-flex items-center text-[11px] font-semibold px-1.5 py-0.5 rounded-md", className)}
      style={{ color: c, background: `${c}1a` }}
    >
      {Math.round(Number(rate))}%
    </span>
  );
};

export const TypePill = ({ type, className, ...p }) =>
  type ? (
    <span
      className={cn("inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full", className)}
      style={{ color: type.color, background: `${type.color}1a` }}
      {...p}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: type.color }} />
      {type.name}
    </span>
  ) : null;

export const Kpi = ({ label, value, sub, color = "#0A84FF", icon: Icon, testId }) => (
  <GlassCard className="p-4 sm:p-5" data-testid={testId}>
    <div className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color }}>
      {Icon && <Icon size={15} strokeWidth={2.4} />}
      {label}
    </div>
    <div className="num text-[26px] sm:text-[30px] font-bold mt-2 leading-none">{value}</div>
    {sub && <div className="text-[13px] txt-2 mt-1.5">{sub}</div>}
  </GlassCard>
);

export const Spinner = () => (
  <div className="w-full py-16 grid place-items-center">
    <div className="w-8 h-8 rounded-full border-2 border-[#0A84FF] border-t-transparent animate-spin" />
  </div>
);
