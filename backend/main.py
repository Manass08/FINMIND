
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Literal
from datetime import date
from uuid import uuid4

app = FastAPI(
    title="FINMIND API",
    description="Financial Intelligence and Risk Platform",
    version="0.2.0",
)


# -------------------------
# Data Model
# -------------------------

class TransactionCreate(BaseModel):
    amount: float = Field(gt=0)
    transaction_type: Literal["income", "expense"]
    category: str = Field(min_length=1, max_length=50)
    description: str = Field(min_length=1, max_length=200)
    transaction_date: date


# Temporary in-memory storage.
# PostgreSQL will be added later.
transactions = []


# -------------------------
# Home and Health
# -------------------------

@app.get("/")
def home():
    return {
        "message": "FINMIND API is running!",
        "version": "0.2.0",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


# -------------------------
# Create Transaction
# -------------------------

@app.post("/transactions", status_code=201)
def create_transaction(transaction: TransactionCreate):
    new_transaction = {
        "id": str(uuid4()),
        **transaction.model_dump(mode="json"),
    }

    transactions.append(new_transaction)
    return new_transaction


# -------------------------
# List, Filter, Sort and Paginate
# -------------------------

@app.get("/transactions")
def get_transactions(
    transaction_type: Literal["income", "expense"] | None = None,
    category: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=10, ge=1, le=100),
    sort_by: Literal["date", "amount"] = "date",
    order: Literal["asc", "desc"] = "desc",
):
    # Validate the date range first.
    if (
        start_date is not None
        and end_date is not None
        and start_date > end_date
    ):
        raise HTTPException(
            status_code=400,
            detail="start_date cannot be after end_date",
        )

    filtered_transactions = transactions.copy()

    # Filter by transaction type.
    if transaction_type is not None:
        filtered_transactions = [
            t for t in filtered_transactions
            if t["transaction_type"] == transaction_type
        ]

    # Filter by category, ignoring case and surrounding spaces.
    if category is not None:
        filtered_transactions = [
            t for t in filtered_transactions
            if t["category"].strip().lower()
            == category.strip().lower()
        ]

    # Filter by start date.
    if start_date is not None:
        filtered_transactions = [
            t for t in filtered_transactions
            if date.fromisoformat(t["transaction_date"]) >= start_date
        ]

    # Filter by end date.
    if end_date is not None:
        filtered_transactions = [
            t for t in filtered_transactions
            if date.fromisoformat(t["transaction_date"]) <= end_date
        ]

    # Sort the filtered results.
    if sort_by == "date":
        filtered_transactions.sort(
            key=lambda t: t["transaction_date"],
            reverse=(order == "desc"),
        )
    else:
        filtered_transactions.sort(
            key=lambda t: t["amount"],
            reverse=(order == "desc"),
        )

    # Calculate total AFTER filtering but BEFORE pagination.
    total = len(filtered_transactions)

    # Apply pagination.
    paginated_transactions = filtered_transactions[
        skip:skip + limit
    ]

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "count": len(paginated_transactions),
        "transactions": paginated_transactions,
    }


# -------------------------
# Financial Summary
# -------------------------

@app.get("/transactions/summary")
def get_transaction_summary():
    total_income = sum(
        t["amount"]
        for t in transactions
        if t["transaction_type"] == "income"
    )

    total_expenses = sum(
        t["amount"]
        for t in transactions
        if t["transaction_type"] == "expense"
    )

    income_by_category = {}
    expenses_by_category = {}

    for transaction in transactions:
        category = transaction["category"]
        amount = transaction["amount"]

        if transaction["transaction_type"] == "income":
            income_by_category[category] = (
                income_by_category.get(category, 0) + amount
            )
        else:
            expenses_by_category[category] = (
                expenses_by_category.get(category, 0) + amount
            )

    return {
        "total_income": round(total_income, 2),
        "total_expenses": round(total_expenses, 2),
        "balance": round(total_income - total_expenses, 2),
        "transaction_count": len(transactions),
        "income_by_category": {
            category: round(amount, 2)
            for category, amount in income_by_category.items()
        },
        "expenses_by_category": {
            category: round(amount, 2)
            for category, amount in expenses_by_category.items()
        },
    }


# -------------------------
# Get One Transaction
# -------------------------

@app.get("/transactions/{transaction_id}")
def get_transaction(transaction_id: str):
    for transaction in transactions:
        if transaction["id"] == transaction_id:
            return transaction

    raise HTTPException(
        status_code=404,
        detail="Transaction not found",
    )


# -------------------------
# Update Transaction
# -------------------------

@app.put("/transactions/{transaction_id}")
def update_transaction(
    transaction_id: str,
    updated_data: TransactionCreate,
):
    for transaction in transactions:
        if transaction["id"] == transaction_id:
            transaction.update(
                updated_data.model_dump(mode="json")
            )

            return {
                "message": "Transaction updated successfully",
                "transaction": transaction,
            }

    raise HTTPException(
        status_code=404,
        detail="Transaction not found",
    )


# -------------------------
# Delete Transaction
# -------------------------

@app.delete("/transactions/{transaction_id}")
def delete_transaction(transaction_id: str):
    for index, transaction in enumerate(transactions):
        if transaction["id"] == transaction_id:
            deleted_transaction = transactions.pop(index)

            return {
                "message": "Transaction deleted successfully",
                "transaction": deleted_transaction,
            }

    raise HTTPException(
        status_code=404,
        detail="Transaction not found",
    )
