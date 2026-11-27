import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  handleCancelPatch,
  handleLookupGet,
  handleReschedulePatch,
} from "@/app/api/appointments/_shared";
import { dayOfWeek, type CairoNow } from "@/lib/cairo-time";
import { generateBookingQrDataUrl } from "@/lib/qr";
import { parseCreateAppointmentInput } from "@/lib/validations/appointments";
import {
  getDoctorAvailability,
  listDoctorAvailableDates,
} from "@/services/availability";
import { BookingServiceError, createAppointment } from "@/services/appointments";
import { getPublicDoctorById, listDoctorsBySpecialty } from "@/services/doctors";
import { listOwnerAppointments } from "@/services/owner-appointments";
import { updateOwnerDoctor } from "@/services/owner-doctors";
import {
  createManualAvailability,
  createScheduleException,
} from "@/services/owner-schedules";
import {
  checkInReceptionistAppointment,
  createReceptionistAppointmentsGetHandler,
  getReceptionistAppointmentByQrToken,
  getReceptionistAppointmentByReference,
  listReceptionistAppointments,
  ReceptionistServiceError,
} from "@/services/receptionist-appointments";
import { listActiveSpecialties } from "@/services/specialties";
import type { StaffProfile } from "@/types/auth";
import type {
  Appointment,
  AppointmentStatus,
  Clinic,
  Database,
  Doctor,
  ManualAvailability,
  ScheduleException,
  Specialty,
  WeeklySchedule,
} from "@/types/database";

const CLINIC_1_ID = "11000000-0000-0000-0000-000000000001";
const CLINIC_2_ID = "11000000-0000-0000-0000-000000000002";
const SPECIALTY_ID = "22000000-0000-0000-0000-000000000001";
const DOCTOR_1_ID = "33000000-0000-0000-0000-000000000001";
const DOCTOR_2_ID = "33000000-0000-0000-0000-000000000002";

const DATE_SUNDAY_1 = "2099-05-03";
const DATE_MONDAY = "2099-05-04";
const DATE_TUESDAY = "2099-05-05";
const DATE_SUNDAY_2 = "2099-05-10";

const SUNDAY = dayOfWeek(DATE_SUNDAY_1);
const MONDAY = dayOfWeek(DATE_MONDAY);

const NOW_BEFORE_2099: CairoNow = { date: "2099-05-01", time: "08:00" };

const RECEPTIONIST_1: StaffProfile = {
  id: "99000000-0000-0000-0000-000000000001",
  name: "هدى سامي",
  email: "reception1@example.com",
  role: "RECEPTIONIST",
  clinicId: CLINIC_1_ID,
  clinicName: "عيادة النيل التخصصية",
  isActive: true,
};

const RECEPTIONIST_2: StaffProfile = {
  id: "99000000-0000-0000-0000-000000000002",
  name: "محمود طارق",
  email: "reception2@example.com",
  role: "RECEPTIONIST",
  clinicId: CLINIC_2_ID,
  clinicName: "عيادة الدلتا الطبية",
  isActive: true,
};

type StoreTables = {
  clinics: Clinic[];
  specialties: Specialty[];
  doctors: Doctor[];
  weekly_schedules: WeeklySchedule[];
  manual_availability: ManualAvailability[];
  schedule_exceptions: ScheduleException[];
  appointments: Appointment[];
};

type TableName = keyof StoreTables;
type AnyRow = Record<string, unknown>;

function normalizeTime(value: string): string {
  const parts = value.trim().split(":");
  return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}:${(parts[2] ?? "00").padStart(2, "0")}`;
}

function toMinutes(value: string): number {
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
}

function projectRow(row: AnyRow, columns: string | null): AnyRow {
  if (!columns || columns.trim() === "*") {
    return { ...row };
  }
  const cols = columns
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  const out: AnyRow = {};
  for (const col of cols) {
    out[col] = row[col];
  }
  return out;
}

function createSimulator(initial?: { now?: CairoNow }) {
  const clockNow = initial?.now ?? NOW_BEFORE_2099;
  const store: StoreTables = {
    clinics: [
      {
        id: CLINIC_1_ID,
        name: "عيادة النيل التخصصية",
        address: "شارع الجمهورية، دمنهور، البحيرة",
        phone: "0453311223",
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      {
        id: CLINIC_2_ID,
        name: "عيادة الدلتا الطبية",
        address: "شارع بورسعيد، كفر الدوار، البحيرة",
        phone: "0452244556",
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ],
    specialties: [
      {
        id: SPECIALTY_ID,
        name: "باطنة",
        description: "تشخيص ومتابعة أمراض الباطنة والسكر",
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ],
    doctors: [
      {
        id: DOCTOR_1_ID,
        clinic_id: CLINIC_1_ID,
        specialty_id: SPECIALTY_ID,
        full_name: "د. أحمد مصطفى",
        photo_url: null,
        bio: "استشاري أمراض الباطنة والسكر",
        qualifications: "دكتوراه الباطنة العامة",
        experience_years: 12,
        consultation_fee: "200.00",
        slot_duration_minutes: 30,
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      {
        id: DOCTOR_2_ID,
        clinic_id: CLINIC_2_ID,
        specialty_id: SPECIALTY_ID,
        full_name: "د. منى عبد الرحمن",
        photo_url: null,
        bio: "أخصائية الباطنة والجهاز الهضمي",
        qualifications: "ماجستير الباطنة العامة",
        experience_years: 8,
        consultation_fee: "180.00",
        slot_duration_minutes: 30,
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ],
    weekly_schedules: [
      {
        id: "55000000-0000-0000-0000-000000000001",
        doctor_id: DOCTOR_1_ID,
        day_of_week: SUNDAY,
        start_time: "09:00:00",
        end_time: "10:00:00",
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "55000000-0000-0000-0000-000000000002",
        doctor_id: DOCTOR_1_ID,
        day_of_week: MONDAY,
        start_time: "14:00:00",
        end_time: "15:00:00",
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "55000000-0000-0000-0000-000000000003",
        doctor_id: DOCTOR_2_ID,
        day_of_week: SUNDAY,
        start_time: "11:00:00",
        end_time: "12:00:00",
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
      },
    ],
    manual_availability: [],
    schedule_exceptions: [],
    appointments: [],
  };

  function getActiveCatalogDoctor(doctorId: string) {
    const doctor = store.doctors.find((d) => d.id === doctorId && d.is_active);
    if (!doctor) {
      return null;
    }
    const clinic = store.clinics.find(
      (c) => c.id === doctor.clinic_id && c.is_active,
    );
    const specialty = store.specialties.find(
      (s) => s.id === doctor.specialty_id && s.is_active,
    );
    if (!clinic || !specialty) {
      return null;
    }
    return doctor;
  }

  function hasOverlappingActiveAppointment(
    doctorId: string,
    date: string,
    startTime: string,
    endTime: string,
    ignoreId?: string,
  ): boolean {
    const startMin = toMinutes(startTime);
    const endMin = toMinutes(endTime);
    return store.appointments.some((appt) => {
      if (appt.doctor_id !== doctorId) return false;
      if (appt.appointment_date !== date) return false;
      if (appt.status !== "CONFIRMED" && appt.status !== "CHECKED_IN") {
        return false;
      }
      if (ignoreId && appt.id === ignoreId) return false;
      const apptStart = toMinutes(appt.start_time);
      const apptEnd = toMinutes(appt.end_time);
      return apptStart < endMin && apptEnd > startMin;
    });
  }

  function isSlotAvailableRpc(
    doctorId: string,
    date: string,
    startTime: string,
    endTime: string,
    slotDurationMinutes: number,
    ignoreId?: string,
  ): boolean {
    if (!getActiveCatalogDoctor(doctorId)) {
      return false;
    }
    if (
      date < clockNow.date ||
      (date === clockNow.date && startTime.slice(0, 5) <= clockNow.time)
    ) {
      return false;
    }

    const startMin = toMinutes(startTime);
    const endMin = toMinutes(endTime);
    if (endMin <= startMin) {
      return false;
    }

    const exceptions = store.schedule_exceptions.filter(
      (ex) => ex.doctor_id === doctorId && ex.exception_date === date,
    );
    const windows: Array<{ start: string; end: string }> = [];
    if (exceptions.length > 0) {
      for (const ex of exceptions) {
        if (ex.exception_type !== "CLOSED" && ex.start_time && ex.end_time) {
          windows.push({ start: ex.start_time, end: ex.end_time });
        }
      }
    } else {
      const targetDow = dayOfWeek(date);
      for (const w of store.weekly_schedules) {
        if (
          w.doctor_id === doctorId &&
          w.is_active &&
          w.day_of_week === targetDow
        ) {
          windows.push({ start: w.start_time, end: w.end_time });
        }
      }
    }

    for (const m of store.manual_availability) {
      if (m.doctor_id === doctorId && m.availability_date === date) {
        windows.push({ start: m.start_time, end: m.end_time });
      }
    }

    const fitsWindow = windows.some((w) => {
      const wStart = toMinutes(w.start);
      const wEnd = toMinutes(w.end);
      return (
        wStart <= startMin &&
        wEnd >= endMin &&
        (startMin - wStart) % slotDurationMinutes === 0
      );
    });

    if (!fitsWindow) {
      return false;
    }

    return !hasOverlappingActiveAppointment(
      doctorId,
      date,
      startTime,
      endTime,
      ignoreId,
    );
  }

  const client = {
    from(table: TableName) {
      let operation: "select" | "insert" | "update" | "delete" = "select";
      let selectedColumns: string | null = null;
      let insertPayloads: AnyRow[] = [];
      let updatePayload: AnyRow = {};
      const filters: Array<(row: AnyRow) => boolean> = [];
      const orders: Array<{ column: string; ascending: boolean }> = [];
      let rowLimit: number | null = null;

      const queryRows = (rows: AnyRow[]) => {
        let matched = rows.filter((row) => filters.every((fn) => fn(row)));
        if (orders.length > 0) {
          matched = [...matched].sort((a, b) => {
            for (const o of orders) {
              const av = a[o.column];
              const bv = b[o.column];
              const cmp =
                typeof av === "number" && typeof bv === "number"
                  ? av - bv
                  : String(av ?? "").localeCompare(String(bv ?? ""));
              if (cmp !== 0) {
                return o.ascending ? cmp : -cmp;
              }
            }
            return 0;
          });
        }
        if (rowLimit !== null) {
          matched = matched.slice(0, rowLimit);
        }
        return matched;
      };

      const execute = () => {
        const rows = store[table] as unknown as AnyRow[];
        const nowIso = new Date().toISOString();

        if (operation === "insert") {
          const inserted: AnyRow[] = [];
          for (const raw of insertPayloads) {
            const row: AnyRow = {
              id:
                typeof raw.id === "string" && raw.id.length > 0
                  ? raw.id
                  : crypto.randomUUID(),
              ...raw,
              created_at: nowIso,
            };
            if (table === "doctors" || table === "clinics" || table === "specialties") {
              row.updated_at = nowIso;
            }
            if (table === "weekly_schedules" && row.is_active === undefined) {
              row.is_active = true;
            }
            rows.push(row);
            inserted.push(projectRow(row, selectedColumns));
          }
          return { data: inserted, error: null };
        }

        if (operation === "update") {
          const matched = queryRows(rows);
          const updated: AnyRow[] = [];
          for (const row of matched) {
            Object.assign(row, updatePayload, { updated_at: nowIso });
            updated.push(projectRow(row, selectedColumns));
          }
          return { data: updated, error: null };
        }

        if (operation === "delete") {
          const matchedSet = new Set(queryRows(rows));
          const deleted: AnyRow[] = [];
          for (let i = rows.length - 1; i >= 0; i -= 1) {
            if (matchedSet.has(rows[i])) {
              deleted.unshift(projectRow(rows[i], selectedColumns));
              rows.splice(i, 1);
            }
          }
          return { data: deleted, error: null };
        }

        return {
          data: queryRows(rows).map((row) => projectRow(row, selectedColumns)),
          error: null,
        };
      };

      const builder: Record<string, unknown> = {
        select(columns?: string) {
          selectedColumns = columns ?? "*";
          return builder;
        },
        insert(payload: AnyRow | AnyRow[]) {
          operation = "insert";
          insertPayloads = Array.isArray(payload) ? payload : [payload];
          return builder;
        },
        update(payload: AnyRow) {
          operation = "update";
          updatePayload = payload;
          return builder;
        },
        delete() {
          operation = "delete";
          return builder;
        },
        eq(column: string, value: unknown) {
          filters.push((row) => row[column] === value);
          return builder;
        },
        in(column: string, values: unknown[]) {
          filters.push((row) => values.includes(row[column]));
          return builder;
        },
        gte(column: string, value: unknown) {
          filters.push((row) => String(row[column]) >= String(value));
          return builder;
        },
        lte(column: string, value: unknown) {
          filters.push((row) => String(row[column]) <= String(value));
          return builder;
        },
        order(column: string, options?: { ascending?: boolean }) {
          orders.push({ column, ascending: options?.ascending ?? true });
          return builder;
        },
        limit(count: number) {
          rowLimit = count;
          return builder;
        },
        async single() {
          const res = execute();
          const list = Array.isArray(res.data) ? res.data : [];
          if (list.length !== 1) {
            return {
              data: null,
              error: { code: "PGRST116", message: "Expected a single row" },
            };
          }
          return { data: list[0], error: null };
        },
        async maybeSingle() {
          const res = execute();
          const list = Array.isArray(res.data) ? res.data : [];
          return { data: list[0] ?? null, error: null };
        },
        then(
          onFulfilled: (value: unknown) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) {
          return Promise.resolve(execute()).then(onFulfilled, onRejected);
        },
      };

      return builder;
    },

    async rpc(fnName: string, args: Record<string, unknown>) {
      if (fnName === "create_appointment") {
        const doctorId = String(args.p_doctor_id);
        const date = String(args.p_date);
        const start = normalizeTime(String(args.p_start));
        const name = String(args.p_patient_name).trim();
        const phone = String(args.p_patient_phone).trim();

        const doctor = getActiveCatalogDoctor(doctorId);
        if (!doctor) {
          return {
            data: null,
            error: { message: "Doctor is not available for booking" },
          };
        }

        const end = minutesToTime(toMinutes(start) + doctor.slot_duration_minutes);
        if (hasOverlappingActiveAppointment(doctorId, date, start, end)) {
          return {
            data: null,
            error: {
              code: "23P01",
              message:
                'conflicting key value violates exclusion constraint "appointments_no_active_overlap"',
            },
          };
        }

        if (
          !isSlotAvailableRpc(
            doctorId,
            date,
            start,
            end,
            doctor.slot_duration_minutes,
          )
        ) {
          return { data: null, error: { message: "Slot is not available" } };
        }

        let reference = "";
        do {
          reference = `DR-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
        } while (
          store.appointments.some((a) => a.reference_number === reference)
        );

        const nowIso = new Date().toISOString();
        const created: Appointment = {
          id: crypto.randomUUID(),
          reference_number: reference,
          qr_token: crypto.randomBytes(24).toString("hex"),
          doctor_id: doctorId,
          clinic_id: doctor.clinic_id,
          patient_name: name,
          patient_phone: phone,
          appointment_date: date,
          start_time: start,
          end_time: end,
          status: "CONFIRMED" as AppointmentStatus,
          created_at: nowIso,
          updated_at: nowIso,
        };
        store.appointments.push(created);
        return { data: { ...created }, error: null };
      }

      if (fnName === "reschedule_appointment") {
        const appointmentId = String(args.p_appointment_id);
        const date = String(args.p_date);
        const start = normalizeTime(String(args.p_start));
        const ref = String(args.p_reference_number).trim().toUpperCase();
        const phone = String(args.p_patient_phone).trim();

        const existing = store.appointments.find(
          (a) =>
            a.id === appointmentId &&
            a.reference_number === ref &&
            a.patient_phone === phone,
        );
        if (!existing) {
          return { data: null, error: { message: "Booking not found" } };
        }
        if (existing.status !== "CONFIRMED") {
          return {
            data: null,
            error: { message: "Booking cannot be rescheduled" },
          };
        }
        const doctor = getActiveCatalogDoctor(existing.doctor_id);
        if (!doctor) {
          return {
            data: null,
            error: { message: "Doctor is not available for booking" },
          };
        }
        const end = minutesToTime(toMinutes(start) + doctor.slot_duration_minutes);
        if (
          !isSlotAvailableRpc(
            existing.doctor_id,
            date,
            start,
            end,
            doctor.slot_duration_minutes,
            existing.id,
          )
        ) {
          return { data: null, error: { message: "Slot is not available" } };
        }

        existing.appointment_date = date;
        existing.start_time = start;
        existing.end_time = end;
        existing.updated_at = new Date().toISOString();
        return { data: { ...existing }, error: null };
      }

      if (fnName === "cancel_appointment") {
        const appointmentId = String(args.p_appointment_id);
        const ref = String(args.p_reference_number).trim().toUpperCase();
        const phone = String(args.p_patient_phone).trim();

        const existing = store.appointments.find(
          (a) =>
            a.id === appointmentId &&
            a.reference_number === ref &&
            a.patient_phone === phone,
        );
        if (!existing) {
          return { data: null, error: { message: "Booking not found" } };
        }
        if (existing.status !== "CONFIRMED") {
          return {
            data: null,
            error: { message: "Booking cannot be cancelled" },
          };
        }
        existing.status = "CANCELLED";
        existing.updated_at = new Date().toISOString();
        return { data: { ...existing }, error: null };
      }

      return { data: null, error: { message: `Unknown RPC: ${fnName}` } };
    },
  };

  return {
    store,
    client: client as unknown as SupabaseClient<Database>,
  };
}

describe("SRS §10 End-to-End MVP Acceptance Scenarios", () => {
  it("Scenario 1: Guest booking creates CONFIRMED appointment with unique reference & scannable QR and removes slot", async () => {
    const { store, client } = createSimulator();

    const specialties = await listActiveSpecialties(client);
    assert.equal(specialties.length, 1);

    const doctors = await listDoctorsBySpecialty(client, specialties[0]);
    assert.equal(doctors.length, 2);

    const before = await getDoctorAvailability(
      client,
      DOCTOR_1_ID,
      DATE_SUNDAY_1,
      NOW_BEFORE_2099,
    );
    assert.deepEqual(before?.slots, [
      { start: "09:00", end: "09:30" },
      { start: "09:30", end: "10:00" },
    ]);

    const parsed = parseCreateAppointmentInput({
      doctorId: DOCTOR_1_ID,
      appointmentDate: DATE_SUNDAY_1,
      startTime: "09:00",
      patientName: "محمود علي حسن",
      patientPhone: "٠١٠١٢٣٤٥٦٧٨",
    });
    assert.equal(parsed.success, true);
    if (!parsed.success) throw new Error("Expected valid input");

    const firstBooking = await createAppointment(client, parsed.data, {
      now: NOW_BEFORE_2099,
      generateQr: generateBookingQrDataUrl,
    });
    assert.equal(firstBooking.status, "CONFIRMED");
    assert.match(firstBooking.referenceNumber, /^DR-[A-Z0-9]{6}$/);
    assert.equal(firstBooking.patientPhone, "01012345678");
    assert.ok(firstBooking.qrCodeDataUrl.startsWith("data:image/png;base64,"));
    assert.equal("qr_token" in firstBooking, false);

    const afterFirst = await getDoctorAvailability(
      client,
      DOCTOR_1_ID,
      DATE_SUNDAY_1,
      NOW_BEFORE_2099,
    );
    assert.deepEqual(afterFirst?.slots, [{ start: "09:30", end: "10:00" }]);

    const secondBooking = await createAppointment(
      client,
      { ...parsed.data, startTime: "09:30", patientName: "إيمان عادل" },
      { now: NOW_BEFORE_2099, generateQr: generateBookingQrDataUrl },
    );
    assert.notEqual(secondBooking.referenceNumber, firstBooking.referenceNumber);
    assert.equal(store.appointments.length, 2);
  });

  it("Scenario 2: Concurrent double-booking allows only one winner and returns 409 SLOT_UNAVAILABLE with updated availability", async () => {
    const { store, client } = createSimulator();

    // Reserve 09:00 first so 09:30 is the last remaining slot on DATE_SUNDAY_1.
    await createAppointment(
      client,
      {
        doctorId: DOCTOR_1_ID,
        appointmentDate: DATE_SUNDAY_1,
        startTime: "09:00",
        patientName: "مريض أول",
        patientPhone: "01000000001",
      },
      { now: NOW_BEFORE_2099 },
    );

    const results = await Promise.allSettled([
      createAppointment(
        client,
        {
          doctorId: DOCTOR_1_ID,
          appointmentDate: DATE_SUNDAY_1,
          startTime: "09:30",
          patientName: "متسابق أول",
          patientPhone: "01000000002",
        },
        { now: NOW_BEFORE_2099 },
      ),
      createAppointment(
        client,
        {
          doctorId: DOCTOR_1_ID,
          appointmentDate: DATE_SUNDAY_1,
          startTime: "09:30",
          patientName: "متسابق تاني",
          patientPhone: "01000000003",
        },
        { now: NOW_BEFORE_2099 },
      ),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.equal(store.appointments.length, 2);

    const err = rejected[0].reason;
    assert.ok(err instanceof BookingServiceError);
    assert.equal(err.status, 409);
    assert.equal(err.code, "SLOT_UNAVAILABLE");
    assert.equal(err.availability?.date, DATE_SUNDAY_1);
    assert.equal(err.availability?.state, "FULL");
    assert.deepEqual(err.availability?.slots, []);
  });

  it("Scenarios 3 & 4: Lookup by phone (multiple bookings) and by reference number", async () => {
    const { client } = createSimulator();

    const bookingA = await createAppointment(
      client,
      {
        doctorId: DOCTOR_1_ID,
        appointmentDate: DATE_MONDAY,
        startTime: "14:00",
        patientName: "نادية فتحي",
        patientPhone: "01099887766",
      },
      { now: NOW_BEFORE_2099 },
    );
    const bookingB = await createAppointment(
      client,
      {
        doctorId: DOCTOR_2_ID,
        appointmentDate: DATE_SUNDAY_1,
        startTime: "11:00",
        patientName: "نادية فتحي",
        patientPhone: "01099887766",
      },
      { now: NOW_BEFORE_2099 },
    );

    const phoneRes = await handleLookupGet(
      new Request(
        "http://localhost/api/appointments/lookup?phone=٠١٠٩٩٨٨٧٧٦٦",
      ),
      () => client,
    );
    assert.equal(phoneRes.status, 200);
    assert.equal(phoneRes.headers.get("Cache-Control"), "no-store");
    const phoneJson = (await phoneRes.json()) as {
      bookings: Array<{ id: string; referenceNumber: string }>;
    };
    assert.equal(phoneJson.bookings.length, 2);
    assert.equal(phoneJson.bookings[0].id, bookingB.id);
    assert.equal(phoneJson.bookings[1].id, bookingA.id);

    const refRes = await handleLookupGet(
      new Request(
        `http://localhost/api/appointments/lookup?reference=${encodeURIComponent(`  ${bookingA.referenceNumber.toLowerCase()}  `)}`,
      ),
      () => client,
    );
    assert.equal(refRes.status, 200);
    assert.equal(refRes.headers.get("Cache-Control"), "no-store");
    const refJson = (await refRes.json()) as {
      bookings: Array<{ id: string; referenceNumber: string }>;
    };
    assert.equal(refJson.bookings.length, 1);
    assert.equal(refJson.bookings[0].referenceNumber, bookingA.referenceNumber);
  });

  it("Scenarios 5 & 6: Atomic rescheduling swaps slots without duplicates and cancellation frees the slot", async () => {
    const { store, client } = createSimulator();

    const booked = await createAppointment(
      client,
      {
        doctorId: DOCTOR_1_ID,
        appointmentDate: DATE_SUNDAY_1,
        startTime: "09:00",
        patientName: "ياسمين سعيد",
        patientPhone: "01155667788",
      },
      { now: NOW_BEFORE_2099 },
    );

    // Reschedule atomically from Sunday 09:00 -> Monday 14:30.
    const rescheduleRes = await handleReschedulePatch(
      new Request(`http://localhost/api/appointments/${booked.id}/reschedule`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          referenceNumber: booked.referenceNumber,
          patientPhone: booked.patientPhone,
          appointmentDate: DATE_MONDAY,
          startTime: "14:30",
        }),
      }),
      booked.id,
      () => client,
    );

    assert.equal(rescheduleRes.status, 200);
    assert.equal(rescheduleRes.headers.get("Cache-Control"), "no-store");
    const rescheduledJson = (await rescheduleRes.json()) as {
      booking: {
        id: string;
        referenceNumber: string;
        appointmentDate: string;
        startTime: string;
        status: string;
      };
    };
    assert.equal(rescheduledJson.booking.id, booked.id);
    assert.equal(
      rescheduledJson.booking.referenceNumber,
      booked.referenceNumber,
    );
    assert.equal(rescheduledJson.booking.appointmentDate, DATE_MONDAY);
    assert.equal(rescheduledJson.booking.startTime, "14:30");
    assert.equal(store.appointments.length, 1);

    const sundayAfterReschedule = await getDoctorAvailability(
      client,
      DOCTOR_1_ID,
      DATE_SUNDAY_1,
      NOW_BEFORE_2099,
    );
    assert.deepEqual(sundayAfterReschedule?.slots, [
      { start: "09:00", end: "09:30" },
      { start: "09:30", end: "10:00" },
    ]);

    const mondayAfterReschedule = await getDoctorAvailability(
      client,
      DOCTOR_1_ID,
      DATE_MONDAY,
      NOW_BEFORE_2099,
    );
    assert.deepEqual(mondayAfterReschedule?.slots, [
      { start: "14:00", end: "14:30" },
    ]);

    // Cancel and verify the 14:30 slot frees immediately.
    const cancelRes = await handleCancelPatch(
      new Request(`http://localhost/api/appointments/${booked.id}/cancel`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          referenceNumber: booked.referenceNumber,
          patientPhone: booked.patientPhone,
        }),
      }),
      booked.id,
      () => client,
    );
    assert.equal(cancelRes.status, 200);
    assert.equal(cancelRes.headers.get("Cache-Control"), "no-store");
    const cancelJson = (await cancelRes.json()) as {
      booking: { status: string; canCancel: boolean; canReschedule: boolean };
    };
    assert.equal(cancelJson.booking.status, "CANCELLED");
    assert.equal(cancelJson.booking.canCancel, false);
    assert.equal(cancelJson.booking.canReschedule, false);

    const mondayAfterCancel = await getDoctorAvailability(
      client,
      DOCTOR_1_ID,
      DATE_MONDAY,
      NOW_BEFORE_2099,
    );
    assert.deepEqual(mondayAfterCancel?.slots, [
      { start: "14:00", end: "14:30" },
      { start: "14:30", end: "15:00" },
    ]);

    const blockedReschedule = await handleReschedulePatch(
      new Request(`http://localhost/api/appointments/${booked.id}/reschedule`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          referenceNumber: booked.referenceNumber,
          patientPhone: booked.patientPhone,
          appointmentDate: DATE_SUNDAY_1,
          startTime: "09:00",
        }),
      }),
      booked.id,
      () => client,
    );
    assert.equal(blockedReschedule.status, 409);
  });

  it("Scenarios 7 & 8: Receptionist check-in, blocked CANCELLED check-in, and strict clinic isolation", async () => {
    const { store, client } = createSimulator();

    const clinic1Active = await createAppointment(
      client,
      {
        doctorId: DOCTOR_1_ID,
        appointmentDate: DATE_SUNDAY_1,
        startTime: "09:00",
        patientName: "كريم محمد",
        patientPhone: "01011112222",
      },
      { now: NOW_BEFORE_2099 },
    );
    const clinic1Cancelled = await createAppointment(
      client,
      {
        doctorId: DOCTOR_1_ID,
        appointmentDate: DATE_SUNDAY_1,
        startTime: "09:30",
        patientName: "طارق نبيل",
        patientPhone: "01033334444",
      },
      { now: NOW_BEFORE_2099 },
    );
    await handleCancelPatch(
      new Request(
        `http://localhost/api/appointments/${clinic1Cancelled.id}/cancel`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            referenceNumber: clinic1Cancelled.referenceNumber,
            patientPhone: clinic1Cancelled.patientPhone,
          }),
        },
      ),
      clinic1Cancelled.id,
      () => client,
    );

    const clinic2Active = await createAppointment(
      client,
      {
        doctorId: DOCTOR_2_ID,
        appointmentDate: DATE_SUNDAY_1,
        startTime: "11:00",
        patientName: "منى حسين",
        patientPhone: "01255556666",
      },
      { now: NOW_BEFORE_2099 },
    );

    const rawClinic1 = store.appointments.find((a) => a.id === clinic1Active.id)!;
    const rawClinic2 = store.appointments.find((a) => a.id === clinic2Active.id)!;

    // Lookup by reference & QR token within Clinic 1.
    const byRef = await getReceptionistAppointmentByReference(
      client,
      CLINIC_1_ID,
      clinic1Active.referenceNumber,
    );
    assert.equal(byRef.id, clinic1Active.id);

    const byQr = await getReceptionistAppointmentByQrToken(
      client,
      CLINIC_1_ID,
      rawClinic1.qr_token,
    );
    assert.equal(byQr.id, clinic1Active.id);

    // Check-in CONFIRMED -> CHECKED_IN; duplicate check-in and CANCELLED check-in fail with 409.
    const checkedIn = await checkInReceptionistAppointment(
      client,
      CLINIC_1_ID,
      clinic1Active.referenceNumber,
    );
    assert.equal(checkedIn.status, "CHECKED_IN");

    await assert.rejects(
      () =>
        checkInReceptionistAppointment(
          client,
          CLINIC_1_ID,
          clinic1Active.referenceNumber,
        ),
      (err: unknown) =>
        err instanceof ReceptionistServiceError && err.status === 409,
    );
    await assert.rejects(
      () =>
        checkInReceptionistAppointment(
          client,
          CLINIC_1_ID,
          clinic1Cancelled.referenceNumber,
        ),
      (err: unknown) =>
        err instanceof ReceptionistServiceError && err.status === 409,
    );

    // Clinic isolation across receptionists.
    const clinic1List = await listReceptionistAppointments(client, CLINIC_1_ID);
    assert.equal(clinic1List.length, 2);
    assert.ok(clinic1List.every((row) => row.clinicId === CLINIC_1_ID));

    const clinic2List = await listReceptionistAppointments(client, CLINIC_2_ID);
    assert.equal(clinic2List.length, 1);
    assert.equal(clinic2List[0].id, clinic2Active.id);

    const receptionistGetHandler = createReceptionistAppointmentsGetHandler({
      requireAdmin: async () => RECEPTIONIST_1,
      getAdminClient: () => client,
    });
    const crossClinicListRes = await receptionistGetHandler(
      new Request(
        `http://localhost/api/receptionist/appointments?clinicId=${CLINIC_2_ID}`,
      ),
    );
    assert.equal(crossClinicListRes.status, 403);

    await assert.rejects(
      () =>
        getReceptionistAppointmentByReference(
          client,
          CLINIC_1_ID,
          clinic2Active.referenceNumber,
        ),
      (err: unknown) =>
        err instanceof ReceptionistServiceError && err.status === 404,
    );
    await assert.rejects(
      () =>
        getReceptionistAppointmentByQrToken(
          client,
          CLINIC_1_ID,
          rawClinic2.qr_token,
        ),
      (err: unknown) =>
        err instanceof ReceptionistServiceError && err.status === 404,
    );
    await assert.rejects(
      () =>
        checkInReceptionistAppointment(
          client,
          CLINIC_2_ID,
          clinic1Active.referenceNumber,
        ),
      (err: unknown) =>
        err instanceof ReceptionistServiceError && err.status === 404,
    );
    assert.equal(RECEPTIONIST_2.clinicId, CLINIC_2_ID);
  });

  it("Scenario 9: Schedule exceptions override weekly schedules on the date while manual availability adds extra periods", async () => {
    const { client } = createSimulator();

    await createScheduleException(client, DOCTOR_1_ID, {
      exceptionDate: DATE_SUNDAY_1,
      exceptionType: "CLOSED",
      startTime: null,
      endTime: null,
      reason: "إجازة مؤتمر",
    });

    const closedSunday = await getDoctorAvailability(
      client,
      DOCTOR_1_ID,
      DATE_SUNDAY_1,
      NOW_BEFORE_2099,
    );
    assert.equal(closedSunday?.state, "OFF");
    assert.deepEqual(closedSunday?.slots, []);

    const otherSunday = await getDoctorAvailability(
      client,
      DOCTOR_1_ID,
      DATE_SUNDAY_2,
      NOW_BEFORE_2099,
    );
    assert.equal(otherSunday?.state, "AVAILABLE");
    assert.deepEqual(otherSunday?.slots, [
      { start: "09:00", end: "09:30" },
      { start: "09:30", end: "10:00" },
    ]);

    await createScheduleException(client, DOCTOR_1_ID, {
      exceptionDate: DATE_MONDAY,
      exceptionType: "MODIFIED_HOURS",
      startTime: "16:00",
      endTime: "17:00",
      reason: "عيادة مسائية",
    });

    await createManualAvailability(client, DOCTOR_1_ID, {
      availabilityDate: DATE_TUESDAY,
      startTime: "19:00",
      endTime: "19:30",
    });

    const monthDates = await listDoctorAvailableDates(
      client,
      DOCTOR_1_ID,
      "2099-05",
      NOW_BEFORE_2099,
    );
    assert.equal(
      monthDates?.find((d) => d.date === DATE_SUNDAY_1)?.state,
      "OFF",
    );
    assert.equal(
      monthDates?.find((d) => d.date === DATE_MONDAY)?.state,
      "AVAILABLE",
    );
    assert.equal(
      monthDates?.find((d) => d.date === DATE_TUESDAY)?.state,
      "AVAILABLE",
    );

    const mondayAvail = await getDoctorAvailability(
      client,
      DOCTOR_1_ID,
      DATE_MONDAY,
      NOW_BEFORE_2099,
    );
    assert.deepEqual(mondayAvail?.slots, [
      { start: "16:00", end: "16:30" },
      { start: "16:30", end: "17:00" },
    ]);

    const tuesdayBooking = await createAppointment(
      client,
      {
        doctorId: DOCTOR_1_ID,
        appointmentDate: DATE_TUESDAY,
        startTime: "19:00",
        patientName: "سامح فؤاد",
        patientPhone: "01511223344",
      },
      { now: NOW_BEFORE_2099 },
    );
    assert.equal(tuesdayBooking.status, "CONFIRMED");

    // Adding manual availability even on a CLOSED exception day opens only those manual hours.
    await createManualAvailability(client, DOCTOR_1_ID, {
      availabilityDate: DATE_SUNDAY_1,
      startTime: "20:00",
      endTime: "20:30",
    });
    const closedWithManual = await getDoctorAvailability(
      client,
      DOCTOR_1_ID,
      DATE_SUNDAY_1,
      NOW_BEFORE_2099,
    );
    assert.equal(closedWithManual?.state, "AVAILABLE");
    assert.deepEqual(closedWithManual?.slots, [{ start: "20:00", end: "20:30" }]);
    const sundayManualBooking = await createAppointment(
      client,
      {
        doctorId: DOCTOR_1_ID,
        appointmentDate: DATE_SUNDAY_1,
        startTime: "20:00",
        patientName: "رانيا مجدي",
        patientPhone: "01022334455",
      },
      { now: NOW_BEFORE_2099 },
    );
    assert.equal(sundayManualBooking.status, "CONFIRMED");
  });

  it("Scenario 10: Deactivated doctor cannot receive new bookings while historical appointments remain accessible", async () => {
    const { client } = createSimulator();

    const existingBooking = await createAppointment(
      client,
      {
        doctorId: DOCTOR_1_ID,
        appointmentDate: DATE_SUNDAY_1,
        startTime: "09:00",
        patientName: "هند إبراهيم",
        patientPhone: "01077889900",
      },
      { now: NOW_BEFORE_2099 },
    );

    await updateOwnerDoctor(client, DOCTOR_1_ID, { isActive: false });

    const specialties = await listActiveSpecialties(client);
    const listedDoctors = await listDoctorsBySpecialty(client, specialties[0]);
    assert.equal(
      listedDoctors.some((d) => d.id === DOCTOR_1_ID),
      false,
    );
    assert.equal(await getPublicDoctorById(client, DOCTOR_1_ID), null);
    assert.equal(
      await getDoctorAvailability(
        client,
        DOCTOR_1_ID,
        DATE_SUNDAY_1,
        NOW_BEFORE_2099,
      ),
      null,
    );

    await assert.rejects(
      () =>
        createAppointment(
          client,
          {
            doctorId: DOCTOR_1_ID,
            appointmentDate: DATE_SUNDAY_1,
            startTime: "09:30",
            patientName: "حالة مرفوضة",
            patientPhone: "01000001111",
          },
          { now: NOW_BEFORE_2099 },
        ),
      (err: unknown) =>
        err instanceof BookingServiceError &&
        err.status === 404 &&
        err.code === "DOCTOR_UNAVAILABLE",
    );

    const lookupRes = await handleLookupGet(
      new Request(
        `http://localhost/api/appointments/lookup?reference=${encodeURIComponent(existingBooking.referenceNumber)}`,
      ),
      () => client,
    );
    assert.equal(lookupRes.status, 200);
    const lookupJson = (await lookupRes.json()) as {
      bookings: Array<{
        isDoctorActive: boolean;
        canReschedule: boolean;
        canCancel: boolean;
      }>;
    };
    assert.equal(lookupJson.bookings.length, 1);
    assert.equal(lookupJson.bookings[0].isDoctorActive, false);
    assert.equal(lookupJson.bookings[0].canReschedule, false);
    assert.equal(lookupJson.bookings[0].canCancel, true);

    const ownerAppointments = await listOwnerAppointments(client, {});
    assert.equal(ownerAppointments.length, 1);
    assert.equal(ownerAppointments[0].doctorIsActive, false);

    const receptionistAppointments = await listReceptionistAppointments(
      client,
      CLINIC_1_ID,
    );
    assert.equal(receptionistAppointments.length, 1);
    assert.equal(receptionistAppointments[0].doctorIsActive, false);
  });
});
