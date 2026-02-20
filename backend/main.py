from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from .parser import RIFTDataParser
from .analyzer import RiftAnalyzer
from .schema import RiftOutput
from pathlib import Path

app = FastAPI(title="RIFT 2026 Detection Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

parser = RIFTDataParser()

# ---------------------------------------------------
# API ROUTE
# ---------------------------------------------------
@app.get("/api/health")
async def health():
    return {"status": "ok"}

@app.post("/api/process", response_model=RiftOutput)
async def process_data(file: UploadFile = File(...)):
    content = await file.read()

    df, msg = parser.parse_and_validate(content)
    if df is None:
        raise HTTPException(status_code=400, detail=msg)

    analyzer = RiftAnalyzer(df)
    results = await run_in_threadpool(analyzer.detect_patterns)

    return results

# ---------------------------------------------------
# SERVE BUILT REACT FRONTEND (Docker only)
# ---------------------------------------------------
_DIST = Path(__file__).parent.parent / "frontend" / "dist"
if _DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        return FileResponse(str(_DIST / "index.html"))
