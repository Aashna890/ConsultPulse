"""
Sentiment Engine
─────────────────
Pipeline:
  1. VADER  →  fast rule-based sentiment (vaderSentiment)
  2. ML     →  Logistic Regression trained on 4 Kaggle datasets
  3. Gemini →  corrects disagreements, generates summary + keywords

Kaggle datasets used for training (download separately):
  - IMDB Movie Reviews (sentiment140 style) — binary pos/neg
  - Twitter Sentiment Analysis (Sentiment140)
  - Amazon Product Reviews
  - Financial PhraseBank (finance-specific sentiment)

Run `python train_model.py` once to train and save the model before starting the server.
"""

import os
import json
import asyncio
import pickle
import re
from typing import Optional
import httpx

from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer


# ─────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
MODEL_PATH = "models/sentiment_model.pkl"
VECTORIZER_PATH = "models/vectorizer.pkl"


# ─────────────────────────────────────────────
# Sentiment Engine
# ─────────────────────────────────────────────

class SentimentEngine:
    def __init__(self):
        self.vader = SentimentIntensityAnalyzer()
        self.ml_model = None
        self.vectorizer = None
        self.model_stats = {}
        self._load_ml_model()

    def _load_ml_model(self):
        """Load trained ML model and vectorizer if they exist."""
        try:
            if os.path.exists(MODEL_PATH) and os.path.exists(VECTORIZER_PATH):
                with open(MODEL_PATH, "rb") as f:
                    self.ml_model = pickle.load(f)
                with open(VECTORIZER_PATH, "rb") as f:
                    self.vectorizer = pickle.load(f)
                stats_path = "models/model_stats.json"
                if os.path.exists(stats_path):
                    with open(stats_path) as f:
                        self.model_stats = json.load(f)
                print("✅ ML model loaded successfully.")
            else:
                print("⚠️  No trained model found. Run train_model.py first.")
        except Exception as e:
            print(f"⚠️  Failed to load ML model: {e}")

    # ──────────────────────────────────────────
    # VADER Analysis
    # ──────────────────────────────────────────

    def vader_analyse(self, text: str) -> dict:
        """
        Run VADER sentiment analysis.
        Returns sentiment label + compound score.
        """
        scores = self.vader.polarity_scores(text)
        compound = scores["compound"]

        if compound >= 0.05:
            label = "positive"
        elif compound <= -0.05:
            label = "negative"
        else:
            label = "neutral"

        return {
            "sentiment": label,
            "score": compound,
            "pos": scores["pos"],
            "neg": scores["neg"],
            "neu": scores["neu"],
        }

    # ──────────────────────────────────────────
    # ML Model Prediction
    # ──────────────────────────────────────────

    def ml_predict(self, text: str) -> dict:
        """
        Predict sentiment using trained Logistic Regression model.
        Falls back to VADER result if model not loaded.
        """
        if self.ml_model is None or self.vectorizer is None:
            # Fallback: use VADER
            return self.vader_analyse(text)

        try:
            cleaned = self._preprocess(text)
            vec = self.vectorizer.transform([cleaned])
            prediction = self.ml_model.predict(vec)[0]
            probas = self.ml_model.predict_proba(vec)[0]
            classes = self.ml_model.classes_
            confidence = float(max(probas))

            return {
                "sentiment": str(prediction),
                "confidence": confidence,
                "probabilities": {str(c): float(p) for c, p in zip(classes, probas)},
            }
        except Exception as e:
            print(f"ML prediction error: {e}")
            return self.vader_analyse(text)

    def _preprocess(self, text: str) -> str:
        """Clean text for ML model."""
        text = text.lower()
        text = re.sub(r"http\S+|www\S+", "", text)
        text = re.sub(r"[^a-z0-9\s]", " ", text)
        text = re.sub(r"\s+", " ", text).strip()
        return text

    # ──────────────────────────────────────────
    # Gemini Correction
    # ──────────────────────────────────────────

    async def gemini_correct_and_summarise(
        self,
        text: str,
        vader_sentiment: str,
        vader_score: float,
        ml_sentiment: str,
        stakeholder_type: str,
        comment_type: str,
        provision: str,
    ) -> dict:
        """
        Send VADER + ML predictions to Gemini.
        Gemini acts as the final arbiter — especially when VADER and ML disagree.
        Also generates a 2-sentence summary and top 5 keywords.
        """
        if not GEMINI_API_KEY:
            # Return VADER result if no Gemini key
            return {
                "final_sentiment": vader_sentiment,
                "sentiment_score": vader_score,
                "summary": f"Stakeholder expressed {vader_sentiment} sentiment regarding the proposed legislation.",
                "keywords": self._extract_keywords(text),
                "correction_applied": False,
            }

        models_agree = vader_sentiment == ml_sentiment
        agreement_note = (
            f"Both VADER and ML model agree: **{vader_sentiment}**"
            if models_agree
            else f"VADER predicts **{vader_sentiment}** but ML model predicts **{ml_sentiment}** — they DISAGREE. Your correction is especially important here."
        )

        prompt = f"""You are an expert sentiment analyst for legislative consultations in India (MCA21 portal context).

A stakeholder comment has been pre-analysed by two models. Your job is to:
1. Verify or CORRECT the sentiment (the models may be wrong, especially on domain-specific legal language)
2. Write a concise 2-sentence summary
3. Extract the top 5 keywords

---
COMMENT: "{text}"
STAKEHOLDER TYPE: {stakeholder_type}
COMMENT TYPE: {comment_type}
PROVISION REFERENCE: {provision or "N/A"}

PRE-ANALYSIS RESULTS:
- VADER compound score: {vader_score:.3f} → predicts: {vader_sentiment}
- ML model predicts: {ml_sentiment}
- {agreement_note}
---

Respond ONLY with valid JSON (no markdown, no explanation):
{{
  "final_sentiment": "<positive|negative|neutral|mixed>",
  "sentiment_score": <float between -1.0 and 1.0>,
  "correction_applied": <true|false>,
  "correction_reason": "<brief reason if corrected, else null>",
  "summary": "<2-sentence summary of the comment>",
  "keywords": ["<kw1>", "<kw2>", "<kw3>", "<kw4>", "<kw5>"]
}}"""

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    f"{GEMINI_API_URL}?key={GEMINI_API_KEY}",
                    json={
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {
                            "temperature": 0.1,
                            "maxOutputTokens": 512,
                        },
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                raw_text = data["candidates"][0]["content"]["parts"][0]["text"]

                # Strip possible markdown fences
                raw_text = re.sub(r"```json|```", "", raw_text).strip()
                result = json.loads(raw_text)
                return result

        except Exception as e:
            print(f"Gemini correction error: {e}")
            return {
                "final_sentiment": vader_sentiment,
                "sentiment_score": vader_score,
                "summary": f"Stakeholder expressed {vader_sentiment} views on the proposed amendment.",
                "keywords": self._extract_keywords(text),
                "correction_applied": False,
            }

    async def gemini_overall_summary(
        self, title: str, analysed_comments: list, sentiment_counts: dict
    ) -> str:
        """Generate an overall summary for the consultation."""
        if not GEMINI_API_KEY:
            total = sum(sentiment_counts.values())
            pos_pct = round(sentiment_counts.get("positive", 0) / max(total, 1) * 100)
            return f"Analysis of {total} comments on '{title}' shows {pos_pct}% positive sentiment."

        summaries_text = "\n".join(
            [f"{i+1}. [{c['sentiment']}] {c.get('ai_summary','')}" 
             for i, c in enumerate(analysed_comments[:30])]  # cap at 30
        )

        prompt = f"""You are summarising stakeholder feedback for an Indian legislative consultation titled: "{title}"

Sentiment distribution across {len(analysed_comments)} analysed comments:
- Positive: {sentiment_counts.get('positive', 0)}
- Negative: {sentiment_counts.get('negative', 0)}
- Neutral: {sentiment_counts.get('neutral', 0)}
- Mixed: {sentiment_counts.get('mixed', 0)}

Individual comment summaries:
{summaries_text}

Write a comprehensive overall summary in 3-5 sentences that captures the dominant themes, key concerns raised, and overall reception of the proposed legislation. Be specific and actionable. Return only the summary text, no JSON."""

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    f"{GEMINI_API_URL}?key={GEMINI_API_KEY}",
                    json={
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 300},
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                return data["candidates"][0]["content"]["parts"][0]["text"].strip()
        except Exception as e:
            print(f"Gemini summary error: {e}")
            return f"Analysis complete for '{title}'. {len(analysed_comments)} comments processed."

    def _extract_keywords(self, text: str, n: int = 5) -> list:
        """Simple keyword extraction fallback (no Gemini)."""
        stopwords = {
            "the", "a", "an", "and", "or", "but", "in", "on", "at", "to",
            "for", "of", "with", "is", "are", "was", "were", "be", "been",
            "this", "that", "it", "its", "not", "as", "by", "from", "would",
            "should", "could", "will", "has", "have", "had", "may", "also",
        }
        words = re.findall(r"\b[a-z]{4,}\b", text.lower())
        freq = {}
        for w in words:
            if w not in stopwords:
                freq[w] = freq.get(w, 0) + 1
        return [w for w, _ in sorted(freq.items(), key=lambda x: -x[1])[:n]]

    def get_model_stats(self) -> dict:
        return self.model_stats or {
            "status": "No model trained yet. Run train_model.py.",
            "datasets": [],
        }