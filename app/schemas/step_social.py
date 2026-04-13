from typing import Literal

from pydantic import BaseModel, Field


SocialChallengeType = Literal["daily_mission", "seven_day"]
SocialChallengeStatus = Literal["active", "completed", "at_risk", "failed"]
SocialDuelStatus = Literal["active", "won", "lost", "tied"]
SocialNotificationType = Literal["leader", "overtaken", "rank", "duel", "challenge", "streak"]
SocialEventType = Literal[
    "passed_by_friend",
    "became_group_leader",
    "duel_started",
    "duel_won",
    "challenge_completed",
    "streak_at_risk",
]


class SocialGroupMember(BaseModel):
    user_id: str = Field(..., min_length=1)
    display_name: str = Field(..., min_length=1, max_length=40)
    joined_at: str


class SocialGroup(BaseModel):
    group_id: str
    name: str = Field(..., min_length=1, max_length=60)
    invite_code: str = Field(..., min_length=4, max_length=16)
    max_members: int = Field(default=5, ge=2, le=5)
    members: list[SocialGroupMember] = Field(default_factory=list)
    created_at: str
    updated_at: str


class SocialChallengeRecord(BaseModel):
    challenge_id: str
    user_id: str = Field(..., min_length=1)
    date: str = Field(..., min_length=10, max_length=10)
    type: SocialChallengeType
    title: str = Field(..., min_length=1, max_length=80)
    target_value: int = Field(default=0, ge=0)
    progress_value: int = Field(default=0, ge=0)
    completed: bool = False
    status: SocialChallengeStatus = "active"
    badge_key: str | None = None
    reward_label: str | None = None
    streak_guarded: bool = False
    created_at: str
    updated_at: str


class SocialChallengePayload(BaseModel):
    challenge_id: str = Field(..., min_length=3, max_length=80)
    date: str = Field(..., min_length=10, max_length=10)
    type: SocialChallengeType
    title: str = Field(..., min_length=1, max_length=80)
    target_value: int = Field(default=0, ge=0)
    progress_value: int = Field(default=0, ge=0)
    completed: bool = False
    status: SocialChallengeStatus = "active"
    badge_key: str | None = None
    reward_label: str | None = None
    streak_guarded: bool = False


class SocialChallengeSyncRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    challenges: list[SocialChallengePayload] = Field(default_factory=list, min_length=1)


class SocialDuelRecord(BaseModel):
    duel_id: str
    group_id: str
    date: str = Field(..., min_length=10, max_length=10)
    challenger_user_id: str
    challenger_name: str
    opponent_user_id: str
    opponent_name: str
    challenger_steps: int = Field(default=0, ge=0)
    opponent_steps: int = Field(default=0, ge=0)
    status: SocialDuelStatus = "active"
    winner_user_id: str | None = None
    created_at: str
    updated_at: str


class SocialNotificationItem(BaseModel):
    type: SocialNotificationType
    title: str
    body: str
    priority: int = Field(default=1, ge=1, le=3)


class SocialEventRecord(BaseModel):
    event_id: str
    user_id: str
    date: str
    type: SocialEventType
    title: str
    body: str
    data: dict = Field(default_factory=dict)
    push_sent: bool = False
    created_at: str
    updated_at: str


class SocialEventCenterResponse(BaseModel):
    user_id: str
    date: str
    events: list[SocialEventRecord] = Field(default_factory=list)


class SocialPushTokenRegisterRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    expo_push_token: str = Field(..., min_length=8, max_length=256)
    platform: str = Field(default="unknown", min_length=2, max_length=24)
    device_id: str = Field(..., min_length=3, max_length=120)


class SocialGroupLeaderboardEntry(BaseModel):
    user_id: str
    display_name: str
    rank: int = Field(..., ge=1)
    step_count: int = Field(default=0, ge=0)
    is_current_user: bool = False


class SocialGroupLeaderboard(BaseModel):
    group_id: str
    date: str
    entries: list[SocialGroupLeaderboardEntry] = Field(default_factory=list)
    current_user: SocialGroupLeaderboardEntry | None = None


class SocialOverviewResponse(BaseModel):
    date: str
    invite_link: str | None = None
    group: SocialGroup | None = None
    group_leaderboard: SocialGroupLeaderboard | None = None
    active_duel: SocialDuelRecord | None = None
    challenges: list[SocialChallengeRecord] = Field(default_factory=list)
    notifications: list[SocialNotificationItem] = Field(default_factory=list)
    events: list[SocialEventRecord] = Field(default_factory=list)


class SocialGroupCreateRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    display_name: str = Field(..., min_length=1, max_length=40)
    group_name: str = Field(..., min_length=1, max_length=60)


class SocialGroupJoinRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    display_name: str = Field(..., min_length=1, max_length=40)
    invite_token: str = Field(..., min_length=4, max_length=256)


class SocialDuelCreateRequest(BaseModel):
    challenger_user_id: str = Field(..., min_length=1)
    opponent_user_id: str = Field(..., min_length=1)
    date: str = Field(..., min_length=10, max_length=10)
