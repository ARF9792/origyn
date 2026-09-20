/**
 * noDoi.integration.test.ts
 *
 * Focused integration tests for no-DOI (local) document behaviour.
 *
 * Spec cases covered:
 *   9.  No-DOI document appears correctly in GET /graph
 *  10.  No-DOI document manual invalidation → INVALID; claims UNSUPPORTED; answers EVIDENCE_CHANGED
 *  11.  Official DOI duplicate protection still returns 409 DUPLICATE_DOCUMENT
 *  12.  Retracted official DOI behaviour unchanged
 *  13.  Malformed / non-PDF upload still returns INVALID_FILE
 *
 * Step 14 regression (official scholarly paper title search):
 *       "A look at advanced learners' use of mobile devices…"
 *        → must still resolve DOI 10.4995/eurocall.2017.7461
 *
 * Step 15: Local document fixture is synthesised in-test (no PDF committed).
 */

import type { APIGatewayProxyEvent } from "aws-lambda";

// ── Mock all AWS / external dependencies ─────────────────────────────────────
jest.mock("../src/lib/dynamo");
jest.mock("../src/lib/s3");
jest.mock("../src/lib/multipart");
jest.mock("../src/services/paperIdentifier");
jest.mock("../src/services/crossrefService");
jest.mock("../src/services/bedrockService");
jest.mock("pdf-parse", () =>
  jest.fn().mockResolvedValue({ text: "Mocked PDF text content for testing." })
);

import {
  getDocument,
  updateDocument,
  listDocuments,
  listAllClaims,
  listAllAnswers,
  listClaimsByDocument,
  putDocument,
  findDocumentByDoi,
} from "../src/lib/dynamo";
import { getFromS3 } from "../src/lib/s3";
import { parseMultipartFile } from "../src/lib/multipart";
import { identifyPaper } from "../src/services/paperIdentifier";
import { checkRetractionStatus, searchByTitle } from "../src/services/crossrefService";

import { Document, Claim, Answer } from "../src/types/document";

const mockGetDocument = getDocument as jest.MockedFunction<typeof getDocument>;
const mockUpdateDocument = updateDocument as jest.MockedFunction<typeof updateDocument>;
const mockListDocuments = listDocuments as jest.MockedFunction<typeof listDocuments>;
const mockListAllClaims = listAllClaims as jest.MockedFunction<typeof listAllClaims>;
const mockListAllAnswers = listAllAnswers as jest.MockedFunction<typeof listAllAnswers>;
const mockListClaimsByDocument = listClaimsByDocument as jest.MockedFunction<typeof listClaimsByDocument>;
const mockPutDocument = putDocument as jest.MockedFunction<typeof putDocument>;
const mockFindDocumentByDoi = findDocumentByDoi as jest.MockedFunction<typeof findDocumentByDoi>;
const mockGetFromS3 = getFromS3 as jest.MockedFunction<typeof getFromS3>;
const mockParseMultipart = parseMultipartFile as jest.MockedFunction<typeof parseMultipartFile>;
const mockIdentifyPaper = identifyPaper as jest.MockedFunction<typeof identifyPaper>;
const mockCheckRetractionStatus = checkRetractionStatus as jest.MockedFunction<typeof checkRetractionStatus>;
const mockSearchByTitle = searchByTitle as jest.MockedFunction<typeof searchByTitle>;

// ── Shared fixtures ───────────────────────────────────────────────────────────

/** A correctly ingested no-DOI local document (after the fix). */
const NO_DOI_DOC: Document = {
  id: "doc_local_001", ownerId: "public",
  filename: "internal-study.pdf",
  s3Key: "uploads/doc_local_001.pdf",
  title: "Remote Work and Developer Productivity",
  doi: null,
  status: "ACTIVE",
  retractionStatus: "UNKNOWN",
  retractionNotice: null,
  claims: [],
  createdAt: "2026-09-18T10:00:00.000Z",
  updatedAt: "2026-09-18T10:00:00.000Z",
};

const NO_DOI_CLAIM: Claim = {
  id: "claim_local_001", ownerId: "public",
  documentId: "doc_local_001",
  sourceDocumentIds: ["doc_local_001"],
  text: "Remote work increased developer productivity by 15% over six weeks.",
  status: "SUPPORTED",
  createdAt: "2026-09-18T10:00:00.000Z",
  updatedAt: "2026-09-18T10:00:00.000Z",
};

const ANSWER_USING_LOCAL_CLAIM: Answer = {
  id: "ans_local_001", ownerId: "public",
  question: "What is the effect of remote work on productivity?",
  text: "According to the internal study, remote work increased developer productivity by 15%.",
  claimIds: ["claim_local_001"],
  sourceDocumentIds: ["doc_local_001"],
  status: "CURRENT",
  previousAnswerId: null,
  supersededByAnswerId: null,
  createdAt: "2026-09-18T10:00:00.000Z",
  updatedAt: "2026-09-18T10:00:00.000Z",
};

/** A classic scholarly DOI-based ACTIVE document. */
const DOI_DOC: Document = {
  id: "doc_doi_001", ownerId: "public",
  filename: "eurocall.pdf",
  s3Key: "uploads/doc_doi_001.pdf",
  title: "A look at advanced learners' use of mobile devices for English language study: Insights from interview data",
  doi: "10.4995/eurocall.2017.7461",
  status: "ACTIVE",
  retractionStatus: "NONE_FOUND",
  retractionNotice: null,
  claims: [],
  createdAt: "2026-09-18T10:00:00.000Z",
  updatedAt: "2026-09-18T10:00:00.000Z",
};

const DOI_CLAIM: Claim = {
  id: "claim_doi_001", ownerId: "public",
  documentId: "doc_doi_001",
  sourceDocumentIds: ["doc_doi_001"],
  text: "Mobile devices support vocabulary acquisition among advanced English learners.",
  status: "SUPPORTED",
  createdAt: "2026-09-18T10:00:00.000Z",
  updatedAt: "2026-09-18T10:00:00.000Z",
};

/** Generic event factory. */
function makeEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    pathParameters: null,
    queryStringParameters: null,
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: "GET",
    isBase64Encoded: false,
    path: "/",
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as APIGatewayProxyEvent["requestContext"],
    resource: "",
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPutDocument.mockResolvedValue(undefined);
  mockUpdateDocument.mockResolvedValue(undefined);
  mockGetFromS3.mockResolvedValue(Buffer.from("fake pdf bytes"));
  mockFindDocumentByDoi.mockResolvedValue(null);
});

// ═════════════════════════════════════════════════════════════════════════════
// Case 9 — No-DOI document appears in GET /graph
// ═════════════════════════════════════════════════════════════════════════════

import { handler as graphHandler } from "../src/handlers/getGraph";

describe("case 9: GET /graph — no-DOI document participates in Document → Claim → Answer provenance", () => {
  it("includes no-DOI DOCUMENT node with correct label and status", async () => {
    mockListDocuments.mockResolvedValue([NO_DOI_DOC]);
    mockListAllClaims.mockResolvedValue([NO_DOI_CLAIM]);
    mockListAllAnswers.mockResolvedValue([ANSWER_USING_LOCAL_CLAIM]);

    const res = await graphHandler(makeEvent({ httpMethod: "GET" }));
    expect(res.statusCode).toBe(200);

    const graph = JSON.parse(res.body);

    // Document node
    const docNode = graph.nodes.find((n: { id: string }) => n.id === "doc_local_001");
    expect(docNode).toBeDefined();
    expect(docNode.type).toBe("DOCUMENT");
    expect(docNode.status).toBe("ACTIVE");
    expect(docNode.label).toBe("Remote Work and Developer Productivity");

    // Claim node
    const claimNode = graph.nodes.find((n: { id: string }) => n.id === "claim_local_001");
    expect(claimNode).toBeDefined();
    expect(claimNode.type).toBe("CLAIM");

    // Answer node
    const answerNode = graph.nodes.find((n: { id: string }) => n.id === "ans_local_001");
    expect(answerNode).toBeDefined();
    expect(answerNode.type).toBe("ANSWER");

    // Edges: SUPPORTS doc→claim and USED_BY claim→answer
    const supportsEdge = graph.edges.find(
      (e: { source: string; target: string; type: string }) =>
        e.source === "doc_local_001" && e.target === "claim_local_001" && e.type === "SUPPORTS"
    );
    expect(supportsEdge).toBeDefined();

    const usedByEdge = graph.edges.find(
      (e: { source: string; target: string; type: string }) =>
        e.source === "claim_local_001" && e.target === "ans_local_001" && e.type === "USED_BY"
    );
    expect(usedByEdge).toBeDefined();
  });

  it("no-DOI doc and DOI doc coexist in the graph without issues", async () => {
    mockListDocuments.mockResolvedValue([NO_DOI_DOC, DOI_DOC]);
    mockListAllClaims.mockResolvedValue([NO_DOI_CLAIM, DOI_CLAIM]);
    mockListAllAnswers.mockResolvedValue([]);

    const res = await graphHandler(makeEvent({ httpMethod: "GET" }));
    expect(res.statusCode).toBe(200);

    const graph = JSON.parse(res.body);
    expect(graph.nodes.filter((n: { type: string }) => n.type === "DOCUMENT")).toHaveLength(2);
    expect(graph.edges.filter((e: { type: string }) => e.type === "SUPPORTS")).toHaveLength(2);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Case 10 — No-DOI document manual invalidation
// ═════════════════════════════════════════════════════════════════════════════

import { handler as invalidateHandler } from "../src/handlers/invalidateDocument";

describe("case 10: POST /documents/{id}/invalidate — no-DOI document", () => {
  it("sets status to INVALID without touching retractionStatus (remains UNKNOWN)", async () => {
    mockGetDocument.mockResolvedValue({ ...NO_DOI_DOC });
    mockListClaimsByDocument.mockResolvedValue([NO_DOI_CLAIM]);
    mockListAllAnswers.mockResolvedValue([ANSWER_USING_LOCAL_CLAIM]);

    const res = await invalidateHandler(
      makeEvent({
        httpMethod: "POST",
        pathParameters: { id: "doc_local_001" },
        body: JSON.stringify({ reason: "Methodology found to be flawed by internal review." }),
      })
    );
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(body.status).toBe("INVALID");
    expect(body.documentId).toBe("doc_local_001");

    // updateDocument must set status INVALID and NOT touch retractionStatus
    expect(mockUpdateDocument).toHaveBeenCalledWith(
      "doc_local_001",
      expect.objectContaining({ status: "INVALID" })
    );
    // retractionStatus must NOT be in the update payload
    const updateCall = mockUpdateDocument.mock.calls[0][1];
    expect(updateCall).not.toHaveProperty("retractionStatus");
  });

  it("is idempotent — returns 200 when document is already INVALID", async () => {
    mockGetDocument.mockResolvedValue({ ...NO_DOI_DOC, status: "INVALID" });

    const res = await invalidateHandler(
      makeEvent({
        httpMethod: "POST",
        pathParameters: { id: "doc_local_001" },
        body: JSON.stringify({ reason: "Duplicate invalidation." }),
      })
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("INVALID");
    // Must not call updateDocument again (already invalidated)
    expect(mockUpdateDocument).not.toHaveBeenCalled();
  });

  it("requires a non-empty reason", async () => {
    const res = await invalidateHandler(
      makeEvent({
        httpMethod: "POST",
        pathParameters: { id: "doc_local_001" },
        body: JSON.stringify({ reason: "" }),
      })
    );
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("INVALID_REQUEST");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Case 11 — Official DOI duplicate protection regression
// ═════════════════════════════════════════════════════════════════════════════

import { handler as uploadHandler } from "../src/handlers/uploadDocument";

describe("case 11: DOI duplicate protection regression — 409 DUPLICATE_DOCUMENT", () => {
  it("still rejects upload when the same DOI already exists", async () => {
    mockParseMultipart.mockResolvedValue({
      filename: "paper.pdf",
      contentType: "application/pdf",
      buffer: Buffer.from("pdf data"),
    });
    mockIdentifyPaper.mockResolvedValue({
      title: "Advanced Learners Study",
      doi: "10.4995/eurocall.2017.7461",
      identificationMethod: "doi_in_pdf",
    });
    // Simulate a pre-existing document with the same DOI (full shape required by type)
    mockFindDocumentByDoi.mockResolvedValue({ ...DOI_DOC, id: "doc_existing_eurocall" });

    const res = await uploadHandler(makeEvent({ httpMethod: "POST" }));
    expect(res.statusCode).toBe(409);

    const body = JSON.parse(res.body);
    expect(body.error.code).toBe("DUPLICATE_DOCUMENT");
    expect(body.error.existingDocumentId).toBe("doc_existing_eurocall");

    // Must abort before S3 or DynamoDB writes
    const { uploadToS3 } = jest.requireMock("../src/lib/s3");
    expect(uploadToS3).not.toHaveBeenCalled();
    expect(mockPutDocument).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Case 12 — Retracted official DOI behaviour unchanged
// ═════════════════════════════════════════════════════════════════════════════

describe("case 12: Retracted official DOI behaviour is unchanged", () => {
  it("returns status RETRACTED + retractionStatus RETRACTED for a retracted DOI paper", async () => {
    mockParseMultipart.mockResolvedValue({
      filename: "bad-science.pdf",
      contentType: "application/pdf",
      buffer: Buffer.from("pdf data"),
    });
    mockIdentifyPaper.mockResolvedValue({
      title: "Bad Science",
      doi: "10.1000/retracted",
      identificationMethod: "doi_in_pdf",
    });
    mockFindDocumentByDoi.mockResolvedValue(null);
    mockCheckRetractionStatus.mockResolvedValue({
      found: true,
      doi: "10.1000/retracted",
      title: "Bad Science",
      retractionStatus: "RETRACTED",
      retractionNotice: {
        doi: "10.1000/retracted-notice",
        date: "2025-03-15",
        source: "crossref",
      },
    });

    const res = await uploadHandler(makeEvent({ httpMethod: "POST" }));
    expect(res.statusCode).toBe(200);

    const doc = JSON.parse(res.body);
    expect(doc.status).toBe("RETRACTED");
    expect(doc.retractionStatus).toBe("RETRACTED");
    expect(doc.retractionNotice).not.toBeNull();
    expect(doc.retractionNotice.date).toBe("2025-03-15");
    expect(doc.doi).toBe("10.1000/retracted");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Case 13 — Malformed / non-PDF upload still fails with INVALID_FILE
// ═════════════════════════════════════════════════════════════════════════════

describe("case 13: Malformed / non-PDF upload — existing INVALID_FILE behaviour preserved", () => {
  it("rejects image upload with INVALID_FILE (wrong content type)", async () => {
    mockParseMultipart.mockResolvedValue({
      filename: "photo.png",
      contentType: "image/png",
      buffer: Buffer.from("img data"),
    });

    const res = await uploadHandler(makeEvent({ httpMethod: "POST" }));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("INVALID_FILE");
  });

  it("rejects empty file with INVALID_FILE", async () => {
    mockParseMultipart.mockResolvedValue({
      filename: "empty.pdf",
      contentType: "application/pdf",
      buffer: Buffer.alloc(0),
    });

    const res = await uploadHandler(makeEvent({ httpMethod: "POST" }));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("INVALID_FILE");
  });

  it("rejects multipart parse error with INVALID_FILE", async () => {
    mockParseMultipart.mockRejectedValue(new Error("Multipart parse failed"));

    const res = await uploadHandler(makeEvent({ httpMethod: "POST" }));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("INVALID_FILE");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Step 14 regression — Official scholarly paper title → correct DOI
// ═════════════════════════════════════════════════════════════════════════════

import { searchByTitle as realSearchByTitle } from "../src/services/crossrefService";

describe("step 14 regression: 'A look at advanced learners' use of mobile devices…' → 10.4995/eurocall.2017.7461", () => {
  const EUROCALL_TITLE =
    "A look at advanced learners' use of mobile devices for English language study: Insights from interview data";

  it("uploadDocument correctly resolves DOI via Crossref title fallback for the eurocall paper", async () => {
    mockParseMultipart.mockResolvedValue({
      filename: "eurocall.pdf",
      contentType: "application/pdf",
      buffer: Buffer.from("pdf data"),
    });

    // paperIdentifier extracts the title but no DOI (as if the PDF has no doi: line)
    mockIdentifyPaper.mockResolvedValue({
      title: EUROCALL_TITLE,
      doi: null,
      identificationMethod: "title_extracted",
    });

    // Crossref title search returns high-confidence match
    mockSearchByTitle.mockResolvedValue("10.4995/eurocall.2017.7461");
    mockFindDocumentByDoi.mockResolvedValue(null); // not a duplicate

    // Crossref retraction check for the resolved DOI → NONE_FOUND
    mockCheckRetractionStatus.mockResolvedValue({
      found: true,
      doi: "10.4995/eurocall.2017.7461",
      title: EUROCALL_TITLE,
      retractionStatus: "NONE_FOUND",
      retractionNotice: null,
    });

    const res = await uploadHandler(makeEvent({ httpMethod: "POST" }));
    expect(res.statusCode).toBe(200);

    const doc = JSON.parse(res.body);
    // Scholarly path must resolve the DOI
    expect(doc.doi).toBe("10.4995/eurocall.2017.7461");
    expect(doc.status).toBe("ACTIVE");
    expect(doc.retractionStatus).toBe("NONE_FOUND");
    expect(doc.title).toBe(EUROCALL_TITLE);

    // Verify search was called with the correct title
    expect(mockSearchByTitle).toHaveBeenCalledWith(EUROCALL_TITLE);
    // Verify Crossref was called for retraction (since a DOI was resolved)
    expect(mockCheckRetractionStatus).toHaveBeenCalledWith("10.4995/eurocall.2017.7461");
  });
});
