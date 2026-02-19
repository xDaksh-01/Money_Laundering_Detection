from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from .parser import RIFTDataParser
from .analyzer import RiftAnalyzer
from .schema import RiftOutput
from .auth import verify_user

app = FastAPI(title="RIFT 2026 Detection Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

parser = RIFTDataParser()


class LoginRequest(BaseModel):
    username: str
    password: str


@app.post("/api/login")
async def login(data: LoginRequest):
    """Verify credentials. Returns user and token on success."""
    if verify_user(data.username, data.password):
        return {"success": True, "user": data.username.strip().lower()}
    raise HTTPException(status_code=401, detail="Invalid username or password")


@app.post("/api/process", response_model=RiftOutput)
async def process_data(file: UploadFile = File(...)):
    content = await file.read()
    
    df, msg = parser.parse_and_validate(content)
    if df is None:
        raise HTTPException(status_code=400, detail=msg)
    
    analyzer = RiftAnalyzer(df)
    results = analyzer.detect_patterns()
    
    return results