import { APIGatewayProxyEvent } from "aws-lambda";
import { handler as getDocumentsHandler } from "../src/handlers/getDocuments";
import { handler as getDocumentHandler } from "../src/handlers/getDocument";
import { handler as getGraphHandler } from "../src/handlers/getGraph";
import { Document } from "../src/types/document";

// ── Mock DynamoDB ─────────────────────────────────────────────────────────────
jest.mock("../src/lib/dynamo");
import { listDocuments, getDocument, listClaimsByDocument, listAllClaims, listAllAnswers } from "../src/lib/dynamo";
const mockListDocuments = listDocuments as jest.MockedFunction<typeof listDocuments>;
const mockGetDocument = getDocument as jest.MockedFunction<typeof getDocument>;
// listClaimsByDocument is called by getDocument handler — default to [] in all tests.
const mockListClaimsByDocument = listClaimsByDocument as jest.MockedFunction<typeof listClaimsByDocument>;
// listAllClaims and listAllAnswers are called by getGraph — default to [] in all tests.
const mockListAllClaims = listAllClaims as jest.MockedFunction<typeof listAllClaims>;
const mockListAllAnswers = listAllAnswers as jest.MockedFunction<typeof listAllAnswers>;

// ─────────────────────────────────────────────────────────────────────────────

const mockEvent = {} as APIGatewayProxyEvent;

const sampleDoc: Document = {
  id: "doc_abc123", ownerId: "public",
  filename: "nature-paper.pdf",
  s3Key: "uploads/doc_abc123.pdf",
  title: "The Nature of Things",
  doi: "10.1038/nature12373",
  status: "ACTIVE",
  retractionStatus: "NONE_FOUND",
  retractionNotice: null,
  claims: [],
  createdAt: "2026-09-17T10:00:00Z",
  updatedAt: "2026-09-17T10:00:05Z",
};

const retractedDoc: Document = {
  id: "doc_xyz789", ownerId: "public",
  filename: "retracted-paper.pdf",
  s3Key: "uploads/doc_xyz789.pdf",
  title: "Retracted Research Paper",
  doi: "10.1016/j.cell.2020.01.001",
  status: "RETRACTED",
  retractionStatus: "RETRACTED",
  retractionNotice: {
    doi: "10.1016/j.cell.2020.01.002",
    date: "2021-06-15",
    source: "crossref",
  },
  claims: [],
  createdAt: "2026-09-17T09:00:00Z",
  updatedAt: "2026-09-17T09:00:10Z",
};

beforeEach(() => {
  jest.clearAllMocks();
  // Default: no persisted claims (Day 1 behaviour preserved for all doc tests).
  mockListClaimsByDocument.mockResolvedValue([]);
  // Default: no claims or answers in graph (populates once Bedrock extraction runs).
  mockListAllClaims.mockResolvedValue([]);
  mockListAllAnswers.mockResolvedValue([]);
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /documents
// ═════════════════════════════════════════════════════════════════════════════

describe("GET /documents", () => {
  it("returns 200 with items array", async () => {
    mockListDocuments.mockResolvedValue([sampleDoc]);
    const result = await getDocumentsHandler(mockEvent);
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.items).toHaveLength(1);
  });

  it("returns only DocumentSummary fields (no retractionNotice, no claims, no timestamps)", async () => {
    mockListDocuments.mockResolvedValue([sampleDoc]);
    const result = await getDocumentsHandler(mockEvent);
    const item = JSON.parse(result.body).items[0];

    expect(item.id).toBe("doc_abc123");
    expect(item.filename).toBe("nature-paper.pdf");
    expect(item.title).toBe("The Nature of Things");
    expect(item.doi).toBe("10.1038/nature12373");
    expect(item.status).toBe("ACTIVE");
    expect(item.retractionStatus).toBe("NONE_FOUND");

    // Must NOT expose these in list view
    expect(item.retractionNotice).toBeUndefined();
    expect(item.claims).toBeUndefined();
    expect(item.createdAt).toBeUndefined();
    expect(item.updatedAt).toBeUndefined();
    expect(item.s3Key).toBeUndefined();
  });

  it("returns empty items array when no documents exist", async () => {
    mockListDocuments.mockResolvedValue([]);
    const result = await getDocumentsHandler(mockEvent);
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).items).toEqual([]);
  });

  it("handles multiple documents including retracted ones", async () => {
    mockListDocuments.mockResolvedValue([sampleDoc, retractedDoc]);
    const result = await getDocumentsHandler(mockEvent);
    const items = JSON.parse(result.body).items;
    expect(items).toHaveLength(2);
    expect(items.find((i: { id: string }) => i.id === "doc_xyz789").status).toBe("RETRACTED");
    expect(items.find((i: { id: string }) => i.id === "doc_xyz789").retractionStatus).toBe("RETRACTED");
  });

  it("returns 502 on DynamoDB error", async () => {
    mockListDocuments.mockRejectedValue(new Error("DB error"));
    const result = await getDocumentsHandler(mockEvent);
    expect(result.statusCode).toBe(502);
    expect(JSON.parse(result.body).error.code).toBe("INTERNAL_ERROR");
  });

  it("includes CORS header", async () => {
    mockListDocuments.mockResolvedValue([]);
    const result = await getDocumentsHandler(mockEvent);
    expect(result.headers?.["Access-Control-Allow-Origin"]).toBe("*");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /documents/:id
// ═════════════════════════════════════════════════════════════════════════════

describe("GET /documents/:id", () => {
  it("returns 200 with full document record", async () => {
    mockGetDocument.mockResolvedValue(sampleDoc);
    const event = { pathParameters: { id: "doc_abc123" } } as unknown as APIGatewayProxyEvent;
    const result = await getDocumentHandler(event);
    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body);
    expect(body.id).toBe("doc_abc123");
    expect(body.title).toBe("The Nature of Things");
    expect(body.doi).toBe("10.1038/nature12373");
    expect(body.status).toBe("ACTIVE");
    expect(body.retractionStatus).toBe("NONE_FOUND");
    expect(body.retractionNotice).toBeNull();
    expect(body.claims).toEqual([]);
    expect(body.createdAt).toBe("2026-09-17T10:00:00Z");
    expect(body.updatedAt).toBe("2026-09-17T10:00:05Z");
  });

  it("returns full retraction notice for retracted document", async () => {
    mockGetDocument.mockResolvedValue(retractedDoc);
    const event = { pathParameters: { id: "doc_xyz789" } } as unknown as APIGatewayProxyEvent;
    const result = await getDocumentHandler(event);
    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body);
    expect(body.status).toBe("RETRACTED");
    expect(body.retractionStatus).toBe("RETRACTED");
    expect(body.retractionNotice).not.toBeNull();
    expect(body.retractionNotice.doi).toBe("10.1016/j.cell.2020.01.002");
    expect(body.retractionNotice.date).toBe("2021-06-15");
    expect(body.retractionNotice.source).toBe("crossref");
  });

  it("returns 404 when document does not exist", async () => {
    mockGetDocument.mockResolvedValue(null);
    const event = { pathParameters: { id: "doc_notexist" } } as unknown as APIGatewayProxyEvent;
    const result = await getDocumentHandler(event);
    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).error.code).toBe("DOCUMENT_NOT_FOUND");
  });

  it("returns 400 when id is missing from path", async () => {
    const event = { pathParameters: null } as unknown as APIGatewayProxyEvent;
    const result = await getDocumentHandler(event);
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error.code).toBe("DOCUMENT_NOT_FOUND");
  });

  it("returns 502 on DynamoDB error", async () => {
    mockGetDocument.mockRejectedValue(new Error("DB error"));
    const event = { pathParameters: { id: "doc_abc123" } } as unknown as APIGatewayProxyEvent;
    const result = await getDocumentHandler(event);
    expect(result.statusCode).toBe(502);
    expect(JSON.parse(result.body).error.code).toBe("INTERNAL_ERROR");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /graph
// ═════════════════════════════════════════════════════════════════════════════

describe("GET /graph", () => {
  it("returns 200 with nodes and empty edges", async () => {
    mockListDocuments.mockResolvedValue([sampleDoc]);
    const result = await getGraphHandler(mockEvent);
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.edges).toEqual([]);
    expect(body.nodes).toHaveLength(1);
  });

  it("builds a node with correct shape for each document", async () => {
    mockListDocuments.mockResolvedValue([sampleDoc]);
    const result = await getGraphHandler(mockEvent);
    const node = JSON.parse(result.body).nodes[0];
    expect(node.id).toBe("doc_abc123");
    // Day 2 API contract uses uppercase node types (06_DAY2_API_CONTRACT_ADDENDUM.md)
    expect(node.type).toBe("DOCUMENT");
    expect(node.label).toBe("The Nature of Things");
    expect(node.status).toBe("ACTIVE");
  });

  it("uses filename as label when title is null", async () => {
    const unknownDoc: Document = { ...sampleDoc, title: null, status: "UNKNOWN" };
    mockListDocuments.mockResolvedValue([unknownDoc]);
    const result = await getGraphHandler(mockEvent);
    const node = JSON.parse(result.body).nodes[0];
    expect(node.label).toBe("nature-paper.pdf");
  });

  it("returns empty nodes for empty document list", async () => {
    mockListDocuments.mockResolvedValue([]);
    const result = await getGraphHandler(mockEvent);
    const body = JSON.parse(result.body);
    expect(body.nodes).toEqual([]);
    expect(body.edges).toEqual([]);
  });

  it("returns 502 on DynamoDB error", async () => {
    mockListDocuments.mockRejectedValue(new Error("DB error"));
    const result = await getGraphHandler(mockEvent);
    expect(result.statusCode).toBe(502);
  });
});
