import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { generatePlanStream } from '../api/plans';
import type { PlanWithTodosOut } from '../lib/plans';
import { todosByDate } from '../lib/plans';
import Spinner from '../components/Spinner';

function daysBetween(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDateKo(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  return `${month}월 ${day}일 (${dayNames[d.getDay()]})`;
}

export function PlanCreate() {
  const navigate = useNavigate();
  const backTo = (useLocation().state as { from?: string })?.from ?? '/plans';

  const [description, setDescription] = useState('');
  const [goal, setGoal] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PlanWithTodosOut | null>(null);

  const dayCount =
    periodStart && periodEnd ? daysBetween(periodStart, periodEnd) : 0;
  const over90 = periodStart && periodEnd && dayCount > 90;
  const canGenerate =
    description.trim() &&
    goal.trim() &&
    periodStart &&
    periodEnd &&
    !over90;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setLoading(true);
    setError(null);
    try {
      const result = await generatePlanStream({
        description: description.trim(),
        period_start: periodStart,
        period_end: periodEnd,
        goal: goal.trim(),
      });
      setPreview(result);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : '생성 중 오류가 발생했어요.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (!preview) return;
    navigate('/plans/' + preview.id);
  };

  const handleRegenerate = async () => {
    setPreview(null);
    await handleGenerate();
  };

  if (preview) {
    return <PreviewSection preview={preview} onSave={handleSave} onRegenerate={handleRegenerate} backTo={backTo} />;
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        padding: '16px 16px 96px',
        background: 'var(--paper-bone)',
        minHeight: '100vh',
        animation: 'days-fade-in 400ms var(--ease-out) both',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          aria-label="뒤로 가기"
          onClick={() => navigate(backTo)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            fontSize: 20,
            color: 'var(--ink-body)',
            padding: '4px 8px 4px 0',
            lineHeight: 1,
          }}
        >
          ←
        </button>
        <h1
          style={{
            margin: 0,
            fontFamily: 'var(--font-sans)',
            fontWeight: 700,
            fontSize: 20,
            color: 'var(--sage-ink)',
            letterSpacing: '-0.02em',
          }}
        >
          AI에게 계획 맡기기
        </h1>
      </div>

      {/* Input card */}
      <div
        style={{
          background: 'var(--paper-pure)',
          border: '1px solid var(--line)',
          borderRadius: 24,
          padding: '20px 20px 16px',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          animation: 'days-pop 300ms var(--ease-soft) both',
        }}
      >
        {/* Description */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label
            htmlFor="plan-description"
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--ink-soft)',
              letterSpacing: '0.01em',
            }}
          >
            계획 설명
          </label>
          <textarea
            id="plan-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="어떤 계획을 세우고 싶으신가요? 자유롭게 설명해 주세요."
            rows={3}
            maxLength={2000}
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 15,
              color: 'var(--ink-deep)',
              border: '1px solid var(--line)',
              borderRadius: 12,
              padding: '12px',
              resize: 'vertical',
              outline: 'none',
              background: 'var(--paper-bone)',
              lineHeight: 1.6,
              transition: 'border-color 160ms var(--ease-out)',
            }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--sage-leaf)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--line)')}
          />
        </div>

        {/* Period */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--ink-soft)',
              letterSpacing: '0.01em',
            }}
          >
            기간
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label htmlFor="plan-start" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
              시작일
            </label>
            <input
              id="plan-start"
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              aria-label="시작일"
              style={{
                flex: 1,
                fontFamily: 'var(--font-sans)',
                fontSize: 14,
                color: 'var(--ink-deep)',
                border: '1px solid var(--line)',
                borderRadius: 12,
                padding: '10px 12px',
                background: 'var(--paper-bone)',
                outline: 'none',
                transition: 'border-color 160ms var(--ease-out)',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--sage-leaf)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--line)')}
            />
            <span style={{ color: 'var(--ink-soft)', fontSize: 14 }}>~</span>
            <label htmlFor="plan-end" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
              종료일
            </label>
            <input
              id="plan-end"
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              aria-label="종료일"
              style={{
                flex: 1,
                fontFamily: 'var(--font-sans)',
                fontSize: 14,
                color: 'var(--ink-deep)',
                border: '1px solid var(--line)',
                borderRadius: 12,
                padding: '10px 12px',
                background: 'var(--paper-bone)',
                outline: 'none',
                transition: 'border-color 160ms var(--ease-out)',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--sage-leaf)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--line)')}
            />
          </div>
          {over90 && (
            <p
              style={{
                margin: 0,
                fontFamily: 'var(--font-sans)',
                fontSize: 13,
                color: 'var(--accent-clay)',
              }}
            >
              기간은 최대 90일까지 설정할 수 있어요. (현재 {dayCount}일)
            </p>
          )}
        </div>

        {/* Goal */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label
            htmlFor="plan-goal"
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--ink-soft)',
              letterSpacing: '0.01em',
            }}
          >
            목표
          </label>
          <textarea
            id="plan-goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="이 계획으로 달성하고 싶은 목표를 적어주세요."
            rows={2}
            maxLength={500}
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 15,
              color: 'var(--ink-deep)',
              border: '1px solid var(--line)',
              borderRadius: 12,
              padding: '12px',
              resize: 'vertical',
              outline: 'none',
              background: 'var(--paper-bone)',
              lineHeight: 1.6,
              transition: 'border-color 160ms var(--ease-out)',
            }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--sage-leaf)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--line)')}
          />
        </div>

        {error && (
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--font-sans)',
              fontSize: 13,
              color: 'var(--accent-clay)',
              background: 'var(--accent-clay-soft)',
              borderRadius: 10,
              padding: '10px 14px',
            }}
          >
            {error}
          </p>
        )}
      </div>

      {/* Generate button */}
      <button
        type="button"
        onClick={handleGenerate}
        disabled={!canGenerate || loading}
        aria-label="AI 생성"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          width: '100%',
          padding: '14px 20px',
          borderRadius: 999,
          border: 0,
          background:
            !canGenerate || loading ? 'var(--sage-mist)' : 'var(--sage-leaf)',
          color: 'var(--paper-pure)',
          fontFamily: 'var(--font-sans)',
          fontWeight: 600,
          fontSize: 16,
          cursor: !canGenerate || loading ? 'not-allowed' : 'pointer',
          opacity: !canGenerate || loading ? 0.7 : 1,
          boxShadow: !canGenerate || loading ? 'none' : 'var(--shadow-2)',
          transition:
            'background var(--dur-1) var(--ease-out), opacity var(--dur-1)',
        }}
      >
        {loading ? <Spinner size={20} color="var(--paper-pure)" /> : null}
        AI 생성
      </button>
      <p
        style={{
          margin: '10px 0 0',
          textAlign: 'center',
          fontSize: 13,
          color: 'var(--ink-muted)',
          fontFamily: 'var(--font-sans)',
        }}
      >
        생성에 최대 3분 정도 걸릴 수 있어요.
      </p>
    </div>
  );
}

interface PreviewSectionProps {
  preview: PlanWithTodosOut;
  onSave: () => void;
  onRegenerate: () => void;
  backTo: string;
}

function PreviewSection({ preview, onSave, onRegenerate, backTo }: PreviewSectionProps) {
  const navigate = useNavigate();
  const grouped = todosByDate(preview.todos);
  const dates = Object.keys(grouped).sort();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        padding: '16px 16px 96px',
        background: 'var(--paper-bone)',
        minHeight: '100vh',
        animation: 'days-fade-in 400ms var(--ease-out) both',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          aria-label="뒤로 가기"
          onClick={() => navigate(backTo)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            fontSize: 20,
            color: 'var(--ink-body)',
            padding: '4px 8px 4px 0',
            lineHeight: 1,
          }}
        >
          ←
        </button>
        <h1
          style={{
            margin: 0,
            fontFamily: 'var(--font-sans)',
            fontWeight: 700,
            fontSize: 20,
            color: 'var(--sage-ink)',
            letterSpacing: '-0.02em',
          }}
        >
          AI 생성 미리보기
        </h1>
      </div>

      {/* Notice */}
      <p
        style={{
          margin: 0,
          fontFamily: 'var(--font-sans)',
          fontSize: 13,
          color: 'var(--ink-meta)',
          background: 'var(--sage-wash)',
          borderRadius: 12,
          padding: '10px 14px',
        }}
      >
        다시 생성 시 새로운 Plan이 생성됩니다. 이전 Plan은 목록에서 직접 삭제해 주세요.
      </p>

      {/* Plan preview card */}
      <div
        style={{
          background: 'var(--paper-pure)',
          border: '1px solid var(--line)',
          borderRadius: 24,
          padding: '20px 20px 16px',
          boxShadow: 'var(--shadow-3)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          animation: 'days-pop 300ms var(--ease-soft) both',
        }}
      >
        {/* Title */}
        <h2
          style={{
            margin: 0,
            fontFamily: 'var(--font-sans)',
            fontWeight: 700,
            fontSize: 20,
            color: 'var(--sage-ink)',
            letterSpacing: '-0.015em',
          }}
        >
          {preview.title}
        </h2>

        {/* Period */}
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            color: 'var(--ink-hint)',
          }}
        >
          {preview.period_start} ~ {preview.period_end}
        </p>

        {/* Todos by date */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            marginTop: 4,
          }}
        >
          {dates.map((date) => (
            <div key={date} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <h3
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 600,
                  fontSize: 13,
                  color: 'var(--sage-forest)',
                }}
              >
                {formatDateKo(date)}
              </h3>
              <ul
                style={{
                  margin: 0,
                  padding: 0,
                  listStyle: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                {(grouped[date] ?? []).map((todo) => (
                  <li
                    key={todo.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      fontFamily: 'var(--font-sans)',
                      fontSize: 14,
                      color: 'var(--ink-body)',
                      lineHeight: 1.5,
                    }}
                  >
                    <span style={{ color: 'var(--sage-fern)', flexShrink: 0, marginTop: 2 }}>•</span>
                    {todo.content}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          type="button"
          aria-label="저장"
          onClick={onSave}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            padding: '14px 20px',
            borderRadius: 999,
            border: 0,
            background: 'var(--sage-leaf)',
            color: 'var(--paper-pure)',
            fontFamily: 'var(--font-sans)',
            fontWeight: 600,
            fontSize: 16,
            cursor: 'pointer',
            boxShadow: 'var(--shadow-2)',
            transition: 'background var(--dur-1) var(--ease-out)',
          }}
        >
          저장
        </button>

        <button
          type="button"
          onClick={onRegenerate}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            padding: '13px 20px',
            borderRadius: 999,
            border: '1.5px solid var(--sage-leaf)',
            background: 'transparent',
            color: 'var(--sage-forest)',
            fontFamily: 'var(--font-sans)',
            fontWeight: 500,
            fontSize: 15,
            cursor: 'pointer',
            transition: 'background var(--dur-1) var(--ease-out)',
          }}
        >
          다시 생성
        </button>

        <button
          type="button"
          onClick={() => navigate(backTo)}
          style={{
            background: 'none',
            border: 0,
            color: 'var(--ink-meta)',
            fontFamily: 'var(--font-sans)',
            fontSize: 14,
            cursor: 'pointer',
            padding: '8px',
            textAlign: 'center',
            transition: 'color var(--dur-1) var(--ease-out)',
          }}
        >
          취소
        </button>
      </div>
    </div>
  );
}
