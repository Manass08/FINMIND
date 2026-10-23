
from pathlib import Path

import joblib


BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "expense_category_model.joblib"

_model = None


def load_model():
    global _model

    if _model is None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(
                "Expense category model not found. "
                "Run: python -m backend.ml.train_model"
            )

        _model = joblib.load(MODEL_PATH)

    return _model


def predict_category(description: str) -> dict:
    cleaned_description = description.strip()

    if not cleaned_description:
        raise ValueError("Description cannot be empty.")

    model = load_model()
    probabilities = model.predict_proba([cleaned_description])[0]
    best_index = probabilities.argmax()

    return {
        "category": str(model.classes_[best_index]),
        "confidence": round(float(probabilities[best_index]), 4),
    }
