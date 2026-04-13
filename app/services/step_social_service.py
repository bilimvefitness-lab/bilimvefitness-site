from datetime import datetime, timezone
from uuid import uuid4

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
    SocialGroup,
    SocialGroupCreateRequest,
    SocialGroupJoinRequest,
    SocialGroupLeaderboard,
    SocialGroupLeaderboardEntry,
    SocialNotificationItem,
    SocialOverviewResponse,
)


class StepSocialService:
    def __init__(self, social_store: StepSocialStore, step_store: StepStore) -> None:
        self.social_store = social_store
        self.step_store = step_store

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
        existing_group = await self.social_store.get_group_by_user(payload.user_id)
        if existing_group is not None:
            return self._to_group_schema(existing_group)

        invite_code = self._extract_invite_code(payload.invite_token)
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
        return self._to_duel_schema(refreshed, payload.challenger_user_id)

    async def get_overview(self, user_id: str, date: str) -> SocialOverviewResponse:
        group = await self.social_store.get_group_by_user(user_id)
        leaderboard = await self._build_group_leaderboard(group, user_id, date) if group else None
        challenges = [
            self._to_challenge_schema(item)
            for item in await self.social_store.list_challenges(user_id)
            if item.date == date
        ]
        duel = await self._get_latest_duel(user_id, date)
        notifications = self._build_notifications(
            current_user_id=user_id,
            leaderboard=leaderboard,
            challenges=challenges,
            duel=duel,
        )

        return SocialOverviewResponse(
            date=date,
            invite_link=self._build_invite_link(group.invite_code) if group else None,
            group=self._to_group_schema(group) if group else None,
            group_leaderboard=leaderboard,
            active_duel=duel,
            challenges=challenges,
            notifications=notifications,
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

    def _build_notifications(
        self,
        *,
        current_user_id: str,
        leaderboard: SocialGroupLeaderboard | None,
        challenges: list[SocialChallengeRecord],
        duel: SocialDuelRecord | None,
    ) -> list[SocialNotificationItem]:
        notifications: list[SocialNotificationItem] = []

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
                        body="Gunluk birebir yarişi kazandin.",
                        priority=2,
                    )
                )

        return notifications[:4]

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
