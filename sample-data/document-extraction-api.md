# Acme Document Extraction API

The Acme Document Extraction API lets applications upload business documents and extract structured fields from them.

## Authentication

All requests use Bearer token authentication.

```
Authorization: Bearer <ACME_API_KEY>
```

## POST /documents/extract

Uploads a document for extraction. Supported file types include PDF, PNG, and JPG.

Request uses `multipart/form-data` with a `file` field and optional `document_type`.

Example response:

```json
{
  "document_id": "doc_123",
  "status": "processing",
  "created_at": "2026-05-26T12:00:00Z"
}
```

## GET /documents/{document_id}

Returns extraction status and extracted fields.

Example response:

```json
{
  "document_id": "doc_123",
  "status": "completed",
  "fields": [
    { "name": "claim_number", "value": "CLM-2026-001", "confidence": 0.98 },
    { "name": "policyholder_name", "value": "Jane Rivera", "confidence": 0.94 },
    { "name": "service_date", "value": "2026-05-19", "confidence": 0.91 },
    { "name": "amount", "value": "1420.55", "confidence": 0.88 }
  ]
}
```

## POST /documents/{document_id}/approve

Approves a reviewed extraction result. Request body contains reviewed field values.

```json
{
  "reviewer": "claims-operator-1",
  "fields": {
    "claim_number": "CLM-2026-001",
    "policyholder_name": "Jane Rivera",
    "amount": "1420.55"
  }
}
```

## POST /exports

Exports approved structured data to a downstream system as JSON. The API does not directly integrate with Guidewire, Salesforce, or Epic; customers usually connect exports to their own integration layer.

## Rate limits

The sandbox allows 60 extraction requests per minute. Production limits vary by contract.

## Marketing note

Customers often use Acme to reduce manual review effort, but exact time savings depend on document quality, workflow design, and human review policies.
