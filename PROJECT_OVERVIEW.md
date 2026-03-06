# WiFi-Based Attendance Management System

**Last Updated:** March 6, 2025  
**Status:** In Active Development  
**Version:** 1.0.0

---

## Table of Contents

1. [Project Overview](#-project-overview)
2. [Architecture](#-architecture)
3. [Project Structure](#-project-structure)
4. [Application Flow](#-application-flow)
5. [Tech Stack](#-tech-stack)
6. [Database Schema](#-database-schema)
7. [Features & Status](#-features--status)
8. [Setup & Installation](#-setup--installation)
9. [Development Guide](#-development-guide)

---

## Project Overview

### What Is It?

The **WiFi-Based Attendance Management System** is a mobile application (React Native/Expo) for educational institutions. It tracks student attendance using:

- **Role-based access**: Students, Teachers, Head of Department (HOD)
- **Device binding**: One device per student
- **WiFi subnet verification**: Ensures students are on the classroom network
- **PIN-based anti-proxy**: 4-digit session PIN
- **Face recognition**: Identity verification during login and (planned) during attendance
- **Offline support**: Queue attendance locally and sync when online

### Target Users

| Role | Purpose |
|------|---------|
| **Student** | Mark attendance with PIN, view history, manage device/face registration |
| **Teacher** | Open/close sessions, view live attendance, manually edit records, filter reports |
| **HOD** | Manage students and teachers, upload face photos, generate PDF reports |

---

## Architecture

### High-Level View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Mobile App (React Native / Expo)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  Expo Router                                                                 │
│  ├── index (Role selector)                                                   │
│  ├── (auth)     → hod-login | teacher-login | student-login                  │
│  ├── (student)  → mark-attendance | my-attendance                            │
│  ├── (teacher)  → session | students | filter                                │
│  └── (hod)      → dashboard | manage-students | manage-teachers | download-pdf│
├─────────────────────────────────────────────────────────────────────────────┤
│  State (Zustand)                                                             │
│  ├── authStore      → user, role, login/logout                               │
│  ├── sessionStore   → activeSession (current attendance session)             │
│  └── attendanceStore → records cache                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  Services (lib/)                                                             │
│  ├── supabase.ts    → Database, Auth, Storage, Realtime                      │
│  ├── faceAuth.ts    → Face embedding, matching (TensorFlow)                  │
│  ├── offlineSync.ts → AsyncStorage queue, NetInfo auto-sync                  │
│  ├── utils.ts       → PIN, subnet, WiFi info                                 │
│  └── errorHandling.ts                                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Supabase (Backend)                                   │
│  ├── PostgreSQL    → hod, teacher, student, attendance_session, attendance_record  │
│  ├── Auth          → HOD (email/password)                                    │
│  ├── Realtime      → attendance_record INSERT → teacher live updates         │
│  └── Storage       → face-photos bucket (reference images)                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Authentication Flow

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                    App Launch                            │
                    └──────────────────────────┬──────────────────────────────┘
                                               │
                    ┌──────────────────────────▼──────────────────────────────┐
                    │  index.tsx — Role selector                               │
                    │  [Student] [Teacher] [HOD]                               │
                    └───────┬─────────────────────┬───────────────────┬───────┘
                            │                     │                   │
            ┌───────────────▼─────────────┐   ┌───▼──────────┐   ┌────▼──────────┐
            │ student-login               │   │teacher-login  │   │ hod-login     │
            │ • Name, Enrollment, Mobile  │   │ • Username    │   │ • Email       │
            │ • Device binding check      │   │ • Password    │   │ • Password    │
            │ • First-time: face capture  │   │ • SHA256 hash │   │ • Supabase    │
            │   + match with HOD photo    │   │   verification│   │   Auth        │
            └───────────────┬─────────────┘   └───┬──────────┘   └────┬──────────┘
                            │                     │                   │
                            └─────────────────────┼───────────────────┘
                                                  │
                    ┌─────────────────────────────▼─────────────────────────────┐
                    │  authStore.setUser({ role, data })                         │
                    │  _layout.tsx → redirect to role-specific home              │
                    └───────────────────────────────────────────────────────────┘
```

### Student Attendance Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  STUDENT: Mark Attendance                                                     │
└──────────────────────────────────────────────────────────────────────────────┘

  mark-attendance.tsx
        │
        ├─(1) Poll for active session (every 30s)
        │     • attendance_session: is_active=true, year=student.year
        │     • opened_at within last 15 min
        │
        ├─(2) No session? → Show "No Attendance Session"
        │
        ├─(3) Session active? → Show PIN input
        │
        ├─(4) Student enters 4-digit PIN
        │     • Must match session.session_pin
        │
        ├─(5) Verify WiFi subnet
        │     • Network.getIpAddressAsync() → extractSubnet(ip)
        │     • Must equal session.router_subnet (e.g. "192.168.1")
        │
        ├─(6) Check if already marked (session_id + student_id)
        │
        ├─(7) Insert attendance_record
        │     • status='present', marked_at=now
        │     • Online: Supabase
        │     • Offline: offlineSync.saveAttendanceLocally → AsyncStorage
        │
        └─(8) Success → Show "Attendance marked"
```

### Teacher Session Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  TEACHER: Session Lifecycle                                                   │
└──────────────────────────────────────────────────────────────────────────────┘

  session.tsx
        │
        ├─ OPEN SESSION
        │     • getWifiInfo() → subnet, bssid
        │     • generatePIN() → 4-digit
        │     • Insert attendance_session
        │       - router_subnet, session_pin, session_bssid
        │       - expires_at = now + 15 min
        │     • Pre-create attendance_record (status='absent') for all students in year
        │     • setActiveSession(session)
        │
        ├─ LIVE VIEW
        │     • Supabase Realtime: postgres_changes on attendance_record (INSERT)
        │     • filter: session_id=eq.{session.id}
        │     • On event → fetchPresentStudents() → update UI
        │
        ├─ PENDING SYNC (offline students)
        │     • getPendingCount() every 5s
        │     • Banner if pending > 0
        │
        └─ CLOSE SESSION
              • If pending > 0 → Alert: "Sync & Close" | "Close Anyway" | "Cancel"
              • performClose(): syncPendingRecords() if requested
              • Update attendance_session: is_active=false, closed_at=now
              • setActiveSession(null)
```

### Offline Sync Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Offline Sync (lib/offlineSync.ts)                                            │
└──────────────────────────────────────────────────────────────────────────────┘

  Student marks attendance offline
        │
        ├─ saveAttendanceLocally(record)
        │     • AsyncStorage key: pending_att_{session_id}_{student_id}
        │     • Value: JSON of AttendanceRecord
        │
  App root layout (_layout.tsx)
        │
        ├─ setupAutoSync()
        │     • NetInfo.addEventListener(state => …)
        │     • When isConnected && isInternetReachable → syncPendingRecords()
        │
  syncPendingRecords()
        │
        ├─ Get all keys with prefix pending_att_
        ├─ For each: upsert to attendance_record
        ├─ On success: AsyncStorage.removeItem(key)
        └─ On failure: update record with sync_status='failed'
```

---

## Project Structure

```
wifi-attendence/
│
├── AttendanceApp/                    # Main React Native app
│   │
│   ├── app/                          # Expo Router (file-based routing)
│   │   ├── _layout.tsx               # Root: auth guard, network banner, face init, offline sync
│   │   ├── index.tsx                 # Role selector (Student / Teacher / HOD)
│   │   │
│   │   ├── (auth)/                   # Auth group (no tabs)
│   │   │   ├── hod-login.tsx
│   │   │   ├── teacher-login.tsx
│   │   │   └── student-login.tsx     # Multi-step: form → face-capture → face-match
│   │   │
│   │   ├── (student)/
│   │   │   ├── _layout.tsx           # Tabs + logout
│   │   │   ├── mark-attendance.tsx   # PIN + subnet verification
│   │   │   └── my-attendance.tsx     # History + percentage
│   │   │
│   │   ├── (teacher)/
│   │   │   ├── _layout.tsx
│   │   │   ├── session.tsx           # Open/close session, live list
│   │   │   ├── students.tsx          # Edit attendance manually
│   │   │   └── filter.tsx            # Date range, 75% calculation
│   │   │
│   │   └── (hod)/
│   │       ├── _layout.tsx
│   │       ├── dashboard.tsx
│   │       ├── manage-students.tsx   # CRUD + face photo upload
│   │       ├── manage-teachers.tsx   # CRUD + password (SHA256)
│   │       └── download-pdf.tsx      # PDF reports
│   │
│   ├── lib/                          # Business logic & services
│   │   ├── supabase.ts               # Supabase client
│   │   ├── faceAuth.ts               # Face embedding, matching (TensorFlow + MediaPipe)
│   │   ├── offlineSync.ts            # Pending queue, auto-sync
│   │   ├── utils.ts                  # generatePIN, extractSubnet, getWifiInfo
│   │   └── errorHandling.ts
│   │
│   ├── store/                        # Zustand stores
│   │   ├── authStore.ts              # user, role, setUser, logout
│   │   ├── sessionStore.ts           # activeSession
│   │   └── attendanceStore.ts        # records, addRecord, updateRecord
│   │
│   ├── components/
│   │   ├── FaceCamera.tsx
│   │   └── NetworkOfflineBanner.tsx
│   │
│   ├── types/
│   │   └── index.ts                  # HOD, Teacher, Student, AttendanceSession, etc.
│   │
│   ├── supabase/
│   │   └── schema.sql                # Base DDL (may need migrations for new columns)
│   │
│   ├── assets/
│   ├── app.json
│   ├── package.json
│   ├── tsconfig.json
│   └── metro.config.js
│
├── PROJECT_OVERVIEW.md               # This file
├── SETUP.md
├── QUICKSTART.md
└── INSTALL.md
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | React Native 0.81, Expo 54 |
| **Routing** | Expo Router 6 |
| **State** | Zustand 4 |
| **UI** | React Native Paper 5 |
| **Backend** | Supabase (PostgreSQL, Auth, Realtime, Storage) |
| **Face** | TensorFlow.js, MediaPipe Face Detection |
| **Auth** | Supabase Auth (HOD), Custom SHA256 (Teacher), Device binding (Student) |
| **Offline** | AsyncStorage, NetInfo |
| **Network** | expo-network (IP, WiFi info) |

---

## Database Schema

### Tables

| Table | Purpose |
|-------|---------|
| `hod` | HOD profile (links to Supabase Auth via `id`) |
| `teacher` | Teachers (username, password_hash=SHA256, hod_id) |
| `student` | Students (enrollment, device_id, face_image_url, face_registered, face_embedding) |
| `attendance_session` | Sessions (teacher_id, subject, year, session_pin, router_subnet, session_bssid, expires_at) |
| `attendance_record` | One per (session_id, student_id): status, marked_at, face_verified, sync_status |

### Relationships

```
hod (1) ─── (*) teacher
hod (1) ─── (*) student
teacher (1) ─── (*) attendance_session
attendance_session (1) ─── (*) attendance_record
student (1) ─── (*) attendance_record
```

### Realtime

- `attendance_record`: Realtime enabled for INSERT events so teachers see live updates.

### Storage

- Bucket `face-photos`: HOD-uploaded reference photos for students.

---

## Features & Status

| Feature | Status |
|---------|--------|
| HOD login (Supabase Auth) | Done |
| Teacher login (SHA256) | Done |
| Student login + device binding | Done |
| Student face registration (first-time) | Done |
| Mark attendance (PIN + subnet) | Done |
| Teacher open/close session | Done |
| Live attendance (Realtime) | Done |
| Offline queue + auto-sync | Done |
| Manual edit attendance | Done |
| PDF reports | Done |
| Face verification at mark time | In progress |
| Liveness detection | Planned |

---

## Setup & Installation

1. **Supabase**: Create project, run `supabase/schema.sql`, enable Realtime on `attendance_record`, create `face-photos` bucket.
2. **Config**: Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `lib/supabase.ts`.
3. **HOD**: Create user in Supabase Auth, insert row in `hod` with matching `id`.
4. **Run**: `cd AttendanceApp && npm install && npx expo start`.

---

## Development Guide

### Key Files

| File | Role |
|------|------|
| `app/_layout.tsx` | Auth guard, init face model, setup offline sync |
| `store/authStore.ts` | `user`, `role`, `setUser`, `logout` |
| `store/sessionStore.ts` | `activeSession` for teacher |
| `lib/offlineSync.ts` | `saveAttendanceLocally`, `syncPendingRecords`, `setupAutoSync` |
| `lib/utils.ts` | `generatePIN`, `extractSubnet`, `getWifiInfo` |

### Add a New Screen

1. Create `app/(role)/screen-name.tsx`.
2. Tab routes are defined in `app/(role)/_layout.tsx`.

### Debug Tips

- **Supabase**: Check URL/key in `lib/supabase.ts`.
- **Face**: Ensure HOD has uploaded reference photo; check `faceAuth.ts` logs.
- **Offline**: Use NetInfo to simulate offline; check AsyncStorage keys `pending_att_*`.
- **Session**: Session expires 15 min after open; check `expires_at`.

---

**Maintained by:** Development Team  
**Last Updated:** March 6, 2025
