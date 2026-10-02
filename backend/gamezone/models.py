from typing import Optional, List, Dict, Any

try:
    from pydantic import BaseModel, Field
except ImportError:
    class BaseModel:
        def __init__(self, **kwargs):
            for k, v in kwargs.items():
                setattr(self, k, v)
        def dict(self):
            return self.__dict__

    def Field(default=None, **kwargs):
        return default


class GameCreateInput(BaseModel):
    title: str = Field(..., min_length=2, max_length=100)
    genre: str = Field(default="Action / Arcade")
    description: str = Field(default="")
    cover_image: Optional[str] = None
    banner_image: Optional[str] = None
    hourly_rate_credits: float = Field(default=1.0, ge=0.1, le=50.0)
    min_gpu_vram: str = Field(default="8 GB")
    recommended_gpu: str = Field(default="NVIDIA RTX 3070 or better")
    docker_image: str = Field(default="productify/game-runner:latest")
    storage_required_gb: float = Field(default=20.0, ge=1.0)
    tags: List[str] = Field(default_factory=list)
    featured: bool = False
    status: str = Field(default="published")


class GameUpdatePriceInput(BaseModel):
    hourly_rate_credits: float = Field(..., ge=0.1, le=100.0)
    featured: Optional[bool] = None
    status: Optional[str] = None  # "published", "draft", "archived"


class GameSubmitInput(BaseModel):
    title: str = Field(..., min_length=2, max_length=100)
    genre: str = Field(default="Indie")
    description: str = Field(default="")
    package_url: str = Field(..., min_length=5)
    version: str = Field(default="v1.0.0")
    min_gpu: str = Field(default="NVIDIA GTX 1060 (6 GB)")
    suggested_hourly_rate: float = Field(default=0.80, ge=0.1)
    cover_image: Optional[str] = None


class GameSubmissionReviewInput(BaseModel):
    decision: str = Field(..., regex="^(approve|reject)$")
    antivirus_scanned: bool = True
    no_crypto_miners: bool = True
    headless_gpu_tested: bool = True
    content_policy_passed: bool = True
    admin_notes: Optional[str] = ""
    assigned_hourly_rate: Optional[float] = None


class PrivateGameUploadInput(BaseModel):
    title: str = Field(..., min_length=2, max_length=100)
    package_url: str = Field(..., min_length=5)
    package_size_gb: float = Field(default=5.0, ge=0.1, le=500.0)
    launch_executable: str = Field(default="Game.exe")
    description: Optional[str] = ""


class PrivateGameQuoteInput(BaseModel):
    rental_id: str
    private_game_id: Optional[str] = None


class GamePlayLaunchInput(BaseModel):
    game_id: Optional[str] = None          # For library games
    private_game_id: Optional[str] = None  # For private user games
    rental_id: Optional[str] = None        # Preferred GPU node (or auto-match)
