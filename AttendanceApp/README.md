# Wireless Attendance Management System

A complete React Native + Expo + Supabase attendance tracking application for educational institutions.

## Features

### 🎓 Student Features
- **Device-bound login** (one device per student)
- **Real-time session detection** with 30-second polling
- **PIN + WiFi verification** for secure attendance marking
- **Attendance history** with color-coded status (present/absent)
- **Attendance percentage** calculation and 75% threshold indicator

### 👨‍🏫 Teacher Features
- **Session management** - open/close attendance sessions
- **4-digit PIN generation** and display for students
- **Real-time attendance tracking** via Supabase Realtime
- **Manual attendance editing** with edit tracking
- **Attendance filtering** - by date range with 75% calculation
- **Live student list** showing who marked present

### 👔 HOD Features
- **Student management** - add/edit/delete students by year
- **Teacher management** - create accounts with hashed passwords
- **Attendance dashboard** - overview by subject and teacher
- **PDF reports** - generate attendance reports by date range
- **Year-based filtering** on all views

### 🔒 Security Features
- **Device binding** - students can only use one device
- **PIN verification** - 4-digit PIN required for marking
- **WiFi subnet verification** - ensures students are in classroom
- **Password hashing** - bcryptjs for teacher accounts
- **Row-level security** - enabled on all database tables
- **Manual edit tracking** - marks when attendance is manually changed

---

## Installation & Setup

### Prerequisites
- Node.js 18+ and npm
- Supabase account (free at https://supabase.com)
- Expo CLI: `npm install -g expo-cli`

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free project
2. In **SQL Editor**, run the schema from `supabase/schema.sql` to create all tables
3. In **Project Settings > API**, copy:
   - **Project URL**
   - **anon public key**

### 2. Configure Supabase Credentials

Edit `lib/supabase.ts`:
```typescript
const SUPABASE_URL = 'YOUR_PROJECT_URL'; // Paste here
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY'; // Paste here
```

### 3. Create First HOD Account

1. In Supabase, go to **Authentication > Users > Add User**
2. Enter email and password for HOD
3. Go to **Database > hod table** and insert a row:
   - `name`: HOD's name
   - `email`: Same email as auth
   - `department`: Your department name

### 4. Install & Run

```bash
cd AttendanceApp
npm install
npx expo start

# Scan QR code with Expo Go app (iOS/Android)
# For testing features like device binding, use:
npx expo start --dev-client
```

---

## Project Structure

```
AttendanceApp/
├── app/
│   ├── _layout.tsx                  # Root auth guard + network banner
│   ├── index.tsx                    # Role selector screen
│   ├── (auth)/
│   │   ├── hod-login.tsx           # HOD email + password login
│   │   ├── teacher-login.tsx       # Teacher username + password login
│   │   └── student-login.tsx       # Student enrollment + device binding
│   ├── (hod)/
│   │   ├── _layout.tsx             # HOD tab navigation
│   │   ├── dashboard.tsx           # Subject overview + stats
│   │   ├── manage-students.tsx     # CRUD students
│   │   ├── manage-teachers.tsx     # CRUD teachers (with password hashing)
│   │   └── download-pdf.tsx        # Generate attendance PDFs
│   ├── (teacher)/
│   │   ├── _layout.tsx             # Teacher tab navigation
│   │   ├── session.tsx             # Open/close attendance + show PIN
│   │   ├── students.tsx            # Manual attendance edit
│   │   └── filter.tsx              # Attendance by date range + 75% calc
│   └── (student)/
│       ├── _layout.tsx             # Student tab navigation
│       ├── mark-attendance.tsx     # PIN + subnet check + mark
│       └── my-attendance.tsx       # History + percentage display
├── lib/
│   ├── supabase.ts                 # Supabase client config
│   ├── utils.ts                    # Utilities (dates, colors, PINs, subnets)
│   └── errorHandling.ts            # Network detection + error parsing
├── store/
│   ├── authStore.ts                # (Zustand) User + login state
│   ├── sessionStore.ts             # (Zustand) Active session state
│   └── attendanceStore.ts          # (Zustand) Attendance records cache
├── types/
│   └── index.ts                    # All TypeScript interfaces
├── components/
│   └── NetworkOfflineBanner.tsx     # Shows when offline
└── supabase/
    └── schema.sql                  # Full database schema
```

---

## Database Schema

### Tables

**hod**
- `id` (UUID) - Primary key
- `name` - HOD name
- `email` - Unique email (linked to Supabase Auth)
- `department` - Department name
- `created_at` - Timestamp

**teacher**
- `id` (UUID) - Primary key
- `hod_id` (UUID) - Foreign key to hod
- `name` - Teacher name
- `subject` - Subject taught
- `year` (1-4) - Year which they teach
- `username` - Unique username for login
- `password_hash` - Bcrypt hashed password
- `created_at` - Timestamp

**student**
- `id` (UUID) - Primary key
- `hod_id` (UUID) - Foreign key to hod
- `name` - Student name
- `enrollment_no` - Unique enrollment number
- `mobile_no` - Unique mobile number
- `year` (1-4) - Student year
- `device_id` - Device binding (set on first login)
- `is_device_bound` - Boolean flag
- `created_at` - Timestamp

**attendance_session**
- `id` (UUID) - Primary key
- `teacher_id` (UUID) - Foreign key to teacher
- `subject` - Subject name (copied from teacher)
- `year` (1-4) - Class year
- `date` - Session date
- `opened_at` - Timestamp when opened
- `closed_at` - Timestamp when closed (NULL = open)
- `router_subnet` - Classroom WiFi subnet (e.g., "192.168.1")
- `session_pin` - 4-digit PIN for students
- `is_active` - Boolean flag
- `created_at` - Timestamp

**attendance_record**
- `id` (UUID) - Primary key
- `session_id` (UUID) - Foreign key to attendance_session
- `student_id` (UUID) - Foreign key to student
- `status` - 'present' or 'absent'
- `marked_at` - Timestamp when marked
- `is_manual_edit` - Boolean flag for teacher edits
- `UNIQUE(session_id, student_id)` - One record per student per session

---

## Workflow Example

### 1. HOD Setup
1. Log in as HOD
2. Go to **Students** and add all students (Year 1, 2, 3, 4)
3. Go to **Teachers** and create teacher accounts:
   - Name: "Mr. Smith"
   - Subject: "Mathematics"
   - Year: 1
   - Username: "mrsmith"
   - Password: auto-hashed
4. View **Dashboard** for overview

### 2. Teacher Attendance
1. Log in as teacher
2. Go to **Session** tab
3. Click "🎯 Open Attendance Session"
   - 4-digit PIN is generated
   - All students automatically marked absent
   - PIN displayed on screen for students
4. Students scan QR or enter PIN
5. Click "⏹ Close Session"
6. Manual edits or browse past sessions in **Students** tab
7. Use **Filter** to find students below 75%

### 3. Student Marking
1. Student logs in (name + enrollment + mobile)
   - First login binds device
   - Subsequent logins blocked if using different device
2. Go to **Mark Attendance** tab
3. Session auto-appears when teacher opens it
4. Enter PIN shown by teacher
5. App verifies WiFi subnet and marks present
6. Go to **My Attendance** tab to see history and %

---

## Error Handling

All screens include:
- ✅ Network offline detection (red banner at top)
- ✅ Loading states with ActivityIndicator
- ✅ Snackbar error messages
- ✅ Empty states with helpful messages
- ✅ Input validation
- ✅ Duplicate prevention
- ✅ Session expiry handling

Common error messages:
- "Network connection error" - offline
- "You must be connected to the classroom WiFi" - subnet mismatch
- "Invalid PIN" - wrong PIN entered
- "This account is already linked to another device" - device binding violation
- "You have already marked attendance" - duplicate marking

---

## Security Considerations

⚠️ **Important Notes:**

1. **WiFi Subnet Check** is a best-effort verification, NOT a guarantee
   - Primary anti-proxy mechanism is the **4-digit PIN**
   - PIN changes every session

2. **Device Binding** prevents:
   - One student account used by multiple devices
   - (Does not prevent phone sharing within same device)

3. **Passwords**:
   - Never stored in plaintext
   - Always hashed with bcryptjs before saving
   - HOD uses Supabase Auth for additional security

4. **Database Security**:
   - Row-level security enabled on all tables
   - Implement RLS policies in Supabase Dashboard as needed

---

## Testing

### Test Users Setup

**HOD:**
- Email: `hod@example.com`
- Password: `test123`

**Teacher (Year 1):**
- Username: `teacher1`
- Password: `pass123`
- Subject: Mathematics

**Student (Year 1):**
- Name: John Doe
- Enrollment: `2024001`
- Mobile: `9876543210`

### Test Scenarios

1. **Device Binding**: Login as student on two different devices/emulators
2. **PIN Verification**: Try wrong PIN on student app
3. **WiFi Subnet**: Change network and try to mark attendance
4. **Manual Edits**: Toggle attendance in teacher students tab
5. **PDF Export**: Generate PDF report from HOD app

---

## Troubleshooting

### "Project URL" or "Anon Key" is incorrect
→ Check Supabase Dashboard > Project Settings > API

### Student login fails
→ Verify student exists in database with exact name, enrollment_no, mobile_no

### Session doesn't appear for student
→ Check teacher's year matches student's year

### PIN is wrong
→ Make sure teacher's session is still open (not closed)

### WiFi subnet error
→ Both teacher and student must be on same WiFi network

### Password hashing fails
→ Ensure `bcryptjs` is installed: `npm install bcryptjs`

---

## Next Steps

### Enhancements
- [ ] SMS notifications to students/parents
- [ ] Monthly attendance reports
- [ ] Biometric attendance (fingerprint/face)
- [ ] Attendance analytics dashboard
- [ ] Parent app for viewing child's attendance
- [ ] Automated low-attendance alerts

### Deployment
- [ ] Build APK for Android: `eas build --platform android`
- [ ] Build IPA for iOS: `eas build --platform ios`
- [ ] Configure app.json properly
- [ ] Set up EAS account for uploads

---

## License

This project is provided as-is for educational purposes.

---

## Support

For issues or questions, refer to:
- [Supabase Docs](https://supabase.com/docs)
- [Expo Docs](https://docs.expo.dev)
- [React Native Docs](https://reactnative.dev/docs/getting-started)
