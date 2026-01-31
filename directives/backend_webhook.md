# Directive: Backend Webhook Implementation

## Goal
Create a secure POST endpoint to receive automation execution data.

## Inputs
- **Endpoint**: `/api/execution-webhook`
- **Method**: POST
- **Payload**:
    ```json
    {
      "api_key": "sk_...",
      "automation_name": "Invoice Processing",
      "status": "success" | "error",
      "timestamp": "ISO-8601 string" (optional, default now)
    }
    ```
    *Note: We use `automation_name` + `api_key` to lookup `automation_id` dynamically, or create a placeholder if it doesn't exist?*
    *Decision: For MVP, look up `automation_metadata` by name. If not found, create it with defaults (0 duration, 0 cost) to start tracking, or error out. Let's error if not found to force configuration.*

## Steps

1.  **Create API Route**
    File: `src/app/api/execution-webhook/route.ts`

2.  **Implement Logic**
    - **Auth**: Validate `api_key` against `clients` table. Get `client_id`.
    - **Lookup**: Find `automation_metadata` where `client_id` matches and `name` == payload.automation_name.
    - **Error Handling**: 
        - If Client not found -> 401 Unauthorized.
        - If Automation not found -> 404 Not Found (Message: "Automation not configured in dashboard").
    - **Insert**: Insert into `executions` table.

3.  **Response**
    - Success: 200 OK `{"success": true, "id": "..."}`
    - Error: 4xx/5xx `{"success": false, "error": "..."}`

## Outputs
- Functional API Route.
