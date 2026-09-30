from pathlib import Path

from app.config import Settings
from app.system_metrics import get_system_metrics


def test_system_metrics_has_expected_shape(tmp_path: Path):
    settings = Settings(media_root=str(tmp_path), disk_warning_percent=100)
    payload = get_system_metrics(settings)

    assert 0 <= payload["cpu_percent"] <= 100
    assert 0 <= payload["memory_percent"] <= 100
    assert 0 <= payload["disk_percent"] <= 100
    assert payload["disk_total_bytes"] > 0
    assert payload["disk_path"] == str(tmp_path)
    assert payload["disk_warning"] is False
