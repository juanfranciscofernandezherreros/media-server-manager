from app.config import Settings


def test_allowed_services_are_normalized():
    settings = Settings(manager_allowed_services=" jellyfin, sonarr ,,radarr ")
    assert settings.allowed_services == {"jellyfin", "sonarr", "radarr"}
