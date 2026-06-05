import json
import re
import time
from datetime import date
from functools import lru_cache
from pathlib import Path

from anthropic import AsyncAnthropic

from app.config import get_settings
from app.models import QnAItem

_PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


@lru_cache(maxsize=None)
def _read_prompt_file(name: str) -> str:
    return (_PROMPTS_DIR / f"{name}.md").read_text(encoding="utf-8")


def _load_prompt(prompt_name: str, **vars: str) -> str:
    template = _read_prompt_file(prompt_name)
    for key, value in vars.items():
        template = template.replace("{{" + key + "}}", value)
    template = re.sub(r"\{\{[^}]+\}\}", "", template)
    return template


def _build_profile_block(user_profile: dict | None) -> str:
    if not user_profile:
        return ""
    parts = [f"닉네임: {user_profile.get('nickname', '')}"]
    if user_profile.get("occupation"):
        parts.append(f"직업: {user_profile['occupation']}")
    if user_profile.get("interests"):
        parts.append(f"관심사: {', '.join(user_profile['interests'])}")
    if user_profile.get("hobbies"):
        parts.append(f"취미: {', '.join(user_profile['hobbies'])}")
    return "사용자 정보: " + " / ".join(parts)


def _build_rag_block(rag_summaries: list[tuple[date, str]]) -> str:
    if not rag_summaries:
        return "이전 일기 없음"
    lines = [f"[{d}] {summary}" for d, summary in rag_summaries]
    return "\n".join(lines)


def _build_session_block(session_items: list[QnAItem]) -> str:
    answered = [i for i in session_items if i.answer is not None]
    answered.sort(key=lambda x: x.sequence)
    if not answered:
        return ""
    lines = [f"Q{i.sequence}: {i.question}\nA{i.sequence}: {i.answer}" for i in answered]
    return "\n".join(lines)


def _parse_suggestions(raw: str) -> list[str]:
    match = re.search(r"<suggestions>(.*?)</suggestions>", raw, re.DOTALL)
    if not match:
        return []
    body = match.group(1).strip()
    if not body:
        return []
    lines = [line.strip() for line in body.splitlines() if line.strip()]
    return lines[:3]


def _parse_schedules(raw: str) -> list[dict]:
    schedules_match = re.search(r"<schedules>(.*?)</schedules>", raw, re.DOTALL)
    if not schedules_match:
        return []
    body = schedules_match.group(1).strip()
    if not body:
        return []
    result = []
    for line in body.splitlines():
        line = line.strip()
        if not line:
            continue
        parts = [p.strip() for p in line.split("|")]
        if len(parts) == 5:
            period_start, period_end, start_time, end_time, situation = parts
        elif len(parts) == 3:
            period_start, period_end, situation = parts
            start_time, end_time = "", ""
        else:
            continue
        if not period_start or not period_end or not situation:
            continue
        result.append({
            "period_start": period_start,
            "period_end": period_end,
            "start_time": start_time,
            "end_time": end_time,
            "situation": situation,
        })
    return result


async def _invoke_claude(model_id: str, prompt: str, max_tokens: int) -> tuple[str, dict]:
    client = AsyncAnthropic(api_key=get_settings().anthropic_api_key)
    t0 = time.monotonic()
    resp = await client.messages.create(
        model=model_id,
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    latency_ms = int((time.monotonic() - t0) * 1000)
    text = next((b.text for b in resp.content if b.type == "text"), "")
    meta = {
        "model_id": model_id,
        "input_tokens": resp.usage.input_tokens,
        "output_tokens": resp.usage.output_tokens,
        "latency_ms": latency_ms,
        "prompt": prompt,
        "raw_response": text,
    }
    return text, meta


class ClaudeClient:
    def __init__(self) -> None:
        self._model_id = get_settings().claude_model

    async def generate_question(
        self,
        rag_summaries: list[tuple[date, str]],
        session_so_far: list[QnAItem],
        next_sequence: int,
        user_profile: dict | None = None,
        relevant_schedules: list[str] | None = None,
        today: date | None = None,
        previously_extracted: str = "",
    ) -> tuple[str, list[dict], list[str], dict]:
        profile_block = _build_profile_block(user_profile)
        rag_block = _build_rag_block(rag_summaries)
        session_block = _build_session_block(session_so_far)
        schedules_block = "\n".join(relevant_schedules) if relevant_schedules else ""
        today_str = str(today or date.today())
        prompt = _load_prompt(
            "question",
            today_date=today_str,
            user_profile=profile_block,
            rag_summaries=rag_block,
            relevant_schedules=schedules_block,
            session_so_far=session_block,
            next_sequence=str(next_sequence),
            previously_extracted=previously_extracted,
        )
        text, meta = await _invoke_claude(self._model_id, prompt, max_tokens=1024)
        raw = text.strip()
        question_match = re.search(r"<question>(.*?)</question>", raw, re.DOTALL)
        question = question_match.group(1).strip() if question_match else raw
        schedules = _parse_schedules(raw)
        suggestions = _parse_suggestions(raw)
        return question, schedules, suggestions, meta

    async def generate_diary(
        self,
        qna_items: list[QnAItem],
        user_profile: dict | None = None,
    ) -> tuple[str, str, dict]:
        profile_block = _build_profile_block(user_profile)
        sorted_items = sorted(qna_items, key=lambda x: x.sequence)
        qa_text = "\n".join(
            f"Q{i.sequence}: {i.question}\nA{i.sequence}: {i.answer}" for i in sorted_items
        )
        prompt = _load_prompt(
            "diary",
            user_profile=profile_block,
            qa_text=qa_text,
        )
        text, meta = await _invoke_claude(self._model_id, prompt, max_tokens=2048)
        raw = text.strip()
        diary_match = re.search(r"<diary>(.*?)</diary>", raw, re.DOTALL)
        summary_match = re.search(r"<summary>(.*?)</summary>", raw, re.DOTALL)
        if diary_match and summary_match:
            body = diary_match.group(1).strip()
            summary = summary_match.group(1).strip()
        else:
            body = raw
            summary = ""
        return body, summary, meta

    async def generate_plan(
        self,
        description: str,
        period_start: date,
        period_end: date,
        goal: str,
        user_profile: dict | None = None,
    ) -> tuple[str, date, date, list[dict], dict]:
        profile_block = _build_profile_block(user_profile)
        prompt = _load_prompt(
            "plan_generation",
            user_description=description,
            period_start=str(period_start),
            period_end=str(period_end),
            goal=goal,
            user_profile=profile_block,
        )
        text, meta = await _invoke_claude(self._model_id, prompt, max_tokens=4096)
        raw = text.strip()
        parsed = json.loads(raw)
        title = parsed["title"]
        ps = date.fromisoformat(parsed["period_start"])
        pe = date.fromisoformat(parsed["period_end"])
        days = [
            {"date": date.fromisoformat(d["date"]), "todos": d["todos"]}
            for d in parsed["days"]
        ]
        return title, ps, pe, days, meta
