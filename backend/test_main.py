from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.main import Base, app, get_db

TEST_ENGINE = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSessionLocal = sessionmaker(
    bind=TEST_ENGINE,
    autoflush=False,
    expire_on_commit=False,
)
client = TestClient(app)


@pytest.fixture(autouse=True)
def isolated_test_database():
    Base.metadata.drop_all(bind=TEST_ENGINE)
    Base.metadata.create_all(bind=TEST_ENGINE)

    def override_get_db():
        db = TestSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=TEST_ENGINE)


@pytest.fixture
def authenticated_client():
    signup = client.post(
        "/auth/signup",
        json={
            "full_name": "Test User",
            "email": "test@example.com",
            "password": "safe-test-password",
        },
    )
    assert signup.status_code == 201
    login = client.post(
        "/auth/login",
        json={"email": "test@example.com", "password": "safe-test-password"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]
    return client, {"Authorization": f"Bearer {token}"}


def transaction_payload(**overrides):
    payload = {
        "amount": 500,
        "transaction_type": "expense",
        "category": "Food",
        "description": "Lunch",
        "transaction_date": "2026-10-14",
    }
    payload.update(overrides)
    return payload


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_signup_stores_full_name_and_normalizes_email():
    response = client.post(
        "/auth/signup",
        json={
            "full_name": "  Test   User  ",
            "email": "TEST@example.com",
            "password": "safe-test-password",
        },
    )
    assert response.status_code == 201
    assert response.json()["user"]["full_name"] == "Test User"
    assert response.json()["user"]["email"] == "test@example.com"


def test_signup_rejects_duplicate_email():
    payload = {
        "full_name": "Test User",
        "email": "test@example.com",
        "password": "safe-test-password",
    }
    assert client.post("/auth/signup", json=payload).status_code == 201
    payload["email"] = "TEST@example.com"
    assert client.post("/auth/signup", json=payload).status_code == 409


def test_signup_rejects_short_password():
    response = client.post(
        "/auth/signup",
        json={
            "full_name": "Test User",
            "email": "test@example.com",
            "password": "short",
        },
    )
    assert response.status_code == 422


def test_login_and_current_user_profile():
    signup = client.post(
        "/auth/signup",
        json={
            "full_name": "Profile Tester",
            "email": "profile@example.com",
            "password": "safe-test-password",
        },
    )
    assert signup.status_code == 201
    login = client.post(
        "/auth/login",
        json={"email": "PROFILE@example.com", "password": "safe-test-password"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["full_name"] == "Profile Tester"
    assert me.json()["email"] == "profile@example.com"


def test_login_rejects_wrong_password():
    client.post(
        "/auth/signup",
        json={
            "full_name": "Test User",
            "email": "test@example.com",
            "password": "safe-test-password",
        },
    )
    response = client.post(
        "/auth/login",
        json={"email": "test@example.com", "password": "incorrect-password"},
    )
    assert response.status_code == 401


def test_protected_endpoints_reject_missing_token():
    assert client.get("/auth/me").status_code == 401
    assert client.get("/transactions").status_code == 401
    assert client.get("/transactions/summary").status_code == 401
    assert client.post("/transactions", json=transaction_payload()).status_code == 401


def test_create_transaction(authenticated_client):
    api, headers = authenticated_client
    response = api.post("/transactions", json=transaction_payload(), headers=headers)
    assert response.status_code == 201
    data = response.json()
    assert Decimal(str(data["amount"])) == Decimal("500.00")
    assert data["transaction_type"] == "expense"
    assert data["category"] == "Food"
    assert data["description"] == "Lunch"
    assert data["transaction_date"] == "2026-10-14"
    assert "id" in data


def test_reject_zero_amount(authenticated_client):
    api, headers = authenticated_client
    response = api.post(
        "/transactions",
        json=transaction_payload(amount=0),
        headers=headers,
    )
    assert response.status_code == 422


def test_reject_invalid_transaction_type(authenticated_client):
    api, headers = authenticated_client
    response = api.post(
        "/transactions",
        json=transaction_payload(transaction_type="transfer"),
        headers=headers,
    )
    assert response.status_code == 422


def test_filter_transactions_by_type(authenticated_client):
    api, headers = authenticated_client
    api.post("/transactions", json=transaction_payload(), headers=headers)
    api.post(
        "/transactions",
        json=transaction_payload(
            amount=50000,
            transaction_type="income",
            category="Salary",
            description="Monthly salary",
        ),
        headers=headers,
    )
    response = api.get(
        "/transactions",
        params={"transaction_type": "expense"},
        headers=headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 1
    assert all(t["transaction_type"] == "expense" for t in data["transactions"])


def test_pagination_metadata(authenticated_client):
    api, headers = authenticated_client
    response = api.get("/transactions", params={"skip": 0, "limit": 10}, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["skip"] == 0
    assert data["limit"] == 10
    assert data["count"] == len(data["transactions"])
    assert data["total"] >= data["count"]


def test_invalid_date_range(authenticated_client):
    api, headers = authenticated_client
    response = api.get(
        "/transactions",
        params={"start_date": "2026-10-20", "end_date": "2026-10-12"},
        headers=headers,
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "start_date cannot be after end_date"


def test_update_transaction(authenticated_client):
    api, headers = authenticated_client
    created = api.post("/transactions", json=transaction_payload(), headers=headers)
    assert created.status_code == 201
    transaction_id = created.json()["id"]
    updated = api.put(
        f"/transactions/{transaction_id}",
        json=transaction_payload(amount=600, description="Updated lunch"),
        headers=headers,
    )
    assert updated.status_code == 200
    data = updated.json()["transaction"]
    assert Decimal(str(data["amount"])) == Decimal("600.00")
    assert data["description"] == "Updated lunch"


def test_delete_transaction(authenticated_client):
    api, headers = authenticated_client
    created = api.post("/transactions", json=transaction_payload(), headers=headers)
    assert created.status_code == 201
    transaction_id = created.json()["id"]
    deleted = api.delete(f"/transactions/{transaction_id}", headers=headers)
    assert deleted.status_code == 200
    assert deleted.json()["message"] == "Transaction deleted successfully"
    assert api.get(f"/transactions/{transaction_id}", headers=headers).status_code == 404


def test_transaction_summary_totals(authenticated_client):
    api, headers = authenticated_client
    api.post(
        "/transactions",
        json=transaction_payload(
            amount=50000,
            transaction_type="income",
            category="Salary",
            description="Monthly salary",
            transaction_date="2026-10-01",
        ),
        headers=headers,
    )
    api.post("/transactions", json=transaction_payload(), headers=headers)
    response = api.get("/transactions/summary", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total_income"] == 50000
    assert data["total_expenses"] == 500
    assert data["balance"] == 49500
    assert data["transaction_count"] == 2
    assert data["income_by_category"]["Salary"] == 50000
    assert data["expenses_by_category"]["Food"] == 500


def test_transactions_are_isolated_between_users(authenticated_client):
    api, first_headers = authenticated_client
    created = api.post("/transactions", json=transaction_payload(), headers=first_headers)
    assert created.status_code == 201

    signup = api.post(
        "/auth/signup",
        json={
            "full_name": "Second User",
            "email": "second@example.com",
            "password": "safe-test-password",
        },
    )
    assert signup.status_code == 201
    login = api.post(
        "/auth/login",
        json={"email": "second@example.com", "password": "safe-test-password"},
    )
    second_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    second_list = api.get("/transactions", headers=second_headers)
    assert second_list.status_code == 200
    assert second_list.json()["total"] == 0
    assert api.get(
        f"/transactions/{created.json()['id']}", headers=second_headers
    ).status_code == 404

    
    transaction_id = created.json()["id"]

    # User B must not update User A's transaction.
    update_response = api.put(
        f"/transactions/{transaction_id}",
        json=transaction_payload(
            amount=999,
            description="Unauthorized update",
        ),
        headers=second_headers,
    )
    assert update_response.status_code == 404

    # User B must not delete User A's transaction.
    delete_response = api.delete(
        f"/transactions/{transaction_id}",
        headers=second_headers,
    )
    assert delete_response.status_code == 404

    # Verify User A still owns and can access the transaction.
    owner_response = api.get(
        f"/transactions/{transaction_id}",
        headers=first_headers,
    )
    assert owner_response.status_code == 200

