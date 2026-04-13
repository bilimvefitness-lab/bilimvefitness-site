import logging
from datetime import datetime, timezone
from uuid import uuid4

from app.db.step_social_event_store import (
    StepSocialEventStore,
    StoredSocialEvent,
    StoredSocialPushToken,
)
from app.db.step_social_store import (
    StepSocialStore,
    StoredSocialChallenge,
    StoredSocialDuel,
    StoredSocialGroup,
    StoredSocialGroupMember,
)
from app.db.step_store import StepStore
from app.schemas.step_social import (
    SocialChallengePayload,
    SocialChallengeRecord,
    SocialDuelCreateRequest,
    SocialDuelRecord,
    SocialEventRecord,
    SocialGroup,
    SocialGroupCreateRequest,
    SocialGroupJoinRequest,
    SocialGroupLeaderboard,
    SocialGroupLeaderboardEntry,
    SocialNotificationItem,
    SocialOverviewResponse,
    SocialPushTokenRegisterRequest,
)
from app.services.expo_push_service import ExpoPushMessage, ExpoPushService


logger = logging.getLogger(__name__)


class StepSocialService:
    def __init__(
        self,
        social_store: StepSocialStore,
        step_store: StepStore,
        event_store: StepSocialEventStore,
        push_service: ExpoPushService,
    ) -> None:
        self.social_store = social_store
        self.step_store = step_store
        self.event_store = event_store
        self.push_service = push_service

    async def create_group(self, payload: SocialGroupCreateRequest) -> SocialGroup:
        existing_group = await self.social_store.get_group_by_user(payload.user_id)
        if existing_group is not None:
            raise ValueError("Kullanici zaten bir gruba bagli.")

        timestamp = self._now_iso()
        group = StoredSocialGroup(
            group_id=f"group-{uuid4().hex[:10]}",
            name=payload.group_name.strip(),
            invite_code=self._generate_invite_code(payload.user_id),
            max_members=5,
            members=[
                StoredSocialGroupMember(
                    user_id=payload.user_id,
                    display_name=payload.display_name.strip(),
                    joined_at=timestamp,
                )
            ],
            created_at=timestamp,
            updated_at=timestamp,
        )
        persisted = await self.social_store.save_group(group)
        return self._to_group_schema(persisted)

    async def join_group(self, payload: SocialGroupJoinRequest) -> SocialGroup:
        invite_code = self._extract_invite_code(payload.invite_token)
        existing_group = await self.social_store.get_group_by_user(payload.user_id)
        if existing_group is not None:
            if existing_group.invite_code == invite_code:
                return self._to_group_schema(existing_group)
            raise ValueError("Zaten baska bir arkadas grubuna baglisin.")

        group = await self.social_store.get_group_by_invite_code(invite_code)
        if group is None:
            raise ValueError("Invite link ya da kodu gecersiz.")
        if len(group.members) >= group.max_members:
            raise ValueError("Bu grup dolu. Maksimum 5 kisi destekleniyor.")

        timestamp = self._now_iso()
        group.members.append(
            StoredSocialGroupMember(
                user_id=payload.user_id,
                display_name=payload.display_name.strip(),
                joined_at=timestamp,
            )
        )
        group.updated_at = timestamp
        persisted = await self.social_store.save_group(group)
        return self._to_group_schema(persisted)

    async def register_push_token(self, payload: SocialPushTokenRegisterRequest) -> dict[str, str | bool]:
        timestamp = self._now_iso()
        token = StoredSocialPushToken(
            user_id=payload.user_id,
            expo_push_token=payload.expo_push_token.strip(),
            platform=payload.platform.strip().lower(),
            device_id=payload.device_id.strip(),
            enabled=True,
            created_at=timestamp,
            updated_at=timestamp,
        )
        await self.event_store.upsert_push_token(token)
        return {
            "registered": True,
            "user_id": payload.user_id,
            "device_id": payload.device_id,
        }

    async def sync_challenges(
        self,
        user_id: str,
        challenges: list[SocialChallengePayload],
    ) -> list[SocialChallengeRecord]:
        saved: list[SocialChallengeRecord] = []
        existing_map = {
            item.challenge_id: item
            for item in await self.social_store.list_challenges(user_id)
        }
        for payload in challenges:
            existing = existing_map.get(payload.challenge_id)
            timestamp = self._now_iso()
            stored = StoredSocialChallenge(
                challenge_id=payload.challenge_id,
                user_id=user_id,
                date=payload.date,
                type=payload.type,
                title=payload.title,
                target_value=int(payload.target_value),
                progress_value=int(payload.progress_value),
                completed=payload.completed,
                status=payload.status,
                badge_key=payload.badge_key,
                reward_label=payload.reward_label,
                streak_guarded=payload.streak_guarded,
                created_at=existing.created_at if existing else timestamp,
                updated_at=timestamp,
            )
            persisted = await self.social_store.save_challenge(stored)
            saved.append(self._to_challenge_schema(persisted))

            if payload.completed and not (existing and existing.completed):
                await self._create_event(
                    user_id=user_id,
                    event_type="challenge_completed",
                    title="Challenge tamamlandi",
                    body=f"{payload.title} bugun kapandi. Rozeti kasaya ekledin.",
                    date=payload.date,
                    dedupe_key=f"{payload.date}:challenge_completed:{user_id}:{payload.challenge_id}",
                    data={
                        "challenge_id": payload.challenge_id,
                        "badge_key": payload.badge_key,
                        "focus": "challenge",
                    },
                )

            if payload.status == "at_risk" and not (existing and existing.status == "at_risk"):
                await self._create_event(
                    user_id=user_id,
                    event_type="streak_at_risk",
                    title="Streak riskte",
                    body=(
                        "Challenge ile bagli seri kayabiliyor. Bugunu bos birakma."
                        if payload.streak_guarded
                        else f"{payload.title} geride kaldi. Kisa bir blokla yeniden ac."
                    ),
                    date=payload.date,
                    dedupe_key=f"{payload.date}:streak_at_risk:{user_id}:{payload.challenge_id}",
                    data={
                        "challenge_id": payload.challenge_id,
                        "streak_guarded": payload.streak_guarded,
                        "focus": "challenge",
                    },
                )
        return saved

    async def start_duel(self, payload: SocialDuelCreateRequest) -> SocialDuelRecord:
        if payload.challenger_user_id == payload.opponent_user_id:
            raise ValueError("Ayni kullanici ile duel baslatilamaz.")

        group = await self.social_store.get_group_by_user(payload.challenger_user_id)
        if group is None:
            raise ValueError("Duel icin once bir arkadas grubuna katil.")

        member_map = {member.user_id: member for member in group.members}
        challenger = member_map.get(payload.challenger_user_id)
        opponent = member_map.get(payload.opponent_user_id)
        if challenger is None or opponent is None:
            raise ValueError("Duel yalnizca ayni grup icindeki kullanicilar arasinda baslatilabilir.")

        existing_duels = await self.social_store.list_duels_for_user(payload.challenger_user_id)
        for duel in existing_duels:
            same_pair = {
                duel.challenger_user_id,
                duel.opponent_user_id,
            } == {payload.challenger_user_id, payload.opponent_user_id}
            if duel.date == payload.date and same_pair:
                refreshed = await self._refresh_duel(duel)
                return self._to_duel_schema(refreshed, payload.challenger_user_id)

        timestamp = self._now_iso()
        duel = StoredSocialDuel(
            duel_id=f"duel-{uuid4().hex[:10]}",
            group_id=group.group_id,
            date=payload.date,
            challenger_user_id=challenger.user_id,
            challenger_name=challenger.display_name,
            opponent_user_id=opponent.user_id,
            opponent_name=opponent.display_name,
            challenger_steps=0,
            opponent_steps=0,
            status="active",
            winner_user_id=None,
            created_at=timestamp,
            updated_at=timestamp,
        )
        refreshed = await self._refresh_duel(duel)
        await self.event_store.save_duel_snapshot(
            refreshed.duel_id,
            {
                "status": refreshed.status,
                "winner_user_id": refreshed.winner_user_id,
                "updated_at": refreshed.updated_at,
            },
        )
        await self._create_event(
            user_id=challenger.user_id,
            event_type="duel_started",
            title="Duel basladi",
            body=f"{opponent.display_name} ile bugunluk yaris acildi.",
            date=payload.date,
            dedupe_key=f"{payload.date}:duel_started:{refreshed.duel_id}:{challenger.user_id}",
            data={
                "duel_id": refreshed.duel_id,
                "focus": "duel",
                "opponent_user_id": opponent.user_id,
                "opponent_name": opponent.display_name,
            },
        )
        await self._create_event(
            user_id=opponent.user_id,
            event_type="duel_started",
            title="Duel basladi",
            body=f"{challenger.display_name} bugun seni birebir yarisa cekti.",
            date=payload.date,
            dedupe_key=f"{payload.date}:duel_started:{refreshed.duel_id}:{opponent.user_id}",
            data={
                "duel_id": refreshed.duel_id,
                "focus": "duel",
                "opponent_user_id": challenger.user_id,
                "opponent_name": challenger.display_name,
            },
        )
        return self._to_duel_schema(refreshed, payload.challenger_user_id)

    async def process_step_sync(self, user_id: str, dates: list[str]) -> list[SocialEventRecord]:
        created_events: list[SocialEventRecord] = []
        unique_dates = sorted({item for item in dates if item})
        if not unique_dates:
            return created_events

        group = await self.social_store.get_group_by_user(user_id)
        for date_key in unique_dates:
            if group is not None:
                leaderboard = await self._build_group_leaderboard(group, user_id, date_key)
                created_events.extend(await self._evaluate_group_events(group, leaderboard, date_key))
            created_events.extend(await self._evaluate_duels_for_user(user_id, date_key))
        return created_events

    async def get_events(
        self,
        user_id: str,
        *,
        date: str | None = None,
        limit: int = 20,
    ) -> list[SocialEventRecord]:
        items = await self.event_store.list_events(user_id, date=date, limit=limit)
        return [self._to_event_schema(item) for item in items]

    async def get_overview(self, user_id: str, date: str) -> SocialOverviewResponse:
        group = await self.social_store.get_group_by_user(user_id)
        leaderboard = await self._build_group_leaderboard(group, user_id, date) if group else None
        if group and leaderboard:
            await self._evaluate_group_events(group, leaderboard, date)
        await self._evaluate_duels_for_user(user_id, date)

        challenges = [
            self._to_challenge_schema(item)
            for item in await self.social_store.list_challenges(user_id)
            if item.date == date
        ]
        duel = await self._get_latest_duel(user_id, date)
        events = await self.get_events(user_id, date=date, limit=12)
        notifications = self._build_notifications(
            current_user_id=user_id,
            leaderboard=leaderboard,
            challenges=challenges,
            duel=duel,
            events=events,
        )

        return SocialOverviewResponse(
            date=date,
            invite_link=self._build_invite_link(group.invite_code) if group else None,
            group=self._to_group_schema(group) if group else None,
            group_leaderboard=leaderboard,
            active_duel=duel,
            challenges=challenges,
            notifications=notifications,
            events=events,
        )

    async def _build_group_leaderboard(
        self,
        group: StoredSocialGroup,
        current_user_id: str,
        date: str,
    ) -> SocialGroupLeaderboard:
        entries: list[SocialGroupLeaderboardEntry] = []
        for member in group.members:
            record = await self.step_store.get_record(member.user_id, date)
            entries.append(
                SocialGroupLeaderboardEntry(
                    user_id=member.user_id,
                    display_name=member.display_name,
                    rank=1,
                    step_count=record.step_count if record else 0,
                    is_current_user=member.user_id == current_user_id,
                )
            )

        entries.sort(key=lambda item: (-item.step_count, item.display_name.lower()))
        ranked_entries: list[SocialGroupLeaderboardEntry] = []
        current_user_entry: SocialGroupLeaderboardEntry | None = None
        for index, item in enumerate(entries, start=1):
            ranked = SocialGroupLeaderboardEntry(
                user_id=item.user_id,
                display_name=item.display_name,
                rank=index,
                step_count=item.step_count,
                is_current_user=item.is_current_user,
            )
            ranked_entries.append(ranked)
            if ranked.is_current_user:
                current_user_entry = ranked

        return SocialGroupLeaderboard(
            group_id=group.group_id,
            date=date,
            entries=ranked_entries,
            current_user=current_user_entry,
        )

    async def _evaluate_group_events(
        self,
        group: StoredSocialGroup,
        leaderboard: SocialGroupLeaderboard,
        date: str,
    ) -> list[SocialEventRecord]:
        previous_snapshot = await self.event_store.get_group_rank_snapshot(group.group_id, date) or {}
        previous_members = previous_snapshot.get("members") or {}
        current_members = {
            entry.user_id: {
                "rank": entry.rank,
                "step_count": entry.step_count,
                "display_name": entry.display_name,
            }
            for entry in leaderboard.entries
        }
        created_events: list[SocialEventRecord] = []

        for entry in leaderboard.entries:
            previous = previous_members.get(entry.user_id)
            if not previous:
                continue

            previous_rank = int(previous.get("rank", entry.rank))
            if entry.rank > previous_rank:
                passing_member = self._find_passing_member(
                    target_user_id=entry.user_id,
                    previous_rank=previous_rank,
                    current_rank=entry.rank,
                    previous_members=previous_members,
                    current_members=current_members,
                )
                title = (
                    f"{passing_member['display_name']} seni gecti"
                    if passing_member
                    else "Bir sira geriye dustun"
                )
                body = (
                    f"Grubunda {entry.rank}. siradasin. Kisa bir yuruyusle farki kapat."
                    if passing_member
                    else f"Grubunda {entry.rank}. siradasin. Bugun tablo hala degisebilir."
                )
                event = await self._create_event(
                    user_id=entry.user_id,
                    event_type="passed_by_friend",
                    title=title,
                    body=body,
                    date=date,
                    dedupe_key=(
                        f"{date}:passed_by_friend:{group.group_id}:{entry.user_id}:"
                        f"{previous_rank}->{entry.rank}:{passing_member['user_id'] if passing_member else 'unknown'}"
                    ),
                    data={
                        "group_id": group.group_id,
                        "focus": "social",
                        "rank": entry.rank,
                        "step_count": entry.step_count,
                        "friend_user_id": passing_member["user_id"] if passing_member else None,
                    },
                )
                if event:
                    created_events.append(event)

            if previous_rank != 1 and entry.rank == 1:
                event = await self._create_event(
                    user_id=entry.user_id,
                    event_type="became_group_leader",
                    title="Grubunda lider oldun",
                    body="Tablonun tepesine ciktin. Bu ritmi koru.",
                    date=date,
                    dedupe_key=f"{date}:became_group_leader:{group.group_id}:{entry.user_id}:{entry.step_count}",
                    data={
                        "group_id": group.group_id,
                        "focus": "social",
                        "rank": entry.rank,
                        "step_count": entry.step_count,
                    },
                )
                if event:
                    created_events.append(event)

        await self.event_store.save_group_rank_snapshot(
            group.group_id,
            date,
            {
                "updated_at": self._now_iso(),
                "members": current_members,
            },
        )
        return created_events

    async def _evaluate_duels_for_user(self, user_id: str, date: str) -> list[SocialEventRecord]:
        created_events: list[SocialEventRecord] = []
        duels = await self.social_store.list_duels_for_user(user_id)
        for duel in duels:
            if duel.date != date:
                continue
            previous_snapshot = await self.event_store.get_duel_snapshot(duel.duel_id) or {}
            refreshed = await self._refresh_duel(duel)
            if previous_snapshot.get("status") != refreshed.status and refreshed.winner_user_id:
                winner_name = (
                    refreshed.challenger_name
                    if refreshed.winner_user_id == refreshed.challenger_user_id
                    else refreshed.opponent_name
                )
                rival_name = (
                    refreshed.opponent_name
                    if refreshed.winner_user_id == refreshed.challenger_user_id
                    else refreshed.challenger_name
                )
                event = await self._create_event(
                    user_id=refreshed.winner_user_id,
                    event_type="duel_won",
                    title="Duel sana yazildi",
                    body=f"{rival_name} karsisinda bugunluk yarisi {winner_name} kapatti. Bonus ritmi koru.",
                    date=date,
                    dedupe_key=f"{date}:duel_won:{refreshed.duel_id}:{refreshed.winner_user_id}",
                    data={
                        "duel_id": refreshed.duel_id,
                        "focus": "duel",
                        "winner_user_id": refreshed.winner_user_id,
                    },
                )
                if event:
                    created_events.append(event)

            await self.event_store.save_duel_snapshot(
                refreshed.duel_id,
                {
                    "status": refreshed.status,
                    "winner_user_id": refreshed.winner_user_id,
                    "updated_at": refreshed.updated_at,
                },
            )
        return created_events

    async def _get_latest_duel(self, user_id: str, date: str) -> SocialDuelRecord | None:
        duels = await self.social_store.list_duels_for_user(user_id)
        for duel in duels:
            if duel.date != date:
                continue
            refreshed = await self._refresh_duel(duel)
            return self._to_duel_schema(refreshed, user_id)
        return None

    async def _refresh_duel(self, duel: StoredSocialDuel) -> StoredSocialDuel:
        challenger_record = await self.step_store.get_record(duel.challenger_user_id, duel.date)
        opponent_record = await self.step_store.get_record(duel.opponent_user_id, duel.date)
        duel.challenger_steps = challenger_record.step_count if challenger_record else 0
        duel.opponent_steps = opponent_record.step_count if opponent_record else 0

        today_key = datetime.now(timezone.utc).date().isoformat()
        if duel.date < today_key:
            if duel.challenger_steps > duel.opponent_steps:
                duel.status = "won"
                duel.winner_user_id = duel.challenger_user_id
            elif duel.opponent_steps > duel.challenger_steps:
                duel.status = "lost"
                duel.winner_user_id = duel.opponent_user_id
            else:
                duel.status = "tied"
                duel.winner_user_id = None
        else:
            duel.status = "active"
            duel.winner_user_id = None

        duel.updated_at = self._now_iso()
        return await self.social_store.save_duel(duel)

    async def _create_event(
        self,
        *,
        user_id: str,
        event_type: str,
        title: str,
        body: str,
        date: str,
        dedupe_key: str,
        data: dict,
    ) -> SocialEventRecord | None:
        existing = await self.event_store.get_event_by_dedupe_key(dedupe_key)
        if existing is not None:
            return self._to_event_schema(existing)

        timestamp = self._now_iso()
        stored = StoredSocialEvent(
            event_id=f"evt-{uuid4().hex[:12]}",
            dedupe_key=dedupe_key,
            user_id=user_id,
            date=date,
            type=event_type,
            title=title,
            body=body,
            data=data,
            push_sent=False,
            created_at=timestamp,
            updated_at=timestamp,
        )
        persisted = await self.event_store.save_event(stored)

        if await self._dispatch_push_for_event(persisted):
            persisted = StoredSocialEvent(
                event_id=persisted.event_id,
                dedupe_key=persisted.dedupe_key,
                user_id=persisted.user_id,
                date=persisted.date,
                type=persisted.type,
                title=persisted.title,
                body=persisted.body,
                data=persisted.data,
                push_sent=True,
                created_at=persisted.created_at,
                updated_at=self._now_iso(),
            )
            persisted = await self.event_store.save_event(persisted)
        return self._to_event_schema(persisted)

    async def _dispatch_push_for_event(self, event: StoredSocialEvent) -> bool:
        push_tokens = await self.event_store.list_push_tokens(event.user_id)
        if not push_tokens:
            return False

        messages = [
            ExpoPushMessage(
                to=token.expo_push_token,
                title=event.title,
                body=event.body,
                data={
                    "type": "social_event",
                    "screen": "Hareket",
                    "focus": event.data.get("focus") or self._focus_for_event(event.type),
                    "event_id": event.event_id,
                    "event_type": event.type,
                    "date": event.date,
                },
            )
            for token in push_tokens
        ]
        try:
            return self.push_service.send_messages(messages)
        except Exception as exc:  # pragma: no cover
            logger.warning("social push dispatch failed user_id=%s error=%s", event.user_id, exc)
            return False

    def _build_notifications(
        self,
        *,
        current_user_id: str,
        leaderboard: SocialGroupLeaderboard | None,
        challenges: list[SocialChallengeRecord],
        duel: SocialDuelRecord | None,
        events: list[SocialEventRecord],
    ) -> list[SocialNotificationItem]:
        notifications: list[SocialNotificationItem] = []

        for event in events:
            mapped = self._notification_from_event(event)
            if mapped is not None:
                notifications.append(mapped)

        if notifications:
            return notifications[:4]

        if leaderboard and leaderboard.current_user:
            current_user = leaderboard.current_user
            if current_user.rank == 1:
                notifications.append(
                    SocialNotificationItem(
                        type="leader",
                        title="Bugun lider sensin",
                        body="Grubun bugun seni takip ediyor. Tempo dusmesin.",
                        priority=2,
                    )
                )
            else:
                leader = leaderboard.entries[0] if leaderboard.entries else None
                if leader and leader.user_id != current_user_id:
                    notifications.append(
                        SocialNotificationItem(
                            type="overtaken",
                            title=f"{leader.display_name} seni gecti",
                            body=f"Grubunda {current_user.rank}. siradasin. Kisa bir blok farki kapatabilir.",
                            priority=3 if current_user.rank > 2 else 2,
                        )
                    )
                notifications.append(
                    SocialNotificationItem(
                        type="rank",
                        title=f"Grubunda {current_user.rank}. siradasin",
                        body="Gun bitmeden tablo degisebilir. Simdi yuklen.",
                        priority=1,
                    )
                )

        active_challenge = next((item for item in challenges if item.status in {"active", "at_risk"}), None)
        if active_challenge:
            notifications.append(
                SocialNotificationItem(
                    type="challenge",
                    title="Challenge acik",
                    body=(
                        "Challenge streak ile bagli. Bugun bos gecerse ilerleme zarar gorur."
                        if active_challenge.streak_guarded
                        else "Bugunun challenge ilerlemesini kapatmak icin son bloklari kullan."
                    ),
                    priority=2 if active_challenge.status == "at_risk" else 1,
                )
            )

        if duel:
            if duel.status == "active":
                current_steps = duel.challenger_steps if duel.challenger_user_id == current_user_id else duel.opponent_steps
                rival_name = duel.opponent_name if duel.challenger_user_id == current_user_id else duel.challenger_name
                rival_steps = duel.opponent_steps if duel.challenger_user_id == current_user_id else duel.challenger_steps
                if rival_steps > current_steps:
                    notifications.append(
                        SocialNotificationItem(
                            type="duel",
                            title=f"{rival_name} duelde onde",
                            body=f"Gun sonuna kadar {max(rival_steps - current_steps, 0)} adimlik fark var.",
                            priority=2,
                        )
                    )
            elif duel.winner_user_id == current_user_id:
                notifications.append(
                    SocialNotificationItem(
                        type="duel",
                        title="Duel sana yazildi",
                        body="Gunluk birebir yarisi kazandin.",
                        priority=2,
                    )
                )

        return notifications[:4]

    def _notification_from_event(self, event: SocialEventRecord) -> SocialNotificationItem | None:
        if event.type == "passed_by_friend":
            return SocialNotificationItem(type="overtaken", title=event.title, body=event.body, priority=3)
        if event.type == "became_group_leader":
            return SocialNotificationItem(type="leader", title=event.title, body=event.body, priority=2)
        if event.type in {"duel_started", "duel_won"}:
            return SocialNotificationItem(type="duel", title=event.title, body=event.body, priority=2)
        if event.type == "challenge_completed":
            return SocialNotificationItem(type="challenge", title=event.title, body=event.body, priority=2)
        if event.type == "streak_at_risk":
            return SocialNotificationItem(type="streak", title=event.title, body=event.body, priority=3)
        return None

    @staticmethod
    def _find_passing_member(
        *,
        target_user_id: str,
        previous_rank: int,
        current_rank: int,
        previous_members: dict,
        current_members: dict,
    ) -> dict | None:
        candidates: list[dict] = []
        for user_id, current in current_members.items():
            if user_id == target_user_id:
                continue
            if int(current.get("rank", 10**6)) >= current_rank:
                continue
            previous = previous_members.get(user_id) or {}
            if int(previous.get("rank", 10**6)) >= previous_rank:
                candidates.append({**current, "user_id": user_id})

        if candidates:
            candidates.sort(key=lambda item: (int(item.get("rank", 10**6)), -int(item.get("step_count", 0))))
            return candidates[0]

        for user_id, current in current_members.items():
            if user_id == target_user_id:
                continue
            if int(current.get("rank", 10**6)) < current_rank:
                return {**current, "user_id": user_id}
        return None

    @staticmethod
    def _focus_for_event(event_type: str) -> str:
        if event_type in {"duel_started", "duel_won"}:
            return "duel"
        if event_type in {"challenge_completed", "streak_at_risk"}:
            return "challenge"
        return "social"

    @staticmethod
    def _generate_invite_code(seed: str) -> str:
        return f"{seed[-2:].upper()}{uuid4().hex[:6].upper()}"

    @staticmethod
    def _extract_invite_code(invite_token: str) -> str:
        token = invite_token.strip()
        if "/" in token:
            token = token.rstrip("/").split("/")[-1]
        return token.upper()

    @staticmethod
    def _build_invite_link(invite_code: str) -> str:
        return f"primewalk://invite/{invite_code}"

    @staticmethod
    def _now_iso() -> str:
        return datetime.now(timezone.utc).isoformat()

    @staticmethod
    def _to_group_schema(group: StoredSocialGroup) -> SocialGroup:
        return SocialGroup(
            group_id=group.group_id,
            name=group.name,
            invite_code=group.invite_code,
            max_members=group.max_members,
            members=[
                {
                    "user_id": member.user_id,
                    "display_name": member.display_name,
                    "joined_at": member.joined_at,
                }
                for member in group.members
            ],
            created_at=group.created_at,
            updated_at=group.updated_at,
        )

    @staticmethod
    def _to_challenge_schema(challenge: StoredSocialChallenge) -> SocialChallengeRecord:
        return SocialChallengeRecord(
            challenge_id=challenge.challenge_id,
            user_id=challenge.user_id,
            date=challenge.date,
            type=challenge.type,
            title=challenge.title,
            target_value=challenge.target_value,
            progress_value=challenge.progress_value,
            completed=challenge.completed,
            status=challenge.status,
            badge_key=challenge.badge_key,
            reward_label=challenge.reward_label,
            streak_guarded=challenge.streak_guarded,
            created_at=challenge.created_at,
            updated_at=challenge.updated_at,
        )

    @staticmethod
    def _to_duel_schema(duel: StoredSocialDuel, current_user_id: str) -> SocialDuelRecord:
        if duel.status == "won" and duel.winner_user_id != current_user_id:
            status = "lost"
        elif duel.status == "lost" and duel.winner_user_id == current_user_id:
            status = "won"
        else:
            status = duel.status

        return SocialDuelRecord(
            duel_id=duel.duel_id,
            group_id=duel.group_id,
            date=duel.date,
            challenger_user_id=duel.challenger_user_id,
            challenger_name=duel.challenger_name,
            opponent_user_id=duel.opponent_user_id,
            opponent_name=duel.opponent_name,
            challenger_steps=duel.challenger_steps,
            opponent_steps=duel.opponent_steps,
            status=status,
            winner_user_id=duel.winner_user_id,
            created_at=duel.created_at,
            updated_at=duel.updated_at,
        )

    @staticmethod
    def _to_event_schema(event: StoredSocialEvent) -> SocialEventRecord:
        return SocialEventRecord(
            event_id=event.event_id,
            user_id=event.user_id,
            date=event.date,
            type=event.type,
            title=event.title,
            body=event.body,
            data=event.data,
            push_sent=event.push_sent,
            created_at=event.created_at,
            updated_at=event.updated_at,
        )
