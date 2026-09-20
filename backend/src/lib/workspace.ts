import { APIGatewayProxyEvent } from "aws-lambda";

function getHeader(headers: Record<string, string | undefined> | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower && value) return value;
  }
  return undefined;
}

/**
 * Resolve the workspace identity for the current request.
 * Priority order:
 * 1. Explicit header from the frontend (current app contract)
 * 2. Cognito JWT claims when an authorizer is present
 * 3. Legacy fallback for local/dev calls
 */
export function getWorkspaceId(event: APIGatewayProxyEvent): string {
  const query = event.queryStringParameters as Record<string, string | undefined> | undefined;
  const queryWorkspaceId = query?.workspaceId;
  if (typeof queryWorkspaceId === "string" && queryWorkspaceId.trim()) return queryWorkspaceId.trim();

  const explicit = getHeader(event.headers, "x-origyn-workspace-id");
  if (explicit) return explicit;

  const claims = (event.requestContext as any)?.authorizer?.jwt?.claims;
  const sub = claims?.sub;
  if (typeof sub === "string" && sub.trim()) return sub.trim();

  const username = claims?.username;
  if (typeof username === "string" && username.trim()) return username.trim();

  return "legacy";
}