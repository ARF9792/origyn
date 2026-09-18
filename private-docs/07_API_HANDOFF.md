# Origyn Backend API Handoff

This document defines the frozen API contract for the frontend integration.

## Configuration
- **Base URL:** `https://avkp1kvy62.execute-api.us-east-1.amazonaws.com`
- **CORS:** Fully enabled (`*` origin, supports `GET, POST, DELETE, OPTIONS`).

## Core Enums

### Document
- `status`: `PROCESSING | ACTIVE | RETRACTED | UNKNOWN | INVALID`
- `retractionStatus`: `NONE_FOUND | RETRACTED | UNKNOWN`

### Claim
- `status`: `SUPPORTED | UNSUPPORTED`

### Answer
- `status`: `CURRENT | EVIDENCE_CHANGED`

*Note: "No retraction found" must be used in the UI, NOT "scientifically valid".*

## Special Backend Behavior

- **`NO_USABLE_EVIDENCE`**: Returned by `/chat` and `/answers/{id}/regenerate` if no valid `SUPPORTED` claims are found in the workspace or original sources.
- **Evidence-Locked Chat Filtering**: Models are strictly locked to `SUPPORTED` claims. `INVALID` or `RETRACTED` document claims are blocked from context.
- **Claim Provenance**: Every `Claim` includes `sourceDocumentIds`. Every `Answer` includes `claimIds` and `sourceDocumentIds`.
- **Regeneration (M8)**: Regenerating an answer preserves the old answer (marked `EVIDENCE_CHANGED`) and creates a new answer (marked `CURRENT`). The new answer has `previousAnswerId` pointing to the old one, and the old one has `supersededByAnswerId` pointing to the new one.
- **Manual Invalidation**: Sets Document `status = INVALID`. It does NOT set `retractionStatus = RETRACTED`. Claims cascade to `UNSUPPORTED`. Answers cascade to `EVIDENCE_CHANGED`.
- **Crossref Recheck**: Queries Crossref. If retracted, sets `status = RETRACTED` and `retractionStatus = RETRACTED`. Claims cascade to `UNSUPPORTED`. Answers cascade to `EVIDENCE_CHANGED`.
- **`GET /documents/{id}/impact`**: Predicts (for `ACTIVE`) or reports (for `INVALID`/`RETRACTED`) the downstream impact on Claims and Answers.
- **Graph Relationship Types**:
  - `Document → Claim`: `SUPPORTS`
  - `Claim → Answer`: `USED_BY`

---

## Endpoints

### 1. `GET /health`
- **Description:** System health check.
- **Success (200 OK):**
```json
{
  "status": "ok",
  "service": "origyn-backend",
  "region": "us-east-1",
  "timestamp": "2026-09-18T16:05:28.139Z"
}
```

### 2. `POST /documents`
- **Description:** Upload a PDF document.
- **Content-Type:** `multipart/form-data`
- **Body:** `file` (binary PDF)
- **Success (200 OK):**
```json
{
  "id": "doc_e1f946fe7891",
  "filename": "doc1.pdf",
  "status": "PROCESSING"
}
```

### 3. `GET /documents`
- **Description:** List all documents.
- **Success (200 OK):**
```json
{
  "items": [
    {
      "id": "doc_e1f946fe7891",
      "filename": "doc1.pdf",
      "title": null,
      "doi": null,
      "status": "ACTIVE",
      "retractionStatus": "UNKNOWN"
    }
  ]
}
```

### 4. `GET /documents/{id}`
- **Description:** Get document details including its claims.
- **Success (200 OK):**
```json
{
  "document": {
    "id": "doc_e1f946fe7891",
    "filename": "doc1.pdf",
    "title": "Example Paper",
    "doi": "10.1038/example",
    "status": "ACTIVE",
    "retractionStatus": "NONE_FOUND"
  },
  "claims": [
    {
      "id": "claim_8c0619331bd4",
      "text": "Water is wet.",
      "status": "SUPPORTED"
    }
  ]
}
```

### 5. `POST /documents/{id}/claims/extract`
- **Description:** Run Bedrock Nova 2 Lite to extract claims.
- **Content-Type:** Empty body
- **Success (200 OK):**
```json
{
  "documentId": "doc_e1f946fe7891",
  "claims": [
    {
      "id": "claim_8c0619331bd4",
      "text": "Water is wet."
    }
  ]
}
```
- **Error (422 Unprocessable Entity):** `PDF_TEXT_EXTRACTION_FAILED`
- **Error (502 Bad Gateway):** `CLAIM_EXTRACTION_FAILED`

### 6. `POST /documents/{id}/recheck`
- **Description:** Force a Crossref retraction recheck.
- **Content-Type:** Empty body
- **Success (200 OK):**
```json
{
  "documentId": "doc_e1f946fe7891",
  "status": "RETRACTED",
  "retractionStatus": "RETRACTED",
  "impact": {
    "claimIds": ["claim_8c0619331bd4"],
    "answerIds": ["ans_7cb70f47090d"],
    "claimCount": 1,
    "answerCount": 1
  }
}
```

### 7. `POST /documents/{id}/invalidate`
- **Description:** Manually invalidate a document (e.g., admin override).
- **Content-Type:** `application/json`
- **Body:**
```json
{
  "reason": "Found methodological error"
}
```
- **Success (200 OK):**
```json
{
  "documentId": "doc_e1f946fe7891",
  "status": "INVALID",
  "reason": "Found methodological error",
  "impact": {
    "claimIds": ["claim_8c0619331bd4"],
    "answerIds": ["ans_7cb70f47090d"],
    "claimCount": 1,
    "answerCount": 1
  }
}
```

### 8. `GET /documents/{id}/impact`
- **Description:** Check the downstream impact of a document on claims and answers. If ACTIVE, it shows *potential* impact. If INVALID/RETRACTED, it shows *actual* affected items.
- **Success (200 OK):**
```json
{
  "document": {
    "id": "doc_e1f946fe7891",
    "title": "Example Paper",
    "status": "INVALID",
    "retractionStatus": "UNKNOWN"
  },
  "claims": [
    {
      "id": "claim_8c0619331bd4",
      "text": "Water is wet.",
      "status": "UNSUPPORTED"
    }
  ],
  "answers": [
    {
      "id": "ans_7cb70f47090d",
      "question": "Is water wet?",
      "status": "EVIDENCE_CHANGED"
    }
  ],
  "summary": {
    "claimCount": 1,
    "answerCount": 1
  }
}
```

### 9. `GET /graph`
- **Description:** Return the complete evidence lineage graph.
- **Success (200 OK):**
```json
{
  "nodes": [
    {
      "id": "doc_e1f946fe7891",
      "type": "DOCUMENT",
      "label": "doc1.pdf",
      "status": "ACTIVE"
    },
    {
      "id": "claim_8c0619331bd4",
      "type": "CLAIM",
      "label": "Water is wet.",
      "status": "SUPPORTED"
    }
  ],
  "edges": [
    {
      "source": "doc_e1f946fe7891",
      "target": "claim_8c0619331bd4",
      "type": "SUPPORTS"
    }
  ]
}
```

### 10. `POST /chat`
- **Description:** Submit a question to the Evidence-Locked chat (Nova Pro).
- **Content-Type:** `application/json`
- **Body:**
```json
{
  "question": "Is water wet?"
}
```
- **Success (200 OK):**
```json
{
  "answer": {
    "id": "ans_7cb70f47090d",
    "question": "Is water wet?",
    "text": "Yes, water is wet based on the provided evidence.",
    "claimIds": ["claim_8c0619331bd4"],
    "sourceDocumentIds": ["doc_e1f946fe7891"],
    "status": "CURRENT",
    "previousAnswerId": null,
    "supersededByAnswerId": null
  }
}
```
- **Error (400 Bad Request):** `NO_USABLE_EVIDENCE`

### 11. `GET /answers`
- **Description:** List all generated answers.
- **Success (200 OK):**
```json
{
  "items": [
    {
      "id": "ans_7cb70f47090d",
      "question": "Is water wet?",
      "status": "CURRENT"
    }
  ]
}
```

### 12. `GET /answers/{id}`
- **Description:** Get details for a specific answer.
- **Success (200 OK):**
```json
{
  "answer": {
    "id": "ans_7cb70f47090d",
    "question": "Is water wet?",
    "text": "Yes, water is wet based on the provided evidence.",
    "claimIds": ["claim_8c0619331bd4"],
    "sourceDocumentIds": ["doc_e1f946fe7891"],
    "status": "CURRENT",
    "previousAnswerId": null,
    "supersededByAnswerId": null
  }
}
```

### 13. `POST /answers/{id}/regenerate`
- **Description:** Regenerate an answer that has `EVIDENCE_CHANGED` status using the remaining valid evidence.
- **Content-Type:** Empty body
- **Success (200 OK):**
```json
{
  "previousAnswer": {
    "id": "ans_7cb70f47090d",
    "status": "EVIDENCE_CHANGED"
  },
  "answer": {
    "id": "ans_9x29b2b412xx",
    "question": "Is water wet?",
    "text": "Based on the new evidence, water is not wet.",
    "claimIds": ["claim_9x9x9x9x9x"],
    "sourceDocumentIds": ["doc_2x2x2x2x2x"],
    "status": "CURRENT",
    "previousAnswerId": "ans_7cb70f47090d",
    "supersededByAnswerId": null
  }
}
```
- **Error (400 Bad Request):** `NO_USABLE_EVIDENCE` (if no usable evidence remains).
