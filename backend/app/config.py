from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # SettingsConfigDict is required here — pydantic's ConfigDict does NOT
    # support the env_file / env_file_encoding options used by pydantic-settings.
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",  # silently ignore unknown env vars rather than raising
    )

    anthropic_api_key: str = ""
    database_url: str = "sqlite:////app/data/financial_planner.db"
    app_title: str = "Doyle Financial Planner"
    fx_cad_usd: float = 1.3650


settings = Settings()
