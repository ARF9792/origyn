import { handler as getDocumentsHandler } from "../src/handlers/getDocuments";
import { APIGatewayProxyEvent } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { config } from "../src/config";
import { putDocument } from "../src/lib/dynamo";
import { DocumentStatus } from "../src/types/document";

const rawClient = new DynamoDBClient({ region: config.aws.region });
const dynamo = DynamoDBDocumentClient.from(rawClient);

async function clearTable(tableName: string) {
  const result = await dynamo.send(new ScanCommand({ TableName: tableName }));
  const items = result.Items ?? [];
  for (const item of items) {
    await dynamo.send(new DeleteCommand({
      TableName: tableName,
      Key: { id: item.id },
    }));
  }
}

describe("Tenant Data Isolation", () => {
  jest.setTimeout(30000); // 30 seconds for DynamoDB operations

  beforeAll(async () => {
    // Purge data before test
    await clearTable(config.dynamodb.documentsTable);
    await clearTable(config.dynamodb.claimsTable);
    await clearTable(config.dynamodb.answersTable);
  });

  afterAll(async () => {
    await clearTable(config.dynamodb.documentsTable);
    await clearTable(config.dynamodb.claimsTable);
    await clearTable(config.dynamodb.answersTable);
  });

  const createMockEvent = (ownerId: string): APIGatewayProxyEvent => ({
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: "GET",
    isBase64Encoded: false,
    path: "/",
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: "123456789012",
      apiId: "api-id",
      authorizer: {
        jwt: {
          claims: {
            sub: ownerId
          }
        }
      },
      protocol: "HTTP/1.1",
      httpMethod: "GET",
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp: "127.0.0.1",
        user: null,
        userAgent: "Custom",
        userArn: null,
      },
      path: "/",
      stage: "$default",
      requestId: "id",
      requestTimeEpoch: 1428582896000,
      resourceId: "resource-id",
      resourcePath: "/",
    },
    resource: "/",
  });

  it("should not allow userB to see userA's documents", async () => {
    // 1. Mock GET event for user A and user B
    const eventA = createMockEvent("user-A-id");
    const eventB = createMockEvent("user-B-id");
    
    // Insert mock document into DB for user A
    await putDocument({
      id: "doc_test1",
      ownerId: "user-A-id",
      filename: "test.pdf",
      s3Key: "users/user-A-id/documents/doc_test1.pdf",
      title: "Title A",
      doi: "10.1234/a",
      status: "ACTIVE" as DocumentStatus,
      retractionStatus: "UNKNOWN",
      retractionNotice: null,
      claims: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const resA = await getDocumentsHandler(eventA);
    expect(resA.statusCode).toBe(200);
    const bodyA = JSON.parse(resA.body);
    expect(bodyA.items).toHaveLength(1);
    expect(bodyA.items[0].id).toBe("doc_test1");

    const resB = await getDocumentsHandler(eventB);
    expect(resB.statusCode).toBe(200);
    const bodyB = JSON.parse(resB.body);
    expect(bodyB.items).toHaveLength(0);
  });
});
