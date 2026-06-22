# Faculty and Staff Management System

A local-first, single-Admin system for faculty and staff records, schedules, attendance encoding, CSC computations, and payroll deductions.

## Local setup

```powershell
npm install
Copy-Item .env.example .env
# Replace SESSION_SECRET in .env with at least 32 random characters.
npx prisma migrate dev --name phase_1_2_core
npx prisma db seed
npm run dev
```

Open http://localhost:3000.

Default Admin credentials:

- Username: `admin`
- Password: `admin123`

## Included modules

- Signed 8-hour Admin session and protected workspace routes
- Departments, positions, payroll rules, and view-only CSC tables
- Employee CRUD with archive/reactivate behavior
- Staff and faculty schedule management with eligibility and overlap checks
- Manual, bulk, and CSV attendance encoding
- CSC day-value and salary deduction calculations
- Audit logs for authentication and all implemented mutations

The original root-level CSC CSV files remain unchanged. Runtime seed sources are copied under `data/`.