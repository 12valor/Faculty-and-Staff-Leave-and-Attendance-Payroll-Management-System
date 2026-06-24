# Faculty & Staff Leave & Attendance Payroll Management System

A local-first, single-Admin system for faculty and staff records, schedules, attendance encoding, Civil Service Commission (CSC) computations, and payroll deductions.

---

## Quick Start Guide (Windows)

The system includes an automatic launcher (`run.bat`) that handles the entire setup (installing dependencies, configuring environment variables, setting up the SQLite database, applying schema migrations, seeding the initial admin account, and opening the browser).

### 1. Prerequisites
To run this application, you only need to download and install **Node.js**:
1. **Download Node.js**:
   - Go to the official website: [https://nodejs.org/](https://nodejs.org/)
   - Download the **LTS (Long Term Support)** version for Windows (e.g., v20 or v22).
2. **Install Node.js**:
   - Run the downloaded installer (`.msi` file).
   - Click "Next" through the prompts, keeping the default settings.
   - **Important**: Make sure the option to **"Add to PATH"** is checked (it is checked by default).
3. **Verify Installation** (Optional):
   - Open Command Prompt and type:
     ```cmd
     node -v
     npm -v
     ```
   - If both return a version number, Node.js is ready!

*Note: Since the system uses a built-in SQLite database, you do **NOT** need to download or set up any database servers (like MySQL or PostgreSQL).*

### 2. How to Run the System
1. **Extract the Files**:
   - Extract the project folder from your ZIP file to any directory on your computer (e.g., your Desktop or Downloads folder).
2. **Launch the Application**:
   - Open the extracted folder and double-click the **`run.bat`** file.
   - The launcher will automatically:
     - Detect Node.js.
     - Install all required software packages/dependencies (this happens only on the first run).
     - Generate a local configuration (`.env`) with a secure unique session secret.
     - Initialize the SQLite database and run default schema migrations and seed data.
     - Automatically open the system in your default browser at **`http://localhost:3000`**.

### 3. How to Stop the System
- Press any key in the main launcher command window to safely stop the server and free up port 3000.
- Alternatively, you can simply close the command prompt windows.

---

## Developer Setup (Manual)

If you are on macOS/Linux or prefer setting up the system manually for development:

1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Configure Environment**:
   - Copy `.env.example` to `.env`:
     ```bash
     cp .env.example .env
     ```
   - Open `.env` and replace `SESSION_SECRET` with a secure random string of at least 32 characters.
3. **Setup Database**:
   ```bash
   npx prisma migrate deploy
   npx prisma db seed
   ```
4. **Start Development Server**:
   ```bash
   npm run dev
   ```
5. **Open Browser**:
   - Navigate to [http://localhost:3000](http://localhost:3000)

---

## Default Credentials

Once the system starts, you can log in using the default administrator credentials:
- **Username**: `admin`
- **Password**: `admin123`

*(Note: You can change the admin username and password from the system settings after logging in.)*

## Included Modules

- **Authentication & Security**: Signed 8-hour Admin session and protected workspace routes.
- **Organization & Rules**: Departments, positions, payroll rules, and view-only CSC tables.
- **Employee Directory**: Employee CRUD with archive/reactivate behavior.
- **Schedules**: Staff and faculty schedule management with eligibility and overlap checks.
- **Attendance Encoding**: Manual, bulk, and CSV attendance encoding.
- **CSC Computations**: CSC day-value conversion and salary deduction calculations.
- **Audit Trails**: Logs for authentication events and all system mutations.

The original root-level CSC CSV files remain unchanged. Runtime seed sources are copied under `data/`.