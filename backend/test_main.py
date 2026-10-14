
from fastapi.testclient import TestClient
from backend.main import app
import pytest

client = TestClient(app)
@pytest.fixture(autouse=True)
def reset_transactions():
    from backend.main import transactions

    transactions.clear()
    yield
    transactions.clear()


def test_health_check():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_create_transaction():
    response = client.post(
        "/transactions",
        json={
            "amount": 500,
            "transaction_type": "expense",
            "category": "Food",
            "description": "Lunch",
            "transaction_date": "2026-10-14",
        },
    )

    assert response.status_code == 201

    data = response.json()
    assert data["amount"] == 500
    assert data["transaction_type"] == "expense"
    assert data["category"] == "Food"
    assert "id" in data


def test_reject_zero_amount():
    response = client.post(
        "/transactions",
        json={
            "amount": 0,
            "transaction_type": "expense",
            "category": "Food",
            "description": "Lunch",
            "transaction_date": "2026-10-14",
        },
    )

    assert response.status_code == 422


def test_reject_invalid_transaction_type():
    response = client.post(
        "/transactions",
        json={
            "amount": 500,
            "transaction_type": "transfer",
            "category": "Other",
            "description": "Test transfer",
            "transaction_date": "2026-10-14",
        },
    )

    assert response.status_code == 422


def test_filter_transactions_by_type():
    response = client.get(
        "/transactions",
        params={"transaction_type": "expense"},
    )

    assert response.status_code == 200

    data = response.json()
    assert "transactions" in data
    assert all(
        t["transaction_type"] == "expense"
        for t in data["transactions"]
    )


def test_pagination_metadata():
    response = client.get(
        "/transactions",
        params={"skip": 0, "limit": 10},
    )

    assert response.status_code == 200

    data = response.json()
    assert data["skip"] == 0
    assert data["limit"] == 10
    assert data["count"] == len(data["transactions"])
    assert data["total"] >= data["count"]


def test_invalid_date_range():
    response = client.get(
        "/transactions",
        params={
            "start_date": "2026-10-20",
            "end_date": "2026-10-12",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == (
        "start_date cannot be after end_date"
    )
