import time
from collections import deque
from threading import Lock

from fastapi import HTTPException, Request

RATE_BUCKETS: dict[str, deque[float]] = {}
RATE_LOCK = Lock()


def client_identity(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "").strip()
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def enforce_rate_limit(scope: str, subject: str, max_requests: int, window_seconds: int = 60) -> None:
    key = f"{scope}:{subject}"
    now = time.time()
    cutoff = now - window_seconds
    with RATE_LOCK:
        bucket = RATE_BUCKETS.get(key)
        if bucket is None:
            bucket = deque()
            RATE_BUCKETS[key] = bucket
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        if len(bucket) >= max_requests:
            raise HTTPException(status_code=429, detail="Too many requests. Try again shortly.")
        bucket.append(now)
