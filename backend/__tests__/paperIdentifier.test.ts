import { identifyPaper } from "../src/services/paperIdentifier";

// ── Mock pdf-parse wrapper ────────────────────────────────────────────────────
jest.mock("../src/lib/pdfExtract");
import { extractPdfData } from "../src/lib/pdfExtract";
const mockExtract = extractPdfData as jest.MockedFunction<typeof extractPdfData>;

// ─────────────────────────────────────────────────────────────────────────────

const anyBuffer = Buffer.from("fake");

describe("identifyPaper — DOI with explicit prefix", () => {
  it("detects DOI with 'doi:' prefix", async () => {
    mockExtract.mockResolvedValue({
      text: "Some paper text\ndoi: 10.1038/nature12373\nAbstract...",
      info: {},
    });
    const result = await identifyPaper(anyBuffer);
    expect(result.doi).toBe("10.1038/nature12373");
    expect(result.identificationMethod).toBe("doi_in_pdf");
  });

  it("detects DOI with 'DOI:' prefix (case-insensitive)", async () => {
    mockExtract.mockResolvedValue({
      text: "DOI: 10.1016/j.cell.2020.02.058",
      info: {},
    });
    const result = await identifyPaper(anyBuffer);
    expect(result.doi).toBe("10.1016/j.cell.2020.02.058");
    expect(result.identificationMethod).toBe("doi_in_pdf");
  });

  it("detects DOI from https://doi.org/ URL", async () => {
    mockExtract.mockResolvedValue({
      text: "Available at https://doi.org/10.1126/science.aaa9090",
      info: {},
    });
    const result = await identifyPaper(anyBuffer);
    expect(result.doi).toBe("10.1126/science.aaa9090");
    expect(result.identificationMethod).toBe("doi_in_pdf");
  });

  it("strips trailing punctuation from DOI", async () => {
    mockExtract.mockResolvedValue({
      text: "doi: 10.1038/nature12373.",
      info: {},
    });
    const result = await identifyPaper(anyBuffer);
    expect(result.doi).toBe("10.1038/nature12373");
  });
});

describe("identifyPaper — bare DOI in text", () => {
  it("detects bare DOI pattern in text", async () => {
    mockExtract.mockResolvedValue({
      text: "This research (10.1093/bioinformatics/btaa) demonstrates...",
      info: {},
    });
    const result = await identifyPaper(anyBuffer);
    expect(result.doi).not.toBeNull();
    expect(result.doi).toContain("10.1093");
    expect(result.identificationMethod).toBe("doi_in_pdf");
  });
});

describe("identifyPaper — title extraction", () => {
  it("uses PDF metadata Title when available and meaningful", async () => {
    mockExtract.mockResolvedValue({
      text: "Some text without a DOI",
      info: { Title: "Attention Is All You Need" },
    });
    const result = await identifyPaper(anyBuffer);
    expect(result.doi).toBeNull();
    expect(result.title).toBe("Attention Is All You Need");
    expect(result.identificationMethod).toBe("title_extracted");
  });

  it("ignores metadata Title that is a generic placeholder", async () => {
    mockExtract.mockResolvedValue({
      text: "A real title line that is long enough to pass the filter\nSome more text",
      info: { Title: "Microsoft Word - Document1" },
    });
    const result = await identifyPaper(anyBuffer);
    expect(result.title).toBe("A real title line that is long enough to pass the filter");
  });

  it("skips journal headers, article types, and page numbers", async () => {
    mockExtract.mockResolvedValue({
      text: "The EUROCALL Review, Volume 25, No. 2, September 2017\n18\nResearch paper\nA look at advanced learners’ use of mobile devices for\nEnglish language study: Insights from interview data\nMariusz Kruk\nUniversity of Zielona Gora, Poland\nAbstract",
      info: {},
    });
    const result = await identifyPaper(anyBuffer);
    expect(result.title).toBe(
      "A look at advanced learners’ use of mobile devices for English language study: Insights from interview data"
    );
    expect(result.identificationMethod).toBe("title_extracted");
  });

  it("does not destroy legitimate titles with numbers/years", async () => {
    mockExtract.mockResolvedValue({
      text: "Machine Learning in 2024: A Review of the Field\nJohn Doe\nUniversity of Examples",
      info: {},
    });
    const result = await identifyPaper(anyBuffer);
    expect(result.title).toBe("Machine Learning in 2024: A Review of the Field");
  });

  it("joins up to 3 lines correctly", async () => {
    mockExtract.mockResolvedValue({
      text: "This is a very long paper title\nthat happens to span across\nthree distinct lines in the PDF\nAuthor Name\nDepartment",
      info: {},
    });
    const result = await identifyPaper(anyBuffer);
    expect(result.title).toBe("This is a very long paper title that happens to span across three distinct lines in the PDF");
  });
});

describe("identifyPaper — UNKNOWN cases", () => {
  it("returns UNKNOWN when text is empty", async () => {
    mockExtract.mockResolvedValue({ text: "", info: {} });
    const result = await identifyPaper(anyBuffer);
    expect(result.doi).toBeNull();
    expect(result.title).toBeNull();
    expect(result.identificationMethod).toBe("unknown");
  });

  it("returns UNKNOWN when pdf-parse throws", async () => {
    mockExtract.mockRejectedValue(new Error("corrupt PDF"));
    const result = await identifyPaper(anyBuffer);
    expect(result.identificationMethod).toBe("unknown");
    expect(result.doi).toBeNull();
    expect(result.title).toBeNull();
  });

  it("does NOT invent a DOI when text is ambiguous", async () => {
    mockExtract.mockResolvedValue({
      text: "This paper references several works in the field.",
      info: {},
    });
    const result = await identifyPaper(anyBuffer);
    expect(result.doi).toBeNull();
  });
});
