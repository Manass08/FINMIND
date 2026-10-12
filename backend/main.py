
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Literal
from datetime import date
from uuid import uuid4

app = FastAPI(
    title="FINMIND API",
    description="Financial Intelligence and Risk Platform",
    version="0.2.0",
)


class TransactionCreate(BaseModel):
    amount: float = Field(gt=0)
    transaction_type: Literal["income", "expense"]
    category: str = Field(min_length=1, max_length=50)
    description: str = Field(min_length=1, max_length=200)
    transaction_date: date


transactions = []


@app.get("/")
def home():
    return {
        "message": "FINMIND API is running!",
        "version": "0.2.0",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.post("/transactions", status_code=201)
def create_transaction(transaction: TransactionCreate):
    new_transaction = {
        "id": str(uuid4()),
        **transaction.model_dump(mode="json"),
    }

    transactions.append(new_transaction)

    return new_transaction


@app.get("/transactions")
def get_transactions():
    return transactions


@app.get("/transactions/summary")
def get_transaction_summary():
    total_income = sum(
        t["amount"] for t in transactions
        if t["transaction_type"] == "income"
    )
    total_expenses = sum(
        t["amount"] for t in transactions
        if t["transaction_type"] == "expense"
    )

    return {
        "total_income": round(total_income, 2),
        "total_expenses": round(total_expenses, 2),
        "balance": round(total_income - total_expenses, 2),
        "transaction_count": len(transactions),
    }


@app.get("/transactions/{transaction_id}")
def get_transaction(transaction_id: str):
    for transaction in transactions:
        if transaction["id"] == transaction_id:
            return transaction

    raise HTTPException(
        status_code=404,
        detail="Transaction not found",
    )
