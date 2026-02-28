-- HOD TABLE
CREATE TABLE hod (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  department TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- TEACHER TABLE
CREATE TABLE teacher (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hod_id UUID REFERENCES hod(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  year INT NOT NULL CHECK (year IN (1, 2, 3, 4)),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- STUDENT TABLE
CREATE TABLE student (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hod_id UUID REFERENCES hod(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  enrollment_no TEXT UNIQUE NOT NULL,
  mobile_no TEXT UNIQUE NOT NULL,
  year INT NOT NULL CHECK (year IN (1, 2, 3, 4)),
  device_id TEXT,                          -- bound on first login, NULL until then
  is_device_bound BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ATTENDANCE SESSION TABLE
CREATE TABLE attendance_session (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES teacher(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  year INT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  opened_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ,                   -- NULL means session is currently open
  router_subnet TEXT,                      -- e.g., "192.168.1" for subnet check
  session_pin TEXT,                        -- 4-digit PIN for anti-proxy
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ATTENDANCE RECORD TABLE
CREATE TABLE attendance_record (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES attendance_session(id) ON DELETE CASCADE,
  student_id UUID REFERENCES student(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'absent' CHECK (status IN ('present', 'absent')),
  marked_at TIMESTAMPTZ,
  is_manual_edit BOOLEAN DEFAULT FALSE,
  UNIQUE(session_id, student_id)           -- one record per student per session
);

-- INDEXES for performance
CREATE INDEX idx_attendance_record_session ON attendance_record(session_id);
CREATE INDEX idx_attendance_record_student ON attendance_record(student_id);
CREATE INDEX idx_session_teacher ON attendance_session(teacher_id);
CREATE INDEX idx_session_date ON attendance_session(date);
CREATE INDEX idx_student_year ON student(year);

-- Enable Row Level Security
ALTER TABLE hod ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher ENABLE ROW LEVEL SECURITY;
ALTER TABLE student ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_record ENABLE ROW LEVEL SECURITY;
