# Faculty & Staff Leave & Attendance Payroll Management System Setup Guide

This guide describes how to run the system on your machine.

---

## 🛠️ Prerequisites

To run this application, you only need to download and install **Node.js**:

1. **Download Node.js**:
   - Go to the official website: **[https://nodejs.org/](https://nodejs.org/)**
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

*Note: Since the system uses a built-in SQLite database (`dev.db`), you do **NOT** need to download or set up any database servers (like MySQL or PostgreSQL).*

---

## 🚀 How to Run the System

1. **Extract the Files**:
   - Extract the project folder from your ZIP file to any directory on your computer (e.g., your Desktop or Downloads folder).
2. **Launch the Application**:
   - Open the extracted folder and double-click the **`run.bat`** file.
   - The launcher will automatically:
     - Detect Node.js.
     - Install all required software packages/dependencies (this happens only on the first run).
     - Verify database and server connections.
     - Automatically open the system in your default browser at **`http://localhost:3000`**.

---

## 🛑 How to Stop the System

- Press any key in the main launcher window to safely stop the server and free up the connection port.
- Alternatively, you can close the command prompt windows.
