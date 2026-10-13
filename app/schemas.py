from pydantic import BaseModel, Field, ConfigDict

class LoginRequest(BaseModel):
    username: str = Field(min_length=2, max_length=190)
    password: str = Field(min_length=1, max_length=200)
    role: str = Field(pattern="^(student|teacher)$")

class StudentCreate(BaseModel):
    student_code: str = Field(min_length=2, max_length=30)
    name: str = Field(min_length=2, max_length=100)
    department: str = Field(default="CSE", min_length=2, max_length=30)
    year: int = Field(ge=1, le=5)
    attendance: float = Field(ge=0, le=100)
    marks: float = Field(ge=0, le=100)
    assignments: float = Field(ge=0, le=100)
    model_config = ConfigDict(extra="forbid")

class AttendanceCreate(BaseModel):
    student_id: int
    subject: str = Field(min_length=2, max_length=100)
    attendance_date: str = Field(min_length=10, max_length=10)
    status: str = Field(pattern="^(present|absent|late)$")

class ResultCreate(BaseModel):
    student_id: int
    subject: str = Field(min_length=2, max_length=100)
    exam_name: str = Field(min_length=2, max_length=100)
    marks_obtained: float = Field(ge=0)
    max_marks: float = Field(gt=0)

class AssignmentCreate(BaseModel):
    title: str = Field(min_length=2, max_length=180)
    subject: str = Field(min_length=2, max_length=100)
    description: str = Field(default="", max_length=2000)
    due_date: str = Field(min_length=10, max_length=10)

class SubmissionCreate(BaseModel):
    submission_text: str = Field(min_length=1, max_length=5000)
