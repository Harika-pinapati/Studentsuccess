import hashlib
import os
import secrets
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "edusuccess.db"


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def hash_password(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 180_000).hex()
    return f"{salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, expected = stored.split("$", 1)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 180_000).hex()
        return secrets.compare_digest(actual, expected)
    except (ValueError, AttributeError):
        return False


def init_db():
    with get_connection() as conn:
        conn.execute("""CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_code TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            department TEXT NOT NULL,
            year INTEGER NOT NULL,
            attendance REAL NOT NULL DEFAULT 80,
            marks REAL NOT NULL DEFAULT 70,
            assignments REAL NOT NULL DEFAULT 80,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )""")
        demo = [
            ("ES001", "Aarav Kumar", "CSE", 3, 96, 88, 100),
            ("ES002", "Diya Sharma", "CSE", 2, 91, 81, 90),
            ("ES003", "Ishaan Reddy", "ECE", 3, 62, 48, 55),
            ("ES004", "Meera Patel", "IT", 2, 78, 69, 80),
            ("ES005", "Arjun Rao", "CSE", 4, 54, 42, 45),
            ("ES006", "Ananya Das", "AIML", 3, 88, 92, 95),
            ("ES007", "Kabir Singh", "ECE", 1, 70, 58, 60),
            ("ES008", "Sana Ali", "IT", 4, 48, 35, 40),
            ("ES009", "Rohan Verma", "AIML", 2, 83, 76, 85),
            ("ES010", "Kavya Nair", "CSE", 1, 67, 52, 50),
        ]
        for record in demo:
            conn.execute("""INSERT OR IGNORE INTO students
                (student_code,name,department,year,attendance,marks,assignments) VALUES (?,?,?,?,?,?,?)""", record)
        conn.execute("""CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('student','teacher')),
            student_id INTEGER UNIQUE,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
        )""")
        conn.execute("""CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )""")
        conn.execute("""CREATE TABLE IF NOT EXISTS attendance_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL,
            subject TEXT NOT NULL,
            attendance_date TEXT NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('present','absent','late')),
            marked_by INTEGER NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(student_id, subject, attendance_date),
            FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
            FOREIGN KEY(marked_by) REFERENCES users(id)
        )""")
        conn.execute("""CREATE TABLE IF NOT EXISTS results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL,
            subject TEXT NOT NULL,
            exam_name TEXT NOT NULL,
            marks_obtained REAL NOT NULL,
            max_marks REAL NOT NULL,
            published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
        )""")
        conn.execute("""CREATE TABLE IF NOT EXISTS assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            subject TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            due_date TEXT NOT NULL,
            created_by INTEGER NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(created_by) REFERENCES users(id)
        )""")
        conn.execute("""CREATE TABLE IF NOT EXISTS submissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            assignment_id INTEGER NOT NULL,
            student_id INTEGER NOT NULL,
            submission_text TEXT NOT NULL DEFAULT '',
            submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(assignment_id, student_id),
            FOREIGN KEY(assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
            FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
        )""")
        # Seed role-specific demo logins. Each student signs in with their student ID.
        conn.execute("INSERT OR IGNORE INTO users(username,password_hash,role,student_id) VALUES(?,?,?,NULL)",
                     ("teacher@edusuccess.local", hash_password("Teacher@123"), "teacher"))
        for student in conn.execute("SELECT id,student_code FROM students").fetchall():
            conn.execute("INSERT OR IGNORE INTO users(username,password_hash,role,student_id) VALUES(?,?,?,?)",
                         (student["student_code"], hash_password("Student@123"), "student", student["id"]))
        # Seed sample attendance, results, and assignments only when each table is empty.
        if conn.execute("SELECT COUNT(*) FROM attendance_records").fetchone()[0] == 0:
            teacher_id = conn.execute("SELECT id FROM users WHERE role='teacher' LIMIT 1").fetchone()[0]
            today = __import__('datetime').date.today().isoformat()
            for student in conn.execute("SELECT id,attendance FROM students").fetchall():
                status = "present" if student["attendance"] >= 70 else "absent"
                conn.execute("INSERT OR IGNORE INTO attendance_records(student_id,subject,attendance_date,status,marked_by) VALUES(?,?,?,?,?)",
                             (student["id"], "Programming Fundamentals", today, status, teacher_id))
        if conn.execute("SELECT COUNT(*) FROM results").fetchone()[0] == 0:
            for student in conn.execute("SELECT id,marks FROM students").fetchall():
                conn.execute("INSERT INTO results(student_id,subject,exam_name,marks_obtained,max_marks) VALUES(?,?,?,?,?)",
                             (student["id"], "Computer Science", "Internal Assessment 1", student["marks"], 100))
        if conn.execute("SELECT COUNT(*) FROM assignments").fetchone()[0] == 0:
            teacher_id = conn.execute("SELECT id FROM users WHERE role='teacher' LIMIT 1").fetchone()[0]
            conn.execute("INSERT INTO assignments(title,subject,description,due_date,created_by) VALUES(?,?,?,?,?)",
                         ("Build a mini project", "Programming Fundamentals", "Submit a short project overview and source-code summary.", "2099-12-31", teacher_id))
