import { APIGatewayProxyEvent } from "aws-lambda";
import { handler } from "../src/handlers/uploadDocument";

// ── Mock multipart parser ─────────────────────────────────────────────────────
jest.mock("../src/lib/multipart");
import { parseMultipartFile } from "../src/lib/multipart";
const mockParseMultipart = parseMultipartFile as jest.MockedFunction<
  typeof parseMultipartFile
>;

// ── Mock S3 ───────────────────────────────────────────────────────────────────
jest.mock("../src/lib/s3");
import { uploadToS3 } from "../src/lib/s3";
const mockUploadToS3 = uploadToS3 as jest.MockedFunction<typeof uploadToS3>;

// ── Mock DynamoDB ─────────────────────────────────────────────────────────────
jest.mock("../src/lib/dynamo");
import { putDocument, updateDocument } from "../src/lib/dynamo";
const mockPutDocument = putDocument as jest.MockedFunction<typeof putDocument>;
const mockUpdateDocument = updateDocument as jest.MockedFunction<typeof updateDocument>;

// ── Mock paper identifier ──────────────────────────────────────────────────
jest.mock("../src/services/paperIdentifier");
import { identifyPaper } from "../src/services/paperIdentifier";
const mockIdentifyPaper = identifyPaper as jest.MockedFunction<typeof identifyPaper>;

// ── Mock Crossref service ──────────────────────────────────────────────────
jest.mock("../src/services/crossrefService");
import { checkRetractionStatus } from "../src/services/crossrefService";
const mockCheckRetraction = checkRetractionStatus as jest.MockedFunction<typeof checkRetractionStatus>;

// ─────────────────────────────────────────────────────────────────────────────

const mockEvent = {} as APIGatewayProxyEvent;

const fakePdfBuffer = Buffer.from("%PDF-1.4 fake pdf content");

beforeEach(() => {
  jest.clearAllMocks();
  mockParseMultipart.mockResolvedValue({
    filename: "paper.pdf",
    buffer: fakePdfBuffer,
    contentType: "application/pdf",
  });
  mockUploadToS3.mockResolvedValue(undefined);
  mockPutDocument.mockResolvedValue(undefined);
  mockUpdateDocument.mockResolvedValue(undefined);
  mockIdentifyPaper.mockResolvedValue({
    title: "Test Research Paper",
    doi: "10.1038/test.doi",
    identificationMethod: "doi_in_pdf",
  });
  mockCheckRetraction.mockResolvedValue({
    found: true,
    doi: "10.1038/test.doi",
    title: "Test Research Paper",
    retractionStatus: "NONE_FOUND",
    retractionNotice: null,
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("POST /documents — happy path", () => {
  it("returns 200 with a fully resolved document", async () => {
    const result = await handler(mockEvent);
    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body);
    expect(body.id).toMatch(/^doc_/);
    expect(body.filename).toBe("paper.pdf");
    expect(body.status).toBe("ACTIVE");
    expect(body.retractionStatus).toBe("NONE_FOUND");
    expect(body.s3Key).toMatch(/^uploads\/doc_/);
    expect(body.title).toBe("Test Research Paper");
    expect(body.doi).toBe("10.1038/test.doi");
    expect(body.retractionNotice).toBeNull();
    expect(body.createdAt).toBeDefined();
    expect(body.updatedAt).toBeDefined();
  });

  it("calls uploadToS3 with the correct key and buffer", async () => {
    await handler(mockEvent);
    expect(mockUploadToS3).toHaveBeenCalledTimes(1);
    const [key, buffer, contentType] = mockUploadToS3.mock.calls[0];
    expect(key).toMatch(/^uploads\/doc_/);
    expect(buffer).toEqual(fakePdfBuffer);
    expect(contentType).toBe("application/pdf");
  });

  it("calls putDocument with PROCESSING status", async () => {
    await handler(mockEvent);
    expect(mockPutDocument).toHaveBeenCalledTimes(1);
    const [doc] = mockPutDocument.mock.calls[0];
    expect(doc.status).toBe("PROCESSING");
    expect(doc.retractionStatus).toBe("UNKNOWN");
  });

  it("includes CORS header", async () => {
    const result = await handler(mockEvent);
    expect(result.headers?.["Access-Control-Allow-Origin"]).toBe("*");
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("POST /documents — validation errors", () => {
  it("returns 400 if multipart parse fails", async () => {
    mockParseMultipart.mockRejectedValue(new Error("bad multipart"));
    const result = await handler(mockEvent);
    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error.code).toBe("INVALID_FILE");
  });

  it("returns 400 if file is not a PDF", async () => {
    mockParseMultipart.mockResolvedValue({
      filename: "image.png",
      buffer: Buffer.from("fake"),
      contentType: "image/png",
    });
    const result = await handler(mockEvent);
    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error.code).toBe("INVALID_FILE");
  });

  it("returns 400 if file is empty", async () => {
    mockParseMultipart.mockResolvedValue({
      filename: "empty.pdf",
      buffer: Buffer.alloc(0),
      contentType: "application/pdf",
    });
    const result = await handler(mockEvent);
    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error.code).toBe("INVALID_FILE");
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("POST /documents — AWS errors", () => {
  it("returns 502 if S3 upload fails", async () => {
    mockUploadToS3.mockRejectedValue(new Error("S3 error"));
    const result = await handler(mockEvent);
    expect(result.statusCode).toBe(502);
    const body = JSON.parse(result.body);
    expect(body.error.code).toBe("UPLOAD_FAILED");
  });

  it("returns 502 if DynamoDB write fails", async () => {
    mockPutDocument.mockRejectedValue(new Error("DynamoDB error"));
    const result = await handler(mockEvent);
    expect(result.statusCode).toBe(502);
    const body = JSON.parse(result.body);
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
