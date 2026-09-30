from __future__ import annotations

from pathlib import Path
from typing import Any

import psutil

from app.config import Settings


def get_system_metrics(settings: Settings) -> dict[str, Any]:
    root = Path(settings.media_root)
    if not root.exists():
        root = Path("/")

    disk = psutil.disk_usage(str(root))
    memory = psutil.virtual_memory()

    temperatures = None
    try:
        sensors = psutil.sensors_temperatures()
        values = [
            entry.current
            for entries in sensors.values()
            for entry in entries
            if entry.current is not None
        ]
        temperatures = round(max(values), 1) if values else None
    except (AttributeError, OSError):
        temperatures = None

    return {
        "cpu_percent": psutil.cpu_percent(interval=0.1),
        "memory_percent": memory.percent,
        "memory_used_bytes": memory.used,
        "memory_total_bytes": memory.total,
        "disk_percent": disk.percent,
        "disk_used_bytes": disk.used,
        "disk_total_bytes": disk.total,
        "disk_path": str(root),
        "temperature_c": temperatures,
        "disk_warning": disk.percent >= settings.disk_warning_percent,
    }
