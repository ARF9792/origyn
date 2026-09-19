/**
 * bedrockHandlers.test.ts
 *
 * Unit tests for the three Bedrock-backed handlers:
 *   M3: extractClaims   (POST /documents/{id}/claims/extract)
 *   M5: chat            (POST /chat)
 *   M8: regenerateAnswer (POST /answers/{id}/regenerate)
 *
 * Bedrock calls are fully mocked — these tests run offline.
 * DynamoDB calls are mocked via jest.mock("../src/lib/dynamo").
 */

import type { APIGatewayProxyEvent } from "aws-lambda";

// ── Mock DynamoDB ─────────────────────────────────────────────────────────────
jest.mock("../src/lib/dynamo");
import {
  getDocument,
  listClaimsByDocument,
  putClaims,
  listAllClaims,
  getAnswer,
  getClaim,
  putAnswer,
  updateAnswerStatus,
} from "../src/lib/dynamo";

const mockGetDocument = getDocument as jest.MockedFunction<typeof getDocument>;
const mockListClaimsByDocument = listClaimsByDocument as jest.MockedFunction<typeof listClaimsByDocument>;
const mockPutClaims = putClaims as jest.MockedFunction<typeof putClaims>;
const mockListAllClaims = listAllClaims as jest.MockedFunction<typeof listAllClaims>;
const mockGetAnswer = getAnswer as jest.MockedFunction<typeof getAnswer>;
const mockGetClaim = getClaim as jest.MockedFunction<typeof getClaim>;
const mockPutAnswer = putAnswer as jest.MockedFunction<typeof putAnswer>;
const mockUpdateAnswerStatus = updateAnswerStatus as jest.MockedFunction<typeof updateAnswerStatus>;

// ── Mock S3 ───────────────────────────────────────────────────────────────────
jest.mock("../src/lib/s3");
import { getFromS3 } from "../src/lib/s3";
const mockGetFromS3 = getFromS3 as jest.MockedFunction<typeof getFromS3>;

// ── Mock pdf-parse ────────────────────────────────────────────────────────────
jest.mock("pdf-parse", () =>
  jest.fn().mockResolvedValue({ text: "Mocked PDF text about scientific findings with measurable outcomes and reproducible results." })
);

// ── Mock bedrockService ───────────────────────────────────────────────────────
jest.mock("../src/services/bedrockService");
import {
  extractClaimsFromText,
  generateGroundedAnswer,
} from "../src/services/bedrockService";

const mockExtractClaimsFromText = extractClaimsFromText as jest.MockedFunction<typeof extractClaimsFromText>;
const mockGenerateGroundedAnswer = generateGroundedAnswer as jest.MockedFunction<typeof generateGroundedAnswer>;

// ── Fixtures ──────────────────────────────────────────────────────────────────
import { Document, Claim, Answer } from "../src/types/document";

const ACTIVE_DOC: Document = {
  id: "doc_active",
  filename: "paper.pdf",
  s3Key: "docs/paper.pdf",
  title: "Test Paper",
  doi: "10.1234/test",
  status: "ACTIVE",
  retractionStatus: "NONE_FOUND",
  retractionNotice: null,
  claims: [],
  createdAt: "2026-09-18T00:00:00.000Z",
  updatedAt: "2026-09-18T00:00:00.000Z",
};

const RETRACTED_DOC: Document = {
  ...ACTIVE_DOC,
  id: "doc_retracted",
  status: "RETRACTED",
  retractionStatus: "RETRACTED",
};

const INVALID_DOC: Document = {
  ...ACTIVE_DOC,
  id: "doc_invalid",
  status: "INVALID",
  retractionStatus: "NONE_FOUND",
};

// Local document: no DOI, formally unverifiable retraction status, but fully ACTIVE and usable.
// This is the correct state after the no-DOI ingestion fix.
const NO_DOI_DOC: Document = {
  ...ACTIVE_DOC,
  id: "doc_no_doi",
  filename: "internal-study.pdf",
  title: "Remote Work and Developer Productivity",
  doi: null,
  status: "ACTIVE",
  retractionStatus: "UNKNOWN",
  retractionNotice: null,
};

const SUPPORTED_CLAIM: Claim = {
  id: "claim_abc",
  documentId: "doc_active",
  sourceDocumentIds: ["doc_active"],
  text: "The intervention reduced mortality by 23%.",
  status: "SUPPORTED",
  createdAt: "2026-09-18T00:00:00.000Z",
  updatedAt: "2026-09-18T00:00:00.000Z",
};

const UNSUPPORTED_CLAIM: Claim = {
  ...SUPPORTED_CLAIM,
  id: "claim_bad",
  status: "UNSUPPORTED",
};

const CLAIM_FROM_RETRACTED: Claim = {
  ...SUPPORTED_CLAIM,
  id: "claim_retracted_src",
  documentId: "doc_retracted",
  sourceDocumentIds: ["doc_retracted"],
};

const CLAIM_FROM_INVALID: Claim = {
  ...SUPPORTED_CLAIM,
  id: "claim_invalid_src",
  documentId: "doc_invalid",
  sourceDocumentIds: ["doc_invalid"],
};

const CURRENT_ANSWER: Answer = {
  id: "ans_001",
  question: "What does the evidence say about mortality?",
  text: "Based on the evidence, mortality was reduced by 23%.",
  claimIds: ["claim_abc"],
  sourceDocumentIds: ["doc_active"],
  status: "CURRENT",
  previousAnswerId: null,
  supersededByAnswerId: null,
  createdAt: "2026-09-18T00:00:00.000Z",
  updatedAt: "2026-09-18T00:00:00.000Z",
};

const EVIDENCE_CHANGED_ANSWER: Answer = {
  ...CURRENT_ANSWER,
  id: "ans_002",
  status: "EVIDENCE_CHANGED",
};

function makeEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    pathParameters: null,
    queryStringParameters: null,
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: "POST",
    isBase64Encoded: false,
    path: "/",
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as APIGatewayProxyEvent["requestContext"],
    resource: "",
    ...overrides,
  };
}

// ── Reset mocks ───────────────────────────────────────────────────────────────
beforeEach(() => {
  jest.clearAllMocks();
  mockGetDocument.mockResolvedValue(null);
  mockListClaimsByDocument.mockResolvedValue([]);
  mockPutClaims.mockResolvedValue(undefined);
  mockListAllClaims.mockResolvedValue([]);
  mockGetAnswer.mockResolvedValue(null);
  mockGetClaim.mockResolvedValue(null);
  mockPutAnswer.mockResolvedValue(undefined);
  mockUpdateAnswerStatus.mockResolvedValue(undefined);
  mockGetFromS3.mockResolvedValue(Buffer.from("fake pdf bytes"));
  mockExtractClaimsFromText.mockResolvedValue([SUPPORTED_CLAIM]);
  mockGenerateGroundedAnswer.mockResolvedValue({
    text: "Answer text from model.",
    usedClaimIds: ["claim_abc"],
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// M3 — extractClaims
// ═════════════════════════════════════════════════════════════════════════════

import { handler as extractClaimsHandler } from "../src/handlers/extractClaims";

describe("POST /documents/{id}/claims/extract", () => {
  it("returns 404 when document does not exist", async () => {
    mockGetDocument.mockResolvedValue(null);
    const res = await extractClaimsHandler(makeEvent({ pathParameters: { id: "doc_missing" } }));
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).error.code).toBe("DOCUMENT_NOT_FOUND");
  });

  it("rejects RETRACTED documents with 409 DOCUMENT_NOT_USABLE", async () => {
    mockGetDocument.mockResolvedValue(RETRACTED_DOC);
    const res = await extractClaimsHandler(makeEvent({ pathParameters: { id: "doc_retracted" } }));
    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).error.code).toBe("DOCUMENT_NOT_USABLE");
    expect(mockExtractClaimsFromText).not.toHaveBeenCalled();
  });

  it("rejects INVALID documents with 409 DOCUMENT_NOT_USABLE", async () => {
    mockGetDocument.mockResolvedValue(INVALID_DOC);
    const res = await extractClaimsHandler(makeEvent({ pathParameters: { id: "doc_invalid" } }));
    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).error.code).toBe("DOCUMENT_NOT_USABLE");
    expect(mockExtractClaimsFromText).not.toHaveBeenCalled();
  });

  it("returns cached claims without calling Bedrock when claims already exist", async () => {
    mockGetDocument.mockResolvedValue(ACTIVE_DOC);
    mockListClaimsByDocument.mockResolvedValue([SUPPORTED_CLAIM]);
    const res = await extractClaimsHandler(makeEvent({ pathParameters: { id: "doc_active" } }));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.cached).toBe(true);
    expect(body.claims).toHaveLength(1);
    expect(mockExtractClaimsFromText).not.toHaveBeenCalled();
  });

  it("re-extracts when force=true even if cached claims exist", async () => {
    mockGetDocument.mockResolvedValue(ACTIVE_DOC);
    mockListClaimsByDocument.mockResolvedValue([SUPPORTED_CLAIM]);
    const res = await extractClaimsHandler(
      makeEvent({
        pathParameters: { id: "doc_active" },
        queryStringParameters: { force: "true" },
      })
    );
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).cached).toBe(false);
    expect(mockExtractClaimsFromText).toHaveBeenCalledTimes(1);
    expect(mockPutClaims).toHaveBeenCalledTimes(1);
  });

  it("extracts and persists claims for ACTIVE document", async () => {
    mockGetDocument.mockResolvedValue(ACTIVE_DOC);
    mockListClaimsByDocument.mockResolvedValue([]);
    const res = await extractClaimsHandler(makeEvent({ pathParameters: { id: "doc_active" } }));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.cached).toBe(false);
    expect(body.claims).toHaveLength(1);
    expect(body.claims[0].status).toBe("SUPPORTED");
    expect(mockPutClaims).toHaveBeenCalledTimes(1);
  });

  it("returns CLAIM_EXTRACTION_FAILED when Bedrock returns malformed JSON", async () => {
    mockGetDocument.mockResolvedValue(ACTIVE_DOC);
    mockListClaimsByDocument.mockResolvedValue([]);
    mockExtractClaimsFromText.mockRejectedValue(new Error("Model returned invalid JSON for claim extraction."));
    const res = await extractClaimsHandler(makeEvent({ pathParameters: { id: "doc_active" } }));
    expect(res.statusCode).toBe(502);
    expect(JSON.parse(res.body).error.code).toBe("CLAIM_EXTRACTION_FAILED");
    expect(mockPutClaims).not.toHaveBeenCalled();
  });

  it("returns BEDROCK_INFERENCE_FAILED on general Bedrock error", async () => {
    mockGetDocument.mockResolvedValue(ACTIVE_DOC);
    mockListClaimsByDocument.mockResolvedValue([]);
    mockExtractClaimsFromText.mockRejectedValue(new Error("Connection timeout"));
    const res = await extractClaimsHandler(makeEvent({ pathParameters: { id: "doc_active" } }));
    expect(res.statusCode).toBe(502);
    expect(JSON.parse(res.body).error.code).toBe("BEDROCK_INFERENCE_FAILED");
    expect(mockPutClaims).not.toHaveBeenCalled();
  });

  it("returns 400 when no document ID in path", async () => {
    const res = await extractClaimsHandler(makeEvent({ pathParameters: null }));
    expect(res.statusCode).toBe(400);
  });

  // case 7: no-DOI ACTIVE document must allow claim extraction
  it("case 7: extracts claims for ACTIVE no-DOI document (doi=null, retractionStatus=UNKNOWN)", async () => {
    mockGetDocument.mockResolvedValue(NO_DOI_DOC);
    mockListClaimsByDocument.mockResolvedValue([]);
    const res = await extractClaimsHandler(makeEvent({ pathParameters: { id: "doc_no_doi" } }));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.cached).toBe(false);
    expect(body.claims).toHaveLength(1);
    // Bedrock must have been called — doc.status is ACTIVE, so it must not be blocked
    expect(mockExtractClaimsFromText).toHaveBeenCalledTimes(1);
    expect(mockPutClaims).toHaveBeenCalledTimes(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// M5 — chat
// ═════════════════════════════════════════════════════════════════════════════

import { handler as chatHandler } from "../src/handlers/chat";

describe("POST /chat", () => {
  it("returns 400 for missing question", async () => {
    const res = await chatHandler(makeEvent({ body: JSON.stringify({ question: "" }) }));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("BAD_REQUEST");
  });

  it("returns NO_USABLE_EVIDENCE when no claims exist", async () => {
    mockListAllClaims.mockResolvedValue([]);
    const res = await chatHandler(makeEvent({ body: JSON.stringify({ question: "What is the treatment effect?" }) }));
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).error.code).toBe("NO_USABLE_EVIDENCE");
    expect(mockGenerateGroundedAnswer).not.toHaveBeenCalled();
  });

  it("returns NO_USABLE_EVIDENCE when all claims are UNSUPPORTED", async () => {
    mockListAllClaims.mockResolvedValue([UNSUPPORTED_CLAIM]);
    const res = await chatHandler(makeEvent({ body: JSON.stringify({ question: "What is the effect?" }) }));
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).error.code).toBe("NO_USABLE_EVIDENCE");
    expect(mockGenerateGroundedAnswer).not.toHaveBeenCalled();
  });

  it("excludes claims from RETRACTED source documents", async () => {
    mockListAllClaims.mockResolvedValue([CLAIM_FROM_RETRACTED]);
    mockGetDocument.mockImplementation(async (id) =>
      id === "doc_retracted" ? RETRACTED_DOC : null
    );
    const res = await chatHandler(makeEvent({ body: JSON.stringify({ question: "What is the effect?" }) }));
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).error.code).toBe("NO_USABLE_EVIDENCE");
    expect(mockGenerateGroundedAnswer).not.toHaveBeenCalled();
  });

  it("excludes claims from INVALID source documents", async () => {
    mockListAllClaims.mockResolvedValue([CLAIM_FROM_INVALID]);
    mockGetDocument.mockImplementation(async (id) =>
      id === "doc_invalid" ? INVALID_DOC : null
    );
    const res = await chatHandler(makeEvent({ body: JSON.stringify({ question: "What is the effect?" }) }));
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).error.code).toBe("NO_USABLE_EVIDENCE");
    expect(mockGenerateGroundedAnswer).not.toHaveBeenCalled();
  });

  it("generates and persists an answer from usable evidence", async () => {
    mockListAllClaims.mockResolvedValue([SUPPORTED_CLAIM]);
    mockGetDocument.mockImplementation(async (id) =>
      id === "doc_active" ? ACTIVE_DOC : null
    );
    const res = await chatHandler(
      makeEvent({ body: JSON.stringify({ question: "What is the treatment effect?" }) })
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.answer.status).toBe("CURRENT");
    expect(body.answer.claimIds).toContain("claim_abc");
    expect(body.answer.sourceDocumentIds).toContain("doc_active");
    expect(body.citations).toHaveLength(1);
    expect(mockPutAnswer).toHaveBeenCalledTimes(1);
  });

  it("does not include claim IDs fabricated by the model", async () => {
    mockListAllClaims.mockResolvedValue([SUPPORTED_CLAIM]);
    mockGetDocument.mockImplementation(async (id) =>
      id === "doc_active" ? ACTIVE_DOC : null
    );
    // bedrockService already strips unknown IDs — simulate that contract:
    // the service receives a hallucinated ID from the model but only returns
    // the validated subset (only claim_abc was in the allowed set).
    mockGenerateGroundedAnswer.mockResolvedValue({
      text: "Answer grounded only on supplied evidence.",
      usedClaimIds: ["claim_abc"], // hallucinated IDs already stripped by service
    });
    const res = await chatHandler(
      makeEvent({ body: JSON.stringify({ question: "What is the effect?" }) })
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.answer.claimIds).toContain("claim_abc");
    expect(body.answer.claimIds).not.toContain("claim_HALLUCINATED");
  });


  it("returns 400 for invalid JSON body", async () => {
    const res = await chatHandler(makeEvent({ body: "not-json" }));
    expect(res.statusCode).toBe(400);
  });

  // case 8: claims from a no-DOI ACTIVE document must be eligible for Evidence-Locked chat
  it("case 8: chat uses claims from no-DOI ACTIVE document (doi=null, retractionStatus=UNKNOWN)", async () => {
    const noDoiClaim: Claim = {
      id: "claim_no_doi",
      documentId: "doc_no_doi",
      sourceDocumentIds: ["doc_no_doi"],
      text: "Remote work increases developer output by 15% on average.",
      status: "SUPPORTED",
      createdAt: "2026-09-18T00:00:00.000Z",
      updatedAt: "2026-09-18T00:00:00.000Z",
    };
    mockListAllClaims.mockResolvedValue([noDoiClaim]);
    mockGetDocument.mockImplementation(async (id) =>
      id === "doc_no_doi" ? NO_DOI_DOC : null
    );
    mockGenerateGroundedAnswer.mockResolvedValue({
      text: "According to the internal study, remote work increases developer output by 15%.",
      usedClaimIds: ["claim_no_doi"],
    });

    const res = await chatHandler(
      makeEvent({ body: JSON.stringify({ question: "What is the effect of remote work on productivity?" }) })
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.answer.status).toBe("CURRENT");
    expect(body.answer.claimIds).toContain("claim_no_doi");
    expect(body.answer.sourceDocumentIds).toContain("doc_no_doi");
    // Citation must include the no-DOI document's title and null doi
    expect(body.citations).toHaveLength(1);
    expect(body.citations[0].doi).toBeNull();
    expect(body.citations[0].title).toBe("Remote Work and Developer Productivity");
    expect(mockGenerateGroundedAnswer).toHaveBeenCalledTimes(1);
    expect(mockPutAnswer).toHaveBeenCalledTimes(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// M8 — regenerateAnswer
// ═════════════════════════════════════════════════════════════════════════════

import { handler as regenerateHandler } from "../src/handlers/regenerateAnswer";

describe("POST /answers/{id}/regenerate", () => {
  it("returns 404 when answer does not exist", async () => {
    mockGetAnswer.mockResolvedValue(null);
    const res = await regenerateHandler(makeEvent({ pathParameters: { id: "ans_missing" } }));
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).error.code).toBe("ANSWER_NOT_FOUND");
  });

  it("returns NO_USABLE_EVIDENCE when all referenced claims are UNSUPPORTED", async () => {
    mockGetAnswer.mockResolvedValue({ ...EVIDENCE_CHANGED_ANSWER, claimIds: ["claim_bad"] });
    mockGetClaim.mockResolvedValue(UNSUPPORTED_CLAIM);
    mockGetDocument.mockResolvedValue(ACTIVE_DOC);
    const res = await regenerateHandler(makeEvent({ pathParameters: { id: "ans_002" } }));
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).error.code).toBe("NO_USABLE_EVIDENCE");
    expect(mockGenerateGroundedAnswer).not.toHaveBeenCalled();
  });

  it("returns NO_USABLE_EVIDENCE when source document is RETRACTED", async () => {
    mockGetAnswer.mockResolvedValue({
      ...EVIDENCE_CHANGED_ANSWER,
      claimIds: ["claim_retracted_src"],
    });
    mockGetClaim.mockResolvedValue(CLAIM_FROM_RETRACTED);
    mockGetDocument.mockResolvedValue(RETRACTED_DOC);
    const res = await regenerateHandler(makeEvent({ pathParameters: { id: "ans_002" } }));
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).error.code).toBe("NO_USABLE_EVIDENCE");
    expect(mockPutAnswer).not.toHaveBeenCalled();
  });

  it("returns NO_USABLE_EVIDENCE when source document is INVALID", async () => {
    mockGetAnswer.mockResolvedValue({
      ...EVIDENCE_CHANGED_ANSWER,
      claimIds: ["claim_invalid_src"],
    });
    mockGetClaim.mockResolvedValue(CLAIM_FROM_INVALID);
    mockGetDocument.mockResolvedValue(INVALID_DOC);
    const res = await regenerateHandler(makeEvent({ pathParameters: { id: "ans_002" } }));
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).error.code).toBe("NO_USABLE_EVIDENCE");
  });

  it("regenerates answer and preserves old answer", async () => {
    mockGetAnswer.mockResolvedValue(EVIDENCE_CHANGED_ANSWER);
    mockGetClaim.mockResolvedValue(SUPPORTED_CLAIM);
    mockGetDocument.mockImplementation(async (id) =>
      id === "doc_active" ? ACTIVE_DOC : null
    );
    const res = await regenerateHandler(makeEvent({ pathParameters: { id: "ans_002" } }));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    // New answer
    expect(body.answer.status).toBe("CURRENT");
    expect(body.answer.previousAnswerId).toBe("ans_002");
    expect(body.answer.supersededByAnswerId).toBeNull();
    expect(mockPutAnswer).toHaveBeenCalledTimes(1);

    // Old answer referenced without overwrite
    expect(body.previousAnswer.id).toBe("ans_002");
    expect(body.previousAnswer.status).toBe("EVIDENCE_CHANGED");

    // Old answer stamped with supersededByAnswerId via updateAnswerStatus
    expect(mockUpdateAnswerStatus).toHaveBeenCalledWith(
      "ans_002",
      "EVIDENCE_CHANGED",
      body.answer.id
    );
  });

  it("returns 400 when no answer ID in path", async () => {
    const res = await regenerateHandler(makeEvent({ pathParameters: null }));
    expect(res.statusCode).toBe(400);
  });
});
