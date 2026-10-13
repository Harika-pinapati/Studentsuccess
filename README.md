# EduSuccess AI — Student Success Platform

A redesigned student success dashboard with separate **Student** and **Teacher** sign-in portals. Built with FastAPI, SQLite, HTML, CSS, JavaScript and a local scikit-learn demo model. No paid APIs are required.

## Features
- Separate student and teacher login screens and role-based API access
- Teacher overview dashboard, student directory, student creation and CSV export
- Student personal dashboard and private access to their own academic information
- Attendance tracking (teachers mark attendance; students view their own records)
- Results and assessment management (teachers publish results; students view their own)
- Assignments (teachers publish assignments; students submit and update work)
- Explainable AI risk insights for teacher review
- SQLite storage and synthetic demo records seeded automatically
- Responsive modern UI for desktop and mobile

> **Prototype note:** AI risk predictions use synthetic training data and are not validated for real student outcomes. They are prompts for supportive human review, not diagnoses or final decisions. Demo credentials are intentionally simple and must be changed before any real deployment. Do not use real student information in this demo without appropriate security, privacy and institutional review.

## Requirements
- Python 3.10 or later
- Internet connection for first-time package installation

## Run on Windows
1. Extract the ZIP and open the `edusuccess_ai` folder in VS Code.
2. Open **Terminal → New Terminal**.
3. Run:

```powershell
py -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn app.main:app --reload
```

If PowerShell blocks activation, run:

```powershell
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Open `http://127.0.0.1:8000` in your browser. API documentation is at `http://127.0.0.1:8000/docs`.

## Run on macOS/Linux

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Demo logins

| Portal | Username | Password |
|---|---|---|
| Student | `ES001` | `Student@123` |
| Teacher | `teacher@edusuccess.local` | `Teacher@123` |

The Student and Teacher portals are separate. Student accounts can only access their own profile, attendance, results, assignments and risk summary. Teacher accounts can manage student records, mark attendance, publish results, create assignments and review AI insights.

New students created by a teacher get a username equal to their Student ID and the initial password `Student@123`. Change these passwords before real-world use.

## SQLite database

`edusuccess.db` is created in this project folder on first run. Existing demo data is preserved. Tables for users, sessions, students, attendance, results, assignments and submissions are created automatically.

## Project structure

```text
edusuccess_ai/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── database.py
│   ├── ml_model.py
│   └── schemas.py
├── static/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── requirements.txt
└── README.md
```
