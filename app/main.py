
import os
import csv
import io
import secrets
from contextlib import asynccontextmanager
from datetime import date
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query, Depends, Header
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from app.database import get_connection, init_db, verify_password
from app.ml_model import train_model, predict_risk
from app.schemas import (
    LoginRequest,
    StudentCreate,
    AttendanceCreate,
    ResultCreate,
    AssignmentCreate,
    SubmissionCreate,
)

ROOT = Path(__file__).resolve().parent.parent


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    train_model()
    yield


app = FastAPI(
    title="EduSuccess AI API",
    description="Student success platform using local ML and SQLite.",
    version="2.0.0",
    lifespan=lifespan,
)

app.mount("/static", StaticFiles(directory=ROOT / "static"), name="static")


def row_to_dict(row):
    return dict(row)


def get_current_user(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=401,
            detail="Please sign in to continue",
        )

    token = authorization.split(" ", 1)[1]

    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT
                u.id,
                u.username,
                u.role,
                u.student_id,
                s.name,
                s.student_code,
                s.department,
                s.year
            FROM sessions x
            JOIN users u ON u.id = x.user_id
            LEFT JOIN students s ON s.id = u.student_id
            WHERE x.token = ?
            """,
            (token,),
        ).fetchone()

    if not row:
        raise HTTPException(
            status_code=401,
            detail="Your session has expired. Please sign in again.",
        )

    return row_to_dict(row)


def require_teacher(user=Depends(get_current_user)):
    if user["role"] != "teacher":
        raise HTTPException(
            status_code=403,
            detail="Teacher access required",
        )
    return user


def require_student(user=Depends(get_current_user)):
    if user["role"] != "student":
        raise HTTPException(
            status_code=403,
            detail="Student access required",
        )
    return user


def get_student_or_404(student_id: int):
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM students WHERE id = ?",
            (student_id,),
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Student not found")

    return row_to_dict(row)


def can_access_student(student_id: int, user):
    if (
        user["role"] == "student"
        and user["student_id"] != student_id
    ):
        raise HTTPException(
            status_code=403,
            detail="You can only view your own student record",
        )


@app.get("/")
def home():
    return FileResponse(ROOT / "static" / "index.html")


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "app": "EduSuccess AI",
        "database": "SQLite",
    }


@app.post("/api/auth/login")
def login(payload: LoginRequest):
    username = payload.username.strip()

    if payload.role == "student":
        username = username.upper()
    else:
        username = username.lower()

    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE username = ? AND role = ?",
            (username, payload.role),
        ).fetchone()

        if not row or not verify_password(
            payload.password,
            row["password_hash"],
        ):
            raise HTTPException(
                status_code=401,
                detail="Incorrect username or password for this login type",
            )

        token = secrets.token_urlsafe(36)

        conn.execute(
            "INSERT INTO sessions(token, user_id) VALUES(?, ?)",
            (token, row["id"]),
        )

        user = conn.execute(
            """
            SELECT
                u.id,
                u.username,
                u.role,
                u.student_id,
                s.name,
                s.student_code,
                s.department,
                s.year
            FROM users u
            LEFT JOIN students s ON s.id = u.student_id
            WHERE u.id = ?
            """,
            (row["id"],),
        ).fetchone()

    return {"token": token, "user": row_to_dict(user)}


@app.post("/api/auth/logout")
def logout(
    user=Depends(get_current_user),
    authorization: str | None = Header(default=None),
):
    token = authorization.split(" ", 1)[1]

    with get_connection() as conn:
        conn.execute(
            "DELETE FROM sessions WHERE token = ?",
            (token,),
        )

    return {"message": "Signed out"}


@app.get("/api/auth/me")
def me(user=Depends(get_current_user)):
    return user


@app.get("/api/dashboard")
def dashboard(user=Depends(get_current_user)):
    with get_connection() as conn:
        if user["role"] == "student":
            rows = conn.execute(
                "SELECT * FROM students WHERE id = ?",
                (user["student_id"],),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM students ORDER BY id"
            ).fetchall()

    students = [row_to_dict(row) for row in rows]
    total = len(students)

    avg_marks = (
        round(sum(s["marks"] for s in students) / total, 1)
        if total else 0
    )
    avg_attendance = (
        round(sum(s["attendance"] for s in students) / total, 1)
        if total else 0
    )

    risk_counts = {"High": 0, "Moderate": 0, "Low": 0}
    departments = {}

    for student in students:
        risk = predict_risk(
            student["attendance"],
            student["marks"],
            student["assignments"],
        )["risk_category"]

        risk_counts[risk] += 1
        departments.setdefault(
            student["department"], []
        ).append(student["marks"])

    return {
        "role": user["role"],
        "total_students": total,
        "average_marks": avg_marks,
        "average_attendance": avg_attendance,
        "support_flags": risk_counts["High"] + risk_counts["Moderate"],
        "risk_counts": risk_counts,
        "departments": [
            {
                "department": department,
                "average_marks": round(sum(marks) / len(marks), 1),
                "students": len(marks),
            }
            for department, marks in sorted(departments.items())
        ],
        "recent_students": students[-5:][::-1],
        "student": (
            students[0]
            if user["role"] == "student" and students
            else None
        ),
    }


@app.get("/api/students")
def list_students(
    search: str = Query(default="", max_length=100),
    user=Depends(require_teacher),
):
    term = f"%{search.strip()}%"

    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT *
            FROM students
            WHERE name LIKE ?
               OR student_code LIKE ?
               OR department LIKE ?
            ORDER BY id DESC
            """,
            (term, term, term),
        ).fetchall()

    return [row_to_dict(row) for row in rows]


@app.post("/api/students", status_code=201)
def create_student(
    student: StudentCreate,
    user=Depends(require_teacher),
):
    try:
        with get_connection() as conn:
            cursor = conn.execute(
                """
                INSERT INTO students
                    (student_code, name, department, year,
                     attendance, marks, assignments)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    student.student_code.strip().upper(),
                    student.name.strip(),
                    student.department.strip(),
                    student.year,
                    student.attendance,
                    student.marks,
                    student.assignments,
                ),
            )

            student_id = cursor.lastrowid

            from app.database import hash_password

            conn.execute(
                """
                INSERT INTO users(username, password_hash, role, student_id)
                VALUES (?, ?, ?, ?)
                """,
                (
                    student.student_code.strip().upper(),
                    hash_password("Student@123"),
                    "student",
                    student_id,
                ),
            )

    except Exception as exc:
        if "UNIQUE constraint failed" in str(exc):
            raise HTTPException(
                status_code=409,
                detail="Student ID already exists",
            )
        raise

    return get_student_or_404(student_id)


@app.put("/api/students/{student_id}")
def update_student(
    student_id: int,
    student: StudentCreate,
    user=Depends(require_teacher),
):
    get_student_or_404(student_id)

    try:
        with get_connection() as conn:
            conn.execute(
                """
                UPDATE students
                SET student_code = ?, name = ?, department = ?, year = ?,
                    attendance = ?, marks = ?, assignments = ?
                WHERE id = ?
                """,
                (
                    student.student_code.strip().upper(),
                    student.name.strip(),
                    student.department.strip(),
                    student.year,
                    student.attendance,
                    student.marks,
                    student.assignments,
                    student_id,
                ),
            )

    except Exception as exc:
        if "UNIQUE constraint failed" in str(exc):
            raise HTTPException(
                status_code=409,
                detail="Student ID already exists",
            )
        raise

    return get_student_or_404(student_id)


@app.get("/api/students/{student_id}/prediction")
def student_prediction(
    student_id: int,
    user=Depends(get_current_user),
):
    can_access_student(student_id, user)
    student = get_student_or_404(student_id)

    return {
        "student": student,
        **predict_risk(
            student["attendance"],
            student["marks"],
            student["assignments"],
        ),
    }


@app.get("/api/attendance")
def list_attendance(user=Depends(get_current_user)):
    with get_connection() as conn:
        if user["role"] == "student":
            rows = conn.execute(
                """
                SELECT a.*, s.name, s.student_code
                FROM attendance_records a
                JOIN students s ON s.id = a.student_id
                WHERE a.student_id = ?
                ORDER BY attendance_date DESC, id DESC
                """,
                (user["student_id"],),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT a.*, s.name, s.student_code
                FROM attendance_records a
                JOIN students s ON s.id = a.student_id
                ORDER BY attendance_date DESC, id DESC
                LIMIT 200
                """
            ).fetchall()

    return [row_to_dict(row) for row in rows]


@app.post("/api/attendance", status_code=201)
def mark_attendance(
    item: AttendanceCreate,
    user=Depends(require_teacher),
):
    get_student_or_404(item.student_id)

    try:
        with get_connection() as conn:
            conn.execute(
                """
                INSERT INTO attendance_records
                    (student_id, subject, attendance_date, status, marked_by)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(student_id, subject, attendance_date)
                DO UPDATE SET
                    status = excluded.status,
                    marked_by = excluded.marked_by
                """,
                (
                    item.student_id,
                    item.subject.strip(),
                    item.attendance_date,
                    item.status,
                    user["id"],
                ),
            )

            records = conn.execute(
                "SELECT status FROM attendance_records WHERE student_id = ?",
                (item.student_id,),
            ).fetchall()

            percentage = (
                round(
                    sum(
                        1 for record in records
                        if record["status"] in ("present", "late")
                    ) / len(records) * 100,
                    1,
                )
                if records else 0
            )

            conn.execute(
                "UPDATE students SET attendance = ? WHERE id = ?",
                (percentage, item.student_id),
            )

    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return {
        "message": "Attendance saved",
        "attendance": percentage,
    }


@app.get("/api/results")
def list_results(user=Depends(get_current_user)):
    with get_connection() as conn:
        if user["role"] == "student":
            rows = conn.execute(
                """
                SELECT r.*, s.name, s.student_code
                FROM results r
                JOIN students s ON s.id = r.student_id
                WHERE r.student_id = ?
                ORDER BY published_at DESC
                """,
                (user["student_id"],),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT r.*, s.name, s.student_code
                FROM results r
                JOIN students s ON s.id = r.student_id
                ORDER BY published_at DESC
                LIMIT 300
                """
            ).fetchall()

    return [row_to_dict(row) for row in rows]


@app.post("/api/results", status_code=201)
def create_result(
    item: ResultCreate,
    user=Depends(require_teacher),
):
    if item.marks_obtained > item.max_marks:
        raise HTTPException(
            status_code=400,
            detail="Marks obtained cannot exceed maximum marks",
        )

    get_student_or_404(item.student_id)

    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO results
                (student_id, subject, exam_name, marks_obtained, max_marks)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                item.student_id,
                item.subject.strip(),
                item.exam_name.strip(),
                item.marks_obtained,
                item.max_marks,
            ),
        )

        rows = conn.execute(
            """
            SELECT marks_obtained, max_marks
            FROM results
            WHERE student_id = ?
            """,
            (item.student_id,),
        ).fetchall()

        average = (
            round(
                sum(
                    (row["marks_obtained"] / row["max_marks"]) * 100
                    for row in rows
                ) / len(rows),
                1,
            )
            if rows else 0
        )

        conn.execute(
            "UPDATE students SET marks = ? WHERE id = ?",
            (average, item.student_id),
        )

    return {
        "message": "Result published",
        "average_marks": average,
    }


@app.get("/api/assignments")
def list_assignments(user=Depends(get_current_user)):
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT
                a.*,
                u.username AS teacher_username,
                sub.submission_text,
                sub.submitted_at
            FROM assignments a
            JOIN users u ON u.id = a.created_by
            LEFT JOIN submissions sub
                ON sub.assignment_id = a.id
                AND sub.student_id = ?
            ORDER BY a.due_date ASC
            """,
            (user["student_id"] or -1,),
        ).fetchall()

    return [row_to_dict(row) for row in rows]


@app.post("/api/assignments", status_code=201)
def create_assignment(
    item: AssignmentCreate,
    user=Depends(require_teacher),
):
    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO assignments
                (title, subject, description, due_date, created_by)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                item.title.strip(),
                item.subject.strip(),
                item.description.strip(),
                item.due_date,
                user["id"],
            ),
        )

        row = conn.execute(
            "SELECT * FROM assignments WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()

    return row_to_dict(row)


@app.post("/api/assignments/{assignment_id}/submit")
def submit_assignment(
    assignment_id: int,
    item: SubmissionCreate,
    user=Depends(require_student),
):
    with get_connection() as conn:
        assignment = conn.execute(
            "SELECT id FROM assignments WHERE id = ?",
            (assignment_id,),
        ).fetchone()

        if not assignment:
            raise HTTPException(
                status_code=404,
                detail="Assignment not found",
            )

        conn.execute(
            """
            INSERT INTO submissions
                (assignment_id, student_id, submission_text)
            VALUES (?, ?, ?)
            ON CONFLICT(assignment_id, student_id)
            DO UPDATE SET
                submission_text = excluded.submission_text,
                submitted_at = CURRENT_TIMESTAMP
            """,
            (
                assignment_id,
                user["student_id"],
                item.submission_text.strip(),
            ),
        )

    return {"message": "Assignment submitted"}


@app.get("/api/export.csv")
def export_csv(user=Depends(require_teacher)):
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT student_code, name, department, year,
                   attendance, marks, assignments
            FROM students
            ORDER BY id
            """
        ).fetchall()

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(
        [
            "student_code",
            "name",
            "department",
            "year",
            "attendance",
            "marks",
            "assignments",
        ]
    )

    writer.writerows([tuple(row) for row in rows])
    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=edusuccess_students.csv"
        },
    )


@app.post("/api/demo/reset")
def reset_demo(user=Depends(require_teacher)):
    if os.getenv("APP_ENV", "development").lower() == "production":
        raise HTTPException(status_code=404, detail="Not found")

    with get_connection() as conn:
        conn.execute("DELETE FROM attendance_records")
        conn.execute("DELETE FROM results")
        conn.execute("DELETE FROM submissions")
        conn.execute("DELETE FROM assignments")

    init_db()
    return {"message": "Demo data restored"}
