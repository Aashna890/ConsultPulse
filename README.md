# ConsultPulse

**AI-powered sentiment analysis for legislative e-consultation platforms.**

ConsultPulse automatically processes stakeholder comments submitted on draft legislation — classifying sentiment, generating AI summaries, extracting keywords, and producing word cloud visualisations. It is built for contexts where a large volume of public feedback must be analysed quickly, consistently, and without oversight gaps.

---

## How it works

Every submitted comment passes through a three-stage AI pipeline:

```
Comment Text
      │
      ▼
┌─────────────────────────────────────────────────┐
│  Stage 1 · VADER                                │
│  Rule-based lexicon analysis                    │
│  Compound score: −1.0 (negative) → +1.0 (pos)  │
│  Runs locally — no API call needed              │
└─────────────────────┬───────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│  Stage 2 · ML Model                             │
│  Logistic Regression + TF-IDF                   │
│  Trained on 4 real-world sentiment datasets     │
│  160,000+ labelled samples after filtering      │
└─────────────────────┬───────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│  Stage 3 · Gemini 2.0 Flash                     │
│  Receives both predictions + full comment text  │
│  ✦ Corrects disagreements between Stage 1 & 2  │
│  ✦ Generates 2-sentence summary                 │
│  ✦ Extracts top 5 keywords                      │
│  ✦ Produces consultation-level executive brief  │
└─────────────────────────────────────────────────┘
```

When VADER and the ML model agree, Gemini validates and enriches the result. When they **disagree**, Gemini uses contextual reasoning to make the final call — this is especially important for domain-specific language (legal, financial, policy text) that rule-based tools handle poorly.

---

## Features

| Feature | Description |
|---|---|
| Sentiment classification | Positive / Negative / Neutral / Mixed per comment |
| Sentiment score | Float from −1.0 to +1.0 (displayed as integer ×100) |
| Per-comment AI summary | 2-sentence summary via Gemini |
| Keyword extraction | Top 5 keywords per comment |
| Word cloud | Frequency-weighted visualisation across all comments |
| Overall summary | 3–5 sentence executive brief per consultation |
| Correction tracking | Shows how often Gemini overrides VADER — visible in UI |
| Analytics dashboard | Charts by sentiment, stakeholder type, and comment type |
| Comment filtering | Filter any consultation by positive / negative / neutral / mixed |
| Provision-level analysis | Comments can be tagged to specific sections of a draft |

---

## Tech stack

**Frontend**
- React 18 + Vite
- Tailwind CSS
- TanStack Query (server state)
- Recharts (charts)
- React Router v6

**Backend**
- Python 3.10+ with FastAPI
- Uvicorn (ASGI server)
- JSON file storage (easily swappable for PostgreSQL/MongoDB)

**AI / ML**
- `vaderSentiment` — Stage 1 rule-based NLP
- `scikit-learn` — Stage 2 Logistic Regression + TF-IDF vectoriser
- `imbalanced-learn` — class balancing during training
- Google Gemini 2.0 Flash API — Stage 3 correction + generation
- `pandas`, `numpy` — data preparation

---

## ML model training

The Logistic Regression model is trained on **four sentiment datasets** covering different domains, which improves generalisation across writing styles (social media, financial, journalistic, conversational).

### Datasets

| # | File | Text Column | Label Column | Labels |
|---|---|---|---|---|
| 1 | `data.csv` | `Sentence` | `Sentiment` | positive, negative |
| 2 | `sentimentdataset.csv` | `Text` | `Sentiment` | Positive, Negative, Neutral |
| 3 | `news_sentiment_analysis.csv` | `Title` + `Description` (combined) | `Sentiment` | positive, negative, neutral |
| 4 | `twitter_training.csv` | column index `[3]` (no header) | column index `[2]` (no header) | Positive, Negative, Neutral, Irrelevant |

> `Irrelevant` labels from the Twitter dataset are mapped to `neutral` during preprocessing.

### VADER calibration filter

Before training, every sample is run through VADER. Samples where VADER **strongly disagrees** with the dataset label (`|compound| > 0.35`) are removed as likely mislabelled. Neutral samples are always kept since VADER is known to underperform on neutral detection. This silver-label filtering improves training data quality without requiring manual re-annotation.

### Training steps

```
1. Load all 4 datasets with domain-specific parsers
2. Normalise labels → positive / negative / neutral
3. Apply VADER calibration filter (remove noisy samples)
4. Combine and balance classes via upsampling
5. TF-IDF vectorisation (40,000 features, unigrams + bigrams)
6. Train Logistic Regression (multinomial, max_iter=1000)
7. Evaluate on 15% held-out test set
8. Benchmark accuracy vs. VADER baseline
9. Save model.pkl, vectorizer.pkl, model_stats.json
```

```bash
python train_model.py
```

---

## Project structure

```
ConsultPulse/
│
├── backend/
│   ├── main.py                  # FastAPI app — all endpoints
│   ├── sentiment_engine.py      # VADER + ML + Gemini pipeline
│   ├── train_model.py           # Model training script
│   ├── database.py              # JSON read/write layer
│   ├── requirements.txt
│   ├── .env.example
│   └── data/
│       ├── *.csv                # place Kaggle datasets here
│       └── db/                  # auto-created — consultations + comments
│           ├── consultations.json
│           └── comments.json
│
├── src/
│   ├── api/
│   │   └── api.js               # fetch wrapper for all backend calls
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   ├── Consultations.jsx
│   │   ├── ConsultationDetail.jsx
│   │   ├── SubmitComment.jsx
│   │   └── Analytics.jsx
│   └── components/
│       ├── dashboard/
│       │   ├── StatCard.jsx
│       │   ├── SentimentDonut.jsx
│       │   └── SentimentBadge.jsx
│       └── analysis/
│           ├── CommentCard.jsx
│           └── WordCloudDisplay.jsx
│
├── package.json
├── vite.config.js
├── tailwind.config.js
├── .env.example
└── README.md
```

---

## Getting started

### Prerequisites

- Node.js 18+
- Python 3.10+
- A Gemini API key — free at [aistudio.google.com](https://aistudio.google.com/app/apikey)

---

### 1 · Clone

```bash
git clone https://github.com/Aashna890/consultpulse.git
cd consultpulse
```

---

### 2 · Backend setup

```bash
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Open .env and set:
# GEMINI_API_KEY=your_key_here
```

**Train the ML model** (optional but recommended):

Place your CSV files in `backend/data/` then run:

```bash
python train_model.py
```

If no datasets are present, the script auto-generates a small demo model so the app still functions.

**Start the API server:**

```bash
python main.py
# Runs at http://localhost:8000
# Interactive docs at http://localhost:8000/docs
```

---

### 3 · Frontend setup

```bash
# From project root
npm install

cp .env.example .env
# .env should contain:
# VITE_API_BASE_URL=http://localhost:8000

npm run dev
# Runs at http://localhost:5173
```

---

## API reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/consultations` | List all consultations |
| `POST` | `/consultations` | Create a new consultation |
| `PATCH` | `/consultations/{id}` | Update status, summary, etc. |
| `GET` | `/comments` | List comments (optionally filter by `consultation_id`) |
| `POST` | `/comments` | Submit a stakeholder comment |
| `POST` | `/comments/analyse` | Run full VADER → ML → Gemini pipeline |
| `GET` | `/analytics/summary` | Aggregated counts + keyword list |
| `GET` | `/model/stats` | Training accuracy, datasets, correction rate |

Full OpenAPI spec available at `http://localhost:8000/docs` when the server is running.

---

## Environment variables

### `backend/.env`

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### `.env` (frontend root)

```env
VITE_API_BASE_URL=http://localhost:8000
```

---

## Ethical design decisions

The system is built as a **decision-support tool**, not a decision-making one.

- **Fairness** — Only the comment text is analysed. Submitter identity, organisation size, and stakeholder type do not influence the sentiment score.
- **Transparency** — The UI shows raw VADER scores alongside the final Gemini result. A correction rate metric shows how often Stage 3 overrides Stage 1.
- **Human oversight** — Analysis must be triggered manually by an administrator. The AI never auto-processes or filters comments.
- **Privacy** — Only comment text is sent to the Gemini API. Email addresses are optional and are never forwarded to external services.
- **Accountability** — Every comment stores its Stage 1 and Stage 2 predictions alongside the final result, creating a full audit trail.

---

## Contributing

Pull requests are welcome. For significant changes, please open an issue first to discuss what you'd like to change.

---
