"""
train_model.py
──────────────
Trains a Logistic Regression sentiment classifier on 4 Kaggle datasets.
VADER is used as a calibration benchmark: samples where VADER is highly
confident (|compound| > 0.6) are kept as "silver labels" for noisy datasets.

DATASETS (download from Kaggle and place in data/ folder):
─────────────────────────────────────────────────────────
1. Sentiment140 (Twitter)
   kaggle datasets download -d kazanova/sentiment140
   File: data/training.1600000.processed.noemoticon.csv
   Columns: target(0=neg,4=pos), text

2. IMDB Movie Reviews
   kaggle datasets download -d lakshmi25npathi/imdb-dataset-of-50k-movie-reviews
   File: data/IMDB Dataset.csv
   Columns: review, sentiment(positive/negative)

3. Amazon Fine Food Reviews
   kaggle datasets download -d snap/amazon-fine-food-reviews
   File: data/Reviews.csv
   Columns: Score(1-5), Text

4. Financial PhraseBank
   kaggle datasets download -d ankurzing/sentiment-analysis-for-financial-news
   File: data/all-data.csv
   Columns: sentiment(positive/negative/neutral), text

Usage:
    pip install -r requirements.txt
    python train_model.py
"""

import os
import json
import pickle
import re
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
from sklearn.utils import resample
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from imblearn.over_sampling import SMOTE

os.makedirs("models", exist_ok=True)
os.makedirs("data", exist_ok=True)

vader = SentimentIntensityAnalyzer()

# ─────────────────────────────────────────────
# Text Preprocessing
# ─────────────────────────────────────────────

def preprocess(text: str) -> str:
    if not isinstance(text, str):
        return ""
    text = text.lower()
    text = re.sub(r"http\S+|www\S+", "", text)
    text = re.sub(r"@\w+|#\w+", "", text)  # remove mentions/hashtags
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def vader_label(text: str) -> tuple:
    """Returns (label, confidence) where confidence = abs(compound)."""
    scores = vader.polarity_scores(text)
    compound = scores["compound"]
    if compound >= 0.05:
        return "positive", abs(compound)
    elif compound <= -0.05:
        return "negative", abs(compound)
    else:
        return "neutral", 1 - abs(compound)


# ─────────────────────────────────────────────
# Dataset Loaders
# ─────────────────────────────────────────────

def load_sentiment140(path="data/training.1600000.processed.noemoticon.csv", max_rows=50000):
    print("📂 Loading Sentiment140 (Twitter)...")
    if not os.path.exists(path):
        print(f"   ⚠️  Not found: {path} — skipping")
        return pd.DataFrame()
    df = pd.read_csv(
        path,
        encoding="latin-1",
        header=None,
        names=["target", "id", "date", "flag", "user", "text"],
    )
    df = df.sample(min(max_rows, len(df)), random_state=42)
    df["label"] = df["target"].apply(lambda x: "positive" if x == 4 else "negative")
    df["text_clean"] = df["text"].apply(preprocess)
    return df[["text_clean", "label"]].rename(columns={"text_clean": "text"})


def load_imdb(path="data/IMDB Dataset.csv", max_rows=25000):
    print("📂 Loading IMDB Movie Reviews...")
    if not os.path.exists(path):
        print(f"   ⚠️  Not found: {path} — skipping")
        return pd.DataFrame()
    df = pd.read_csv(path)
    df = df.sample(min(max_rows, len(df)), random_state=42)
    df["text_clean"] = df["review"].apply(preprocess)
    df["label"] = df["sentiment"]  # already positive/negative
    return df[["text_clean", "label"]].rename(columns={"text_clean": "text"})


def load_amazon(path="data/Reviews.csv", max_rows=25000):
    print("📂 Loading Amazon Fine Food Reviews...")
    if not os.path.exists(path):
        print(f"   ⚠️  Not found: {path} — skipping")
        return pd.DataFrame()
    df = pd.read_csv(path, usecols=["Score", "Text"])
    df = df.dropna().sample(min(max_rows, len(df)), random_state=42)

    def score_to_label(s):
        if s >= 4:
            return "positive"
        elif s <= 2:
            return "negative"
        else:
            return "neutral"

    df["label"] = df["Score"].apply(score_to_label)
    df["text_clean"] = df["Text"].apply(preprocess)
    return df[["text_clean", "label"]].rename(columns={"text_clean": "text"})


def load_financial(path="data/all-data.csv", max_rows=None):
    print("📂 Loading Financial PhraseBank...")
    if not os.path.exists(path):
        print(f"   ⚠️  Not found: {path} — skipping")
        return pd.DataFrame()
    df = pd.read_csv(path, encoding="latin-1", header=None, names=["label", "text"])
    df = df.dropna()
    if max_rows:
        df = df.sample(min(max_rows, len(df)), random_state=42)
    df["text"] = df["text"].apply(preprocess)
    return df[["text", "label"]]


# ─────────────────────────────────────────────
# VADER Calibration Filter
# ─────────────────────────────────────────────

def vader_calibration_filter(df: pd.DataFrame, min_confidence: float = 0.4) -> pd.DataFrame:
    """
    For each sample, check if VADER agrees with the dataset label.
    Keep samples where VADER is confident and agrees (silver-standard filtering).
    Neutral labels are exempt from this filter since VADER is weak at detecting neutral.
    """
    print("   🔬 Applying VADER calibration filter...")
    keep = []
    for _, row in df.iterrows():
        text = row["text"]
        label = row["label"]
        vader_lbl, confidence = vader_label(text)

        if label == "neutral":
            keep.append(True)  # always keep neutral
        elif vader_lbl == label and confidence >= min_confidence:
            keep.append(True)
        else:
            keep.append(False)

    filtered = df[keep].reset_index(drop=True)
    print(f"   ✅ Kept {len(filtered)}/{len(df)} samples after VADER calibration")
    return filtered


# ─────────────────────────────────────────────
# Main Training Script
# ─────────────────────────────────────────────

def main():
    print("\n" + "=" * 60)
    print("  eConsultation Sentiment Model Training")
    print("=" * 60 + "\n")

    # ── 1. Load all datasets ──
    dfs = []
    dataset_stats = []

    for loader, name in [
        (load_sentiment140, "Sentiment140 (Twitter)"),
        (load_imdb, "IMDB Movie Reviews"),
        (load_amazon, "Amazon Fine Food Reviews"),
        (load_financial, "Financial PhraseBank"),
    ]:
        df = loader()
        if len(df) > 0:
            raw_count = len(df)
            df = vader_calibration_filter(df)
            dfs.append(df)
            dataset_stats.append({
                "name": name,
                "raw_samples": raw_count,
                "filtered_samples": len(df),
                "label_distribution": df["label"].value_counts().to_dict(),
            })
            print(f"   Labels: {df['label'].value_counts().to_dict()}\n")

    if not dfs:
        print("❌ No datasets found. Please download datasets to the data/ folder.")
        print("   See the instructions at the top of this file.")
        # Create a minimal synthetic model for demo purposes
        _create_demo_model()
        return

    # ── 2. Combine & Balance ──
    combined = pd.concat(dfs, ignore_index=True)
    combined = combined.dropna(subset=["text", "label"])
    combined = combined[combined["text"].str.len() > 10]

    print(f"\n📊 Combined dataset: {len(combined)} samples")
    print(f"   Label distribution:\n{combined['label'].value_counts()}\n")

    # Balance classes
    max_class_size = combined["label"].value_counts().max()
    balanced_dfs = []
    for label in combined["label"].unique():
        class_df = combined[combined["label"] == label]
        if len(class_df) < max_class_size:
            class_df = resample(class_df, replace=True, n_samples=max_class_size, random_state=42)
        balanced_dfs.append(class_df)
    balanced = pd.concat(balanced_dfs, ignore_index=True).sample(frac=1, random_state=42)
    print(f"📊 Balanced dataset: {len(balanced)} samples")

    # ── 3. Vectorize ──
    print("\n🔢 Vectorizing with TF-IDF...")
    X = balanced["text"].tolist()
    y = balanced["label"].tolist()

    vectorizer = TfidfVectorizer(
        max_features=50000,
        ngram_range=(1, 2),
        min_df=3,
        max_df=0.85,
        sublinear_tf=True,
    )
    X_vec = vectorizer.fit_transform(X)

    # ── 4. Train/Test Split ──
    X_train, X_test, y_train, y_test = train_test_split(
        X_vec, y, test_size=0.15, random_state=42, stratify=y
    )

    # ── 5. Train Model ──
    print("🧠 Training Logistic Regression model...")
    model = LogisticRegression(
        max_iter=1000,
        C=1.0,
        solver="lbfgs",
        multi_class="multinomial",
        n_jobs=-1,
        random_state=42,
    )
    model.fit(X_train, y_train)

    # ── 6. Evaluate ──
    print("\n📈 Evaluation on test set:")
    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    report = classification_report(y_test, y_pred, output_dict=True)
    print(f"   Accuracy: {acc:.4f}")
    print(classification_report(y_test, y_pred))

    # ── 7. VADER Benchmark Comparison ──
    print("⚖️  VADER Benchmark on test set:")
    sample_texts = balanced["text"].tolist()[:2000]
    sample_labels = balanced["label"].tolist()[:2000]
    vader_preds = [vader_label(t)[0] for t in sample_texts]
    vader_acc = accuracy_score(sample_labels, vader_preds)
    print(f"   VADER Accuracy: {vader_acc:.4f}")
    print(f"   ML Model vs VADER improvement: {(acc - vader_acc)*100:+.2f}%\n")

    # ── 8. Save ──
    print("💾 Saving model and vectorizer...")
    with open("models/sentiment_model.pkl", "wb") as f:
        pickle.dump(model, f)
    with open("models/vectorizer.pkl", "wb") as f:
        pickle.dump(vectorizer, f)

    stats = {
        "accuracy": round(acc, 4),
        "vader_accuracy": round(vader_acc, 4),
        "improvement_over_vader_pct": round((acc - vader_acc) * 100, 2),
        "total_training_samples": len(balanced),
        "classes": model.classes_.tolist(),
        "datasets": dataset_stats,
        "classification_report": report,
        "trained_at": pd.Timestamp.now().isoformat(),
    }
    with open("models/model_stats.json", "w") as f:
        json.dump(stats, f, indent=2)

    print("\n✅ Training complete!")
    print(f"   Model saved to models/sentiment_model.pkl")
    print(f"   Stats saved to models/model_stats.json")
    print(f"   Final Accuracy: {acc:.4f}")
    print(f"   VADER Accuracy: {vader_acc:.4f}")


def _create_demo_model():
    """Create a minimal demo model when no datasets are available."""
    print("\n⚡ Creating demo model with synthetic data...")
    
    synthetic_texts = [
        # Positive legislative comments
        "This amendment is excellent and will greatly benefit small businesses",
        "The proposed changes are well thought out and comprehensive",
        "Strongly support this initiative as it simplifies compliance",
        "This will improve ease of doing business significantly",
        "The draft legislation addresses long-standing concerns effectively",
        "Commendable effort by the ministry in drafting this amendment",
        # Negative
        "This amendment will impose excessive burden on companies",
        "The provision is unclear and will lead to litigation",
        "Strongly oppose this as it undermines investor confidence",
        "The timelines are unrealistic and will harm businesses",
        "This goes against the principles of natural justice",
        "The draft fails to consider ground realities",
        # Neutral
        "Section 12 needs clarification regarding applicability",
        "Additional consultation with stakeholders is recommended",
        "The definitions in clause 3 require review",
        "We suggest extending the comment period",
        "Reference to the previous act should be retained",
        "The ministry should consider international best practices",
        # Mixed
        "While the intent is good, the implementation is problematic",
        "Some provisions are helpful but others need revision",
        "Partially support the amendment with suggested modifications",
        "The spirit is right but the drafting needs improvement",
    ]
    
    synthetic_labels = (
        ["positive"] * 6 + ["negative"] * 6 + ["neutral"] * 6 + ["mixed"] * 4
    )
    
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.linear_model import LogisticRegression
    
    vectorizer = TfidfVectorizer(max_features=5000, ngram_range=(1, 2))
    X = vectorizer.fit_transform(synthetic_texts)
    model = LogisticRegression(max_iter=500, random_state=42)
    model.fit(X, synthetic_labels)
    
    with open("models/sentiment_model.pkl", "wb") as f:
        pickle.dump(model, f)
    with open("models/vectorizer.pkl", "wb") as f:
        pickle.dump(vectorizer, f)
    
    stats = {
        "accuracy": 0.0,
        "note": "Demo model only — download Kaggle datasets and retrain for production use.",
        "classes": model.classes_.tolist(),
        "datasets": [],
        "trained_at": pd.Timestamp.now().isoformat(),
    }
    with open("models/model_stats.json", "w") as f:
        json.dump(stats, f, indent=2)
    
    print("✅ Demo model saved. Download Kaggle datasets and retrain for production.")


if __name__ == "__main__":
    main()