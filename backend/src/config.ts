/**
 * config.ts — single source of truth for all environment variables.
 * Never hard-code credentials or secrets here.
 * All values come from process.env, which in AWS Lambda is set via
 * Lambda environment variables (not committed to Git).
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const config = {
  aws: {
    region: optional("AWS_REGION", "us-east-1"),
  },
  s3: {
    bucketName: optional("S3_BUCKET_NAME", ""),
  },
  dynamodb: {
    documentsTable: optional("DYNAMODB_DOCUMENTS_TABLE", ""),
    claimsTable: optional("DYNAMODB_CLAIMS_TABLE", ""),
  },
  crossref: {
    /**
     * Crossref polite pool: include a contact email in the User-Agent.
     * https://api.crossref.org/swagger-ui/index.html#/Polite-pool
     */
    contactEmail: optional("CROSSREF_CONTACT_EMAIL", ""),
    baseUrl: optional("CROSSREF_BASE_URL", "https://api.crossref.org"),
  },
  bedrock: {
    modelId: optional("BEDROCK_MODEL_ID", "anthropic.claude-3-haiku-20240307-v1:0"),
  },
};
