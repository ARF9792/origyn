# Origyn

Evidence-validity layer for AI-assisted scientific research.

## Repository structure

```
origyn/
├── backend/      # AWS Lambda / TypeScript
├── frontend/     # Next.js / React (Person 2)
├── infra/        # Deployment configuration
├── docs/
├── .env.example
├── .gitignore
└── README.md
```

## Branches

| Branch | Owner |
|---|---|
| `feat/backend-core` | Person 1 — backend, AWS, Crossref |
| `feat/frontend-core` | Person 2 — frontend, UX |

## Backend quick start

```bash
cd backend
npm install
npm run build     # type-check
npm test          # run unit tests
```

### Environment variables

Copy `.env.example` to `.env` and fill in values. **Never commit `.env`.**

See `.env.example` for required variable names.

## Architecture

- **AWS Lambda** — serverless compute
- **API Gateway** — HTTP routing
- **S3** — PDF storage
- **DynamoDB** — document and claim records
- **Amazon Bedrock** — LLM reasoning layer
- **Crossref REST API** — retraction metadata

## Status wording

`NONE_FOUND` means **no known retraction found**.  
It does **not** mean the science is valid.

## Day 1 goal

> A real research PDF can be uploaded to the AWS backend, identified, checked against Crossref, persisted, and returned to the frontend with a trustworthy retraction-status representation.
