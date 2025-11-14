"""In-memory tracking for Nexus handoff metadata."""
from __future__ import annotations

import threading
import time
import uuid
from typing import Any, Dict, List, Optional

from fastapi import HTTPException

from core.nexus.nxm import NXMRequest

NXM_HANDOFF_TTL_SECONDS = 600
_HANDOFFS: Dict[str, Dict[str, Any]] = {}
_HANDOFF_LOCK = threading.Lock()


def _purge_expired_locked(now: Optional[float] = None) -> None:
    current = time.time() if now is None else now
    expired = [identifier for identifier, record in list(_HANDOFFS.items()) if record.get("expires_at", current) <= current]
    for identifier in expired:
        _HANDOFFS.pop(identifier, None)


def _purge_expired(now: Optional[float] = None) -> None:
    with _HANDOFF_LOCK:
        _purge_expired_locked(now)


def register_handoff(nxm: NXMRequest, *, metadata: Dict[str, Any]) -> Dict[str, Any]:
    with _HANDOFF_LOCK:
        _purge_expired_locked()
        identifier = str(uuid.uuid4())
        created_at = time.time()
        record = {
            "id": identifier,
            "created_at": created_at,
            "expires_at": created_at + NXM_HANDOFF_TTL_SECONDS,
            "request": {
                "raw": nxm.raw,
                "game": nxm.game_domain,
                "mod_id": nxm.mod_id,
                "file_id": nxm.file_id,
                "query": dict(nxm.query),
            },
            "metadata": metadata,
        }
        _HANDOFFS[identifier] = record
        return record


def snapshot_metadata(nxm: NXMRequest) -> Dict[str, Any]:
    return {
        "mod_id": nxm.mod_id,
        "file_id": nxm.file_id,
        "key": nxm.key,
        "expires": nxm.expires,
    }


def get_handoff_or_404(handoff_id: str) -> Dict[str, Any]:
    with _HANDOFF_LOCK:
        _purge_expired_locked()
        record = _HANDOFFS.get(handoff_id)
        if record is None:
            raise HTTPException(status_code=404, detail="handoff not found or expired")
        return record


def list_handoffs() -> List[Dict[str, Any]]:
    with _HANDOFF_LOCK:
        _purge_expired_locked()
        return list(_HANDOFFS.values())


def delete_handoff(handoff_id: str) -> Dict[str, Any]:
    with _HANDOFF_LOCK:
        _purge_expired_locked()
        record = _HANDOFFS.get(handoff_id)
        if record is None:
            raise HTTPException(status_code=404, detail="handoff not found or expired")
        _HANDOFFS.pop(handoff_id, None)
        return record


def update_handoff_progress(
    handoff_id: str,
    *,
    stage: str,
    bytes_downloaded: Optional[int] = None,
    bytes_total: Optional[int] = None,
    message: Optional[str] = None,
    error: Optional[str] = None,
) -> None:
    now = time.time()
    percent_value: Optional[float] = None
    if bytes_downloaded is not None and bytes_total:
        try:
            percent_value = max(0.0, min(100.0, (bytes_downloaded / bytes_total) * 100.0))
        except Exception:
            percent_value = None
    with _HANDOFF_LOCK:
        record = _HANDOFFS.get(handoff_id)
        if record is None:
            return
        progress = record.setdefault("progress", {})
        progress["stage"] = stage
        progress["updated_at"] = now
        if bytes_downloaded is not None:
            progress["bytes_downloaded"] = int(bytes_downloaded)
        if bytes_total is not None:
            progress["bytes_total"] = int(bytes_total)
        if percent_value is not None:
            progress["percent"] = percent_value
        elif "percent" in progress:
            progress.pop("percent", None)
        if message is not None:
            progress["message"] = message
        if error is not None:
            progress["error"] = error


def serialize_handoff(record: Dict[str, Any], *, include_metadata: bool = False) -> Dict[str, Any]:
    payload = {
        "id": record.get("id"),
        "created_at": record.get("created_at"),
        "expires_at": record.get("expires_at"),
        "request": record.get("request"),
    }
    progress = record.get("progress")
    if isinstance(progress, dict) and progress:
        payload["progress"] = dict(progress)
    if include_metadata:
        metadata = record.get("metadata") or {}
        filtered = metadata.get("collect_all_filtered") if isinstance(metadata, dict) else None
        mod_info = None
        if isinstance(filtered, dict):
            maybe = filtered.get("mod_info")
            if isinstance(maybe, dict):
                mod_info = maybe
        if mod_info is not None:
            payload["metadata"] = {
                "mod_info": mod_info,
                "fetched_at": metadata.get("collect_all_timestamp"),
            }
    return payload


__all__ = [
    "NXM_HANDOFF_TTL_SECONDS",
    "delete_handoff",
    "get_handoff_or_404",
    "list_handoffs",
    "register_handoff",
    "serialize_handoff",
    "snapshot_metadata",
    "update_handoff_progress",
]
