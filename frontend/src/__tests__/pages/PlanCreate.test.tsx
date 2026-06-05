/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PlanCreate } from '../../pages/PlanCreate';
import * as plansApi from '../../api/plans';
import type { PlanWithTodosOut } from '../../lib/plans';

vi.mock('../../api/plans');

const mockNavigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockPlan: PlanWithTodosOut = {
  id: 42,
  user_id: 1,
  title: 'AI가 생성한 플랜',
  description_input: '테스트 설명',
  goal_input: '테스트 목표',
  period_start: '2026-06-01',
  period_end: '2026-06-07',
  source: 'ai',
  created_at: '2026-06-01T00:00:00Z',
  progress: 0,
  todos: [
    { id: 1, plan_id: 42, todo_date: '2026-06-01', sequence: 1, content: '첫 번째 할 일', completed: false, completed_at: null },
    { id: 2, plan_id: 42, todo_date: '2026-06-02', sequence: 1, content: '두 번째 할 일', completed: false, completed_at: null },
  ],
};

describe('PlanCreate 페이지', () => {
  beforeEach(() => {
    vi.mocked(plansApi.generatePlanStream).mockResolvedValue(mockPlan);
    mockNavigate.mockClear();
  });

  it('폼 요소들이 렌더링된다', () => {
    render(<MemoryRouter><PlanCreate /></MemoryRouter>);
    expect(screen.getByLabelText(/계획 설명/)).toBeInTheDocument();
    expect(screen.getByLabelText(/목표/)).toBeInTheDocument();
    expect(screen.getByLabelText(/시작일/)).toBeInTheDocument();
    expect(screen.getByLabelText(/종료일/)).toBeInTheDocument();
  });

  it('모든 입력이 비어있으면 AI 생성 버튼이 비활성화된다', () => {
    render(<MemoryRouter><PlanCreate /></MemoryRouter>);
    expect(screen.getByRole('button', { name: /AI 생성/ })).toBeDisabled();
  });

  it('모든 입력 후 AI 생성 버튼이 활성화된다', () => {
    render(<MemoryRouter><PlanCreate /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText(/계획 설명/), { target: { value: '테스트 설명' } });
    fireEvent.change(screen.getByLabelText(/목표/), { target: { value: '테스트 목표' } });
    fireEvent.change(screen.getByLabelText(/시작일/), { target: { value: '2026-06-01' } });
    fireEvent.change(screen.getByLabelText(/종료일/), { target: { value: '2026-06-07' } });
    expect(screen.getByRole('button', { name: /AI 생성/ })).not.toBeDisabled();
  });

  it('AI 생성 클릭 시 generatePlan을 호출하고 미리보기를 표시한다', async () => {
    render(<MemoryRouter><PlanCreate /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText(/계획 설명/), { target: { value: '테스트 설명' } });
    fireEvent.change(screen.getByLabelText(/목표/), { target: { value: '테스트 목표' } });
    fireEvent.change(screen.getByLabelText(/시작일/), { target: { value: '2026-06-01' } });
    fireEvent.change(screen.getByLabelText(/종료일/), { target: { value: '2026-06-07' } });
    fireEvent.click(screen.getByRole('button', { name: /AI 생성/ }));
    await waitFor(() => {
      expect(plansApi.generatePlanStream).toHaveBeenCalledWith({
        description: '테스트 설명',
        period_start: '2026-06-01',
        period_end: '2026-06-07',
        goal: '테스트 목표',
      });
      expect(screen.getByText('AI가 생성한 플랜')).toBeInTheDocument();
    });
  });

  it('미리보기에서 저장 버튼 클릭 시 /plans/{id}로 navigate한다', async () => {
    render(<MemoryRouter><PlanCreate /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText(/계획 설명/), { target: { value: '테스트 설명' } });
    fireEvent.change(screen.getByLabelText(/목표/), { target: { value: '테스트 목표' } });
    fireEvent.change(screen.getByLabelText(/시작일/), { target: { value: '2026-06-01' } });
    fireEvent.change(screen.getByLabelText(/종료일/), { target: { value: '2026-06-07' } });
    fireEvent.click(screen.getByRole('button', { name: /AI 생성/ }));
    await waitFor(() => screen.getByText('AI가 생성한 플랜'));
    fireEvent.click(screen.getByRole('button', { name: /저장/ }));
    expect(mockNavigate).toHaveBeenCalledWith('/plans/42');
  });

  it('90일 초과 기간 입력 시 에러 메시지를 표시하고 제출 불가', () => {
    render(<MemoryRouter><PlanCreate /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText(/계획 설명/), { target: { value: '테스트' } });
    fireEvent.change(screen.getByLabelText(/목표/), { target: { value: '목표' } });
    fireEvent.change(screen.getByLabelText(/시작일/), { target: { value: '2026-06-01' } });
    fireEvent.change(screen.getByLabelText(/종료일/), { target: { value: '2026-09-30' } }); // 121일
    expect(screen.getByText(/90일/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /AI 생성/ })).toBeDisabled();
  });

  it('미리보기에서 todo 목록이 표시된다', async () => {
    render(<MemoryRouter><PlanCreate /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText(/계획 설명/), { target: { value: '테스트 설명' } });
    fireEvent.change(screen.getByLabelText(/목표/), { target: { value: '테스트 목표' } });
    fireEvent.change(screen.getByLabelText(/시작일/), { target: { value: '2026-06-01' } });
    fireEvent.change(screen.getByLabelText(/종료일/), { target: { value: '2026-06-07' } });
    fireEvent.click(screen.getByRole('button', { name: /AI 생성/ }));
    await waitFor(() => {
      expect(screen.getByText('첫 번째 할 일')).toBeInTheDocument();
      expect(screen.getByText('두 번째 할 일')).toBeInTheDocument();
    });
  });

  it('state.from이 있으면 뒤로 가기 클릭 시 from 경로로 navigate한다', () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/plans/new', state: { from: '/calendar?view=plan' } }]}>
        <PlanCreate />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: /뒤로 가기/ }));
    expect(mockNavigate).toHaveBeenCalledWith('/calendar?view=plan');
  });
});
