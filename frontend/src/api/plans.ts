import client from './client';
import { postSSE } from './sseClient';
import type {
  PlanOut,
  PlanWithTodosOut,
  PlanCreateInput,
  PlanUpdateInput,
  PlanTodoOut,
  PlanTodoCreateInput,
  PlanTodoUpdateInput,
  PlanGenerateInput,
} from '../lib/plans';

export async function listPlans(): Promise<PlanOut[]> {
  const res = await client.get<PlanOut[]>('/plans');
  return res.data;
}

export async function getPlan(planId: number): Promise<PlanWithTodosOut> {
  const res = await client.get<PlanWithTodosOut>(`/plans/${planId}`);
  return res.data;
}

export async function createPlan(input: PlanCreateInput): Promise<PlanWithTodosOut> {
  const res = await client.post<PlanWithTodosOut>('/plans', input);
  return res.data;
}

export async function updatePlan(planId: number, input: PlanUpdateInput): Promise<PlanOut> {
  const res = await client.put<PlanOut>(`/plans/${planId}`, input);
  return res.data;
}

export async function deletePlan(planId: number): Promise<void> {
  await client.delete(`/plans/${planId}`);
}

export async function generatePlan(input: PlanGenerateInput): Promise<PlanWithTodosOut> {
  const res = await client.post<PlanWithTodosOut>('/plans/generate', input);
  return res.data;
}

export function generatePlanStream(
  input: PlanGenerateInput,
  onStatus?: (step: string) => void,
): Promise<PlanWithTodosOut> {
  return new Promise((resolve, reject) => {
    postSSE('/api/plans/generate-stream', input, {
      onStatus: (step) => onStatus?.(step),
      onDone: (data) => resolve(data as PlanWithTodosOut),
      onError: (err) => reject(err),
    });
  });
}

export async function listPlansForCalendar(start: string, end: string): Promise<PlanWithTodosOut[]> {
  const res = await client.get<PlanWithTodosOut[]>('/plans/calendar', {
    params: { start, end },
  });
  return res.data;
}

export async function createTodo(planId: number, input: PlanTodoCreateInput): Promise<PlanTodoOut> {
  const res = await client.post<PlanTodoOut>(`/plans/${planId}/todos`, input);
  return res.data;
}

export async function updateTodo(
  planId: number,
  todoId: number,
  input: PlanTodoUpdateInput,
): Promise<PlanTodoOut> {
  const res = await client.put<PlanTodoOut>(`/plans/${planId}/todos/${todoId}`, input);
  return res.data;
}

export async function deleteTodo(planId: number, todoId: number): Promise<void> {
  await client.delete(`/plans/${planId}/todos/${todoId}`);
}

export async function bulkReplaceTodos(
  planId: number,
  contents: string[],
): Promise<PlanWithTodosOut> {
  const res = await client.post<PlanWithTodosOut>(`/plans/${planId}/todos/bulk_replace`, {
    contents,
  });
  return res.data;
}
