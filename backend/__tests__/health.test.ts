import { handler } from "../src/handlers/health";
import { APIGatewayProxyEvent } from "aws-lambda";

const mockEvent = {} as APIGatewayProxyEvent;

describe("GET /health", () => {
  it("returns 200 with status ok", async () => {
    const result = await handler(mockEvent);
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.status).toBe("ok");
    expect(body.service).toBe("origyn-backend");
    expect(body.region).toBeDefined();
    expect(body.timestamp).toBeDefined();
  });

  it("includes CORS header", async () => {
    const result = await handler(mockEvent);
    expect(result.headers?.["Access-Control-Allow-Origin"]).toBe("*");
  });
});
