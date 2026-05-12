from pydantic import BaseModel, Field


class TranslateRequest(BaseModel):
    text: str = Field(..., max_length=5000)
    target_lang: str = Field(..., pattern=r"^(AR|UR|EN)$")


class TranslateResponse(BaseModel):
    translated_text: str
    cached: bool
