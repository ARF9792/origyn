import { checkRetractionStatus } from "../src/services/crossrefService";

// ── Mock global fetch ─────────────────────────────────────────────────────────
const mockFetch = jest.fn();
global.fetch = mockFetch;

function mockCrossrefOk(body: object) {
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => body,
  } as Response);
}

function mockCrossref404() {
  mockFetch.mockResolvedValue({
    ok: false,
    status: 404,
    json: async () => ({}),
  } as Response);
}

function mockCrossrefNetworkError() {
  mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────

describe("checkRetractionStatus — NONE_FOUND (active paper)", () => {
  it("returns NONE_FOUND when update-to is empty", async () => {
    mockCrossrefOk({
      status: "ok",
      message: {
        DOI: "10.1038/nature12373",
        title: ["Attention Is All You Need"],
        "update-to": [],
      },
    });

    const result = await checkRetractionStatus("10.1038/nature12373");

    expect(result.found).toBe(true);
    expect(result.retractionStatus).toBe("NONE_FOUND");
    expect(result.retractionNotice).toBeNull();
    expect(result.title).toBe("Attention Is All You Need");
    expect(result.doi).toBe("10.1038/nature12373");
  });

  it("returns NONE_FOUND when update-to is absent", async () => {
    mockCrossrefOk({
      status: "ok",
      message: {
        DOI: "10.1038/nature12373",
        title: ["Some Paper"],
      },
    });

    const result = await checkRetractionStatus("10.1038/nature12373");
    expect(result.retractionStatus).toBe("NONE_FOUND");
    expect(result.retractionNotice).toBeNull();
  });

  it("ignores non-retraction update types (e.g. correction)", async () => {
    mockCrossrefOk({
      status: "ok",
      message: {
        DOI: "10.1038/nature12373",
        title: ["Corrected Paper"],
        "update-to": [
          {
            DOI: "10.1038/correction-doi",
            type: "correction",
            updated: { "date-parts": [[2024, 3, 15]] },
          },
        ],
      },
    });

    const result = await checkRetractionStatus("10.1038/nature12373");
    expect(result.retractionStatus).toBe("NONE_FOUND");
    expect(result.retractionNotice).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("checkRetractionStatus — RETRACTED", () => {
  it("detects a retracted paper via update-to type=retraction", async () => {
    mockCrossrefOk({
      status: "ok",
      message: {
        DOI: "10.1016/j.cell.2020.01.001",
        title: ["Retracted Research Paper"],
        "update-to": [
          {
            DOI: "10.1016/j.cell.2020.01.002",
            type: "retraction",
            label: "Retraction",
            updated: {
              "date-parts": [[2021, 6, 15]],
              "date-time": "2021-06-15T00:00:00Z",
            },
          },
        ],
      },
    });

    const result = await checkRetractionStatus("10.1016/j.cell.2020.01.001");

    expect(result.found).toBe(true);
    expect(result.retractionStatus).toBe("RETRACTED");
    expect(result.retractionNotice).not.toBeNull();
    expect(result.retractionNotice?.doi).toBe("10.1016/j.cell.2020.01.002");
    expect(result.retractionNotice?.date).toBe("2021-06-15");
    expect(result.retractionNotice?.source).toBe("crossref");
  });

  it("is case-insensitive for retraction type", async () => {
    mockCrossrefOk({
      status: "ok",
      message: {
        DOI: "10.1038/some.doi",
        title: ["Retracted Paper"],
        "update-to": [
          {
            DOI: "10.1038/retraction",
            type: "Retraction", // capital R
            updated: { "date-parts": [[2022, 1, 1]] },
          },
        ],
      },
    });

    const result = await checkRetractionStatus("10.1038/some.doi");
    expect(result.retractionStatus).toBe("RETRACTED");
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("checkRetractionStatus — UNKNOWN cases", () => {
  it("returns UNKNOWN (found:false) when DOI is not in Crossref (404)", async () => {
    mockCrossref404();
    const result = await checkRetractionStatus("10.9999/does.not.exist");
    expect(result.found).toBe(false);
    expect(result.retractionStatus).toBe("UNKNOWN");
    expect(result.retractionNotice).toBeNull();
  });

  it("returns UNKNOWN on network error", async () => {
    mockCrossrefNetworkError();
    const result = await checkRetractionStatus("10.1038/nature12373");
    expect(result.retractionStatus).toBe("UNKNOWN");
    expect(result.found).toBe(false);
  });

  it("returns UNKNOWN on unexpected Crossref response shape", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "error", message: null }),
    } as Response);

    const result = await checkRetractionStatus("10.1038/nature12373");
    expect(result.retractionStatus).toBe("UNKNOWN");
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("checkRetractionStatus — title extraction", () => {
  it("returns null title if Crossref title array is empty", async () => {
    mockCrossrefOk({
      status: "ok",
      message: {
        DOI: "10.1038/test",
        title: [],
      },
    });

    const result = await checkRetractionStatus("10.1038/test");
    expect(result.title).toBeNull();
  });

  it("extracts first title from array", async () => {
    mockCrossrefOk({
      status: "ok",
      message: {
        DOI: "10.1038/test",
        title: ["Main Title", "Subtitle"],
      },
    });

    const result = await checkRetractionStatus("10.1038/test");
    expect(result.title).toBe("Main Title");
  });
});
