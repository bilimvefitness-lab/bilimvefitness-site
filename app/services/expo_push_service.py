import json
import logging
from dataclasses import dataclass
from typing import Sequence
from urllib import error, request


logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


@dataclass(slots=True)
class ExpoPushMessage:
    to: str
    title: str
    body: str
    data: dict


class ExpoPushService:
    def __init__(self, access_token: str | None = None) -> None:
        self.access_token = access_token

    def send_messages(self, messages: Sequence[ExpoPushMessage]) -> bool:
        if not messages:
            return False

        payload = [
            {
                "to": message.to,
                "sound": "default",
                "title": message.title,
                "body": message.body,
                "data": message.data,
            }
            for message in messages
        ]
        body = json.dumps(payload).encode("utf-8")
        headers = {
            "Accept": "application/json",
            "Accept-encoding": "gzip, deflate",
            "Content-Type": "application/json",
        }
        if self.access_token:
            headers["Authorization"] = f"Bearer {self.access_token}"

        req = request.Request(EXPO_PUSH_URL, data=body, headers=headers, method="POST")
        try:
            with request.urlopen(req, timeout=8) as response:
                response.read()
            return True
        except (error.URLError, TimeoutError, OSError) as exc:
            logger.warning("expo push send failed: %s", exc)
            return False
