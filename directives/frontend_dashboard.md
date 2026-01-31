# Directive: Frontend Dashboard

## Goal
Build the visual interface for the ROI Dashboard.

## Inputs
- **Design Reference**: https://ai-mate.es/ (Modern, minimalist, dark/light mode capable).
- **Libraries**: Recharts (Charts), Lucide (Icons), Shadcn/ui (Components).

## Components

1.  **Layout (`src/app/layout.tsx`)**
    - Font: Inter or similar Google Font.
    - Navbar: Logo (AI-Mate) + Client Name.

2.  **Dashboard Page (`src/app/dashboard/page.tsx`)**
    - **Hero Section**:
        - `StatCard`: Big number "Total Saved". Animated counter.
        - Sub-stats: "Total Hours", "Total Executions", "Success Rate".
    - **Charts Section**:
        - `TrendChart`: Bar chart of "Savings per Day/Week".
    - **Data Section**:
        - `TransparencyTable`: List of latest 10 executions.
    - **Refresh**: Auto-refresh every 30s or manual button.

3.  **Data Fetching**
    - Use Server Actions or API Route to fetch aggregated data from Supabase.
    - Query:
        - Join `executions` with `automation_metadata`.
        - Calculate sums based on formulas defined in `implementation_plan.md`.

## Outputs
- Responsive, beautiful dashboard page.
