"""
train_model.py
──────────────
Trains a Logistic Regression sentiment classifier on 4 datasets:

1. data.csv                    — Columns: Sentence, Sentiment (positive/negative)
2. sentimentdataset.csv        — Columns: Text, Sentiment (Positive/Negative/Neutral)
3. news_sentiment_analysis.csv — Columns: Title+Description, Sentiment (positive/negative/neutral)
4. twitter_training.csv        — No header; col[2]=sentiment, col[3]=tweet text

Run:
    python train_model.py
"""

import os
import json
import pickle
import re
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
from sklearn.utils import resample
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

os.makedirs("models", exist_ok=True)

vader = SentimentIntensityAnalyzer()


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def preprocess(text: str) -> str:
    if not isinstance(text, str):
        return ""
    text = text.lower()
    text = re.sub(r"http\S+|www\S+", "", text)
    text = re.sub(r"@\w+|#\w+", "", text)
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def normalise_label(label: str) -> str:
    if not isinstance(label, str):
        return "neutral"
    l = label.strip().lower()
    if l in ("positive", "pos"):
        return "positive"
    if l in ("negative", "neg"):
        return "negative"
    if l in ("neutral", "neu", "irrelevant"):
        return "neutral"
    return "neutral"


def vader_label(text: str):
    scores = vader.polarity_scores(text)
    c = scores["compound"]
    if c >= 0.05:
        return "positive", abs(c)
    elif c <= -0.05:
        return "negative", abs(c)
    else:
        return "neutral", 1 - abs(c)


# ─────────────────────────────────────────────
# Dataset Loaders
# ─────────────────────────────────────────────

def load_financial_phrases(path="data/data.csv"):
    """Columns: Sentence, Sentiment"""
    print("📂 Loading Financial Phrases (data.csv)...")
    if not os.path.exists(path):
        print(f"   ⚠️  Not found: {path} — skipping")
        return pd.DataFrame()
    df = pd.read_csv(path, on_bad_lines="skip")
    df = df.dropna(subset=["Sentence", "Sentiment"])
    df["text"] = df["Sentence"].apply(preprocess)
    df["label"] = df["Sentiment"].apply(normalise_label)
    df = df[df["text"].str.len() > 5]
    print(f"   ✅ {len(df)} rows | {df['label'].value_counts().to_dict()}")
    return df[["text", "label"]]


def load_social_sentiment(path="data/sentimentdataset.csv"):
    """Columns: Text, Sentiment"""
    print("📂 Loading Social Sentiment (sentimentdataset.csv)...")
    if not os.path.exists(path):
        print(f"   ⚠️  Not found: {path} — skipping")
        return pd.DataFrame()
    df = pd.read_csv(path, on_bad_lines="skip")
    df = df.dropna(subset=["Text", "Sentiment"])
    df["text"] = df["Text"].apply(preprocess)
    df["label"] = df["Sentiment"].apply(normalise_label)
    df = df[df["text"].str.len() > 5]
    print(f"   ✅ {len(df)} rows | {df['label'].value_counts().to_dict()}")
    return df[["text", "label"]]


def load_news_sentiment(path="data/news_sentiment_analysis.csv"):
    """Columns: Title, Description, Sentiment — combine Title+Description as text"""
    print("📂 Loading News Sentiment (news_sentiment_analysis.csv)...")
    if not os.path.exists(path):
        print(f"   ⚠️  Not found: {path} — skipping")
        return pd.DataFrame()
    df = pd.read_csv(path, on_bad_lines="skip")
    df = df.dropna(subset=["Sentiment"])
    df["Title"] = df["Title"].fillna("")
    df["Description"] = df["Description"].fillna("")
    df["text"] = (df["Title"] + " " + df["Description"]).apply(preprocess)
    df["label"] = df["Sentiment"].apply(normalise_label)
    df = df[df["text"].str.len() > 5]
    print(f"   ✅ {len(df)} rows | {df['label'].value_counts().to_dict()}")
    return df[["text", "label"]]


def load_twitter(path="data/twitter_training.csv"):
    """
    No header. Positional columns:
      [0]=id, [1]=topic, [2]=sentiment, [3]=tweet text
    """
    print("📂 Loading Twitter Training (twitter_training.csv)...")
    if not os.path.exists(path):
        print(f"   ⚠️  Not found: {path} — skipping")
        return pd.DataFrame()
    df = pd.read_csv(
        path,
        header=None,
        names=["id", "topic", "sentiment", "text"],
        on_bad_lines="skip",
        encoding="latin-1",
    )
    df = df.dropna(subset=["text", "sentiment"])
    df["text"] = df["text"].apply(preprocess)
    df["label"] = df["sentiment"].apply(normalise_label)
    df = df[df["text"].str.len() > 5]
    print(f"   ✅ {len(df)} rows | {df['label'].value_counts().to_dict()}")
    return df[["text", "label"]]


# ─────────────────────────────────────────────
# VADER Calibration Filter
# ─────────────────────────────────────────────

def vader_calibration_filter(df: pd.DataFrame, min_confidence: float = 0.35) -> pd.DataFrame:
    """
    For non-neutral samples, keep only those where VADER agrees
    with the dataset label AND is confident enough.
    Neutral samples are always kept (VADER is weak at neutral).
    This removes mislabelled or ambiguous samples.
    """
    print("   🔬 Applying VADER calibration filter...")
    keep = []
    for _, row in df.iterrows():
        if row["label"] == "neutral":
            keep.append(True)
            continue
        vlabel, conf = vader_label(row["text"])
        keep.append(vlabel == row["label"] and conf >= min_confidence)
    filtered = df[keep].reset_index(drop=True)
    print(f"   ✅ Kept {len(filtered)}/{len(df)} (removed {len(df)-len(filtered)} noisy samples)")
    return filtered


# ─────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────

def main():
    print("\n" + "=" * 60)
    print("  eConsultation Sentiment Model Training")
    print("=" * 60 + "\n")

    loaders = [
        (load_financial_phrases, "Financial Phrases"),
        (load_social_sentiment,  "Social Sentiment"),
        (load_news_sentiment,    "News Sentiment"),
        (load_twitter,           "Twitter"),
    ]

    dfs = []
    dataset_stats = []

    for loader, name in loaders:
        df = loader()
        if len(df) == 0:
            print()
            continue
        raw = len(df)
        df = vader_calibration_filter(df)
        if len(df) == 0:
            print(f"   ⚠️  {name}: 0 samples after filter — skipping\n")
            continue
        dfs.append(df)
        dataset_stats.append({
            "name": name,
            "raw_samples": raw,
            "filtered_samples": len(df),
            "label_distribution": df["label"].value_counts().to_dict(),
        })
        print()

    if not dfs:
        print("❌ No datasets loaded.")
        return

    # Combine
    combined = pd.concat(dfs, ignore_index=True).dropna(subset=["text", "label"])
    combined = combined[combined["text"].str.len() > 5]
    print(f"📊 Combined: {len(combined)} samples")
    print(combined["label"].value_counts(), "\n")

    # Balance classes by upsampling minority classes
    max_size = combined["label"].value_counts().max()
    balanced = pd.concat([
        resample(combined[combined["label"] == lbl], replace=True,
                 n_samples=max_size, random_state=42)
        for lbl in combined["label"].unique()
    ], ignore_index=True).sample(frac=1, random_state=42)
    print(f"📊 Balanced: {len(balanced)} samples")
    print(balanced["label"].value_counts(), "\n")

    # TF-IDF
    print("🔢 Vectorizing with TF-IDF...")
    vectorizer = TfidfVectorizer(
        max_features=40000,
        ngram_range=(1, 2),
        min_df=2,
        max_df=0.90,
        sublinear_tf=True,
    )
    X_vec = vectorizer.fit_transform(balanced["text"].tolist())
    y = balanced["label"].tolist()
    print(f"   Vocabulary: {len(vectorizer.vocabulary_)} features\n")

    # Split
    X_train, X_test, y_train, y_test = train_test_split(
        X_vec, y, test_size=0.15, random_state=42, stratify=y
    )
    print(f"   Train: {X_train.shape[0]}  |  Test: {X_test.shape[0]}\n")

    # Train
    print("🧠 Training Logistic Regression...")
    model = LogisticRegression(
        max_iter=1000, C=1.0, solver="lbfgs",
        multi_class="multinomial", n_jobs=-1, random_state=42,
    )
    model.fit(X_train, y_train)

    # Evaluate
    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    report = classification_report(y_test, y_pred, output_dict=True)
    print("\n📈 Test Set Results:")
    print(classification_report(y_test, y_pred))

    # VADER Benchmark
    print("⚖️  VADER Benchmark (2000 samples):")
    sample = balanced.sample(min(2000, len(balanced)), random_state=42)
    vader_preds = [vader_label(t)[0] for t in sample["text"].tolist()]
    vader_acc = accuracy_score(sample["label"].tolist(), vader_preds)
    improvement = (acc - vader_acc) * 100
    print(f"   VADER Accuracy : {vader_acc:.4f}")
    print(f"   ML Accuracy    : {acc:.4f}")
    print(f"   Improvement    : {improvement:+.2f}%\n")

    # Save
    with open("models/sentiment_model.pkl", "wb") as f:
        pickle.dump(model, f)
    with open("models/vectorizer.pkl", "wb") as f:
        pickle.dump(vectorizer, f)

    stats = {
        "accuracy": round(acc, 4),
        "vader_accuracy": round(vader_acc, 4),
        "improvement_over_vader_pct": round(improvement, 2),
        "total_training_samples": len(balanced),
        "classes": model.classes_.tolist(),
        "datasets": dataset_stats,
        "classification_report": report,
        "trained_at": pd.Timestamp.now().isoformat(),
    }
    with open("models/model_stats.json", "w") as f:
        json.dump(stats, f, indent=2)

    print("✅ Training complete!")
    print(f"   models/sentiment_model.pkl")
    print(f"   models/model_stats.json")
    print(f"\n   ML Accuracy    : {acc:.4f}")
    print(f"   VADER Baseline : {vader_acc:.4f}")
    print(f"   Improvement    : {improvement:+.2f}%")


if __name__ == "__main__":
    main()