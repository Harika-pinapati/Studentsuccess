import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

_model = None


def train_model():
    """Train a local demonstration model on synthetic data (no network/API)."""
    global _model
    rng = np.random.default_rng(42)
    n = 700
    attendance = rng.uniform(35, 100, n)
    marks = rng.uniform(20, 100, n)
    assignments = rng.uniform(20, 100, n)

    score = (
        (attendance < 65).astype(int) * 0.38
        + (marks < 50).astype(int) * 0.42
        + (assignments < 55).astype(int) * 0.20
        + rng.normal(0, 0.08, n)
    )
    labels = (score >= 0.42).astype(int)

    _model = make_pipeline(
        StandardScaler(),
        RandomForestClassifier(n_estimators=120, random_state=42, class_weight="balanced"),
    )
    _model.fit(np.column_stack([attendance, marks, assignments]), labels)


def predict_risk(attendance: float, marks: float, assignments: float):
    if _model is None:
        train_model()

    features = np.array([[attendance, marks, assignments]])
    probability = float(_model.predict_proba(features)[0][1])
    if probability >= 0.68:
        category = "High"
    elif probability >= 0.38:
        category = "Moderate"
    else:
        category = "Low"

    factors = []
    if attendance < 75:
        factors.append(f"Attendance is {attendance:.0f}%; consider checking attendance barriers.")
    if marks < 60:
        factors.append(f"Marks are {marks:.0f}%; offer subject-specific academic support.")
    if assignments < 70:
        factors.append(f"Assignment completion is {assignments:.0f}%; check workload or access issues.")
    if not factors:
        factors.append("No major threshold flags from the selected indicators; continue routine check-ins.")

    actions = []
    if attendance < 75:
        actions.append("Arrange a supportive attendance check-in.")
    if marks < 60:
        actions.append("Offer faculty office hours or peer tutoring.")
    if assignments < 70:
        actions.append("Review assignment instructions, workload, and deadlines.")
    if not actions:
        actions.append("Recognize progress and maintain regular feedback.")

    return {
        "risk_category": category,
        "risk_probability": round(probability * 100, 1),
        "factors": factors,
        "recommended_actions": actions,
        "model_note": "Demonstration model trained on synthetic data; not validated for real student decisions.",
    }
