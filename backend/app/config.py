from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    anthropic_api_key: str = ""
    database_url: str = "sqlite:////app/data/financial_planner.db"
    app_title: str = "Doyle Financial Planner"
    fx_cad_usd: float = 1.3650  # CAD per USD, updated via settings endpoint

    class Config:
        env_file = ".env"


settings = Settings()
