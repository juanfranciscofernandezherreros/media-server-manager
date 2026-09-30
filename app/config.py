from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    manager_api_token: str = ""
    manager_allowed_services: str = (
        "jellyfin,gluetun,deluge,sonarr,radarr,prowlarr,bazarr,"
        "jellyseerr,tailscale,samba"
    )
    media_root: str = "/"
    manager_refresh_seconds: int = 10
    disk_warning_percent: int = 85

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def allowed_services(self) -> set[str]:
        return {
            name.strip()
            for name in self.manager_allowed_services.split(",")
            if name.strip()
        }


@lru_cache
def get_settings() -> Settings:
    return Settings()
