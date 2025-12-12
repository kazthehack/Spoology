import re
import json
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

app = FastAPI(
    title="Spool Analyzer API",
    description="Backend service for analyzing filament spool images and returning structured metadata.",
    version="0.2.0",
)

BASE_DIR = Path(__file__).resolve().parent.parent
SPOOLS_DIR = BASE_DIR / "App" / "public" / "spools"
IMAGES_DIR = BASE_DIR / "App" / "public" / "images" / "spools"


def slugify(value: str) -> str:
    value = value.strip().lower()
    # replace non-alphanumeric with hyphens
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-+", "-", value).strip("-")
    return value or "spool"



app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SpoolAnalysis(BaseModel):
    brand_guess: Optional[str] = None
    material_type: Optional[str] = None
    hole_pattern_type: Optional[str] = None
    estimated_empty_weight_grams: Optional[float] = None
    notes: str


@app.get("/health", summary="Health check")
async def health() -> dict:
    return {"status": "ok"}



class SpoolModel(BaseModel):
    brand: str
    type: str
    image: str
    description: Optional[str] = None
    filamentDiameterMm: Optional[float] = None
    filamentWeightGrams: Optional[float] = None
    emptySpoolWeightGrams: Optional[float] = None
    refillable: Optional[bool] = None


class SpoolContribution(BaseModel):
    id: str
    json_path: str
    image_path: str
    spool: SpoolModel


@app.post(
    "/contrib/spool",
    response_model=SpoolContribution,
    summary="Submit a new spool definition",
    tags=["contrib"],
)
async def contrib_spool(
    brand: str = Form(...),
    type: str = Form(...),
    description: Optional[str] = Form(None),
    filament_diameter_mm: Optional[float] = Form(None),
    filament_weight_grams: Optional[float] = Form(None),
    empty_spool_weight_grams: Optional[float] = Form(None),
    refillable: Optional[bool] = Form(False),
    image: UploadFile = File(...),
) -> SpoolContribution:
    slug = slugify(f"{brand}-{type}")
    image_ext = Path(image.filename).suffix.lower() or ".png"
    image_filename = f"{slug}{image_ext}"
    json_filename = f"{slug}.json"

    spool = {
        "brand": brand,
        "type": type,
        "description": description,
        "filamentDiameterMm": filament_diameter_mm,
        "filamentWeightGrams": filament_weight_grams,
        "emptySpoolWeightGrams": empty_spool_weight_grams,
        "refillable": refillable,
        "image": f"/images/spools/{image_filename}",
    }
    # Drop keys where the value is None
    spool_compact = {k: v for k, v in spool.items() if v is not None}

    SPOOLS_DIR.mkdir(parents=True, exist_ok=True)
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    json_path = SPOOLS_DIR / json_filename
    with json_path.open("w", encoding="utf-8") as f:
        json.dump(spool_compact, f, indent=2)

    img_path = IMAGES_DIR / image_filename
    contents = await image.read()
    with img_path.open("wb") as f:
        f.write(contents)

    # Return paths relative to repo root for easy committing
    return SpoolContribution(
        id=slug,
        json_path=str(json_path.relative_to(BASE_DIR)),
        image_path=str(img_path.relative_to(BASE_DIR)),
        spool=SpoolModel(**spool_compact),
    )


@app.post(
    "/analyze/spool-image",
    response_model=SpoolAnalysis,
    summary="Analyze spool image",
    tags=["analysis"],
)
async def analyze_spool_image(file: UploadFile = File(...)) -> SpoolAnalysis:
    return SpoolAnalysis(
        brand_guess=None,
        material_type=None,
        hole_pattern_type=None,
        estimated_empty_weight_grams=None,
        notes=f"Placeholder analysis. Received file '{file.filename}'.",
    )
