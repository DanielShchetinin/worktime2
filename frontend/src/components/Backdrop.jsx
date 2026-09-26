export const Backdrop = () => (
  <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
    <div className="orb" style={{ width: 560, height: 560, left: "-12%", top: "-14%", background: "radial-gradient(circle, #FF2D55 0%, transparent 65%)" }} />
    <div className="orb" style={{ width: 620, height: 620, right: "-14%", top: "8%", background: "radial-gradient(circle, #0A84FF 0%, transparent 65%)", animationDelay: "-8s" }} />
    <div className="orb" style={{ width: 520, height: 520, left: "25%", bottom: "-22%", background: "radial-gradient(circle, #30D158 0%, transparent 65%)", animationDelay: "-14s" }} />
    <div className="orb" style={{ width: 380, height: 380, right: "18%", bottom: "4%", background: "radial-gradient(circle, #BF5AF2 0%, transparent 65%)", animationDelay: "-20s" }} />
    <div className="noise absolute inset-0" />
  </div>
);
