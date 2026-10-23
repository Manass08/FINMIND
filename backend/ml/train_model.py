
import csv
from pathlib import Path

import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score, classification_report


BASE_DIR = Path(__file__).resolve().parent
DATASET_PATH = BASE_DIR / "training_data.csv"
MODEL_PATH = BASE_DIR / "expense_category_model.joblib"


def load_dataset():
    descriptions = []
    categories = []

    with DATASET_PATH.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)

        for row in reader:
            description = row["description"].strip()
            category = row["category"].strip()

            if description and category:
                descriptions.append(description)
                categories.append(category)

    if not descriptions:
        raise ValueError("The training dataset is empty.")

    if len(set(categories)) < 2:
        raise ValueError("The dataset must contain at least two categories.")

    return descriptions, categories


def main():
    descriptions, categories = load_dataset()

    print(f"Loaded {len(descriptions)} examples.")
    print(f"Categories: {sorted(set(categories))}")

    # Use a held-out test set only when there are enough examples
    # per category to make the split meaningful.
    counts = {label: categories.count(label) for label in set(categories)}
    can_split = (
        len(descriptions) >= 20
        and min(counts.values()) >= 2
        and len(descriptions) >= 2 * len(counts)
    )

    if can_split:
        X_train, X_test, y_train, y_test = train_test_split(
            descriptions,
            categories,
            test_size=0.25,
            random_state=42,
            stratify=categories,
        )
    else:
        print(
            "Warning: too few examples for a reliable held-out evaluation. "
            "Training on all examples; reported accuracy is unavailable."
        )
        X_train, y_train = descriptions, categories
        X_test, y_test = [], []

    model = Pipeline([
        ("tfidf", TfidfVectorizer(ngram_range=(1, 2), lowercase=True)),
        ("classifier", LogisticRegression(max_iter=1000, class_weight="balanced")),
    ])

    model.fit(X_train, y_train)

    if X_test:
        predictions = model.predict(X_test)
        print(f"Held-out accuracy: {accuracy_score(y_test, predictions):.2%}")
        print(classification_report(y_test, predictions, zero_division=0))

    joblib.dump(model, MODEL_PATH)
    print(f"Saved model to: {MODEL_PATH}")


if __name__ == "__main__":
    main()
