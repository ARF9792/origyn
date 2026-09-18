# Day 2 Verification Walkthrough

The backend has been successfully hardened and verified end-to-end against the single canonical AWS account (`015524245486`). 

## Diagnostics & Fixes
- **500 Internal Server Errors Resolved**: We diagnosed that the new HTTP API Gateway routes lacked the necessary `lambda:InvokeFunction` resource-based permissions to trigger their respective Lambdas. We executed a script to comprehensively bind the `$default` stage to all 13 Origyn functions.
- **PDF Corruption Addressed**: During the M3 validation, we encountered `bad XRef entry` PDF parsing errors within the `origyn-extractClaims` Lambda. We diagnosed this as a stream processing issue when reading S3 blobs inside the Lambda runtime. We updated `src/lib/s3.ts` to use `@aws-sdk/client-s3`'s native `transformToByteArray()`, resolving the corruption and allowing `pdf-parse` to run seamlessly.

## End-to-End Test Results

### 1. Regression Tests
✅ `GET /health`, `GET /documents`, `GET /answers`, and `GET /graph` all returned HTTP `200 OK` successfully.

### 2. M3: Claim Extraction (Nova 2 Lite)
✅ We generated and uploaded a test scholarly PDF (`POST /documents`).
✅ After marking the document as `ACTIVE`, we executed `POST /documents/{id}/claims/extract`.
✅ **Result**: The extraction pipeline read the PDF from S3 and successfully engaged `amazon.nova-2-lite-v1:0`. It parsed 4 exact claims from the dummy text and stored them as `SUPPORTED` in DynamoDB.

### 3. M5: Evidence-Locked Chat (Nova Pro)
✅ We queried the chat API (`POST /chat`) with a question about the test document's claims.
✅ **Result**: The backend deterministically bound the evidence to the 4 extracted claims, invoked `amazon.nova-pro-v1:0`, and returned a strictly grounded answer (`ans_80ad6d598eb8`) correctly citing `CLAIM_1` and `CLAIM_2` along with their `sourceDocumentIds`. 

### 4. M6: Graph Lineage
✅ `GET /graph` mapped the exact state of our data.
✅ **Result**: Correctly connected the document (`doc_d06453c8a785`) via `SUPPORTS` edges to the 4 claims, and connected the 2 cited claims via `USED_BY` edges to the generated answer.

### 5. M7: Impact & Invalidation Propagation
✅ We executed `POST /documents/{id}/invalidate` using a deterministic reason string.
✅ **Result**: The document transitioned to `INVALID`. The 4 claims deterministically cascaded to `UNSUPPORTED`. The dependent answer (`ans_80ad6d598eb8`) automatically cascaded to `EVIDENCE_CHANGED`. 
✅ `GET /documents/{id}/impact` and the subsequent `GET /graph` both correctly reflected this terminal state change.

---

> [!TIP]
> The single canonical environment is now 100% operational. The architecture is locked, the tests pass natively on the single AWS account without STS cross-account overhead, and all temporary scratch files and downloaded test binaries have been cleaned from the workspace.
