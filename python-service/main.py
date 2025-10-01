from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transcript_service import get_video_metadata, get_original_transcript

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class VideoRequest(BaseModel):
    video_url: str

@app.post("/api/metadata")
async def extract_metadata(request: VideoRequest):
    result = get_video_metadata(request.video_url)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result)
    return result

@app.post("/api/transcript")
async def extract_transcript(request: VideoRequest):
    result = get_original_transcript(request.video_url)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result)
    return result

@app.get("/health")
async def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)