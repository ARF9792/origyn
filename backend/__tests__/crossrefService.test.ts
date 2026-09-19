import { checkRetractionStatus, searchByTitle } from "../src/services/crossrefService";

const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe("checkRetractionStatus", () => {
  const MOCK_DOI = "10.1234/test.doi";

  it("returns UNKNOWN when fetch throws a network error", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("Network down"));
    const result = await checkRetractionStatus(MOCK_DOI);
    expect(result.retractionStatus).toBe("UNKNOWN");
    expect(result.found).toBe(false);
  });

  it("returns UNKNOWN when API returns 404 (not found)", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ status: 404 });
    const result = await checkRetractionStatus(MOCK_DOI);
    expect(result.retractionStatus).toBe("UNKNOWN");
    expect(result.found).toBe(false);
  });

  it("returns NONE_FOUND when paper is found but has no retraction update", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "ok",
        message: { DOI: MOCK_DOI, title: ["Test Title"], "update-to": [] },
      }),
    });
    const result = await checkRetractionStatus(MOCK_DOI);
    expect(result.retractionStatus).toBe("NONE_FOUND");
    expect(result.found).toBe(true);
    expect(result.title).toBe("Test Title");
  });

  it("returns RETRACTED when paper has a retraction update", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "ok",
        message: {
          DOI: MOCK_DOI,
          title: ["Bad Science"],
          "update-to": [
            {
              type: "retraction",
              updated: { "date-time": "2024-01-01T00:00:00Z" },
            },
          ],
        },
      }),
    });
    const result = await checkRetractionStatus(MOCK_DOI);
    expect(result.retractionStatus).toBe("RETRACTED");
    expect(result.found).toBe(true);
    expect(result.retractionNotice?.date).toBe("2024-01-01");
  });
});

describe("searchByTitle", () => {
  it("returns null on network error", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("Network down"));
    const result = await searchByTitle("Some title");
    expect(result).toBeNull();
  });

  it("returns null if API returns no items", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ok", message: { items: [] } }),
    });
    const result = await searchByTitle("Unique obscure title that does not exist");
    expect(result).toBeNull();
  });

  it("returns DOI if a strong match is found", async () => {
    const candidateTitle = "A look at advanced learners’ use of mobile devices for English language study: Insights from interview data";
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "ok",
        message: {
          items: [
            { DOI: "10.4995/eurocall.2017.7461", title: [candidateTitle] },
          ],
        },
      }),
    });
    
    // Test title is slightly messy (like typical extraction)
    const queryTitle = "A look at advanced learners’ use of mobile devices for English language study: Insights from interview data";
    const result = await searchByTitle(queryTitle);
    
    expect(result).toBe("10.4995/eurocall.2017.7461");
  });

  it("returns null if best match is below 0.75 Jaccard similarity threshold", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "ok",
        message: {
          items: [
            { DOI: "10.000/wrong", title: ["Completely unrelated research on potatoes"] },
          ],
        },
      }),
    });
    const result = await searchByTitle("A look at advanced learners’ use of mobile devices");
    expect(result).toBeNull();
  });

  it("returns null if candidates are too ambiguous (multiple close matches)", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "ok",
        message: {
          items: [
            { DOI: "10.000/v1", title: ["Effects of coffee on sleep"] },
            { DOI: "10.000/v2", title: ["The effects of coffee on sleep"] },
          ],
        },
      }),
    });
    // Query is very similar to both
    const result = await searchByTitle("The effects of coffee on sleep patterns");
    expect(result).toBeNull();
  });
});
