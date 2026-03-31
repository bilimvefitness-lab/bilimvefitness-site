# Book AI MVP

FastAPI + static frontend MVP for uploading book PDFs, chunking them, indexing them, and chatting over retrieved chunks only.

## Included

- FastAPI application bootstrap
- PDF upload endpoint
- PDF text extraction with PyMuPDF
- Word-based chunking with structured JSON output
- Deterministic chunk embeddings for local development
- Clean document metadata catalog
- Retrieved-chunks-only chat endpoint
- Minimal frontend with upload, documents, and chat views

## Project Structure

```text
app/
  api/
    routes/
  core/
  db/
  schemas/
  services/
data/
  uploads/
frontend/
  public/
```

## Exact Run Commands

Backend on Windows with `python`:

```powershell
cd C:\Users\emres\OneDrive\Belgeler\Playground
python -m venv .venv
.venv\Scripts\activate
Copy-Item .env.example .env
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Backend on Windows with `py` fallback:

```powershell
cd C:\Users\emres\OneDrive\Belgeler\Playground
py -m venv .venv
.venv\Scripts\activate
Copy-Item .env.example .env
py -m pip install --upgrade pip
py -m pip install -r requirements.txt
py -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Before starting the backend, open `.env` and set:

```env
OPENAI_API_KEY=your_real_openai_api_key
EMBEDDING_MODEL=text-embedding-3-small
```

Frontend:

```powershell
cd C:\Users\emres\OneDrive\Belgeler\Playground\frontend
npm run dev
```

## Endpoints

- `GET /api/v1/health`
- `POST /api/v1/upload`
- `GET /api/v1/documents`
- `GET /api/v1/documents/{document_id}`
- `POST /api/v1/chat`
- `POST /api/v1/rag/ask`

Upload a PDF with `multipart/form-data` using the `file` field.
The response includes the full extracted text, clean chunk metadata, generated embeddings, and vector-store-ready records.

Ask a question with JSON like:

```json
{
  "question": "What does the document say about onboarding?",
  "top_k": 3
}
```

The `/chat` endpoint retrieves the most similar indexed chunks and generates an extractive answer using only those retrieved chunks.

## Exact Test Steps

1. Start the backend.
2. Open `http://127.0.0.1:8000/docs`.
3. Open `GET /` and click `Try it out`, then `Execute`. Confirm the response says the app is running.
4. Open `GET /api/v1/health` and confirm it returns a healthy response.
5. Open `POST /api/v1/upload`, click `Try it out`, choose a real PDF file, and click `Execute`.
6. Copy the returned `document_id`.
7. Confirm the upload response includes:
   - `document_id`
   - `page_count`
   - `chunk_count`
   - `chunks`
   - `vector_store_status`
8. Open `GET /api/v1/documents` and confirm the uploaded file appears in the list.
9. Open `GET /api/v1/documents/{document_id}`, paste the copied `document_id`, and confirm chunk metadata is returned.
10. Open `POST /api/v1/chat`, click `Try it out`, and send:

```json
{
  "question": "What is the main topic of this document?",
  "document_id": "PASTE_YOUR_DOCUMENT_ID_HERE",
  "top_k": 5
}
```

11. Confirm the response includes:
   - `answer`
   - `answer_supported`
   - `retrieved_chunks`
   - `sources`
12. Confirm the answer only reflects the retrieved chunk content.

Direct API examples:

```bash
curl -X POST "http://127.0.0.1:8000/api/v1/upload" ^
  -H "accept: application/json" ^
  -H "Content-Type: multipart/form-data" ^
  -F "file=@C:\path\to\book.pdf"
```

```bash
curl "http://127.0.0.1:8000/api/v1/documents"
```

```bash
curl -X POST "http://127.0.0.1:8000/api/v1/chat" ^
  -H "Content-Type: application/json" ^
  -d "{\"question\":\"What is the main topic?\",\"document_id\":\"REPLACE_WITH_ID\",\"top_k\":3}"
```
