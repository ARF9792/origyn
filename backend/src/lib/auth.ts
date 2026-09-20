import { APIGatewayProxyEvent } from "aws-lambda";

export const PUBLIC_WORKSPACE_ID = "public";

export function getWorkspaceId(event?: APIGatewayProxyEvent): string {
  return PUBLIC_WORKSPACE_ID;
}
