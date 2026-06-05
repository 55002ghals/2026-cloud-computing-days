import { useNavigate } from "react-router-dom";
import { Logo } from "../days/Logo";
import { Icon } from "../days/Icon";

export function GlobalHeader() {
  const navigate = useNavigate();

  return (
    <header
      style={{
        width: "100%",
        maxWidth: 480,
        margin: "0 auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px",
        minHeight: 52,
        background: "transparent",
        pointerEvents: "none",
      }}
    >
      <button
        type="button"
        aria-label="홈으로"
        onClick={() => navigate("/hub")}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          pointerEvents: "auto",
        }}
      >
        <Logo size={24} />
      </button>

      <button
        type="button"
        aria-label="개발자"
        onClick={() => navigate("/admin")}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: "var(--paper-pure)",
          border: "1px solid var(--line-faint)",
          borderRadius: 999,
          padding: "6px 12px",
          cursor: "pointer",
          color: "var(--ink-deep)",
          font: "500 13px/1 var(--font-sans)",
          boxShadow: "var(--shadow-1)",
          pointerEvents: "auto",
        }}
      >
        <Icon name="settings" size={18} color="var(--sage-forest)" />
      </button>
    </header>
  );
}
