import { getCairoNow, type CairoNow } from "@/lib/cairo-time";
import { generateBookingQrDataUrl } from "@/lib/qr";
import type { DoctorAvailability } from "@/types/availability";
import type {
  BookingConfirmationData,
  BookingErrorCode,
  CancelAppointmentInput,
  CreateAppointmentInput,
  LookupAppointmentQuery,
  ManagedBookingData,
  RescheduleAppointmentInput,
} from "@/types/booking";
import type { Appointment } from "@/types/database";

import { getDoctorAvailability } from "./availability";
import { getPublicDoctorById } from "./doctors";
import type { CatalogClient } from "./specialties";

const DOCTOR_UNAVAILABLE_MESSAGE = "الدكتور ده غير متاح للحجز دلوقتي.";
const DOCTOR_UNAVAILABLE_RESCHEDULE_MESSAGE =
  "الدكتور ده غير متاح لتغيير المعاد دلوقتي.";
const SLOT_UNAVAILABLE_MESSAGE =
  "المعاد ده اتحجز قبلك بشوية. اختار معاد تاني من المواعيد المتاحة.";
const PATIENT_NAME_ERROR = "اكتب اسمك بالكامل (3 حروف على الأقل).";
const PATIENT_PHONE_ERROR = "اكتب رقم موبايل صح (أرقام بس، من 7 لـ 20 رقم).";
const INTERNAL_BOOKING_ERROR =
  "حصلت مشكلة وإحنا بنسجل الحجز، حاول تاني بعد شوية.";
const INTERNAL_LOOKUP_ERROR =
  "حصلت مشكلة وإحنا بندور على الحجز، حاول تاني بعد شوية.";
const INTERNAL_RESCHEDULE_ERROR =
  "حصلت مشكلة وإحنا بنغيّر المعاد، حاول تاني بعد شوية.";
const INTERNAL_CANCEL_ERROR =
  "حصلت مشكلة وإحنا بنلغي الحجز، حاول تاني بعد شوية.";
const BOOKING_NOT_FOUND_MESSAGE =
  "ما لقيناش الحجز ده. اتأكد من بيانات الحجز وحاول تاني.";
const SAME_SLOT_MESSAGE = "ده نفس معادك الحالي، اختار يوم أو وقت تاني.";
const ALREADY_CANCELLED_MESSAGE = "الحجز ده ملغي بالفعل.";
const CANCELLED_RESCHEDULE_MESSAGE =
  "الحجز ده ملغي، ما ينفعش تغيّر معاده. تقدر تعمل حجز جديد.";
const PAST_RESCHEDULE_MESSAGE = "معاد الحجز ده فات، ما ينفعش يتغيّر دلوقتي.";
const PAST_CANCEL_MESSAGE = "معاد الحجز ده فات، ما ينفعش يتلغي دلوقتي.";
const STATUS_RESCHEDULE_BLOCKED_MESSAGE =
  "ما ينفعش تغيّر معاد الحجز ده في حالته الحالية.";
const STATUS_CANCEL_BLOCKED_MESSAGE =
  "ما ينفعش تلغي الحجز ده في حالته الحالية.";

type DoctorHydrationRow = {
  id: string;
  clinic_id: string;
  specialty_id: string;
  full_name: string;
  consultation_fee: string;
  is_active: boolean;
};

type ClinicHydrationRow = {
  id: string;
  name: string;
  address: string;
  is_active: boolean;
};

type SpecialtyHydrationRow = {
  id: string;
  name: string;
  is_active: boolean;
};

export class BookingServiceError extends Error {
  readonly status: 400 | 404 | 409 | 500;
  readonly code: BookingErrorCode;
  readonly availability?: DoctorAvailability;
  readonly fieldErrors?: Partial<Record<string, string>>;

  constructor(
    status: 400 | 404 | 409 | 500,
    code: BookingErrorCode,
    message: string,
    details?: {
      availability?: DoctorAvailability;
      fieldErrors?: Partial<Record<string, string>>;
    },
  ) {
    super(message);
    this.name = "BookingServiceError";
    this.status = status;
    this.code = code;
    this.availability = details?.availability;
    this.fieldErrors = details?.fieldErrors;
  }
}

function extractAppointmentRow(
  data: Appointment | Appointment[] | null,
): Appointment | null {
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

function isReferenceNumberCollision(
  error: { code?: string; message?: string } | null,
): boolean {
  return (
    error !== null &&
    error.code === "23505" &&
    (error.message ?? "").includes("reference_number")
  );
}

function isSlotConflictError(error: { code?: string; message?: string }): boolean {
  const message = error.message ?? "";
  return (
    message.includes("Slot is not available") ||
    message.includes("Invalid slot time") ||
    error.code === "23P01" ||
    message.includes("appointments_no_active_overlap")
  );
}

function isAppointmentPast(
  appointmentDate: string,
  startTime: string,
  now: CairoNow,
): boolean {
  return (
    appointmentDate < now.date ||
    (appointmentDate === now.date && startTime.slice(0, 5) <= now.time)
  );
}

async function throwSlotConflictWithAvailability(
  client: CatalogClient,
  doctorId: string,
  appointmentDate: string,
  now: CairoNow,
  unavailableMessage: string,
): Promise<never> {
  const availability = await getDoctorAvailability(
    client,
    doctorId,
    appointmentDate,
    now,
  );
  if (!availability) {
    throw new BookingServiceError(
      404,
      "DOCTOR_UNAVAILABLE",
      unavailableMessage,
    );
  }

  throw new BookingServiceError(
    409,
    "SLOT_UNAVAILABLE",
    SLOT_UNAVAILABLE_MESSAGE,
    { availability },
  );
}

async function findOwnedAppointment(
  client: CatalogClient,
  input: CancelAppointmentInput,
  internalErrorMessage: string,
): Promise<Appointment> {
  const { data, error } = await client
    .from("appointments")
    .select("*")
    .eq("id", input.appointmentId)
    .eq("reference_number", input.referenceNumber)
    .eq("patient_phone", input.patientPhone)
    .maybeSingle();

  if (error) {
    throw new BookingServiceError(500, "INTERNAL_ERROR", internalErrorMessage);
  }

  if (!data) {
    throw new BookingServiceError(
      404,
      "BOOKING_NOT_FOUND",
      BOOKING_NOT_FOUND_MESSAGE,
    );
  }

  return data;
}

async function hydrateManagedBookings(
  client: CatalogClient,
  appointments: Appointment[],
  now: CairoNow,
  generateQr: (token: string) => Promise<string>,
  internalErrorMessage: string,
): Promise<ManagedBookingData[]> {
  if (appointments.length === 0) {
    return [];
  }

  const doctorIds = [...new Set(appointments.map((row) => row.doctor_id))];
  const { data: doctors, error: doctorsError } = await client
    .from("doctors")
    .select(
      "id, clinic_id, specialty_id, full_name, consultation_fee, is_active",
    )
    .in("id", doctorIds);

  if (doctorsError) {
    throw new BookingServiceError(500, "INTERNAL_ERROR", internalErrorMessage);
  }

  const doctorRows = (doctors ?? []) as DoctorHydrationRow[];
  const doctorMap = new Map(doctorRows.map((row) => [row.id, row]));

  const clinicIds = [
    ...new Set([
      ...appointments.map((row) => row.clinic_id),
      ...doctorRows.map((row) => row.clinic_id),
    ]),
  ];
  const specialtyIds = [...new Set(doctorRows.map((row) => row.specialty_id))];

  const [clinicsResult, specialtiesResult, qrCodes] = await Promise.all([
    clinicIds.length > 0
      ? client
          .from("clinics")
          .select("id, name, address, is_active")
          .in("id", clinicIds)
      : Promise.resolve({ data: [], error: null }),
    specialtyIds.length > 0
      ? client
          .from("specialties")
          .select("id, name, is_active")
          .in("id", specialtyIds)
      : Promise.resolve({ data: [], error: null }),
    Promise.all(appointments.map((row) => generateQr(row.qr_token))),
  ]);

  if (clinicsResult.error || specialtiesResult.error) {
    throw new BookingServiceError(500, "INTERNAL_ERROR", internalErrorMessage);
  }

  const clinicMap = new Map(
    ((clinicsResult.data ?? []) as ClinicHydrationRow[]).map((row) => [
      row.id,
      row,
    ]),
  );
  const specialtyMap = new Map(
    ((specialtiesResult.data ?? []) as SpecialtyHydrationRow[]).map((row) => [
      row.id,
      row,
    ]),
  );

  return appointments.map((appointment, index) => {
    const doctor = doctorMap.get(appointment.doctor_id);
    const appointmentClinic = clinicMap.get(appointment.clinic_id);
    const doctorClinic = doctor ? clinicMap.get(doctor.clinic_id) : undefined;
    const clinic = appointmentClinic ?? doctorClinic;
    const specialty = doctor ? specialtyMap.get(doctor.specialty_id) : undefined;

    if (!doctor || !clinic || !doctorClinic || !specialty) {
      throw new BookingServiceError(500, "INTERNAL_ERROR", internalErrorMessage);
    }

    const isDoctorActive = Boolean(
      doctor.is_active && doctorClinic.is_active && specialty.is_active,
    );
    const isPast = isAppointmentPast(
      appointment.appointment_date,
      appointment.start_time,
      now,
    );
    const isUpcomingConfirmed = appointment.status === "CONFIRMED" && !isPast;

    return {
      id: appointment.id,
      referenceNumber: appointment.reference_number,
      status: appointment.status,
      patientName: appointment.patient_name,
      patientPhone: appointment.patient_phone,
      doctorId: doctor.id,
      doctorName: doctor.full_name,
      specialtyName: specialty.name,
      clinicName: clinic.name,
      clinicAddress: clinic.address,
      consultationFee: doctor.consultation_fee,
      appointmentDate: appointment.appointment_date,
      startTime: appointment.start_time.slice(0, 5),
      endTime: appointment.end_time.slice(0, 5),
      qrCodeDataUrl: qrCodes[index],
      isDoctorActive,
      isPast,
      canReschedule: isUpcomingConfirmed && isDoctorActive,
      canCancel: isUpcomingConfirmed,
    };
  });
}

function isUpcomingActiveBooking(booking: ManagedBookingData): boolean {
  return (
    !booking.isPast &&
    (booking.status === "CONFIRMED" || booking.status === "CHECKED_IN")
  );
}

function compareDateTimeAsc(a: ManagedBookingData, b: ManagedBookingData): number {
  return (
    a.appointmentDate.localeCompare(b.appointmentDate) ||
    a.startTime.localeCompare(b.startTime)
  );
}

function sortManagedBookings(
  bookings: ManagedBookingData[],
): ManagedBookingData[] {
  return [...bookings].sort((first, second) => {
    const firstActive = isUpcomingActiveBooking(first);
    const secondActive = isUpcomingActiveBooking(second);
    if (firstActive !== secondActive) {
      return firstActive ? -1 : 1;
    }
    return firstActive
      ? compareDateTimeAsc(first, second)
      : compareDateTimeAsc(second, first);
  });
}

/**
 * Validates doctor availability, creates an appointment transactionally via the
 * `create_appointment` RPC, maps database/concurrency errors to structured Arabic
 * service errors, and attaches a generated QR code data URL.
 */
export async function createAppointment(
  client: CatalogClient,
  input: CreateAppointmentInput,
  options?: {
    now?: CairoNow;
    generateQr?: (token: string) => Promise<string>;
  },
): Promise<BookingConfirmationData> {
  const now = options?.now ?? getCairoNow();
  const doctor = await getPublicDoctorById(client, input.doctorId);
  if (!doctor) {
    throw new BookingServiceError(
      404,
      "DOCTOR_UNAVAILABLE",
      DOCTOR_UNAVAILABLE_MESSAGE,
    );
  }

  const rpcArgs = {
    p_doctor_id: input.doctorId,
    p_date: input.appointmentDate,
    p_start: input.startTime,
    p_patient_name: input.patientName,
    p_patient_phone: input.patientPhone,
  };

  let rpcResult = await client.rpc("create_appointment", rpcArgs);
  if (isReferenceNumberCollision(rpcResult.error)) {
    rpcResult = await client.rpc("create_appointment", rpcArgs);
  }

  if (rpcResult.error) {
    const message = rpcResult.error.message ?? "";

    if (message.includes("Doctor is not available for booking")) {
      throw new BookingServiceError(
        404,
        "DOCTOR_UNAVAILABLE",
        DOCTOR_UNAVAILABLE_MESSAGE,
      );
    }

    if (isSlotConflictError(rpcResult.error)) {
      await throwSlotConflictWithAvailability(
        client,
        input.doctorId,
        input.appointmentDate,
        now,
        DOCTOR_UNAVAILABLE_MESSAGE,
      );
    }

    if (message.includes("Patient name")) {
      throw new BookingServiceError(400, "VALIDATION_ERROR", PATIENT_NAME_ERROR, {
        fieldErrors: { patientName: PATIENT_NAME_ERROR },
      });
    }

    if (message.includes("Patient phone")) {
      throw new BookingServiceError(400, "VALIDATION_ERROR", PATIENT_PHONE_ERROR, {
        fieldErrors: { patientPhone: PATIENT_PHONE_ERROR },
      });
    }

    throw new BookingServiceError(500, "INTERNAL_ERROR", INTERNAL_BOOKING_ERROR);
  }

  const appointment = extractAppointmentRow(rpcResult.data);
  if (!appointment) {
    throw new BookingServiceError(500, "INTERNAL_ERROR", INTERNAL_BOOKING_ERROR);
  }

  const qrCodeDataUrl = await (options?.generateQr ?? generateBookingQrDataUrl)(
    appointment.qr_token,
  );

  return {
    id: appointment.id,
    referenceNumber: appointment.reference_number,
    status: appointment.status,
    patientName: appointment.patient_name,
    patientPhone: appointment.patient_phone,
    doctorId: doctor.id,
    doctorName: doctor.fullName,
    specialtyName: doctor.specialtyName,
    clinicName: doctor.clinicName,
    clinicAddress: doctor.clinicAddress,
    consultationFee: doctor.consultationFee,
    appointmentDate: appointment.appointment_date,
    startTime: appointment.start_time.slice(0, 5),
    endTime: appointment.end_time.slice(0, 5),
    qrCodeDataUrl,
  };
}

/**
 * Looks up patient appointments by booking reference number or phone number,
 * returning hydrated booking details sorted with upcoming active bookings first.
 */
export async function lookupAppointments(
  client: CatalogClient,
  query: LookupAppointmentQuery,
  options?: {
    now?: CairoNow;
    generateQr?: (token: string) => Promise<string>;
  },
): Promise<{ bookings: ManagedBookingData[]; todayDate: string }> {
  const now = options?.now ?? getCairoNow();
  const baseQuery = client.from("appointments").select("*");
  const { data, error } =
    query.type === "reference"
      ? await baseQuery.eq("reference_number", query.reference)
      : await baseQuery.eq("patient_phone", query.phone);

  if (error) {
    throw new BookingServiceError(500, "INTERNAL_ERROR", INTERNAL_LOOKUP_ERROR);
  }

  const hydrated = await hydrateManagedBookings(
    client,
    (data ?? []) as Appointment[],
    now,
    options?.generateQr ?? generateBookingQrDataUrl,
    INTERNAL_LOOKUP_ERROR,
  );

  return {
    bookings: sortManagedBookings(hydrated),
    todayDate: now.date,
  };
}

/**
 * Atomically reschedules an upcoming confirmed appointment to a new available slot
 * via `reschedule_appointment`, releasing the previous slot without creating duplicates.
 */
export async function rescheduleAppointment(
  client: CatalogClient,
  input: RescheduleAppointmentInput,
  options?: {
    now?: CairoNow;
    generateQr?: (token: string) => Promise<string>;
  },
): Promise<{ booking: ManagedBookingData; todayDate: string }> {
  const now = options?.now ?? getCairoNow();
  const existing = await findOwnedAppointment(
    client,
    input,
    INTERNAL_RESCHEDULE_ERROR,
  );

  if (existing.status === "CANCELLED") {
    throw new BookingServiceError(
      409,
      "BOOKING_NOT_MODIFIABLE",
      CANCELLED_RESCHEDULE_MESSAGE,
    );
  }

  if (existing.status !== "CONFIRMED") {
    throw new BookingServiceError(
      409,
      "BOOKING_NOT_MODIFIABLE",
      STATUS_RESCHEDULE_BLOCKED_MESSAGE,
    );
  }

  if (isAppointmentPast(existing.appointment_date, existing.start_time, now)) {
    throw new BookingServiceError(
      409,
      "BOOKING_NOT_MODIFIABLE",
      PAST_RESCHEDULE_MESSAGE,
    );
  }

  if (
    existing.appointment_date === input.appointmentDate &&
    existing.start_time.slice(0, 5) === input.startTime
  ) {
    throw new BookingServiceError(400, "VALIDATION_ERROR", SAME_SLOT_MESSAGE);
  }

  const activeDoctor = await getPublicDoctorById(client, existing.doctor_id);
  if (!activeDoctor) {
    throw new BookingServiceError(
      404,
      "DOCTOR_UNAVAILABLE",
      DOCTOR_UNAVAILABLE_RESCHEDULE_MESSAGE,
    );
  }

  const rpcResult = await client.rpc("reschedule_appointment", {
    p_appointment_id: input.appointmentId,
    p_date: input.appointmentDate,
    p_start: input.startTime,
    p_reference_number: input.referenceNumber,
    p_patient_phone: input.patientPhone,
  });

  if (rpcResult.error) {
    const message = rpcResult.error.message ?? "";

    if (message.includes("Booking not found")) {
      throw new BookingServiceError(
        404,
        "BOOKING_NOT_FOUND",
        BOOKING_NOT_FOUND_MESSAGE,
      );
    }

    if (message.includes("Booking cannot be rescheduled")) {
      throw new BookingServiceError(
        409,
        "BOOKING_NOT_MODIFIABLE",
        STATUS_RESCHEDULE_BLOCKED_MESSAGE,
      );
    }

    if (message.includes("Doctor is not available for booking")) {
      throw new BookingServiceError(
        404,
        "DOCTOR_UNAVAILABLE",
        DOCTOR_UNAVAILABLE_RESCHEDULE_MESSAGE,
      );
    }

    if (isSlotConflictError(rpcResult.error)) {
      await throwSlotConflictWithAvailability(
        client,
        existing.doctor_id,
        input.appointmentDate,
        now,
        DOCTOR_UNAVAILABLE_RESCHEDULE_MESSAGE,
      );
    }

    throw new BookingServiceError(
      500,
      "INTERNAL_ERROR",
      INTERNAL_RESCHEDULE_ERROR,
    );
  }

  const updated = extractAppointmentRow(rpcResult.data);
  if (!updated) {
    throw new BookingServiceError(
      500,
      "INTERNAL_ERROR",
      INTERNAL_RESCHEDULE_ERROR,
    );
  }

  const [booking] = await hydrateManagedBookings(
    client,
    [updated],
    now,
    options?.generateQr ?? generateBookingQrDataUrl,
    INTERNAL_RESCHEDULE_ERROR,
  );

  return { booking, todayDate: now.date };
}

/**
 * Atomically cancels an upcoming confirmed appointment via `cancel_appointment`,
 * marking its status as `CANCELLED` and immediately freeing its time slot.
 */
export async function cancelAppointment(
  client: CatalogClient,
  input: CancelAppointmentInput,
  options?: {
    now?: CairoNow;
    generateQr?: (token: string) => Promise<string>;
  },
): Promise<{ booking: ManagedBookingData; todayDate: string }> {
  const now = options?.now ?? getCairoNow();
  const existing = await findOwnedAppointment(
    client,
    input,
    INTERNAL_CANCEL_ERROR,
  );

  if (existing.status === "CANCELLED") {
    throw new BookingServiceError(
      409,
      "BOOKING_NOT_MODIFIABLE",
      ALREADY_CANCELLED_MESSAGE,
    );
  }

  if (existing.status !== "CONFIRMED") {
    throw new BookingServiceError(
      409,
      "BOOKING_NOT_MODIFIABLE",
      STATUS_CANCEL_BLOCKED_MESSAGE,
    );
  }

  if (isAppointmentPast(existing.appointment_date, existing.start_time, now)) {
    throw new BookingServiceError(
      409,
      "BOOKING_NOT_MODIFIABLE",
      PAST_CANCEL_MESSAGE,
    );
  }

  const rpcResult = await client.rpc("cancel_appointment", {
    p_appointment_id: input.appointmentId,
    p_reference_number: input.referenceNumber,
    p_patient_phone: input.patientPhone,
  });

  if (rpcResult.error) {
    const message = rpcResult.error.message ?? "";

    if (message.includes("Booking not found")) {
      throw new BookingServiceError(
        404,
        "BOOKING_NOT_FOUND",
        BOOKING_NOT_FOUND_MESSAGE,
      );
    }

    if (message.includes("Booking cannot be cancelled")) {
      throw new BookingServiceError(
        409,
        "BOOKING_NOT_MODIFIABLE",
        STATUS_CANCEL_BLOCKED_MESSAGE,
      );
    }

    throw new BookingServiceError(500, "INTERNAL_ERROR", INTERNAL_CANCEL_ERROR);
  }

  const updated = extractAppointmentRow(rpcResult.data);
  if (!updated) {
    throw new BookingServiceError(500, "INTERNAL_ERROR", INTERNAL_CANCEL_ERROR);
  }

  const [booking] = await hydrateManagedBookings(
    client,
    [updated],
    now,
    options?.generateQr ?? generateBookingQrDataUrl,
    INTERNAL_CANCEL_ERROR,
  );

  return { booking, todayDate: now.date };
}
