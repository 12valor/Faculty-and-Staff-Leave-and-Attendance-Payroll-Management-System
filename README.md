# Faculty and Staff Management System

A local-first web application scaffold for faculty and staff leave, attendance,
schedules, payroll deductions, overtime, overload, and institutional reports.

## Local setup

```powershell
npm install
Copy-Item .env.example .env
npm run prisma:generate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Current scope

- Next.js App Router, TypeScript, Tailwind CSS, and shadcn/ui
- Prisma ORM configured for a local SQLite database
- Validated login interface without authentication sessions
- Responsive application shell and prepared module routes
- Dashboard presentation using Recharts and TanStack Table
- ExcelJS and browser print utilities prepared for future reports

The root-level CSC CSV files are preserved as future leave-credit references.
