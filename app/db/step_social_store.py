import json
from dataclasses import asdict, dataclass
from pathlib import Path
from threading import Lock
from typing import Protocol


@dataclass(slots=True)
class StoredSocialGroupMember:
    user_id: str
    display_name: str
    joined_at: str


@dataclass(slots=True)
class StoredSocialGroup:
    group_id: str
    name: str
    invite_code: str
    max_members: int
    members: list[StoredSocialGroupMember]
    created_at: str
    updated_at: str


@dataclass(slots=True)
class StoredSocialChallenge:
    challenge_id: str
    user_id: str
    date: str
    type: str
    title: str
    target_value: int
    progress_value: int
    completed: bool
    status: str
    badge_key: str | None
    reward_label: str | None
    streak_guarded: bool
    created_at: str
    updated_at: str


@dataclass(slots=True)
class StoredSocialDuel:
    duel_id: str
    group_id: str
    date: str
    challenger_user_id: str
    challenger_name: str
    opponent_user_id: str
    opponent_name: str
    challenger_steps: int
    opponent_steps: int
    status: str
    winner_user_id: str | None
    created_at: str
    updated_at: str


class StepSocialStore(Protocol):
    async def get_group_by_user(self, user_id: str) -> StoredSocialGroup | None:
        """Return group for a user."""

    async def get_group_by_invite_code(self, invite_code: str) -> StoredSocialGroup | None:
        """Return group by invite code."""

    async def save_group(self, group: StoredSocialGroup) -> StoredSocialGroup:
        """Persist group and memberships."""

    async def list_challenges(self, user_id: str) -> list[StoredSocialChallenge]:
        """List social challenges for a user."""

    async def save_challenge(self, challenge: StoredSocialChallenge) -> StoredSocialChallenge:
        """Persist social challenge progress."""

    async def list_duels_for_user(self, user_id: str) -> list[StoredSocialDuel]:
        """List duel records for a user."""

    async def save_duel(self, duel: StoredSocialDuel) -> StoredSocialDuel:
        """Persist duel state."""


class JsonStepSocialStore:
    def __init__(self, file_path: Path) -> None:
        self._file_path = file_path
        self._file_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = Lock()
        if not self._file_path.exists():
            self._write_payload(self._empty_payload())

    async def get_group_by_user(self, user_id: str) -> StoredSocialGroup | None:
        with self._lock:
            payload = self._read_payload()

        group_id = payload["memberships"].get(user_id)
        if not group_id:
            return None
        raw_group = payload["groups"].get(group_id)
        if raw_group is None:
            return None
        return self._deserialize_group(raw_group)

    async def get_group_by_invite_code(self, invite_code: str) -> StoredSocialGroup | None:
        normalized_code = invite_code.upper().strip()
        with self._lock:
            payload = self._read_payload()

        for raw_group in payload["groups"].values():
            if str(raw_group.get("invite_code", "")).upper() == normalized_code:
                return self._deserialize_group(raw_group)
        return None

    async def save_group(self, group: StoredSocialGroup) -> StoredSocialGroup:
        with self._lock:
            payload = self._read_payload()
            payload["groups"][group.group_id] = self._serialize_group(group)
            for member in group.members:
                payload["memberships"][member.user_id] = group.group_id
            self._write_payload(payload)
        return group

    async def list_challenges(self, user_id: str) -> list[StoredSocialChallenge]:
        with self._lock:
            payload = self._read_payload()

        challenge_map = payload["challenges"].get(user_id, {})
        items = [self._deserialize_challenge(item) for item in challenge_map.values()]
        items.sort(key=lambda item: (item.date, item.challenge_id), reverse=True)
        return items

    async def save_challenge(self, challenge: StoredSocialChallenge) -> StoredSocialChallenge:
        with self._lock:
            payload = self._read_payload()
            user_map = payload["challenges"].setdefault(challenge.user_id, {})
            user_map[challenge.challenge_id] = asdict(challenge)
            self._write_payload(payload)
        return challenge

    async def list_duels_for_user(self, user_id: str) -> list[StoredSocialDuel]:
        with self._lock:
            payload = self._read_payload()

        items = [
            self._deserialize_duel(raw_duel)
            for raw_duel in payload["duels"].values()
            if raw_duel.get("challenger_user_id") == user_id or raw_duel.get("opponent_user_id") == user_id
        ]
        items.sort(key=lambda item: (item.date, item.created_at), reverse=True)
        return items

    async def save_duel(self, duel: StoredSocialDuel) -> StoredSocialDuel:
        with self._lock:
            payload = self._read_payload()
            payload["duels"][duel.duel_id] = asdict(duel)
            self._write_payload(payload)
        return duel

    def _read_payload(self) -> dict:
        try:
            content = self._file_path.read_text(encoding="utf-8-sig")
        except FileNotFoundError:
            return self._empty_payload()
        if not content.strip():
            return self._empty_payload()
        parsed = json.loads(content)
        return {
            "groups": parsed.get("groups") or {},
            "memberships": parsed.get("memberships") or {},
            "challenges": parsed.get("challenges") or {},
            "duels": parsed.get("duels") or {},
        }

    def _write_payload(self, payload: dict) -> None:
        self._file_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    @staticmethod
    def _empty_payload() -> dict:
        return {
            "groups": {},
            "memberships": {},
            "challenges": {},
            "duels": {},
        }

    @staticmethod
    def _serialize_group(group: StoredSocialGroup) -> dict:
        return {
            **asdict(group),
            "members": [asdict(member) for member in group.members],
        }

    @staticmethod
    def _deserialize_group(payload: dict) -> StoredSocialGroup:
        return StoredSocialGroup(
            group_id=payload["group_id"],
            name=payload["name"],
            invite_code=payload["invite_code"],
            max_members=int(payload.get("max_members", 5)),
            members=[
                StoredSocialGroupMember(
                    user_id=member["user_id"],
                    display_name=member["display_name"],
                    joined_at=member["joined_at"],
                )
                for member in payload.get("members", [])
            ],
            created_at=payload["created_at"],
            updated_at=payload["updated_at"],
        )

    @staticmethod
    def _deserialize_challenge(payload: dict) -> StoredSocialChallenge:
        return StoredSocialChallenge(
            challenge_id=payload["challenge_id"],
            user_id=payload["user_id"],
            date=payload["date"],
            type=payload["type"],
            title=payload["title"],
            target_value=int(payload.get("target_value", 0)),
            progress_value=int(payload.get("progress_value", 0)),
            completed=bool(payload.get("completed", False)),
            status=payload.get("status", "active"),
            badge_key=payload.get("badge_key"),
            reward_label=payload.get("reward_label"),
            streak_guarded=bool(payload.get("streak_guarded", False)),
            created_at=payload["created_at"],
            updated_at=payload["updated_at"],
        )

    @staticmethod
    def _deserialize_duel(payload: dict) -> StoredSocialDuel:
        return StoredSocialDuel(
            duel_id=payload["duel_id"],
            group_id=payload["group_id"],
            date=payload["date"],
            challenger_user_id=payload["challenger_user_id"],
            challenger_name=payload["challenger_name"],
            opponent_user_id=payload["opponent_user_id"],
            opponent_name=payload["opponent_name"],
            challenger_steps=int(payload.get("challenger_steps", 0)),
            opponent_steps=int(payload.get("opponent_steps", 0)),
            status=payload.get("status", "active"),
            winner_user_id=payload.get("winner_user_id"),
            created_at=payload["created_at"],
            updated_at=payload["updated_at"],
        )
