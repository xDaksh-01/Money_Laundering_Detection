from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from .parser import RIFTDataParser
from .analyzer import RiftAnalyzer
from .schema import RiftOutput
import os

app = FastAPI(title="RIFT 2026 Detection Engine")

# ---------------------------------------------------
# CORS (safe for demo / hackathon)
# ---------------------------------------------------
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
# FRONTEND STATIC SERVING (Vite dist build)
# ---------------------------------------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIST = os.path.join(BASE_DIR, "frontend", "dist")

if os.path.exists(FRONTEND_DIST):

    # Serve Vite assets
    app.mount(
        "/assets",
        StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")),
        name="assets"
    )

    # Serve root index.html
    @app.get("/", include_in_schema=False)
    async def serve_root():
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))

    # Catch-all route for SPA routing
    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))