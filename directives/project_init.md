# Directive: Project Initialization (Next.js 16)

## Goal
Initialize a production-ready Next.js 16 application with Tailwind CSS and Shadcn/ui, configured for the AI-Mate Dashboard.

## Inputs
- **Stack**: Next.js 16 (App Router), TypeScript, Tailwind CSS, Lucide React (Icons).
- **Styling**: Shadcn/ui (Default theme, Slate color).

## Steps

1.  **Create Next.js App**
    Run the following command in the **root** folder (ensure you are in `c:\Users\Aritz\Proyectos IA-DRIVEN\Dashboard`):
    ```bash
    npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-git
    ```
    *Note: We use `.` to install in current dir. Use `--no-git` because the workspace is likely already a repo.*

2.  **Initialize Shadcn/ui**
    ```bash
    npx shadcn@latest init
    ```
    - Style: `New York`
    - Base Color: `Slate`
    - CSS Variables: `yes`

3.  **Install Dependencies**
    ```bash
    npm install lucide-react clsx tailwind-merge recharts date-fns @supabase/supabase-js
    ```

4.  **Clean Up**
    - Remove default `page.tsx` content.
    - Remove default `globals.css` styles (keep Tailwind directives).

## Outputs
- A working Next.js 16 application structure.
- `package.json` with dependencies.
