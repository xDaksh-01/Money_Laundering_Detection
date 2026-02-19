from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
from .parser import RIFTDataParser
from .analyzer import RiftAnalyzer
from .schema import RiftOutput

app = FastAPI(title="RIFT 2026 Detection Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

parser = RIFTDataParser()

@app.get("/")
async def health():
    return {"status": "ok"}

@app.post("/api/process", response_model=RiftOutput)
async def process_data(file: UploadFile = File(...)):
    content = await file.read()

    df, msg = parser.parse_and_validate(content)
    if df is None:
        raise HTTPException(status_code=400, detail=msg)

    # detect_patterns is CPU-bound — run in a thread so the event loop stays free
    analyzer = RiftAnalyzer(df)
    results = await run_in_threadpool(analyzer.detect_patterns)

    return results