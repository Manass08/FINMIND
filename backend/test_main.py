
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from backend.main import app, transactions

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_transactions():
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
    assert Decimal(str(data["amount"])) == Decimal("500")
    assert data["transaction_type"] == "expense"
    assert data["category"] == "Food"
    assert data["description"] == "Lunch"
    assert data["transaction_date"] == "2026-10-14"
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
    client.post(
        "/transactions",
        json={
            "amount": 500,
            "transaction_type": "expense",
            "category": "Food",
            "description": "Lunch",
            "transaction_date": "2026-10-14",
        },
    )

    client.post(
        "/transactions",
        json={
            "amount": 50000,
            "transaction_type": "income",
            "category": "Salary",
            "description": "Monthly salary",
            "transaction_date": "2026-10-14",
        },
    )

    response = client.get(
        "/transactions",
        params={"transaction_type": "expense"},
    )

    assert response.status_code == 200

    data = response.json()
    assert data["count"] == 1
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


def test_update_transaction():
    create_response = client.post(
        "/transactions",
        json={
            "amount": 500,
            "transaction_type": "expense",
            "category": "Food",
            "description": "Lunch",
            "transaction_date": "2026-10-14",
        },
    )

    assert create_response.status_code == 201
    transaction_id = create_response.json()["id"]

    update_response = client.put(
        f"/transactions/{transaction_id}",
        json={
            "amount": 600,
            "transaction_type": "expense",
            "category": "Food",
            "description": "Updated lunch",
            "transaction_date": "2026-10-14",
        },
    )

    assert update_response.status_code == 200

    data = update_response.json()["transaction"]
    assert Decimal(str(data["amount"])) == Decimal("600")
    assert data["description"] == "Updated lunch"


def test_delete_transaction():
    create_response = client.post(
        "/transactions",
        json={
            "amount": 500,
            "transaction_type": "expense",
            "category": "Food",
            "description": "Lunch",
            "transaction_date": "2026-10-14",
        },
    )

    assert create_response.status_code == 201
    transaction_id = create_response.json()["id"]

    delete_response = client.delete(
        f"/transactions/{transaction_id}"
    )

    assert delete_response.status_code == 200
    assert (
        delete_response.json()["message"]
        == "Transaction deleted successfully"
    )

    get_response = client.get(
        f"/transactions/{transaction_id}"
    )
    assert get_response.status_code == 404


def test_transaction_summary_totals():
    client.post(
        "/transactions",
        json={
            "amount": 50000,
            "transaction_type": "income",
            "category": "Salary",
            "description": "Monthly salary",
            "transaction_date": "2026-10-01",
        },
    )

    client.post(
        "/transactions",
        json={
            "amount": 500,
            "transaction_type": "expense",
            "category": "Food",
            "description": "Lunch",
            "transaction_date": "2026-10-14",
        },
    )

    response = client.get("/transactions/summary")

    assert response.status_code == 200

    data = response.json()
    assert data["total_income"] == 50000
    assert data["total_expenses"] == 500
    assert data["balance"] == 49500
    assert data["transaction_count"] == 2
    assert data["income_by_category"]["Salary"] == 50000
    assert data["expenses_by_category"]["Food"] == 500
