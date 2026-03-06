# Wireless Attendance Management System

A React Native + Expo + Supabase attendance tracking application for educational institutions. Supports role-based access (Student, Teacher, HOD), device binding, WiFi subnet verification, face registration, and offline sync.

---

## Features

### Student Features
- **Device-bound login** – one device per student
- **Face registration** – first-time login captures face, matches against HOD-uploaded reference photo (TensorFlow + MediaPipe)
- **Session detection** – 30-second polling for active sessions
- **PIN + WiFi verification** – secure attendance marking
- **Offline marking** – attendance queued locally when offline, auto-syncs when back online
- **Attendance history** – color-coded present/absent with percentage
- **75% threshold** – indicator for attendance compliance

### Teacher Features
- **Session management** – open/close attendance sessions (15-min expiry)
- **4-digit PIN** – auto-generated and displayed for students
- **Real-time tracking** – Supabase Realtime for live attendance list
- **Pending sync warning** – shows when students have offline records before closing
- **Manual editing** – edit attendance with edit tracking
- **Filter** – by date range with 75% calculation
- **Live student list** – who has marked present

### HOD Features
- **Student management** – add/edit/delete by year
- **Face photo upload** – reference photos for student face verification
- **Teacher management** – create accounts with SHA256-hashed passwords
- **Attendance dashboard** – overview by subject and teacher
- **PDF reports** – generate reports by date range
- **Year-based filtering** – on all views

### Security Features
- **Device binding** – students restricted to one device
- **PIN verification** – 4-digit PIN required for marking
- **WiFi subnet verification** – ensures students are on classroom network (IP-based)
- **Password hashing** – SHA256 (expo-crypto) for teacher accounts
- **Row-level security** – enabled on all database tables
- **Manual edit tracking** – records when attendance is manually changed

---

## Project Structure

```
AttendanceApp/
├── app/
│   ├── _layout.tsx                  # Root: auth guard, network banner, face init, offline sync
│   ├── index.tsx                    # Role selector (Student / Teacher / HOD)
│   ├── (auth)/
│   │   ├── hod-login.tsx            # HOD email + password (Supabase Auth)
│   │   ├── teacher-login.tsx        # Teacher username + password (SHA256)
│   │   └── student-login.tsx        # Enrollment + device binding + face registration
│   ├── (hod)/
│   │   ├── _layout.tsx              # HOD tab navigation
│   │   ├── dashboard.tsx            # Subject overview + stats
│   │   ├── manage-students.tsx      # CRUD students + face photo upload
│   │   ├── manage-teachers.tsx      # CRUD teachers (SHA256 password)
│   │   └── download-pdf.tsx         # Generate attendance PDFs
│   ├── (teacher)/
│   │   ├── _layout.tsx              # Teacher tab navigation
│   │   ├── session.tsx              # Open/close session, PIN, live list
│   │   ├── students.tsx             # Manual attendance edit
│   │   └── filter.tsx               # Date range + 75% calculation
│   └── (student)/
│       ├── _layout.tsx              # Student tab navigation
│       ├── mark-attendance.tsx      # PIN + subnet check + mark
│       └── my-attendance.tsx        # History + percentage
├── lib/
│   ├── supabase.ts                  # Supabase client config
│   ├── faceAuth.ts                  # Face embedding, matching (TensorFlow + MediaPipe)
│   ├── offlineSync.ts               # Pending queue, auto-sync on reconnect
│   ├── utils.ts                     # PIN, subnet, WiFi info, dates, colors
│   └── errorHandling.ts             # Network detection + error parsing
├── store/
│   ├── authStore.ts                 # User, role, login/logout
│   ├── sessionStore.ts              # Active session state
│   └── attendanceStore.ts           # Attendance records cache
├── types/
│   └── index.ts                     # TypeScript interfaces
├── components/
│   ├── FaceCamera.tsx               # Camera for face capture
│   └── NetworkOfflineBanner.tsx     # Offline indicator
├── supabase/
│   └── schema.sql                   # Base database schema
├── assets/
├── app.json
├── package.json
├── tsconfig.json
└── metro.config.js
```

---

## Database Schema

### Tables (base schema in `supabase/schema.sql`)

**hod**
- `id` (UUID) – Primary key, matches Supabase Auth user id
- `name` – HOD name
- `email` – Unique (linked to Supabase Auth)
- `department` – Department name
- `created_at` – Timestamp

**teacher**
- `id` (UUID) – Primary key
- `hod_id` (UUID) – Foreign key to hod
- `name` – Teacher name
- `subject` – Subject taught
- `year` (1–4) – Year they teach
- `username` – Unique username for login
- `password_hash` – SHA256-hashed password (expo-crypto)
- `created_at` – Timestamp

**student**
- `id` (UUID) – Primary key
- `hod_id` (UUID) – Foreign key to hod
- `name` – Student name
- `enrollment_no` – Unique enrollment number
- `mobile_no` – Unique mobile number
- `year` (1–4) – Student year
- `device_id` – Set on first login (device binding)
- `is_device_bound` – Boolean
- `face_image_url` – Storage path/URL for reference photo (HOD uploads)
- `face_registered` – Boolean (set after first face verification)
- `face_embedding` – Stored embedding for reinstall recovery
- `created_at` – Timestamp

**attendance_session**
- `id` (UUID) – Primary key
- `teacher_id` (UUID) – Foreign key to teacher
- `subject` – Subject name
- `year` (1–4) – Class year
- `date` – Session date
- `opened_at` – When opened
- `closed_at` – When closed (NULL = open)
- `router_subnet` – Classroom WiFi subnet (e.g. "192.168.1")
- `session_pin` – 4-digit PIN
- `session_bssid` – WiFi BSSID (optional)
- `expires_at` – Session expiry (e.g. 15 min)
- `is_active` – Boolean
- `created_at` – Timestamp

**attendance_record**
- `id` (UUID) – Primary key
- `session_id` (UUID) – Foreign key to attendance_session
- `student_id` (UUID) – Foreign key to student
- `status` – 'present' or 'absent'
- `marked_at` – When marked
- `is_manual_edit` – Boolean for teacher edits
- `face_verified` – Boolean (face check at mark time)
- `sync_status` – 'pending' | 'synced' | 'failed' (offline sync)
- `local_timestamp` – For offline records
- `UNIQUE(session_id, student_id)` – One record per student per session

### Storage
- **face-photos** bucket – HOD-uploaded reference photos for students

### Realtime
- `attendance_record` – Realtime enabled for INSERT events (teacher live view)

> **Note:** `schema.sql` is the base. Face and offline sync features use extra columns (`face_image_url`, `face_registered`, `face_embedding`, `session_bssid`, `expires_at`, `face_verified`, `sync_status`, `local_timestamp`). Add these via migrations if not present.

---

## Installation & Setup

### Prerequisites
- Node.js 18+
- Supabase account (free at https://supabase.com)
- Expo Go app (for device testing)

### 1. Create Supabase Project

1. Create a project at [supabase.com](https://supabase.com)
2. Run `supabase/schema.sql` in **SQL Editor**
3. Enable **Realtime** on `attendance_record` (Database → Replication)
4. Create **Storage** bucket `face-photos` (public or with RLS as needed)
5. Copy **Project URL** and **anon public key** from Project Settings → API

### 2. Configure Credentials

Edit `lib/supabase.ts`:
```typescript
const SUPABASE_URL = 'YOUR_PROJECT_URL';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
```

### 3. Create First HOD

1. **Authentication → Users → Add User** – add HOD email and password
2. **Database → hod** – insert row with same email and department

### 4. Install & Run

```bash
cd AttendanceApp
npm install
npx expo start
```

Scan QR code with Expo Go. For device binding and camera, use:
```bash
npx expo start --dev-client
```

---

## Workflow Example

### 1. HOD Setup
1. Log in as HOD
2. **Students** – add students (year 1–4)
3. For each student, upload face reference photo
4. **Teachers** – create teacher accounts (username + password)
5. Use **Dashboard** for overview

### 2. Teacher Session
1. Log in as teacher
2. **Session** tab → **Open Attendance Session**
   - PIN and subnet are set
   - All students pre-marked absent
   - PIN shown for students
3. Students mark attendance (PIN + same WiFi)
4. Close session when done (optional sync of offline records)
5. **Students** – manual edit; **Filter** – date range, 75%

### 3. Student Flow
1. Log in (name + enrollment + mobile)
   - First time: face capture and match with HOD photo
   - Device bound on first successful login
2. **Mark Attendance** – enter PIN when session is active
3. App checks WiFi subnet and marks present
4. **My Attendance** – history and percentage

---

## Error Handling

- Network offline detection (banner)
- Loading states and Snackbars
- Empty states and validation
- Duplicate prevention
- Session expiry (15 min)

Common messages:
- "You must be connected to the classroom WiFi" – subnet mismatch
- "Invalid PIN" – wrong PIN
- "This account is already linked to another device" – device binding
- "You have already marked attendance" – duplicate
- "HOD has not uploaded your reference photo yet" – no face photo

---

## Security Considerations

1. **WiFi subnet** – Best-effort; primary anti-proxy is the 4-digit PIN
2. **Device binding** – Prevents one account on multiple devices
3. **Passwords** – Teacher passwords hashed with SHA256 (expo-crypto); HOD uses Supabase Auth
4. **Row-level security** – Enabled on all tables; configure RLS policies in Supabase as needed

---

## Testing

### Test Users

**HOD:** Create in Supabase Auth + `hod` table  
**Teacher:** Create via HOD → Teachers (username + password)  
**Student:** Create via HOD → Students; upload face photo; login to bind device

### Scenarios
1. Device binding – login as student on two devices
2. PIN – try wrong PIN on student app
3. WiFi – change network and try to mark
4. Offline – mark attendance offline, then go online
5. Face registration – first-time student login with camera

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Wrong Project URL or Anon Key | Supabase Dashboard → Project Settings → API |
| Student login fails | Check name, enrollment_no, mobile_no match |
| Session not visible for student | Teacher’s year must match student’s year |
| PIN wrong | Ensure session is still open (not closed) |
| WiFi subnet error | Teacher and student on same network |
| Face verification fails | HOD must upload reference photo first |
| Teacher login fails | Verify username and password (SHA256 hash) |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React Native 0.81, Expo 54 |
| Routing | Expo Router 6 |
| State | Zustand |
| UI | React Native Paper |
| Backend | Supabase (PostgreSQL, Auth, Realtime, Storage) |
| Face | TensorFlow.js, MediaPipe Face Detection |
| Offline | AsyncStorage, NetInfo |

---

## Next Steps (Planned)

- [ ] Face verification at mark time (not just at login)
- [ ] SMS / email notifications
- [ ] Attendance analytics dashboard
- [ ] EAS build for APK/IPA

---

## License

This project is provided as-is for educational purposes.

---

## Support

- [Supabase Docs](https://supabase.com/docs)
- [Expo Docs](https://docs.expo.dev)
- [React Native Docs](https://reactnative.dev/docs/getting-started)
