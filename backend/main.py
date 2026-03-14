"""
eConsultation Sentiment Analysis Backend
Uses VADER for initial sentiment analysis + Gemini API for correction/enhancement
Trained/calibrated on Kaggle sentiment datasets
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import uvicorn
import os
from datetime import datetime
import uuid

from sentiment_engine import SentimentEngine
from database import db

app = FastAPI(title="eConsultation Sentiment API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = SentimentEngine()

# ─────────────────────────────────────────────
# Pydantic Models
# ─────────────────────────────────────────────

class CommentCreate(BaseModel):
    consultation_id: str
    stakeholder_name: str
    stakeholder_email: Optional[str] = ""
    stakeholder_type: Optional[str] = "individual"
    comment_type: Optional[str] = "overall"
    provision_reference: Optional[str] = ""
    comment_text: str

class ConsultationCreate(BaseModel):
    title: str
    description: str
    category: Optional[str] = "other"
    start_date: Optional[str] = ""
    end_date: Optional[str] = ""
    provisions: Optional[List[dict]] = []

class AnalyseRequest(BaseModel):
    comment_ids: List[str]
    consultation_id: str

# ─────────────────────────────────────────────
# Consultation Endpoints
# ─────────────────────────────────────────────

@app.get("/consultations")
def list_consultations():
    return db.list_consultations()

@app.get("/consultations/{consultation_id}")
def get_consultation(consultation_id: str):
    c = db.get_consultation(consultation_id)
    if not c:
        raise HTTPException(status_code=404, detail="Consultation not found")
    return c

@app.post("/consultations")
def create_consultation(data: ConsultationCreate):
    consultation = {
        "id": str(uuid.uuid4()),
        "title": data.title,
        "description": data.description,
        "category": data.category,
        "start_date": data.start_date,
        "end_date": data.end_date,
        "provisions": data.provisions,
        "status": "draft",
        "total_comments": 0,
        "overall_sentiment": None,
        "created_date": datetime.utcnow().isoformat(),
    }
    db.save_consultation(consultation)
    return consultation

@app.patch("/consultations/{consultation_id}")
def update_consultation(consultation_id: str, updates: dict):
    c = db.get_consultation(consultation_id)
    if not c:
        raise HTTPException(status_code=404, detail="Not found")
    c.update(updates)
    db.save_consultation(c)
    return c

# ─────────────────────────────────────────────
# Comment Endpoints
# ─────────────────────────────────────────────

@app.get("/comments")
def list_comments(consultation_id: Optional[str] = None):
    return db.list_comments(consultation_id)

@app.post("/comments")
def create_comment(data: CommentCreate):
    comment = {
        "id": str(uuid.uuid4()),
        "consultation_id": data.consultation_id,
        "stakeholder_name": data.stakeholder_name,
        "stakeholder_email": data.stakeholder_email,
        "stakeholder_type": data.stakeholder_type,
        "comment_type": data.comment_type,
        "provision_reference": data.provision_reference,
        "comment_text": data.comment_text,
        "is_analysed": False,
        "sentiment": None,
        "sentiment_score": None,
        "ai_summary": None,
        "keywords": [],
        "created_date": datetime.utcnow().isoformat(),
    }
    db.save_comment(comment)

    # Update total_comments on consultation
    c = db.get_consultation(data.consultation_id)
    if c:
        c["total_comments"] = c.get("total_comments", 0) + 1
        db.save_consultation(c)

    return comment

@app.post("/comments/analyse")
async def analyse_comments(req: AnalyseRequest):
    """
    Analyse comments using VADER + Gemini correction pipeline.
    VADER gives initial label, Gemini corrects edge cases and generates summaries.
    """
    results = []
    for comment_id in req.comment_ids:
        comment = db.get_comment(comment_id)
        if not comment or comment.get("is_analysed"):
            continue

        # Step 1: VADER analysis
        vader_result = engine.vader_analyse(comment["comment_text"])

        # Step 2: ML model prediction (trained on Kaggle datasets)
        ml_result = engine.ml_predict(comment["comment_text"])

        # Step 3: Gemini correction + summary + keywords
        gemini_result = await engine.gemini_correct_and_summarise(
            text=comment["comment_text"],
            vader_sentiment=vader_result["sentiment"],
            vader_score=vader_result["score"],
            ml_sentiment=ml_result["sentiment"],
            stakeholder_type=comment.get("stakeholder_type", "unknown"),
            comment_type=comment.get("comment_type", "overall"),
            provision=comment.get("provision_reference", ""),
        )

        # Merge results
        final_sentiment = gemini_result.get("final_sentiment", vader_result["sentiment"])
        final_score = gemini_result.get("sentiment_score", vader_result["score"])

        comment.update({
            "is_analysed": True,
            "sentiment": final_sentiment,
            "sentiment_score": final_score,
            "ai_summary": gemini_result.get("summary", ""),
            "keywords": gemini_result.get("keywords", []),
            "vader_raw": vader_result,
            "ml_raw": ml_result,
        })
        db.save_comment(comment)
        results.append(comment)

    # Generate overall consultation summary
    all_comments = db.list_comments(req.consultation_id)
    analysed = [c for c in all_comments if c.get("is_analysed")]

    sentiment_counts = {
        "positive": sum(1 for c in analysed if c["sentiment"] == "positive"),
        "negative": sum(1 for c in analysed if c["sentiment"] == "negative"),
        "neutral": sum(1 for c in analysed if c["sentiment"] == "neutral"),
        "mixed": sum(1 for c in analysed if c["sentiment"] == "mixed"),
    }

    consultation = db.get_consultation(req.consultation_id)
    if consultation:
        overall_summary = await engine.gemini_overall_summary(
            title=consultation.get("title", ""),
            analysed_comments=analysed,
            sentiment_counts=sentiment_counts,
        )
        consultation["overall_sentiment"] = {
            **sentiment_counts,
            "summary": overall_summary,
        }
        consultation["status"] = "analysed"
        db.save_consultation(consultation)

    return {
        "analysed_count": len(results),
        "results": results,
    }

@app.get("/analytics/summary")
def analytics_summary(consultation_id: Optional[str] = None):
    comments = db.list_comments(consultation_id)
    analysed = [c for c in comments if c.get("is_analysed")]

    sentiment_counts = {
        "positive": sum(1 for c in analysed if c["sentiment"] == "positive"),
        "negative": sum(1 for c in analysed if c["sentiment"] == "negative"),
        "neutral": sum(1 for c in analysed if c["sentiment"] == "neutral"),
        "mixed": sum(1 for c in analysed if c["sentiment"] == "mixed"),
    }

    stakeholder_breakdown = {}
    for c in analysed:
        stype = c.get("stakeholder_type", "unknown")
        stakeholder_breakdown[stype] = stakeholder_breakdown.get(stype, 0) + 1

    all_keywords = [kw for c in analysed for kw in (c.get("keywords") or [])]

    return {
        "total_comments": len(comments),
        "analysed_count": len(analysed),
        "sentiment_counts": sentiment_counts,
        "stakeholder_breakdown": stakeholder_breakdown,
        "keywords": all_keywords,
    }

@app.get("/model/stats")
def model_stats():
    """Return training stats of the ML model."""
    return engine.get_model_stats()

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)