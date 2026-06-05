from datetime import date, datetime, timedelta, timezone

from app.time_kst import kst_today

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import require_session
from app.claude import ClaudeClient, PlanParseError
from app.db import get_db
from app.models import Plan, PlanTodo, UserProfile
from app.schemas import (
    PlanCreate,
    PlanGenerateInput,
    PlanOut,
    PlanTodoBulkReplace,
    PlanTodoOut,
    PlanTodoUpdate,
    PlanUpdate,
    PlanWithTodosOut,
)

router = APIRouter(prefix="/api/plans", tags=["plans"])


def _get_claude() -> ClaudeClient:
    return ClaudeClient()


class _TodoIn(BaseModel):
    todo_date: date
    sequence: int | None = None
    content: str


def _compute_progress(todos: list) -> float:
    if not todos:
        return 0.0
    return sum(1 for t in todos if t.completed) / len(todos)


def _plan_out(plan: Plan) -> PlanOut:
    out = PlanOut.model_validate(plan)
    out.progress = _compute_progress(plan.todos)
    return out


def _plan_with_todos_out(plan: Plan, todos: list | None = None) -> PlanWithTodosOut:
    display_todos = todos if todos is not None else plan.todos
    return PlanWithTodosOut(
        id=plan.id,
        user_id=plan.user_id,
        title=plan.title,
        description_input=plan.description_input,
        goal_input=plan.goal_input,
        period_start=plan.period_start,
        period_end=plan.period_end,
        source=plan.source,
        created_at=plan.created_at,
        progress=_compute_progress(plan.todos),
        todos=[PlanTodoOut.model_validate(t) for t in display_todos],
    )


async def _get_plan_or_404(plan_id: int, user_id: int, db: AsyncSession) -> Plan:
    result = await db.execute(
        select(Plan)
        .options(selectinload(Plan.todos))
        .where(Plan.id == plan_id, Plan.user_id == user_id)
    )
    plan = result.scalars().first()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="plan not found")
    return plan


@router.get("", response_model=list[PlanOut])
async def list_plans(
    user_id: int = Depends(require_session),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Plan)
        .options(selectinload(Plan.todos))
        .where(Plan.user_id == user_id)
        .order_by(Plan.period_start.desc())
    )
    plans = result.scalars().all()
    return [_plan_out(p) for p in plans]


@router.post("", response_model=PlanWithTodosOut, status_code=status.HTTP_201_CREATED)
async def create_plan(
    body: PlanCreate,
    user_id: int = Depends(require_session),
    db: AsyncSession = Depends(get_db),
):
    if body.period_end < body.period_start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="period_end must be >= period_start",
        )
    plan = Plan(
        user_id=user_id,
        title=body.title,
        description_input=body.description_input,
        goal_input=body.goal_input,
        period_start=body.period_start,
        period_end=body.period_end,
        source=body.source,
    )
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    result = await db.execute(
        select(Plan).options(selectinload(Plan.todos)).where(Plan.id == plan.id)
    )
    plan = result.scalars().first()
    return _plan_with_todos_out(plan)


# /calendar and /generate must be defined before /{plan_id} to avoid routing conflict
@router.get("/calendar", response_model=list[PlanWithTodosOut])
async def list_plans_calendar(
    start: date = Query(...),
    end: date = Query(...),
    user_id: int = Depends(require_session),
    db: AsyncSession = Depends(get_db),
):
    if start > end:
        raise HTTPException(status_code=422, detail="start must be <= end")
    result = await db.execute(
        select(Plan)
        .options(selectinload(Plan.todos))
        .where(
            Plan.user_id == user_id,
            Plan.period_start <= end,
            Plan.period_end >= start,
        )
        .order_by(Plan.period_start)
    )
    plans = result.scalars().all()
    return [
        _plan_with_todos_out(
            plan,
            todos=[t for t in plan.todos if start <= t.todo_date <= end],
        )
        for plan in plans
    ]


@router.post("/generate", response_model=PlanWithTodosOut, status_code=status.HTTP_201_CREATED)
async def generate_plan_with_ai(
    body: PlanGenerateInput,
    user_id: int = Depends(require_session),
    db: AsyncSession = Depends(get_db),
):
    if not (1 <= len(body.description) <= 2000):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="description must be 1-2000 chars")
    if not (1 <= len(body.goal) <= 500):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="goal must be 1-500 chars")
    if body.period_end < body.period_start:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="period_end must be >= period_start")
    if (body.period_end - body.period_start).days > 90:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="period must be <= 90 days")

    profile_result = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    profile = profile_result.scalar_one_or_none()
    user_profile = (
        {
            "nickname": profile.nickname,
            "occupation": profile.occupation,
            "hobbies": profile.hobbies,
            "interests": profile.interests,
        }
        if profile
        else None
    )

    try:
        title, ps, pe, days, meta = await _get_claude().generate_plan(
            description=body.description,
            period_start=body.period_start,
            period_end=body.period_end,
            goal=body.goal,
            user_profile=user_profile,
        )
    except PlanParseError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))

    plan = Plan(
        user_id=user_id,
        title=title,
        description_input=body.description,
        goal_input=body.goal,
        period_start=ps,
        period_end=pe,
        source="ai",
        ai_meta=meta,
    )
    db.add(plan)
    await db.flush()

    for day_entry in days:
        for j, todo_content in enumerate(day_entry["todos"]):
            db.add(PlanTodo(
                plan_id=plan.id,
                todo_date=day_entry["date"],
                sequence=j + 1,
                content=todo_content,
            ))

    await db.commit()

    result = await db.execute(
        select(Plan).options(selectinload(Plan.todos)).where(Plan.id == plan.id)
    )
    plan = result.scalars().first()
    return _plan_with_todos_out(plan)


@router.get("/{plan_id}", response_model=PlanWithTodosOut)
async def get_plan(
    plan_id: int,
    user_id: int = Depends(require_session),
    db: AsyncSession = Depends(get_db),
):
    plan = await _get_plan_or_404(plan_id, user_id, db)
    return _plan_with_todos_out(plan)


@router.put("/{plan_id}", response_model=PlanOut)
async def update_plan(
    plan_id: int,
    body: PlanUpdate,
    user_id: int = Depends(require_session),
    db: AsyncSession = Depends(get_db),
):
    plan = await _get_plan_or_404(plan_id, user_id, db)

    new_start = body.period_start if body.period_start is not None else plan.period_start
    new_end = body.period_end if body.period_end is not None else plan.period_end
    if new_end < new_start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="period_end must be >= period_start",
        )

    if body.title is not None:
        plan.title = body.title
    if body.description_input is not None:
        plan.description_input = body.description_input
    if body.goal_input is not None:
        plan.goal_input = body.goal_input
    plan.period_start = new_start
    plan.period_end = new_end

    await db.commit()
    result = await db.execute(
        select(Plan).options(selectinload(Plan.todos)).where(Plan.id == plan.id)
    )
    plan = result.scalars().first()
    return _plan_out(plan)


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_plan(
    plan_id: int,
    user_id: int = Depends(require_session),
    db: AsyncSession = Depends(get_db),
):
    plan = await _get_plan_or_404(plan_id, user_id, db)
    await db.delete(plan)
    await db.commit()


@router.post("/{plan_id}/todos/bulk_replace", response_model=PlanWithTodosOut)
async def bulk_replace_todos(
    plan_id: int,
    body: PlanTodoBulkReplace,
    user_id: int = Depends(require_session),
    db: AsyncSession = Depends(get_db),
):
    plan = await _get_plan_or_404(plan_id, user_id, db)

    today = kst_today()
    if plan.period_end < today:
        return _plan_with_todos_out(plan)

    effective_start = max(today, plan.period_start)

    # Delete todos in [effective_start, period_end]
    todos_to_delete = [
        t for t in plan.todos
        if effective_start <= t.todo_date <= plan.period_end
    ]
    for t in todos_to_delete:
        await db.delete(t)
    # Flush deletes before inserts to avoid unique constraint violation
    await db.flush()

    # Insert new todos for each date in range
    if body.contents:
        current = effective_start
        while current <= plan.period_end:
            for seq, content in enumerate(body.contents, start=1):
                db.add(PlanTodo(
                    plan_id=plan.id,
                    todo_date=current,
                    sequence=seq,
                    content=content,
                ))
            current += timedelta(days=1)

    await db.commit()

    # Use populate_existing=True so the session identity map is bypassed
    # (conftest sets expire_on_commit=False, so stale cache must be overwritten)
    result = await db.execute(
        select(Plan)
        .options(selectinload(Plan.todos))
        .where(Plan.id == plan.id)
        .execution_options(populate_existing=True)
    )
    plan = result.scalars().first()
    return _plan_with_todos_out(plan)


@router.post("/{plan_id}/todos", response_model=PlanTodoOut, status_code=status.HTTP_201_CREATED)
async def add_todo(
    plan_id: int,
    body: _TodoIn,
    user_id: int = Depends(require_session),
    db: AsyncSession = Depends(get_db),
):
    await _get_plan_or_404(plan_id, user_id, db)

    sequence = body.sequence
    if sequence is None:
        max_result = await db.execute(
            select(func.max(PlanTodo.sequence)).where(
                PlanTodo.plan_id == plan_id,
                PlanTodo.todo_date == body.todo_date,
            )
        )
        sequence = (max_result.scalar() or 0) + 1

    todo = PlanTodo(
        plan_id=plan_id,
        todo_date=body.todo_date,
        sequence=sequence,
        content=body.content,
    )
    db.add(todo)
    await db.commit()
    await db.refresh(todo)
    return todo


@router.put("/{plan_id}/todos/{todo_id}", response_model=PlanTodoOut)
async def update_todo(
    plan_id: int,
    todo_id: int,
    body: PlanTodoUpdate,
    user_id: int = Depends(require_session),
    db: AsyncSession = Depends(get_db),
):
    await _get_plan_or_404(plan_id, user_id, db)

    result = await db.execute(
        select(PlanTodo).where(PlanTodo.id == todo_id, PlanTodo.plan_id == plan_id)
    )
    todo = result.scalars().first()
    if not todo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="todo not found")

    if body.sequence is not None:
        todo.sequence = body.sequence
    if body.content is not None:
        todo.content = body.content
    if body.completed is not None:
        todo.completed = body.completed
        todo.completed_at = datetime.now(timezone.utc) if body.completed else None

    await db.commit()
    await db.refresh(todo)
    return todo


@router.delete("/{plan_id}/todos/{todo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_todo(
    plan_id: int,
    todo_id: int,
    user_id: int = Depends(require_session),
    db: AsyncSession = Depends(get_db),
):
    await _get_plan_or_404(plan_id, user_id, db)

    result = await db.execute(
        select(PlanTodo).where(PlanTodo.id == todo_id, PlanTodo.plan_id == plan_id)
    )
    todo = result.scalars().first()
    if not todo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="todo not found")

    await db.delete(todo)
    await db.commit()
