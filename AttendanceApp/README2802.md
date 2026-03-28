# AttendanceApp

This document is the canonical project context for this repository. It is written so a new engineer or an AI agent can understand the app quickly, including what exists, how it works, which files matter, and where the current implementation has gaps or mismatches.

## 1. What This Project Is

AttendanceApp is a React Native mobile app built with Expo and Expo Router for classroom attendance management.

It supports three roles:

- HOD: creates teachers and students, uploads student reference photos, views dashboards, exports PDF reports
- Teacher: opens attendance sessions, gets a live PIN, sees who marked present, manually edits records, filters low attendance
- Student: logs in with identity fields, binds to one device, completes first-time face registration, then marks attendance using PIN + face verification + classroom WiFi subnet

The backend is Supabase and is used for:

- PostgreSQL tables
- HOD authentication via Supabase Auth
- file storage for student face reference photos
- realtime subscriptions for live teacher session updates

## 2. Product Goal

The app is trying to prevent proxy attendance with a layered check:

1. role-based access
2. student device binding
3. teacher-generated session PIN
4. student face verification against HOD-uploaded reference image
5. same-network check using WiFi subnet

The design is practical rather than perfectly secure. It is optimized for college/institute attendance workflows, not for high-assurance identity verification.

## 3. Tech Stack

- React Native `0.81.5`
- Expo `54`
- Expo Router `6`
- React `19`
- React Native Paper for UI
- Zustand for app state
- Supabase JS client for database, auth, storage, realtime
- Expo Camera for live face capture
- Expo Network / NetInfo for connectivity and subnet checks
- Expo Print + Expo Sharing for report export
- TypeScript across the app

Defined in [package.json](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/package.json).

## 4. High-Level Architecture

The app is organized into five layers:

1. UI screens in `app/`
2. reusable UI components in `components/`
3. state stores in `store/`
4. infrastructure and helpers in `lib/`
5. shared domain types in `types/`

At runtime the flow looks like this:

- Expo boots the app through `expo-router`
- `app/_layout.tsx` mounts the app shell, network banner, and auto-sync listener
- route groups split screens by role: `(auth)`, `(student)`, `(teacher)`, `(hod)`
- screens call Supabase directly; there is no separate service layer
- Zustand stores hold only lightweight session/auth UI state
- most business rules are implemented inside screen files themselves

This means the architecture is simple to follow, but business logic is spread across screen components instead of being centralized.

## 5. Entry Points And Runtime Shell

### Boot files

- [App.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/App.tsx): wraps the app with gesture handler, safe area, Paper provider, and renders `Slot`
- [index.ts](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/index.ts): Expo root registration
- [app/_layout.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/app/_layout.tsx): real runtime shell used by Expo Router

### What `app/_layout.tsx` does

- loads `react-native-url-polyfill`
- subscribes to `setupAutoSync()` from `lib/offlineSync.ts`
- reads `user` from `authStore`
- redirects users into the correct route group for their role
- redirects unauthenticated users back to `/`
- always renders `NetworkOfflineBanner`

Important: this file is the actual application gatekeeper. Any future auth, hydration, or global side effects should be reviewed here first.

## 6. Route Structure

### Public / auth routes

- [app/index.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/app/index.tsx): role selector
- [app/(auth)/student-login.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/app/(auth)/student-login.tsx)
- [app/(auth)/teacher-login.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/app/(auth)/teacher-login.tsx)
- [app/(auth)/hod-login.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/app/(auth)/hod-login.tsx)

### Student tab routes

- [app/(student)/_layout.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/app/(student)/_layout.tsx)
- [app/(student)/mark-attendance.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/app/(student)/mark-attendance.tsx)
- [app/(student)/my-attendance.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/app/(student)/my-attendance.tsx)

### Teacher tab routes

- [app/(teacher)/_layout.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/app/(teacher)/_layout.tsx)
- [app/(teacher)/session.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/app/(teacher)/session.tsx)
- [app/(teacher)/students.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/app/(teacher)/students.tsx)
- [app/(teacher)/filter.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/app/(teacher)/filter.tsx)

### HOD tab routes

- [app/(hod)/_layout.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/app/(hod)/_layout.tsx)
- [app/(hod)/dashboard.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/app/(hod)/dashboard.tsx)
- [app/(hod)/manage-students.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/app/(hod)/manage-students.tsx)
- [app/(hod)/manage-teachers.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/app/(hod)/manage-teachers.tsx)
- [app/(hod)/download-pdf.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/app/(hod)/download-pdf.tsx)

## 7. Role-by-Role Behavior

### HOD flow

Implemented mainly in:

- [app/(auth)/hod-login.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/app/(auth)/hod-login.tsx)
- [app/(hod)/manage-students.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/app/(hod)/manage-students.tsx)
- [app/(hod)/manage-teachers.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/app/(hod)/manage-teachers.tsx)
- [app/(hod)/dashboard.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/app/(hod)/dashboard.tsx)
- [app/(hod)/download-pdf.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/app/(hod)/download-pdf.tsx)

Behavior:

- HOD logs in using Supabase Auth email/password
- after login, the app fetches the HOD profile from the `hod` table using the auth user id
- HOD can add students with `name`, `enrollment_no`, `mobile_no`, `year`
- HOD can upload a reference photo for a student into the Supabase Storage bucket `face-photos`
- HOD can add teachers with a manually hashed password
- HOD sees dashboard summaries per teacher/subject
- HOD can generate PDF attendance reports for a date range

Why it is implemented this way:

- HOD is the bootstrap/admin actor
- student face verification depends on HOD uploading a trusted reference image first
- teacher accounts are managed from inside the app instead of using Supabase Auth

### Teacher flow

Implemented mainly in:

- [app/(auth)/teacher-login.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/app/(auth)/teacher-login.tsx)
- [app/(teacher)/session.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/app/(teacher)/session.tsx)
- [app/(teacher)/students.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/app/(teacher)/students.tsx)
- [app/(teacher)/filter.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/app/(teacher)/filter.tsx)

Behavior:

- Teacher logs in with `username` + `password`
- password is SHA-256 hashed on the client and compared against `teacher.password_hash`
- teacher opens an attendance session
- app generates a 4-digit PIN
- app captures current network subnet and optional BSSID
- app creates absent records for every student in the teacher's year
- teacher sees live present count and present student list
- teacher can manually flip student attendance for a selected session/date
- teacher can filter students by attendance percentage in a chosen date range

Why it is implemented this way:

- session opening is the point where attendance state is initialized
- pre-inserting absent rows lets the system treat attendance as "everyone absent unless marked present"
- realtime subscription gives a near-live classroom dashboard without extra backend code

### Student flow

Implemented mainly in:

- [app/(auth)/student-login.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/app/(auth)/student-login.tsx)
- [app/(student)/mark-attendance.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/app/(student)/mark-attendance.tsx)
- [app/(student)/my-attendance.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/app/(student)/my-attendance.tsx)

Behavior:

- student enters `name`, `enrollment_no`, `mobile_no`
- app fetches matching student from the `student` table
- student name must match exactly ignoring case
- device binding is enforced using a device id from Expo Device
- if no face registration exists, student performs first-time face capture
- captured image is compared against HOD reference image using Face++
- if successful, app updates `face_registered`, `device_id`, `is_device_bound`
- in mark attendance screen the app polls every 30 seconds for an active session for the student's year
- student enters teacher PIN
- student captures face again for live verification
- app verifies the live face with Face++ using a fresh signed reference image URL
- app checks current IP subnet against the teacher session subnet
- app upserts attendance as `present`
- student can later review history and percentage

Why it is implemented this way:

- student login is identity plus device binding, not password-based
- first-time face registration prevents unknown devices from binding without a face match
- attendance marking re-validates face and WiFi context each time

## 8. Main Data Flow

### A. HOD creates a student

1. HOD submits form in `manage-students.tsx`
2. screen inserts a row into `student`
3. screen can immediately prompt for face photo upload
4. chosen image is compressed and uploaded to Supabase Storage
5. signed URL is generated and stored in `student.face_image_url`

### B. HOD creates a teacher

1. HOD submits form in `manage-teachers.tsx`
2. password is hashed with `expo-crypto`
3. row is inserted into `teacher`

### C. Student first login and device bind

1. student enters identity fields
2. app queries `student`
3. app checks if the device is already bound to another student
4. app checks if the student is bound to another device
5. if `face_registered` is false, app opens `FaceCamera`
6. app gets a fresh signed URL for `face-photos/{studentId}/reference.jpg`
7. app calls Face++ compare API
8. on success, app updates student binding fields and logs in the student

### D. Teacher opens a session

1. teacher taps open session in `session.tsx`
2. app reads current IP/subnet/BSSID using `getWifiInfo()`
3. app deactivates previous active sessions for that teacher
4. app inserts a new `attendance_session`
5. app fetches all students for the teacher's year
6. app inserts one `attendance_record` per student with status `absent`
7. app stores the returned session in `sessionStore`

### E. Student marks attendance

1. `mark-attendance.tsx` polls for an active, unexpired session
2. student enters the displayed PIN
3. app opens camera and captures a face image
4. app verifies face against fresh signed reference image
5. app checks that student subnet matches `attendance_session.router_subnet`
6. app ensures attendance was not already marked as present
7. app upserts the record to `present`
8. teacher realtime subscription receives the change and refreshes present students

### F. Teacher views and edits attendance

1. teacher picks date/session in `students.tsx`
2. app fetches all students for the teacher year
3. app fetches records for the selected session
4. teacher toggles status
5. app upserts the edited record with `is_manual_edit = true`

### G. HOD exports a report

1. HOD selects teacher and date range
2. app fetches sessions for that teacher/date range
3. app fetches students for the teacher's year
4. app fetches matching attendance records
5. app computes summary rows
6. app builds HTML
7. Expo Print generates a PDF
8. Expo Sharing opens the share dialog

## 9. Data Model

Base schema is in [supabase/schema.sql](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/supabase/schema.sql).

Runtime types are in [types/index.ts](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/types/index.ts).

### Core tables

- `hod`
- `teacher`
- `student`
- `attendance_session`
- `attendance_record`

### Important table relationships

- one HOD manages many teachers
- one HOD manages many students
- one teacher creates many attendance sessions
- one session contains one attendance record per student
- one student can have many attendance records across sessions

### Important fields in actual code

Student:

- `device_id`
- `is_device_bound`
- `face_image_url`
- `face_registered`

Attendance session:

- `router_subnet`
- `session_pin`
- `session_bssid`
- `expires_at`
- `is_active`

Attendance record:

- `status`
- `marked_at`
- `is_manual_edit`
- `face_verified`
- `liveness_verified`
- `sync_status`
- `local_timestamp`

## 10. Stores

Stores are intentionally minimal.

### [store/authStore.ts](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/store/authStore.ts)

Holds:

- current authenticated user
- loading flag
- logout helper

Used by:

- root layout for redirection
- all role tab layouts for logout
- most screens to get current user role/data

### [store/sessionStore.ts](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/store/sessionStore.ts)

Holds:

- current active teacher session

Used by:

- teacher session screen

### [store/attendanceStore.ts](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/store/attendanceStore.ts)

Holds:

- local attendance record array

Reality check:

- this store exists but is barely used in the current codebase
- most screens fetch directly from Supabase into local component state

## 11. Shared Libraries

### [lib/supabase.ts](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/lib/supabase.ts)

Creates the Supabase client. It currently contains hardcoded project credentials.

Why it matters:

- every screen imports this directly
- if project credentials or auth handling change, this is the first place to update

### [lib/utils.ts](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/lib/utils.ts)

Contains:

- date formatting
- attendance percentage calculation
- attendance color thresholds
- PIN generation
- subnet extraction
- network info helper

Why it matters:

- teacher session creation and student verification both depend on these helpers

### [lib/offlineSync.ts](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/lib/offlineSync.ts)

Contains:

- local persistence for pending attendance records via AsyncStorage
- sync routine that upserts to Supabase
- pending count helper
- network listener setup

Reality check:

- auto-sync is mounted globally in `app/_layout.tsx`
- teacher session screen checks pending count and can trigger sync on close
- student attendance marking currently writes directly to Supabase and does not call `saveAttendanceLocally()`
- so offline support is partially built, but not fully connected to the student flow

### [lib/faceApi.ts](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/lib/faceApi.ts)

Contains:

- integration with Face++ compare API
- conversion helpers from file/blob to base64

Used by:

- student first-time registration
- student attendance marking

Why it matters:

- current production face verification depends on this file, not local embeddings

### [lib/faceAuth.ts](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/lib/faceAuth.ts)

Contains:

- local face-detection-based embedding and similarity helpers
- liveness challenge helpers
- AsyncStorage persistence for embeddings

Reality check:

- this file is not imported anywhere in the current app flows
- it references `@react-native-ml-kit/face-detection`, which is not listed in `package.json`
- treat it as experimental or abandoned code unless the app is intentionally being moved back to on-device face matching

### [lib/errorHandling.ts](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/lib/errorHandling.ts)

Contains:

- simple online/offline hook using `expo-network`
- Supabase error-to-message helper

Used by:

- offline banner

## 12. Reusable Components

### [components/FaceCamera.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/components/FaceCamera.tsx)

Purpose:

- shared camera capture UI for face registration and attendance verification

Important implementation details:

- uses `CameraView` from Expo Camera
- handles permission requests inline
- returns captured image URI to parent screen
- uses fixed-size layout instead of flex-inside-scroll behavior to avoid invisible camera bugs

### [components/NetworkOfflineBanner.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/components/NetworkOfflineBanner.tsx)

Purpose:

- global banner shown when the app detects no internet connection

## 13. Authentication Model

This project uses mixed authentication patterns.

### HOD authentication

- real Supabase Auth email/password
- after sign-in, profile is loaded from `hod`

### Teacher authentication

- custom table-based authentication
- username lookup in `teacher`
- client-side SHA-256 hash comparison

### Student authentication

- identity-based lookup using `name`, `enrollment_no`, `mobile_no`
- device binding rules
- no password
- first-time face registration required before attendance use

Why this matters:

- auth behavior is role-dependent, so any attempt to unify login flows will be a significant refactor
- root navigation logic assumes the stored `user.role` is authoritative

## 14. Security Model And Intent

Implemented security controls:

- role-based route segregation
- one-device-per-student binding
- teacher-issued 4-digit PIN
- reference-image-based face verification
- subnet matching against teacher session network
- manual edit tracking

Limitations:

- subnet matching is a weak network trust signal
- teacher authentication is custom and entirely client-driven
- teacher hashes are compared on the client, which is not ideal for a real security boundary
- HOD face reference URLs are stored as signed URLs in the student record, but runtime flows now generate fresh signed URLs before verification
- Supabase RLS is enabled in schema, but no policy definitions are present in this repo

## 15. Current Mismatches, Risks, And Gotchas

This section is especially important for any AI agent making changes.

### Schema drift

The SQL schema file does not fully match the runtime TypeScript model and screen logic.

Code expects extra columns such as:

- `student.face_image_url`
- `student.face_registered`
- `attendance_session.session_bssid`
- `attendance_session.expires_at`
- `attendance_record.face_verified`
- `attendance_record.liveness_verified`
- `attendance_record.sync_status`
- `attendance_record.local_timestamp`

Before changing DB-related logic, verify the live Supabase schema, not just `supabase/schema.sql`.

### README and older docs were stale

Older repository docs referenced technologies and flows that are no longer true. This file should now be treated as the source of truth.

### Offline sync is incomplete

The sync infrastructure exists, but the student attendance flow does not currently enqueue failed submissions locally. If the goal is true offline attendance marking, `mark-attendance.tsx` must be wired to `saveAttendanceLocally()`.

### `faceAuth.ts` is not active

There is dormant on-device face matching code, but the active implementation uses Face++ through `faceApi.ts`.

### Secrets handling is weak

- Supabase URL and anon key are hardcoded in source
- Face++ keys are expected in Expo public env vars, which are still client-visible at build time

### Business logic lives in screens

There is no dedicated domain/service layer. Any non-trivial feature change will likely touch UI screens directly.

## 16. File Map By Responsibility

Use this as a quick index when modifying the app.

### Navigation and app shell

- [app/_layout.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/app/_layout.tsx)
- [app/index.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/app/index.tsx)
- [app/(student)/_layout.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/app/(student)/_layout.tsx)
- [app/(teacher)/_layout.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/app/(teacher)/_layout.tsx)
- [app/(hod)/_layout.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/app/(hod)/_layout.tsx)

### Login and auth flows

- [app/(auth)/student-login.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/app/(auth)/student-login.tsx)
- [app/(auth)/teacher-login.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/app/(auth)/teacher-login.tsx)
- [app/(auth)/hod-login.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/app/(auth)/hod-login.tsx)
- [store/authStore.ts](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/store/authStore.ts)

### Student attendance flow

- [app/(student)/mark-attendance.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/app/(student)/mark-attendance.tsx)
- [components/FaceCamera.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/components/FaceCamera.tsx)
- [lib/faceApi.ts](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/lib/faceApi.ts)
- [lib/utils.ts](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/lib/utils.ts)

### Teacher classroom flow

- [app/(teacher)/session.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/app/(teacher)/session.tsx)
- [app/(teacher)/students.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/app/(teacher)/students.tsx)
- [app/(teacher)/filter.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/app/(teacher)/filter.tsx)
- [store/sessionStore.ts](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/store/sessionStore.ts)

### HOD admin flow

- [app/(hod)/manage-students.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/app/(hod)/manage-students.tsx)
- [app/(hod)/manage-teachers.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/app/(hod)/manage-teachers.tsx)
- [app/(hod)/dashboard.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/app/(hod)/dashboard.tsx)
- [app/(hod)/download-pdf.tsx](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/app/(hod)/download-pdf.tsx)

### Backend and storage integration

- [lib/supabase.ts](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/lib/supabase.ts)
- [supabase/schema.sql](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/supabase/schema.sql)

## 17. Setup Notes

### Required external services

- Supabase project
- Supabase Storage bucket named `face-photos`
- Face++ API credentials exposed as:
  - `EXPO_PUBLIC_FACEPP_API_KEY`
  - `EXPO_PUBLIC_FACEPP_API_SECRET`

### App configuration

See [app.json](C:/Users/welcome/projects/wifi-attendence/AttendanceApp/app.json) for:

- Expo app metadata
- camera plugin
- Android permissions
- iOS camera usage description

### Important platform assumptions

- camera access is required for students
- network information is required for subnet verification
- device testing is more meaningful than web testing because camera/network flows are central

## 18. How To Reason About Changes Safely

If you are an AI agent editing this project, keep these assumptions in mind:

- check both screen logic and types before changing DB fields
- verify whether a feature uses Face++ or the unused local face library before refactoring
- treat `app/_layout.tsx` as the source of truth for app-level side effects
- most business rules are in screens, so search route files before assuming a helper exists
- confirm real Supabase schema before writing migrations or column-dependent code
- be careful with teacher auth changes because it is not tied to Supabase Auth
- do not assume offline attendance actually works end to end yet

## 19. Recommended Next Improvements

The most valuable engineering improvements would be:

1. align `supabase/schema.sql` with the fields used in runtime code
2. move sensitive keys/config out of hardcoded source
3. finish offline attendance enqueue/retry flow in student marking
4. add a proper service layer for Supabase interactions
5. replace client-side teacher password verification with a safer auth model
6. remove or formally adopt `lib/faceAuth.ts`

## 20. Short Summary

This is a role-based Expo attendance app where:

- HOD manages users and reference photos
- teacher creates attendance sessions and supervises live marking
- student proves identity with device binding, face verification, PIN, and WiFi subnet

The project is functional, but there is schema drift, mixed authentication patterns, partial offline support, and some experimental face-auth code left in the repo. Any future work should start by respecting those realities instead of assuming a clean greenfield architecture.
