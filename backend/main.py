import os
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from statistics import median
from typing import Literal
from uuid import uuid4
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from pathlib import Path

from backend.ml.predict_category import predict_category

import jwt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field, field_validator
from pwdlib import PasswordHash
from sqlalchemy import Date, Numeric, String, create_engine, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    Session,
    mapped_column,
    sessionmaker,
)
load_dotenv(
    dotenv_path=Path(__file__).resolve().parent.parent / ".env",
    override=True,
)
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
DATABASE_URL = os.getenv("FINMIND_DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(
        "FINMIND_DATABASE_URL is missing. "
        "Add it to the project-root .env file."
    )

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not JWT_SECRET_KEY:
    raise RuntimeError(
        "JWT_SECRET_KEY is missing from the project-root .env file."
    )

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    expire_on_commit=False,
)

password_hasher = PasswordHash.recommended()
bearer_scheme = HTTPBearer()


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    full_name: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    email: Mapped[str] = mapped_column(
        String(254),
        unique=True,
        index=True,
        nullable=False,
    )
    hashed_password: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    google_sub: Mapped[str | None] = mapped_column(
        String(255),
        unique=True,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    user_id: Mapped[str] = mapped_column(
        String(36),
        nullable=False,
        index=True,
    )
    amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )
    transaction_type: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
    )
    category: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    description: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )
    transaction_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )


class TransactionCreate(BaseModel):
    amount: Decimal = Field(
        gt=0,
        max_digits=12,
        decimal_places=2,
    )
    transaction_type: Literal["income", "expense"]
    category: str = Field(min_length=1, max_length=50)
    description: str = Field(min_length=1, max_length=200)
    transaction_date: date

    @field_validator("category", "description")
    @classmethod
    def strip_text_fields(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be blank.")
        return value


class SignupRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str) -> str:
        value = " ".join(value.split())
        if len(value) < 2:
            raise ValueError("Full name must contain at least 2 characters.")
        return value


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
class GoogleLoginRequest(BaseModel):
    credential: str = Field(min_length=1)    


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_access_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(
        payload,
        JWT_SECRET_KEY,
        algorithm=JWT_ALGORITHM,
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    try:
        payload = jwt.decode(
            credentials.credentials,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
        )
        user_id = payload.get("sub")
        if not isinstance(user_id, str) or not user_id:
            raise HTTPException(
                status_code=401,
                detail="Invalid access token",
            )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired access token",
        )

    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=401,
            detail="User not found",
        )

    return user


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Creates missing tables. Existing tables are not automatically migrated.
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="FINMIND API",
    description="Financial Intelligence and Risk Platform",
    version="0.5.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def serialize_transaction(transaction: Transaction) -> dict:
    return {
        "id": transaction.id,
        "amount": str(transaction.amount),
        "transaction_type": transaction.transaction_type,
        "category": transaction.category,
        "description": transaction.description,
        "transaction_date": transaction.transaction_date.isoformat(),
    }


@app.post("/auth/signup", status_code=201)
def signup(data: SignupRequest, db: Session = Depends(get_db)):
    email = str(data.email).strip().lower()

    existing_user = db.scalar(
        select(User).where(User.email == email)
    )
    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists",
        )

    user = User(
        id=str(uuid4()),
        full_name=data.full_name,
        email=email,
        hashed_password=password_hasher.hash(data.password),
    )

    db.add(user)
    try:
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists",
        )

    return {
        "message": "Account created successfully",
        "user": {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
        },
    }


@app.post("/auth/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    email = str(data.email).strip().lower()
    user = db.scalar(
        select(User).where(User.email == email)
    )

    if user is None or not password_hasher.verify(
        data.password,
        user.hashed_password,
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    return TokenResponse(
        access_token=create_access_token(user.id)
    )

@app.post("/auth/google", response_model=TokenResponse)
def google_login(
    data: GoogleLoginRequest,
    db: Session = Depends(get_db),
):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=500,
            detail="Google Sign-In is not configured",
        )

    try:
        google_user = id_token.verify_oauth2_token(
            data.credential,
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
        )
    except ValueError:
        raise HTTPException(
            status_code=401,
            detail="Invalid Google ID token",
        )

    if google_user.get("email_verified") is not True:
        raise HTTPException(
            status_code=401,
            detail="Google email is not verified",
        )

    google_sub = google_user.get("sub")
    email = google_user.get("email")

    if not isinstance(google_sub, str) or not google_sub:
        raise HTTPException(
            status_code=401,
            detail="Google account ID is missing",
        )

    if not isinstance(email, str) or not email:
        raise HTTPException(
            status_code=401,
            detail="Google email is missing",
        )

    email = email.strip().lower()

    user = db.scalar(
        select(User).where(User.google_sub == google_sub)
    )

    if user is None:
        user = db.scalar(
            select(User).where(User.email == email)
        )

        if user is not None:
            # Do not automatically link an existing account.
            raise HTTPException(
                status_code=409,
                detail=(
                    "An account with this email already exists. "
                    "Sign in with your existing method first."
                ),
            )

        user = User(
            id=str(uuid4()),
            full_name=google_user.get("name"),
            email=email,
            hashed_password=password_hasher.hash(
                str(uuid4())
            ),
            google_sub=google_sub,
        )

        db.add(user)

        try:
            db.commit()
            db.refresh(user)
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=409,
                detail="An account with this email or Google ID already exists",
            )

    return TokenResponse(
        access_token=create_access_token(user.id)
    )


@app.get("/auth/me")
def get_my_account(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
    }


@app.get("/")
def home():
    return {
        "message": "FINMIND API is running!",
        "version": "0.5.0",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.post("/transactions", status_code=201)
def create_transaction(
    transaction: TransactionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    new_transaction = Transaction(
        **transaction.model_dump(),
        id=str(uuid4()),
        user_id=user.id,
    )
    db.add(new_transaction)
    db.commit()
    db.refresh(new_transaction)
    return serialize_transaction(new_transaction)


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
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=400,
            detail="start_date cannot be after end_date",
        )

    statement = select(Transaction).where(
        Transaction.user_id == user.id
    )

    if transaction_type is not None:
        statement = statement.where(
            Transaction.transaction_type == transaction_type
        )
    if category is not None:
        statement = statement.where(
            Transaction.category.ilike(category.strip())
        )
    if start_date is not None:
        statement = statement.where(
            Transaction.transaction_date >= start_date
        )
    if end_date is not None:
        statement = statement.where(
            Transaction.transaction_date <= end_date
        )

    total = db.scalar(
        select(func.count()).select_from(statement.subquery())
    ) or 0

    sort_column = (
        Transaction.transaction_date
        if sort_by == "date"
        else Transaction.amount
    )
    statement = statement.order_by(
        sort_column.asc() if order == "asc" else sort_column.desc()
    )

    items = db.scalars(
        statement.offset(skip).limit(limit)
    ).all()

    serialized = [serialize_transaction(item) for item in items]
    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "count": len(serialized),
        "transactions": serialized,
    }


@app.get("/transactions/summary")
def get_transaction_summary(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items = db.scalars(
        select(Transaction).where(Transaction.user_id == user.id)
    ).all()

    total_income = sum(
        (
            item.amount
            for item in items
            if item.transaction_type == "income"
        ),
        Decimal("0.00"),
    )
    total_expenses = sum(
        (
            item.amount
            for item in items
            if item.transaction_type == "expense"
        ),
        Decimal("0.00"),
    )

    income_by_category: dict[str, Decimal] = {}
    expenses_by_category: dict[str, Decimal] = {}

    for transaction in items:
        totals = (
            income_by_category
            if transaction.transaction_type == "income"
            else expenses_by_category
        )
        totals[transaction.category] = (
            totals.get(transaction.category, Decimal("0.00"))
            + transaction.amount
        )

    return {
        "total_income": float(total_income),
        "total_expenses": float(total_expenses),
        "balance": float(total_income - total_expenses),
        "transaction_count": len(items),
        "income_by_category": {
            key: float(value)
            for key, value in income_by_category.items()
        },
        "expenses_by_category": {
            key: float(value)
            for key, value in expenses_by_category.items()
        },
    }


@app.post("/transactions/suggest-category")
def suggest_transaction_category(
    data: dict,
    user: User = Depends(get_current_user),
):
    description = data.get("description", "")
    if not isinstance(description, str) or not description.strip():
        raise HTTPException(status_code=422, detail="A non-empty description is required.")
    try:
        prediction = predict_category(description)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {
        "suggested_category": prediction["category"],
        "confidence": prediction["confidence"],
    }


def _user_transactions(db: Session, user: User) -> list[Transaction]:
    return db.scalars(
        select(Transaction)
        .where(Transaction.user_id == user.id)
        .order_by(Transaction.transaction_date.asc())
    ).all()


@app.get("/analytics/spending-forecast")
def get_spending_forecast(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Simple transparent baseline forecast, not a trained time-series model."""
    items = _user_transactions(db, user)
    today = date.today()
    current_start = today - timedelta(days=29)
    previous_start = today - timedelta(days=59)
    expenses = [
        t for t in items
        if t.transaction_type == "expense" and t.transaction_date <= today
    ]
    current = [t for t in expenses if current_start <= t.transaction_date <= today]
    previous = [t for t in expenses if previous_start <= t.transaction_date < current_start]
    current_total = sum((t.amount for t in current), Decimal("0.00"))
    previous_total = sum((t.amount for t in previous), Decimal("0.00"))
    active_days = len({t.transaction_date for t in current})
    projected = float(current_total)  # a 30-day window extrapolated to the next 30 days
    change_pct = None
    if previous_total > 0:
        change_pct = round((float(current_total - previous_total) / float(previous_total)) * 100, 1)
    if len(current) < 5 or active_days < 4:
        quality = "low"
        note = "Add expenses across at least 4 different days; this estimate is based on limited history."
    elif active_days < 10 or len(expenses) < 15:
        quality = "moderate"
        note = "Preliminary baseline only; more history will improve the estimate."
    else:
        quality = "moderate"
        note = "Baseline estimate from the most recent 30 days, not a guarantee of future spending."
    return {
        "method": "last_30_days_baseline",
        "currency": "INR",
        "period_start": current_start.isoformat(),
        "period_end": today.isoformat(),
        "recorded_expenses_last_30_days": round(float(current_total), 2),
        "predicted_expenses_next_30_days": round(projected, 2),
        "previous_30_days_expenses": round(float(previous_total), 2),
        "change_vs_previous_30_days_pct": change_pct,
        "expense_transactions": len(current),
        "active_expense_days": active_days,
        "data_quality": quality,
        "note": note,
    }


@app.get("/analytics/unusual-spending")
def get_unusual_spending(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Flag unusually large expenses relative to the user's own category history."""
    items = _user_transactions(db, user)
    expenses = [t for t in items if t.transaction_type == "expense" and t.transaction_date <= date.today()]
    alerts = []
    insufficient_categories = set()
    for transaction in expenses:
        peers = [
            float(other.amount) for other in expenses
            if other.id != transaction.id
            and other.category == transaction.category
            and other.transaction_date <= transaction.transaction_date
        ]
        # Need a meaningful personal baseline; do not compare against population-wide thresholds.
        if len(peers) < 5:
            insufficient_categories.add(transaction.category)
            continue
        center = median(peers)
        deviations = [abs(value - center) for value in peers]
        mad = median(deviations) if deviations else 0.0
        threshold = max(center * 2.5, center + 3 * mad, center + 100.0)
        amount = float(transaction.amount)
        if amount > threshold:
            alerts.append({
                "transaction_id": transaction.id,
                "date": transaction.transaction_date.isoformat(),
                "description": transaction.description,
                "category": transaction.category,
                "amount": round(amount, 2),
                "category_median": round(center, 2),
                "threshold": round(threshold, 2),
                "message": f"This {transaction.category} expense is higher than your previous transactions in that category.",
            })
    alerts.sort(key=lambda item: item["amount"], reverse=True)
    return {
        "alerts": alerts[:10],
        "alert_count": len(alerts),
        "transactions_checked": len(expenses),
        "minimum_history_per_category": 5,
        "note": "Alerts are statistical prompts for review, not proof of fraud. Categories with fewer than 5 earlier transactions are not scored.",
    }


@app.get("/analytics/personalized-insights")
def get_personalized_insights(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items = _user_transactions(db, user)
    income = sum((t.amount for t in items if t.transaction_type == "income"), Decimal("0.00"))
    expenses = sum((t.amount for t in items if t.transaction_type == "expense"), Decimal("0.00"))
    expense_by_category: dict[str, Decimal] = {}
    for transaction in items:
        if transaction.transaction_type == "expense":
            expense_by_category[transaction.category] = expense_by_category.get(transaction.category, Decimal("0.00")) + transaction.amount
    insights = []
    if not items:
        insights.append({
            "title": "Start with your first transaction",
            "description": "Record income and expenses to unlock personalized observations.",
            "tag": "Getting started",
        })
    else:
        if income > 0:
            net_rate = float((income - expenses) / income * Decimal("100"))
            insights.append({
                "title": "Positive recorded cash flow" if income >= expenses else "Expenses exceed recorded income",
                "description": f"Recorded income is ₹{float(income):,.2f}, expenses are ₹{float(expenses):,.2f}, and net-to-income is {net_rate:.1f}%. This uses only transactions recorded in FINMIND.",
                "tag": f"{net_rate:.1f}% net-to-income",
            })
        elif expenses > 0:
            insights.append({
                "title": "Add your income for context",
                "description": f"You have recorded ₹{float(expenses):,.2f} in expenses but no income yet, so a savings-rate comparison is unavailable.",
                "tag": "Suggested action",
            })
        if expense_by_category:
            category, amount = max(expense_by_category.items(), key=lambda pair: pair[1])
            insights.append({
                "title": f"{category} is your largest recorded expense category",
                "description": f"Recorded {category} expenses total ₹{float(amount):,.2f}. Review the transactions to decide whether any spending changes make sense.",
                "tag": "Category breakdown",
            })
        dates = {t.transaction_date for t in items}
        if len(dates) < 7:
            insights.append({
                "title": "More history will improve insights",
                "description": "Your transactions cover fewer than 7 distinct dates. Treat trends and forecasts as preliminary until more history is recorded.",
                "tag": "Data quality",
            })
    return {
        "insights": insights,
        "transaction_count": len(items),
        "distinct_transaction_days": len({t.transaction_date for t in items}),
        "recorded_income": round(float(income), 2),
        "recorded_expenses": round(float(expenses), 2),
        "note": "Rule-based observations based only on this authenticated user's recorded transactions; not professional financial advice.",
    }


@app.get("/transactions/{transaction_id}")
def get_transaction(
    transaction_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    transaction = db.scalar(
        select(Transaction).where(
            Transaction.id == transaction_id,
            Transaction.user_id == user.id,
        )
    )
    if transaction is None:
        raise HTTPException(
            status_code=404,
            detail="Transaction not found",
        )
    return serialize_transaction(transaction)


@app.put("/transactions/{transaction_id}")
def update_transaction(
    transaction_id: str,
    updated_data: TransactionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    transaction = db.scalar(
        select(Transaction).where(
            Transaction.id == transaction_id,
            Transaction.user_id == user.id,
        )
    )
    if transaction is None:
        raise HTTPException(
            status_code=404,
            detail="Transaction not found",
        )

    for key, value in updated_data.model_dump().items():
        setattr(transaction, key, value)

    db.commit()
    db.refresh(transaction)

    return {
        "message": "Transaction updated successfully",
        "transaction": serialize_transaction(transaction),
    }


@app.delete("/transactions/{transaction_id}")
def delete_transaction(
    transaction_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    transaction = db.scalar(
        select(Transaction).where(
            Transaction.id == transaction_id,
            Transaction.user_id == user.id,
        )
    )
    if transaction is None:
        raise HTTPException(
            status_code=404,
            detail="Transaction not found",
        )

    deleted = serialize_transaction(transaction)
    db.delete(transaction)
    db.commit()

    return {
        "message": "Transaction deleted successfully",
        "transaction": deleted,
    }
