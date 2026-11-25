# Software Requirements Specification (SRS)
## Doctor Appointment Booking Platform — MVP

**Version:** 1.0
**Status:** Initial Requirements — Ready for Implementation Planning
**Product Type:** Web-based Doctor Appointment Booking System

---

# 1. Project Overview

## 1.1 Purpose

The system is a web-based platform that allows patients to discover doctors, book appointments, and manage existing bookings without creating an account.

The platform also provides dashboards for:
- Website Owner: managing clinics, doctors, specialties, and schedules.
- Clinic Receptionist: managing appointments and checking patients in.

## 1.2 Target Audience

The platform targets people living in one specific town or local area in Beheira, Egypt.

The primary users may have limited technical experience. Therefore, the interface must prioritize simplicity, clarity, and ease of use.

## 1.3 Product Goals

1. Make finding and booking a doctor straightforward.
2. Allow patients to manage bookings without registration.
3. Prevent double-booking of appointment slots.
4. Allow receptionists to identify bookings and check patients in.
5. Allow the website owner to manage clinics, doctors, and schedules.
6. Provide a mobile-first experience using simple Egyptian Arabic.

---

# 2. Project Scope

## 2.1 In Scope

- Patient-facing website.
- Medical specialty browsing.
- Doctor listings and profiles.
- Multiple clinics.
- Multiple doctors per clinic.
- One clinic per doctor.
- Appointment booking.
- Unique booking reference numbers.
- QR codes for bookings.
- Appointment lookup using reference number or phone number.
- Appointment rescheduling.
- Appointment cancellation.
- Receptionist dashboard.
- Owner dashboard.
- Doctor weekly schedules.
- Manually added appointments or available time slots.
- Schedule exceptions and days off.
- Appointment check-in.

## 2.2 Out of Scope

The following features are intentionally excluded from the MVP:

- Patient registration and accounts.
- Patient login.
- OTP verification.
- Online payments.
- Medical records and patient medical history.
- Video consultations.
- Prescriptions.
- Insurance integrations.
- SMS or WhatsApp notifications.
- Multi-region or multi-city selection.
- Doctor accounts and doctor dashboards.
- Multi-clinic assignment for one doctor.

---

# 3. User Roles

## 3.1 Patient

Patients do not need accounts.

They can:
- Browse medical specialties.
- Browse doctors.
- View doctor information.
- Book appointments.
- Receive a booking reference number.
- View an existing booking.
- Reschedule an appointment.
- Cancel an appointment.

## 3.2 Website Owner

The owner has administrative access to the entire platform.

They can:
- Add, edit, and deactivate clinics.
- Add, edit, and deactivate doctors.
- Assign doctors to specialties.
- Assign each doctor to one clinic.
- Configure consultation fees.
- Manage doctor schedules.
- Configure weekly working hours.
- Add manually scheduled availability.
- Configure schedule exceptions.
- View appointments across all clinics.

## 3.3 Clinic Receptionist

Receptionists have access limited to their assigned clinic.

They can:
- Log in to the receptionist dashboard.
- View their clinic's appointments.
- Search for bookings.
- Scan a booking QR code.
- Look up a booking using its reference number.
- View relevant booking information.
- Check patients in.
- View appointment statuses.

Receptionists cannot manage clinics, doctors, or platform-wide settings.

---

# 4. Functional Requirements

## 4.1 Homepage

The homepage must provide two primary actions.

### Action A: Book an Appointment

Arabic label: **احجز عند دكتور**

This starts the new appointment booking flow.

### Action B: Manage an Existing Appointment

Arabic label: **عندي حجز بالفعل**

This allows patients to:
- Find an existing booking.
- Reschedule the appointment.
- Cancel the appointment.

The homepage must be simple and must not overwhelm users with unnecessary information.

## 4.2 Medical Specialties

The system must display available medical specialties.

Examples:
- باطنة
- أسنان
- عيون
- عظام
- أنف وأذن وحنجرة
- نساء وتوليد
- مسالك بولية

The patient selects a specialty to see doctors belonging to it.

The website owner manages the specialties available on the platform.

## 4.3 Doctor Listing

After selecting a specialty, the system displays matching doctors.

Each doctor card must contain:

- Doctor's photograph.
- Doctor's full name.
- Medical specialty.
- Short description or professional biography.
- Clinic name.
- Clinic address.
- Consultation fee.
- A clear booking button.

The description should be brief and easy to understand.

The doctor list must not display appointment schedules directly unless needed. The patient can see available appointments after selecting a doctor.

## 4.4 Doctor Profile

The doctor profile should provide:

- Full name.
- Photograph.
- Specialty.
- Short biography.
- Qualifications and experience, when available.
- Clinic information.
- Clinic address.
- Consultation fee.
- Working schedule.
- Available appointment slots.

Each doctor belongs to exactly one clinic.

A clinic can have multiple doctors.

## 4.5 Appointment Booking

The booking process must follow this sequence:

1. Patient selects "احجز عند دكتور".
2. Patient selects a medical specialty.
3. System displays doctors belonging to that specialty.
4. Patient selects a doctor.
5. System displays the doctor's available dates.
6. Patient selects a date.
7. System displays available time slots.
8. Patient selects a time slot.
9. Patient enters their name and phone number.
10. Patient confirms the booking.
11. System creates the booking and generates a unique reference number.
12. System displays the booking confirmation.

Patient information required:
- Full name.
- Phone number.

No patient account is required.

### Booking Confirmation

The confirmation page must display:
- Booking reference number.
- QR code.
- Patient name.
- Doctor name.
- Specialty.
- Clinic name.
- Appointment date.
- Appointment time.
- Clinic address.

The patient should be encouraged to save or take a screenshot of the confirmation.

## 4.6 Booking Reference Number

Every booking must have a unique reference number.

Example format:

`DR-8K29P4`

Requirements:
- Every booking receives a unique reference number.
- The reference number must not be reused.
- The reference number must be associated with exactly one booking.
- The QR code must identify the booking through a secure, non-guessable identifier or token.
- The receptionist must be able to search using the reference number.

## 4.7 Manage Existing Appointment

The patient can access an existing booking using either:

1. Booking Reference Number.
2. Phone Number used during booking.

If the phone number has multiple bookings, the system displays the matching bookings so the patient can select the intended appointment.

After finding a booking, the patient can:
- View booking details.
- Reschedule the appointment.
- Cancel the appointment.

The interface must use simple Egyptian Arabic.

### Rescheduling

1. Patient finds their booking.
2. Patient selects "غيّر معادك".
3. System displays available dates.
4. Patient selects a new date.
5. System displays available time slots.
6. Patient selects a new time.
7. System updates the existing booking.
8. The old slot becomes available.
9. The new slot becomes unavailable.
10. The patient sees the updated booking details.

Rescheduling must not create an unnecessary duplicate booking.

### Cancellation

1. Patient finds their booking.
2. Patient selects "إلغاء الحجز".
3. System displays a confirmation message.
4. Patient confirms cancellation.
5. System changes the booking status to `CANCELLED`.
6. The previously reserved slot becomes available again.

Suggested confirmation message:

"متأكد إنك عايز تلغي الحجز؟"

## 4.8 Doctor Scheduling

The platform must support two scheduling methods.

### A. Weekly Fixed Schedule

The owner configures recurring working hours for each doctor.

Example:

| Day | Working Hours |
|---|---|
| Saturday | 4 PM – 8 PM |
| Sunday | Off |
| Monday | 4 PM – 8 PM |
| Tuesday | Off |
| Wednesday | 5 PM – 9 PM |
| Thursday | 4 PM – 8 PM |
| Friday | Off |

The system generates available appointment slots based on:
- Working days.
- Working hours.
- Appointment duration.
- Existing bookings.

### B. Manual Scheduling

The owner can manually add availability for specific dates.

Examples:
- Add an extra working day.
- Add additional working hours.
- Configure a one-time schedule.

### C. Schedule Exceptions

The owner can:
- Close a specific day.
- Modify working hours for a specific date.
- Add an exceptional working period.
- Prevent new bookings during unavailable periods.

Schedule exceptions must take precedence over the normal weekly schedule for the affected date.

## 4.9 Availability Management

The backend must calculate appointment availability.

The frontend must never be the source of truth for available slots.

A slot is unavailable if:
- It has already been booked.
- The doctor is not working during that period.
- The date is marked as unavailable.
- The slot overlaps another active booking.

The calendar should distinguish:

- `AVAILABLE`: At least one slot is available.
- `FULL`: The doctor works that day, but no slots remain.
- `OFF`: The doctor does not work that day.

When a booking is cancelled, the slot becomes available again.

When a booking is rescheduled, the old slot must be released and the new slot reserved safely.

### Double-Booking Prevention

The system must prevent two patients from booking the same doctor at overlapping times.

This must be enforced by the backend and database, not just by hiding the slot in the frontend.

Booking and rescheduling operations must be transactional.

If another patient books the slot first, the second request must fail gracefully and receive an updated availability response.

## 4.10 Receptionist Dashboard

The receptionist dashboard must require authentication.

The receptionist can:

- View appointments for their assigned clinic.
- View today's appointments.
- Search by booking reference number.
- Scan booking QR codes.
- View patient name and phone number.
- View doctor and appointment information.
- Check in a patient.
- View booking status.

### Check-in Process

1. Patient arrives at the clinic.
2. Patient provides the booking reference number or QR code.
3. Receptionist searches or scans it.
4. System retrieves the booking.
5. Receptionist verifies the booking information.
6. Receptionist clicks "تسجيل وصول المريض".
7. Booking status changes to `CHECKED_IN`.

The receptionist must not be able to check in a cancelled booking.

## 4.11 Owner Dashboard

The owner dashboard must provide basic management functionality.

### Clinic Management

- Add clinic.
- Edit clinic.
- Deactivate clinic.
- Manage clinic name and address.
- Assign receptionist accounts.

### Doctor Management

- Add doctor.
- Edit doctor information.
- Upload doctor photograph.
- Assign specialty.
- Assign clinic.
- Set consultation fee.
- Set short biography.
- Activate or deactivate doctor.

### Schedule Management

- Configure weekly schedules.
- Add manual availability.
- Edit working hours.
- Configure schedule exceptions.
- Close specific dates.

The owner should be able to manage these operations through the interface without directly modifying the database.

---

# 5. Appointment Statuses

The system must support the following statuses:

| Status | Description |
|---|---|
| `CONFIRMED` | Appointment successfully booked and slot reserved |
| `CHECKED_IN` | Patient arrived and receptionist registered attendance |
| `COMPLETED` | Consultation completed |
| `CANCELLED` | Appointment cancelled |
| `NO_SHOW` | Patient did not arrive |

A booking is considered confirmed immediately after successful booking.

Receptionist confirmation is not required to reserve the appointment.

---

# 6. User Interface and User Experience Requirements

## 6.1 Language

The patient-facing website must use simple Egyptian colloquial Arabic.

Examples:

| Technical/Formal Label | Patient-Facing Arabic |
|---|---|
| Book Appointment | احجز عند دكتور |
| Select Specialty | اختار التخصص |
| Internal Medicine | باطنة |
| Dentistry | أسنان |
| Available Appointments | المواعيد المتاحة |
| Manage Booking | عندي حجز بالفعل |
| Reschedule | غيّر معادك |
| Cancel Appointment | إلغاء الحجز |
| Booking Reference | رقم الحجز |
| Confirm Booking | أكّد الحجز |
| Clinic Address | عنوان العيادة |

Avoid unnecessarily formal Arabic and technical terminology.

## 6.2 Layout

- Mobile-first responsive design.
- Right-to-left layout.
- Large and readable typography.
- Clear buttons with descriptive labels.
- Simple navigation.
- Minimal steps per operation.
- Avoid unnecessary forms and fields.
- Clear feedback after every important action.

## 6.3 Accessibility and Usability

The website should:
- Work on common mobile screen sizes.
- Use sufficient text contrast.
- Make important buttons easy to identify.
- Avoid relying on color alone to communicate status.
- Display understandable error messages.
- Support users with limited technical experience.

---

# 7. Non-Functional Requirements

## 7.1 Performance

- Main pages should load efficiently on typical mobile internet connections.
- Availability queries should return promptly.
- Doctor images should be optimized.
- Avoid unnecessary frontend dependencies.

## 7.2 Reliability

- A successful booking must be stored persistently.
- Booking reference numbers must be unique.
- Failed bookings must not reserve slots.
- Rescheduling must not leave a booking without a valid slot.
- Concurrent booking attempts must not create duplicate reservations.

## 7.3 Authentication and Security

### Admin Authentication

The system must provide a simple email-and-password login for administrative users.

- Owner and Receptionist users sign in using their email address and password.
- No OTP or phone verification is required.
- No public registration is available.
- Administrative accounts are created by the website owner.
- Passwords must be securely hashed before storage.
- Users can log out of their accounts.

### Authorization

The system must enforce role-based access control.

**Owner:**
- Full access to platform administration.
- Manage clinics, doctors, specialties, schedules, and receptionist accounts.
- View appointments across all clinics.

**Receptionist:**
- Access only their assigned clinic.
- View and manage appointments belonging to that clinic.
- Check patients in.
- Cannot access owner-only management features or other clinics' data.

Authorization must be enforced by the backend, not only by frontend UI restrictions.

### Session Security

- Use secure authenticated sessions.
- Protect administrative routes and API endpoints.
- Apply basic login rate limiting.
- Invalidate sessions on logout.

---

# 8. Proposed Data Model

The following is a recommended starting point, not a final database design.

## Clinic

- `id`
- `name`
- `address`
- `phone`
- `is_active`
- `created_at`

## Specialty

- `id`
- `name`
- `description`
- `is_active`

## Doctor

- `id`
- `clinic_id`
- `specialty_id`
- `full_name`
- `photo_url`
- `bio`
- `qualifications`
- `experience_years`
- `consultation_fee`
- `slot_duration_minutes`
- `is_active`
- `created_at`

Each doctor belongs to one clinic and one primary specialty in the initial implementation.

## WeeklySchedule

- `id`
- `doctor_id`
- `day_of_week`
- `start_time`
- `end_time`
- `is_active`

## ScheduleException

- `id`
- `doctor_id`
- `date`
- `exception_type`
- `start_time`
- `end_time`
- `reason`

The exception type should distinguish unavailable dates from additional or modified working hours.

## ManualAvailability

- `id`
- `doctor_id`
- `date`
- `start_time`
- `end_time`

## Appointment

- `id`
- `reference_number`
- `qr_token`
- `doctor_id`
- `clinic_id`
- `patient_name`
- `patient_phone`
- `appointment_date`
- `start_time`
- `end_time`
- `status`
- `created_at`
- `updated_at`

## AdminUser

- `id`
- `name`
- `email`
- `password_hash`
- `role`
- `clinic_id` (nullable for owner)
- `is_active`

---

# 9. Proposed API Structure

The following endpoints are an implementation proposal.

## Public Endpoints

### Specialties
- `GET /api/specialties`

### Doctors
- `GET /api/doctors?specialtyId=...`
- `GET /api/doctors/:id`

### Availability
- `GET /api/doctors/:id/availability?date=...`
- `GET /api/doctors/:id/available-dates?month=...`

### Booking
- `POST /api/appointments`
- `GET /api/appointments/lookup?reference=...`
- `GET /api/appointments/lookup?phone=...`
- `PATCH /api/appointments/:id/reschedule`
- `PATCH /api/appointments/:id/cancel`

## Receptionist Endpoints

- `POST /api/admin/login`
- `GET /api/receptionist/appointments`
- `GET /api/receptionist/appointments/:reference`
- `POST /api/receptionist/appointments/:reference/check-in`

## Owner Endpoints

- `POST /api/owner/clinics`
- `PATCH /api/owner/clinics/:id`
- `POST /api/owner/doctors`
- `PATCH /api/owner/doctors/:id`
- `POST /api/owner/doctors/:id/weekly-schedule`
- `POST /api/owner/doctors/:id/manual-availability`
- `POST /api/owner/doctors/:id/schedule-exceptions`

All administrative endpoints must enforce role-based authorization.

---

# 10. Acceptance Criteria

The MVP is considered functionally ready for demonstration when the following scenarios pass.

## Scenario 1: Successful Booking

Given a doctor has available appointment slots,

When a patient selects a slot and submits valid information,

Then the system creates a confirmed booking and generates a unique reference number.

## Scenario 2: Prevent Double Booking

Given a doctor has one available slot,

When two patients attempt to book the same slot,

Then only one booking succeeds.

## Scenario 3: Phone Number Lookup

Given a patient has multiple bookings using the same phone number,

When the patient searches using that number,

Then all matching bookings are displayed.

## Scenario 4: Reference Number Lookup

Given a valid booking reference number,

When the patient enters it,

Then the correct booking is displayed.

## Scenario 5: Rescheduling

Given a patient has a confirmed appointment,

When they select another available slot,

Then the new slot is reserved and the previous slot becomes available.

## Scenario 6: Cancellation

Given a patient has a confirmed appointment,

When they confirm cancellation,

Then the booking becomes `CANCELLED` and its slot becomes available.

## Scenario 7: Receptionist Check-in

Given a confirmed appointment,

When the receptionist retrieves it and checks in the patient,

Then the status changes to `CHECKED_IN`.

## Scenario 8: Clinic Isolation

Given two clinics exist,

When a receptionist assigned to one clinic logs in,

Then they can only access appointments belonging to their assigned clinic.

## Scenario 9: Schedule Management

Given a doctor has a weekly schedule,

When the owner adds an exception for a particular date,

Then availability for that date reflects the exception.

## Scenario 10: Inactive Doctor

Given a doctor is deactivated,

Then patients cannot create new bookings with that doctor, while historical appointments remain accessible to authorized staff.

---

# 11. Suggested Implementation Order

Implement the project incrementally.

1. Project setup and database configuration.
2. Database schema and initial seed data.
3. Specialty and doctor management.
4. Clinic management.
5. Weekly schedule and manual availability.
6. Backend availability calculation.
7. Appointment booking and double-booking prevention.
8. Booking reference number and QR generation.
9. Patient booking lookup.
10. Rescheduling and cancellation.
11. Owner dashboard.
12. Receptionist dashboard.
13. QR scanning and check-in.
14. Arabic RTL interface and responsive design.
15. End-to-end testing.

---

# 12. Initial Demo Dataset

The initial prototype should include realistic sample data:

- More than five doctors.
- Multiple clinics.
- Several medical specialties.
- Different consultation fees.
- Different weekly schedules.
- Manual availability for selected dates.
- Schedule exceptions.
- Sample patient bookings in different statuses.
- At least one owner account.
- At least one receptionist account per demo clinic.

All demo data should be clearly identified as fictional.

---

# 13. Final MVP Definition

The MVP is a simple, mobile-first doctor appointment booking platform for one specific local area.

Patients can browse specialties, find doctors, book appointments, receive reference numbers, and manage their bookings without creating accounts.

The website owner manages clinics, doctors, and schedules.

Receptionists manage their clinic's bookings and register patient arrivals.

The system prioritizes simplicity, reliable appointment availability, and an Egyptian Arabic user experience.

**The primary objective is to validate the booking experience and operational workflow before expanding the product.**
