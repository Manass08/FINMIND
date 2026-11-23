# FINMIND

**Financial Intelligence and Risk Platform**

FINMIND is a web application for recording personal income and expenses, reviewing cash flow, and surfacing simple, explainable observations from the transactions a user records.

> FINMIND is a personal tracking and educational tool. Its summaries and alerts are based on user-entered data; they are not bank statements, investment advice, or proof of fraud.

## Technology

- **Frontend:** React, Vite, JavaScript
- **Backend:** Python, FastAPI, Pydantic
- **Database:** PostgreSQL through SQLAlchemy
- **Authentication:** JWT bearer tokens, password hashing, Google ID-token verification
- **Category suggestion:** scikit-learn model loaded with joblib
- **Tests:** pytest, FastAPI TestClient, HTTPX

## Current capabilities

- Account signup, email/password login, Google sign-in, and current-user profile
- Authenticated transaction create, read, update, and delete operations
- Transaction filtering, sorting, and pagination
- Per-user transaction ownership checks
- Income, expense, balance, and category summaries
- Description-based expense-category suggestions
- A transparent last-30-days spending baseline
- Category-relative unusual-spending prompts
- Rule-based personalized observations
- Browser-side budget and savings-goal preferences, dashboard customization, monthly recap, and CSV export

Some dashboard preferences are stored in the browser for the current profile rather than persisted in the backend database. Forecasts and unusual-spending prompts are baseline/statistical rules, not trained financial forecasting or fraud-detection models.

## Current repository layout

```text
FINMIND/
├── backend/
│   ├── main.py
│   ├── ml/
│   └── test_main.py
├── frontend/
│   ├── src/
│   └── package.json
├── requirements.txt
└── README.md
```

This describes the current repository layout. The refactoring branch may introduce a more modular structure over time.

## Local development

### Backend

Use Python 3.12 or a compatible version.

```bash
python -m venv .venv
```

Activate the environment and install dependencies:

```bash
pip install -r requirements.txt
```

Create a project-root `.env` file:

```dotenv
FINMIND_DATABASE_URL=postgresql+psycopg://USER:PASSWORD@localhost:5432/finmind
JWT_SECRET_KEY=replace-with-a-long-random-secret
GOOGLE_CLIENT_ID=your-google-oauth-client-id
```

Use your own local PostgreSQL database and OAuth client. Never commit real credentials or production secrets.

Start the API from the repository root:

```bash
uvicorn backend.main:app --reload
```

API documentation is available at `http://127.0.0.1:8000/docs`.

### Frontend

```bash
cd frontend
npm install
```

Copy `.env.example` to `.env.local` and set the Google OAuth client ID. The API base URL defaults to `http://127.0.0.1:8000` if not configured.

```bash
npm run dev
```

### Tests and frontend checks

From the repository root:

```bash
pytest
```

From `frontend/`:

```bash
npm run lint
npm run build
```

Run these commands in your own environment before treating a change as verified. Passing API tests does not replace deployment, security, or real-browser testing.

## Important implementation notes

- The backend currently creates missing tables at application startup. This is not a database migration system; schema changes should be managed with migrations before production use.
- JWTs are currently stored by the frontend in browser local storage. Review the threat model and consider a secure, HttpOnly cookie-based session design before handling real financial data.
- Configure production CORS origins explicitly; do not deploy with development localhost origins as the production policy.
- The category suggestion endpoint depends on a trained joblib artifact being present at the path expected by the prediction module. Verify the training script and model artifact are included and reproducible before deployment.
- Analytics depend on the completeness and quality of transactions entered by the user. Present them as estimates and prompts, not guarantees.

## Development approach

Refactoring should preserve working behavior first, then improve module boundaries, accessibility, responsive behavior, error handling, and test coverage in small reviewable changes. Keep the default branch stable and merge reviewed pull requests only after checks pass.
