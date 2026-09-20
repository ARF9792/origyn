import { APIGatewayProxyEvent } from "aws-lambda";
import { handler } from "../src/handlers/uploadDocument";

// ── Mocks ─────────────────────────────────────────────────────────────────────
jest.mock("../src/lib/multipart");
jest.mock("../src/lib/s3");
jest.mock("../src/lib/dynamo");
jest.mock("../src/services/paperIdentifier");
jest.mock("../src/services/crossrefService");

import { parseMultipartFile } from "../src/lib/multipart";
import { uploadToS3 } from "../src/lib/s3";
import { putDocument, updateDocument, findDocumentByDoi } from "../src/lib/dynamo";
import { identifyPaper } from "../src/services/paperIdentifier";
import { checkRetractionStatus, searchByTitle } from "../src/services/crossrefService";

const mockParse = parseMultipartFile as jest.Mock;
const mockUploadS3 = uploadToS3 as jest.Mock;
const mockPut = putDocument as jest.Mock;
const mockUpdate = updateDocument as jest.Mock;
const mockFindDoi = findDocumentByDoi as jest.Mock;
const mockIdentify = identifyPaper as jest.Mock;
const mockCheckRetraction = checkRetractionStatus as jest.Mock;
const mockSearchByTitle = searchByTitle as jest.Mock;

function createEvent(): APIGatewayProxyEvent {
  return {
    body: "fake-multipart-body",
    headers: { "content-type": "multipart/form-data; boundary=---" },
  } as unknown as APIGatewayProxyEvent;
}

beforeEach(() => {
  jest.clearAllMocks();

  mockParse.mockResolvedValue({
    filename: "test.pdf",
    contentType: "application/pdf",
    buffer: Buffer.from("pdf-data"),
  });

  mockUploadS3.mockResolvedValue(undefined);
  mockPut.mockResolvedValue(undefined);
  mockUpdate.mockResolvedValue(undefined);
  mockFindDoi.mockResolvedValue(null);
});

describe("uploadDocument pipeline", () => {
  it("rejects non-PDF files", async () => {
    mockParse.mockResolvedValueOnce({
      filename: "test.png",
      contentType: "image/png",
      buffer: Buffer.from("img"),
    });

    const res = await handler(createEvent());
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe("INVALID_FILE");
  });

  it("handles duplicate DOI rejection correctly", async () => {
    mockIdentify.mockResolvedValueOnce({
      title: null,
      doi: "10.1000/duplicate",
      identificationMethod: "doi_in_pdf",
    });
    mockFindDoi.mockResolvedValueOnce({ id: "doc_existing123" });

    const res = await handler(createEvent());
    expect(res.statusCode).toBe(409);
    
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe("DUPLICATE_DOCUMENT");
    expect(body.error.existingDocumentId).toBe("doc_existing123");
    
    // Ensure it aborts before S3/Dynamo writes
    expect(mockUploadS3).not.toHaveBeenCalled();
    expect(mockPut).not.toHaveBeenCalled();
  });

  it("identifies paper, uploads to S3, writes to DB, checks Crossref, and returns ACTIVE", async () => {
    mockIdentify.mockResolvedValueOnce({
      title: "Valid Science",
      doi: "10.1000/valid",
      identificationMethod: "doi_in_pdf",
    });

    mockCheckRetraction.mockResolvedValueOnce({
      found: true,
      doi: "10.1000/valid",
      title: "Valid Science from Crossref",
      retractionStatus: "NONE_FOUND",
      retractionNotice: null,
    });

    const res = await handler(createEvent());
    expect(res.statusCode).toBe(200);

    const doc = JSON.parse(res.body);
    expect(doc.status).toBe("ACTIVE");
    expect(doc.retractionStatus).toBe("NONE_FOUND");
    expect(doc.title).toBe("Valid Science"); // Prefers identified title over crossref if both exist (well, identification.title ?? crossrefTitle)
    expect(doc.doi).toBe("10.1000/valid");

    // Pipeline verifications
    expect(mockUploadS3).toHaveBeenCalled();
    expect(mockPut).toHaveBeenCalledWith(expect.objectContaining({
      status: "PROCESSING"
    }));
    expect(mockUpdate).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      status: "ACTIVE",
      retractionStatus: "NONE_FOUND"
    }));
  });

  it("returns RETRACTED when Crossref finds a retraction", async () => {
    mockIdentify.mockResolvedValueOnce({
      title: "Bad Science",
      doi: "10.1000/bad",
      identificationMethod: "doi_in_pdf",
    });

    mockCheckRetraction.mockResolvedValueOnce({
      found: true,
      doi: "10.1000/bad",
      title: "Bad Science",
      retractionStatus: "RETRACTED",
      retractionNotice: {
        date: "2024-01-01",
        doi: "10.1000/bad",
        source: "crossref"
      },
    });

    const res = await handler(createEvent());
    expect(res.statusCode).toBe(200);

    const doc = JSON.parse(res.body);
    expect(doc.status).toBe("RETRACTED");
    expect(doc.retractionStatus).toBe("RETRACTED");
    expect(doc.retractionNotice).not.toBeNull();
  });

  it("safely falls back to UNKNOWN if Crossref fails", async () => {
    mockIdentify.mockResolvedValueOnce({
      title: null,
      doi: "10.1000/unknown",
      identificationMethod: "doi_in_pdf",
    });

    mockCheckRetraction.mockRejectedValueOnce(new Error("API Timeout"));

    const res = await handler(createEvent());
    expect(res.statusCode).toBe(200);

    const doc = JSON.parse(res.body);
    // Even though DOI exists, retraction status could not be verified
    expect(doc.status).toBe("UNKNOWN");
    expect(doc.retractionStatus).toBe("UNKNOWN");
  });

  it("handles title fallback correctly when DOI is missing", async () => {
    mockIdentify.mockResolvedValueOnce({
      title: "Some Fallback Title",
      doi: null,
      identificationMethod: "title_extracted",
    });

    mockSearchByTitle.mockResolvedValueOnce("10.1000/fallback");
    mockFindDoi.mockResolvedValueOnce(null);

    mockCheckRetraction.mockResolvedValueOnce({
      found: true,
      doi: "10.1000/fallback",
      title: "Some Fallback Title from Crossref",
      retractionStatus: "NONE_FOUND",
      retractionNotice: null,
    });

    const res = await handler(createEvent());
    expect(res.statusCode).toBe(200);

    const doc = JSON.parse(res.body);
    expect(doc.doi).toBe("10.1000/fallback");
    expect(doc.status).toBe("ACTIVE");
    
    expect(mockSearchByTitle).toHaveBeenCalledWith("Some Fallback Title");
    // Duplicate check must be called AFTER the fallback resolves the DOI
    expect(mockFindDoi).toHaveBeenCalledWith("10.1000/fallback", "public");
  });

  it("returns ACTIVE + retractionStatus UNKNOWN for a no-DOI local document (no Crossref match)", async () => {
    mockIdentify.mockResolvedValueOnce({
      title: "Some Ambiguous Title",
      doi: null,
      identificationMethod: "title_extracted",
    });

    mockSearchByTitle.mockResolvedValueOnce(null);

    const res = await handler(createEvent());
    expect(res.statusCode).toBe(200);

    const doc = JSON.parse(res.body);
    expect(doc.doi).toBeNull();
    // No-DOI local documents must be ACTIVE, not UNKNOWN.
    // retractionStatus UNKNOWN means "cannot verify" — not "invalid".
    expect(doc.status).toBe("ACTIVE");
    expect(doc.retractionStatus).toBe("UNKNOWN");
  });

  // ── No-DOI local document tests (cases 3–6 from spec) ──────────────────────

  it("case 3: no-DOI PDF with a clear title and no Crossref match → ACTIVE + UNKNOWN", async () => {
    mockIdentify.mockResolvedValueOnce({
      title: "Remote Work and Developer Productivity",
      doi: null,
      identificationMethod: "title_extracted",
    });
    mockSearchByTitle.mockResolvedValueOnce(null); // no Crossref match

    const res = await handler(createEvent());
    expect(res.statusCode).toBe(200);
    const doc = JSON.parse(res.body);
    expect(doc.doi).toBeNull();
    expect(doc.status).toBe("ACTIVE");
    expect(doc.retractionStatus).toBe("UNKNOWN");
    expect(doc.retractionNotice).toBeNull();
    expect(doc.title).toBe("Remote Work and Developer Productivity");
    // Crossref must NOT be called for retraction (no DOI to look up)
    expect(mockCheckRetraction).not.toHaveBeenCalled();
  });

  it("case 4: no-DOI PDF with multi-line title → correct joined title", async () => {
    // paperIdentifier.ts joins the lines; the handler just receives the result
    mockIdentify.mockResolvedValueOnce({
      title: "Impact of Remote Work on Software Engineering Productivity",
      doi: null,
      identificationMethod: "title_extracted",
    });
    mockSearchByTitle.mockResolvedValueOnce(null);

    const res = await handler(createEvent());
    expect(res.statusCode).toBe(200);
    const doc = JSON.parse(res.body);
    expect(doc.title).toBe("Impact of Remote Work on Software Engineering Productivity");
    expect(doc.status).toBe("ACTIVE");
    expect(doc.doi).toBeNull();
  });

  it("case 5: no-DOI PDF with weak/ambiguous Crossref title results → no DOI attached, still ACTIVE+UNKNOWN", async () => {
    mockIdentify.mockResolvedValueOnce({
      title: "Internal Engineering Observations",
      doi: null,
      identificationMethod: "title_extracted",
    });
    // searchByTitle returns null when similarity is below threshold or ambiguous
    mockSearchByTitle.mockResolvedValueOnce(null);

    const res = await handler(createEvent());
    expect(res.statusCode).toBe(200);
    const doc = JSON.parse(res.body);
    expect(doc.doi).toBeNull();              // no DOI must be fabricated
    expect(doc.status).toBe("ACTIVE");       // still usable
    expect(doc.retractionStatus).toBe("UNKNOWN");
    expect(mockCheckRetraction).not.toHaveBeenCalled();
  });

  it("case 6: no-DOI PDF with no usable title text → filename fallback used, upload succeeds", async () => {
    mockParse.mockResolvedValueOnce({
      filename: "remote-work-study-2026.pdf",
      contentType: "application/pdf",
      buffer: Buffer.from("pdf-data"),
    });
    mockIdentify.mockResolvedValueOnce({
      title: null,   // paperIdentifier found nothing
      doi: null,
      identificationMethod: "unknown",
    });
    // searchByTitle not called when title is null (handler guards with `identification.title`)

    const res = await handler(createEvent());
    expect(res.statusCode).toBe(200);
    const doc = JSON.parse(res.body);
    expect(doc.doi).toBeNull();
    expect(doc.status).toBe("ACTIVE");
    expect(doc.retractionStatus).toBe("UNKNOWN");
    // Filename fallback: "remote-work-study-2026.pdf" → "remote work study 2026"
    expect(doc.title).toBe("remote work study 2026");
  });
});
