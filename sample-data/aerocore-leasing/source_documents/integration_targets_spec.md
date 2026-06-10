# AeroCore System Integration Target Specifications

AeroCore must sync its local logistics, telemetry, and CRM data with two downstream core systems: **CargoWise API** (for freight/logistics clients) and **Salesforce CRM API** (for accounts management). Below are the technical API specifications detailing the payload formats and integration schemas.

---

## 🚚 1. CargoWise Freight Ingestion API (REST Spec)
This API is used to synchronize flight mappings, coordinates, and sensor cargo details with client logistics ledgers.

*   **Endpoint:** `POST https://api.cargowise.com/v1/shipments/sensor-sync`
*   **Authentication:** Bearer token (`Authorization: Bearer <CARGOWISE_API_TOKEN>`)
*   **Request Schema (JSON):**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "CargoWiseSensorSync",
  "type": "object",
  "properties": {
    "carrier_code": { "type": "string", "const": "AEROCORE" },
    "consignment_id": { "type": "string", "pattern": "^BK-[0-9]{5}$" },
    "origin_location": {
      "type": "object",
      "properties": {
        "latitude": { "type": "number", "minimum": -90, "maximum": 90 },
        "longitude": { "type": "number", "minimum": -180, "maximum": 180 },
        "address": { "type": "string" }
      },
      "required": ["latitude", "longitude"]
    },
    "sensor_payload": {
      "type": "object",
      "properties": {
        "sensor_id": { "type": "string" },
        "telemetry_link": { "type": "string", "format": "uri" }
      },
      "required": ["sensor_id", "telemetry_link"]
    }
  },
  "required": ["carrier_code", "consignment_id", "origin_location", "sensor_payload"]
}
```

*   **Note for AI claim validation:** The CargoWise API does **not** allow direct third-party drone dispatch automation triggers. Third-party providers must use the CargoWise Webhook Event Bus and manually approve dispatches in their local UI portal before posting the sync payload.

---

## 👥 2. Salesforce CRM Custom Object Ingestion API
This API updates client account profiles with contract lease values and active billing logs.

*   **Endpoint:** `PATCH https://na85.salesforce.com/services/data/v58.0/sobjects/Lease_Agreement__c/Lease_Ref_ID__c/{lease_id}`
*   **Authentication:** OAuth 2.0 Access Token (`Authorization: Bearer <SF_SESSION_ID>`)
*   **Request Schema (JSON):**
```json
{
  "Billing_Account_Number__c": "CL-001928",
  "Lease_Start_Date__c": "2026-05-01",
  "Lease_End_Date__c": "2027-04-30",
  "Base_Subscription_Rate__c": 3500.00,
  "Active_Hardware_Serial__c": "SM4-900821-X",
  "Monthly_Flight_Allowance__c": 40,
  "Overage_Hourly_Rate__c": 85.00,
  "Status__c": "Active"
}
```

*   **Note for AI claim validation:** Direct write-backs to standard Salesforce `Account` structures require a custom middleware Salesforce Apex trigger, because standard objects do not map usage-based variables without a package installation (like Salesforce Billing).
