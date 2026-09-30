from docker.errors import DockerException

from app.config import Settings
from app.docker_manager import DockerManager


def test_services_stay_visible_when_docker_is_unavailable(monkeypatch):
    settings = Settings(
        manager_allowed_services="jellyfin,sonarr,radarr",
        manager_api_token="test-token",
    )
    manager = DockerManager(settings)

    def broken_client():
        raise DockerException("docker unavailable")

    monkeypatch.setattr(manager, "_client", broken_client)

    services = manager.services()
    names = {service["name"] for service in services}

    assert {"jellyfin", "sonarr", "radarr", "docker"} <= names
    assert all(
        service["status"] == "docker-unavailable"
        for service in services
        if service["name"] != "docker"
    )
