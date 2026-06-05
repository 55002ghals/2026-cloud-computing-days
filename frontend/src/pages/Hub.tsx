import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import { WeekStrip } from "../components/hub/WeekStrip";
import { TodayDiaryCard } from "../components/hub/TodayDiaryCard";
import { SearchTriggerCard } from "../components/hub/SearchTriggerCard";
import { DailyTodoCard } from "../components/hub/DailyTodoCard";

import { type PlantState } from "../components/hub/PlantVideoCard";
import { PlantVideoCardV2 } from "../components/hub/PlantVideoCardV2";
import { getWeekWindow, type CalendarEntry } from "../lib/week";
import { fetchStreak } from "../lib/streak";
import { useMockDate } from "../hooks/useMockDate";
import { usePlantTest } from "../hooks/usePlantTest";
import { listPlans, listPlansForCalendar } from "../api/plans";
import type { PlanOut } from "../lib/plans";

export function Hub() {
  const navigate = useNavigate();
  const today = useMockDate();
  const plantTestOverride = usePlantTest();
  const thisMonth = today.slice(0, 7);
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [diaryBody, setDiaryBody] = useState<string | null>(null);
  const [streak, setStreak] = useState<number | null>(null);
  const [plans, setPlans] = useState<PlanOut[]>([]);
  const [activeTodayTodos, setActiveTodayTodos] = useState(0);

  useEffect(() => {
    listPlans()
      .then(setPlans)
      .catch(() => setPlans([]));
  }, []);

  useEffect(() => {
    listPlansForCalendar(today, today)
      .then((plansWithTodos) => {
        const count = plansWithTodos.reduce(
          (sum, p) => sum + p.todos.filter((t) => t.todo_date === today).length,
          0,
        );
        setActiveTodayTodos(count);
      })
      .catch(() => setActiveTodayTodos(0));
  }, [today]);

  useEffect(() => {
    client
      .get(`/calendar?month=${thisMonth}`)
      .then((res) => {
        setEntries(res.data.entries ?? []);
      })
      .catch(() => {});
  }, [thisMonth]);

  useEffect(() => {
    client
      .get(`/diary/${today}`)
      .then((res) => {
        setDiaryBody(res.data.body ?? "");
      })
      .catch(() => {
        setDiaryBody(null);
      });
  }, [today]);

  useEffect(() => {
    fetchStreak()
      .then(setStreak)
      .catch(() => setStreak(null));
  }, []);

  const weekDays = getWeekWindow(entries, today);
  const hasDiary = diaryBody !== null;

  const activePlanCount = plans.length;

  // 식물 상태 계산
  // - 3일 연속 이상 작성 → 3 (무럭무럭)
  // - 마지막 일기가 3일 이상 전 → 1 (시듦)
  // - 그 외 (신규 포함) → 2 (보통)
  const plantState: PlantState = (() => {
    if (streak !== null && streak >= 3) return 3;
    if (entries.length > 0) {
      const lastDate = entries.map(e => e.date).sort().at(-1)!;
      const daysSince = Math.floor(
        (new Date(today).getTime() - new Date(lastDate).getTime()) / 86400000
      );
      if (daysSince >= 3) return 1;
    }
    return 2;
  })();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
        padding: "16px 16px 8px",
      }}
    >
      {streak !== null && streak > 0 && (
        <div
          style={{
            textAlign: "center",
            fontSize: "1.1rem",
            fontWeight: 600,
            color: "var(--sage-leaf)",
            animation: "days-pop 380ms var(--ease-soft) both",
          }}
        >
          🔥 {streak}일 연속
        </div>
      )}
      <div style={{ animation: "days-rise 320ms var(--ease-out) 40ms both" }}>
        <WeekStrip days={weekDays} today={today} />
      </div>

      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "stretch",
          animation: "days-rise 320ms var(--ease-out) 120ms both",
        }}
      >
        <TodayDiaryCard
          today={today}
          hasDiary={hasDiary}
          summary={diaryBody ?? undefined}
          onOpen={(date) => navigate(`/diary/${date}`)}
          onStart={() => navigate(`/qna/${today}`)}
        />
        <SearchTriggerCard onClick={() => navigate('/search')} />
      </div>

      <DailyTodoCard
        onClick={() => navigate('/plans')}
        planCount={activePlanCount}
        activeTodayTodos={activeTodayTodos}
      />

      <PlantVideoCardV2 plantState={plantTestOverride.state ?? plantState} season={plantTestOverride.season ?? undefined} />
    </div>
  );
}
