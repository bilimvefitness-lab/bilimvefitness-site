import json
from dataclasses import asdict, dataclass
from pathlib import Path
from threading import Lock
from typing import Protocol


@dataclass(slots=True)
class StoredSocialPushToken:
    user_id: str
    expo_push_token: str
    platform: str
    device_id: str
    enabled: bool
    created_at: str
    updated_at: str


@dataclass(slots=True)
class StoredSocialEvent:
    event_id: str
    dedupe_key: str
    user_id: str
    date: str
    type: str
    title: str
    body: str
    data: dict
    push_sent: bool
    created_at: str
    updated_at: str


class StepSocialEventStore(Protocol):
    async def upsert_push_token(self, token: StoredSocialPushToken) -> StoredSocialPushToken:
        """Persist a device push token."""

    async def list_push_tokens(self, user_id: str) -> list[StoredSocialPushToken]:
        """Return enabled push tokens for a user."""

    async def get_event_by_dedupe_key(self, dedupe_key: str) -> StoredSocialEvent | None:
        """Return an existing event by dedupe key."""

    async def save_event(self, event: StoredSocialEvent) -> StoredSocialEvent:
        """Persist an event."""

    async def list_events(self, user_id: str, date: str | None = None, limit: int = 20) -> list[StoredSocialEvent]:
        """Return latest events for a user."""

    async def get_group_rank_snapshot(self, group_id: str, date: str) -> dict | None:
        """Return previous rank snapshot for a group-day."""

    async def save_group_rank_snapshot(self, group_id: str, date: str, snapshot: dict) -> dict:
        """Persist rank snapshot for a group-day."""

    async def get_duel_snapshot(self, duel_id: str) -> dict | None:
        """Return previous duel snapshot."""

    async def save_duel_snapshot(self, duel_id: str, snapshot: dict) -> dict:
        """Persist duel snapshot."""


class JsonStepSocialEventStore:
    def __init__(self, file_path: Path) -> None:
        self._file_path = file_path
        self._file_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = Lock()
        if not self._file_path.exists():
            self._write_payload(self._empty_payload())

    async def upsert_push_token(self, token: StoredSocialPushToken) -> StoredSocialPushToken:
        with self._lock:
            payload = self._read_payload()
            user_map = payload["push_tokens"].setdefault(token.user_id, {})
            user_map[token.device_id] = asdict(token)
            self._write_payload(payload)
        return token

    async def list_push_tokens(self, user_id: str) -> list[StoredSocialPushToken]:
        with self._lock:
            payload = self._read_payload()

        user_map = payload["push_tokens"].get(user_id, {})
        items = [self._deserialize_push_token(item) for item in user_map.values()]
        return [item for item in items if item.enabled]

    async def get_event_by_dedupe_key(self, dedupe_key: str) -> StoredSocialEvent | None:
        with self._lock:
            payload = self._read_payload()
        event_id = payload["event_keys"].get(dedupe_key)
        if not event_id:
            return None
        raw_event = payload["events"].get(event_id)
        if raw_event is None:
            return None
        return self._deserialize_event(raw_event)

    async def save_event(self, event: StoredSocialEvent) -> StoredSocialEvent:
        with self._lock:
            payload = self._read_payload()
            payload["events"][event.event_id] = asdict(event)
            payload["event_keys"][event.dedupe_key] = event.event_id
            self._write_payload(payload)
        return event

    async def list_events(self, user_id: str, date: str | None = None, limit: int = 20) -> list[StoredSocialEvent]:
        with self._lock:
            payload = self._read_payload()

        items = [
            self._deserialize_event(raw_event)
            for raw_event in payload["events"].values()
            if raw_event.get("user_id") == user_id and (date is None or raw_event.get("date") == date)
        ]
        items.sort(key=lambda item: (item.date, item.created_at), reverse=True)
        return items[: max(int(limit or 20), 1)]

    async def get_group_rank_snapshot(self, group_id: str, date: str) -> dict | None:
        with self._lock:
            payload = self._read_payload()
        return payload["group_rank_snapshots"].get(f"{group_id}:{date}")

    async def save_group_rank_snapshot(self, group_id: str, date: str, snapshot: dict) -> dict:
        with self._lock:
            payload = self._read_payload()
            payload["group_rank_snapshots"][f"{group_id}:{date}"] = snapshot
            self._write_payload(payload)
        return snapshot

    async def get_duel_snapshot(self, duel_id: str) -> dict | None:
        with self._lock:
            payload = self._read_payload()
        return payload["duel_snapshots"].get(duel_id)

    async def save_duel_snapshot(self, duel_id: str, snapshot: dict) -> dict:
        with self._lock:
            payload = self._read_payload()
            payload["duel_snapshots"][duel_id] = snapshot
            self._write_payload(payload)
        return snapshot

    def _read_payload(self) -> dict:
        try:
            content = self._file_path.read_text(encoding="utf-8-sig")
        except FileNotFoundError:
            return self._empty_payload()
        if not content.strip():
            return self._empty_payload()
        parsed = json.loads(content)
        return {
            "push_tokens": parsed.get("push_tokens") or {},
            "events": parsed.get("events") or {},
            "event_keys": parsed.get("event_keys") or {},
            "group_rank_snapshots": parsed.get("group_rank_snapshots") or {},
            "duel_snapshots": parsed.get("duel_snapshots") or {},
        }

    def _write_payload(self, payload: dict) -> None:
        self._file_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    @staticmethod
    def _empty_payload() -> dict:
        return {
            "push_tokens": {},
            "events": {},
            "event_keys": {},
            "group_rank_snapshots": {},
            "duel_snapshots": {},
        }

    @staticmethod
    def _deserialize_push_token(payload: dict) -> StoredSocialPushToken:
        return StoredSocialPushToken(
            user_id=payload["user_id"],
            expo_push_token=payload["expo_push_token"],
            platform=payload["platform"],
            device_id=payload["device_id"],
            enabled=bool(payload.get("enabled", True)),
            created_at=payload["created_at"],
            updated_at=payload["updated_at"],
        )

    @staticmethod
    def _deserialize_event(payload: dict) -> StoredSocialEvent:
        return StoredSocialEvent(
            event_id=payload["event_id"],
            dedupe_key=payload["dedupe_key"],
            user_id=payload["user_id"],
            date=payload["date"],
            type=payload["type"],
            title=payload["title"],
            body=payload["body"],
            data=payload.get("data") or {},
            push_sent=bool(payload.get("push_sent", False)),
            created_at=payload["created_at"],
            updated_at=payload["updated_at"],
        )
