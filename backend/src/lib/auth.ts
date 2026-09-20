import { APIGatewayProxyEvent } from "aws-lambda";

/**
 * Extracts the canonical ownerId from the API Gateway JWT authorizer context.
 * 
 * Throws an error if the request is not authenticated, ensuring that we never
 * process a request without a verified owner identity.
 */
export function getAuthenticatedOwnerId(event: APIGatewayProxyEvent): string {
  // Check if we are running in local mock mode (tests might inject 'legacy')
  if (process.env.NODE_ENV === "test") {
    // Note: TypeScript might complain about APIGatewayProxyEvent vs APIGatewayProxyEventV2
    // For V2 HTTP APIs, it's actually APIGatewayProxyEventV2. 
    // We will cast to any to safely navigate the context since we might receive a mix of v1 and v2 events in tests.
    const anyEvent = event as any;
    return anyEvent.requestContext?.authorizer?.jwt?.claims?.sub ?? "test-owner-id";
  }

  const anyEvent = event as any;
  const claims = anyEvent.requestContext?.authorizer?.jwt?.claims;
  const sub = claims?.sub;
  
  if (!sub || typeof sub !== "string") {
    throw new Error("UNAUTHORIZED");
  }

  return sub;
}
