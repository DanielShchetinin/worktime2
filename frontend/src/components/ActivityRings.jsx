import { useId } from "react";
import { motion } from "framer-motion";

export const RING_COLORS = {
  red: ["#FF2D55", "#FF9500"],
  green: ["#30D158", "#63E6E2"],
  blue: ["#0A84FF", "#5E5CE6"],
  purple: ["#BF5AF2", "#FF375F"],
};

export const ActivityRings = ({ rings, size = 220, stroke = 18, gap = 5, children, testId, className }) => {
  const uid = useId().replace(/:/g, "");
  const c = size / 2;
  return (
    <div className={`relative shrink-0 ${className || ""}`} style={{ width: size, height: size }} data-testid={testId}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 overflow-visible">
        <defs>
          {rings.map((r, i) => (
            <linearGradient key={i} id={`g${uid}${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={r.colors[0]} />
              <stop offset="100%" stopColor={r.colors[1]} />
            </linearGradient>
          ))}
        </defs>
        {rings.map((r, i) => {
          const rad = c - stroke / 2 - i * (stroke + gap);
          const p = Math.max(0, Math.min((r.value || 0) / (r.max || 1), 1));
          return (
            <g key={i}>
              <circle cx={c} cy={c} r={rad} fill="none" stroke={r.colors[0]} strokeOpacity={0.16} strokeWidth={stroke} />
              <motion.circle
                cx={c}
                cy={c}
                r={rad}
                fill="none"
                stroke={`url(#g${uid}${i})`}
                strokeWidth={stroke}
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: Math.max(p, 0.001) }}
                transition={{ duration: 1.5, ease: [0.2, 0.8, 0.2, 1], delay: 0.15 + i * 0.12 }}
                style={{ filter: `drop-shadow(0 0 6px ${r.colors[0]}80)` }}
              />
            </g>
          );
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
};
