# Tally – receipt scanner and expense tracker

> Communication: talk to the user in **Polish**. Code, comments, names, commits and docs are in **English**.

## About

Tally is a mobile-first web app that:
1. accepts a photo of a receipt taken with a phone,
2. reads the store, date, total and all line items (name, quantity, price, discount),
3. assigns each item a category (food, clothing, household chemicals, etc.),
4. stores everything in a database and shows spending by category.

Goal: a portfolio project (AI/ML Engineer CV) and a tool for real daily use by two people.
What matters: clean production-grade code, tests, measurable quality (evaluation) and a working online demo.
What does not matter: maximum number of features.

## Stack

- Backend: Python 3.12, uv, FastAPI, Pydantic v2, SQLAlchemy 2.0 (sync), Alembic, PostgreSQL
- Extraction: vision model via API with structured output into a Pydantic schema (approach A); later OCR + text model for comparison (approach B)
- Frontend: React + Vite + TypeScript + react-router, one simple app that works well on a phone
- Infrastructure: Docker Compose (api, db, frontend), later Caddy and deploy on a VPS (Hetzner)
- Quality: ruff, pytest, GitHub Actions
- Secrets only in `.env` (`.env.example` in the repo), never in code

## Technical decisions

- Money is `Numeric(10, 2)` in the DB and `Decimal` in Python, never `float`.
- SQLAlchemy is used synchronously; FastAPI runs sync endpoints in a thread pool, which is enough for this load.
- Tests run against a real PostgreSQL (separate test database), not SQLite, so `Numeric` and enums behave as in production.
- The extractor is a `typing.Protocol`, so implementations need no inheritance and are easy to swap in tests.
- The phone talks to the Vite dev server, which proxies `/api` to the backend (no CORS setup needed in dev).
- Uploaded images live on a Docker volume; the DB stores only the path.

## Data model

- **Receipt**: id, store_name, store_nip, purchase_date, total, image_path, status (`ok` / `needs_review`), created_at
- **ReceiptItem**: id, receipt_id, raw_name (exactly as printed on the receipt), quantity, unit_price, total_price, discount, category
- **ProductDictionary**: normalized_raw_name → category (cache: known names do not go to the LLM)
- **Categories** (fixed list, enum): bakery, dairy, meat, fruits_vegetables, drinks, sweets_snacks, alcohol, household_chemicals, cosmetics, clothing, home, other

## Extraction architecture

Extraction is hidden behind an interface (`ReceiptExtractor` with `extract(image) -> ExtractedReceipt`) so implementations can be swapped:
- `StubExtractor` – returns a fake result (Phase 1),
- `VisionLLMExtractor` – vision model (Phase 2),
- `OcrLLMExtractor` – OCR + text model (Phase 3).

The implementation is selected via configuration (environment variable).

## Phases

### Phase 1: end-to-end skeleton
- repo structure, uv, ruff, pytest, Docker Compose with api + db + frontend
- SQLAlchemy models and the first Alembic migration
- endpoints: `POST /receipts` (upload image, save file, extract with StubExtractor, save to DB), `GET /receipts`, `GET /receipts/{id}`
- frontend: upload a photo from the phone, result screen with the item list, receipt list; minimal styling
- **Done when:** `docker compose up`, upload a photo from a phone on the local network and see the (fake) result saved in the DB

### Phase 2: real extraction
- `VisionLLMExtractor` with structured output into a Pydantic schema
- editing items and categories in the frontend (`PATCH` on an item)
- **Done when:** a real receipt yields sensible items and errors can be fixed manually

### Phase 3: evaluation
- `data/` directory with images and hand-labelled JSON files (ground truth); the data is not committed, only a few examples
- `eval/run.py`: item accuracy (match by name and price), total agreement, category accuracy, time and cost per receipt
- `OcrLLMExtractor` and an A vs B comparison table
- **Done when:** one command produces a results table for both approaches

### Phase 4: validation and dictionary
- validation: sum of items minus discounts = receipt total (with tolerance), NIP checksum, sensible date; mismatch → status `needs_review`
- categorization: ProductDictionary first, unknown names go to the LLM, the result is stored in the dictionary
- a manual category correction updates the dictionary
- metric: dictionary hit rate over time
- **Done when:** a second receipt with the same products is categorized without an LLM call

### Phase 5: deploy and README
- production Docker Compose + Caddy (HTTPS), deploy to VPS, subdomain
- GitHub Actions: ruff + pytest on every push
- demo safeguards: file size limit, rate limiting, demo account with sample receipts
- README as a case study: problem, architecture diagram, evaluation table, GIF of the app
- **Done when:** the demo runs on the domain, CI is green, README has numbers

## Out of scope for v1

Do not implement; record ideas in `ROADMAP.md`:
- charts and advanced analytics, price tracking over time
- multiple accounts / shared household
- shopping planning based on history

## Working rules

- Work in phases. Before starting a phase, present a short plan (files, steps) and wait for approval.
- Small, logical commits with descriptive messages.
- Every new module has tests. Extraction is mocked in tests; tests never call paid APIs.
- No overengineering: the simplest solution that works and can be extended.
- After each step, briefly explain what was done and why (the user will discuss every part in job interviews).
- **The user writes validation logic, product name normalization and evaluation metrics themselves.** For these modules provide only function signatures, docstrings and tests, and leave the implementation to the user unless explicitly asked otherwise.
- If something is unclear or needs a decision (library, structure, trade-off), ask instead of guessing.
