import { useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Icon } from "../days/Icon";
import { useMockDate } from "../../hooks/useMockDate";
import client from "../../api/client";

interface NavItem {
  label: string;
  icon: string;
  match: string;
  path: (today: string) => string;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "오늘의 일기",
    icon: "sunrise",
    match: "/diary",
    path: (today) => `/diary/${today}`,
  },
  {
    label: "추천",
    icon: "sparkles",
    match: "/recommend",
    path: () => "/recommend",
  },
  {
    label: "홈",
    icon: "home",
    match: "/hub",
    path: () => "/hub",
  },
  {
    label: "캘린더",
    icon: "calendar",
    match: "/calendar",
    path: () => "/calendar",
  },
  {
    label: "프로필",
    icon: "user",
    match: "/profile",
    path: () => "/profile",
  },
];

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const TODAY = useMockDate();
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = navRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      document.documentElement.style.setProperty(
        "--bottom-nav-h",
        `${el.getBoundingClientRect().height}px`,
      );
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <nav
      ref={navRef}
      aria-label="하단 내비게이션"
      style={{
        position: "fixed",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: "100%",
        maxWidth: 480,
        background: "var(--paper-pure)",
        borderTop: "1px solid var(--line-faint)",
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        paddingBottom: "env(safe-area-inset-bottom, 8px)",
        zIndex: 100,
        boxShadow: "0 -2px 12px -4px rgba(54, 70, 38, 0.08)",
      }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = location.pathname.startsWith(item.match);
        const handleClick = async () => {
          if (item.label === "오늘의 일기") {
            try {
              const month = TODAY.slice(0, 7);
              const res = await client.get(`/calendar?month=${month}`);
              const entries: { date: string }[] = res.data?.entries ?? [];
              if (entries.some((e) => e.date === TODAY)) {
                navigate(`/diary/${TODAY}`);
              } else {
                navigate(`/qna/${TODAY}`);
              }
            } catch {
              navigate(`/qna/${TODAY}`);
            }
            return;
          }
          navigate(item.path(TODAY));
        };
        return (
          <button
            key={item.label}
            aria-current={isActive ? "page" : undefined}
            onClick={handleClick}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              padding: "10px 0",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: isActive ? "var(--sage-leaf)" : "var(--ink-hint)",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--t-xs)",
              fontWeight: isActive ? 600 : 400,
              transition: "color var(--dur-1)",
            }}
          >
            <span
              key={isActive ? `${item.label}-on` : `${item.label}-off`}
              style={{
                display: "flex",
                animation: isActive
                  ? "days-bounce 320ms var(--ease-soft) both"
                  : "none",
              }}
            >
              <Icon
                name={item.icon}
                size={22}
                color={isActive ? "var(--sage-leaf)" : "var(--ink-hint)"}
              />
            </span>
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
