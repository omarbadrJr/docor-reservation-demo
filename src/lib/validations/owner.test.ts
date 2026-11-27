import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseCreateClinicInput,
  parseCreateDoctorInput,
  parseCreateManualAvailabilityInput,
  parseCreateReceptionistInput,
  parseCreateScheduleExceptionInput,
  parseCreateSpecialtyInput,
  parseCreateWeeklyScheduleInput,
  parseOwnerAppointmentsFilter,
  parseUpdateClinicInput,
  parseUpdateDoctorInput,
  parseUpdateReceptionistInput,
  parseUpdateSpecialtyInput,
  parseUpdateWeeklyScheduleInput,
  parseUuidParam,
  validateDoctorPhotoFile,
} from "./owner";

const SEED_CLINIC_ID = "11000000-0000-0000-0000-000000000001";
const SEED_SPECIALTY_ID = "22000000-0000-0000-0000-000000000001";
const SEED_DOCTOR_ID = "33000000-0000-0000-0000-000000000001";

describe("parseUuidParam", () => {
  it("accepts non-RFC synthetic seed UUIDs and uppercase hex", () => {
    for (const id of [
      SEED_CLINIC_ID,
      SEED_SPECIALTY_ID,
      SEED_DOCTOR_ID,
      "ABCDEF01-2345-6789-ABCD-EF0123456789",
    ]) {
      assert.deepEqual(parseUuidParam(id), { success: true, id });
    }
  });

  it("rejects malformed UUIDs and includes optional label in message", () => {
    for (const bad of ["", "not-a-uuid", "11000000-0000-0000-0000-00000000000", null, 42]) {
      const plain = parseUuidParam(bad);
      assert.equal(plain.success, false);
      if (!plain.success) {
        assert.equal(plain.message, "رقم التعريف مش صحيح.");
      }

      const labeled = parseUuidParam(bad, "العيادة");
      assert.equal(labeled.success, false);
      if (!labeled.success) {
        assert.equal(labeled.message, "رقم تعريف العيادة مش صحيح.");
      }
    }
  });
});

describe("clinic parsers", () => {
  it("creates clinic with trimmed fields, Arabic digit phone normalization, and default isActive", () => {
    const result = parseCreateClinicInput({
      name: "  عيادة الرحمة التخصصية  ",
      address: "  شارع الجمهورية - دمنهور  ",
      phone: "  +٢٠ ١٠٠ ٥٥٥ ١٢٣٤  ",
    });

    assert.deepEqual(result, {
      success: true,
      data: {
        name: "عيادة الرحمة التخصصية",
        address: "شارع الجمهورية - دمنهور",
        phone: "+20 100 555 1234",
        isActive: true,
      },
    });
  });

  it("rejects non-object payloads, invalid phone, and overly long clinic fields", () => {
    assert.equal(parseCreateClinicInput(null).success, false);
    assert.equal(parseCreateClinicInput([]).success, false);

    const badPhone = parseCreateClinicInput({
      name: "عيادة النور",
      address: "دمنهور",
      phone: "------",
    });
    assert.equal(badPhone.success, false);
    if (!badPhone.success) {
      assert.ok(badPhone.fieldErrors.phone);
    }

    const tooLong = parseCreateClinicInput({
      name: "أ".repeat(121),
      address: "ب".repeat(241),
      phone: "12345",
      isActive: "yes",
    });
    assert.equal(tooLong.success, false);
    if (!tooLong.success) {
      assert.ok(tooLong.fieldErrors.name);
      assert.ok(tooLong.fieldErrors.address);
      assert.ok(tooLong.fieldErrors.phone);
      assert.ok(tooLong.fieldErrors.isActive);
    }
  });

  it("updates partial clinic fields and rejects empty updates", () => {
    const empty = parseUpdateClinicInput({});
    assert.equal(empty.success, false);

    const partial = parseUpdateClinicInput({ isActive: false });
    assert.deepEqual(partial, {
      success: true,
      data: { isActive: false },
    });
  });
});

describe("specialty parsers", () => {
  it("creates specialty and converts blank description to null", () => {
    const result = parseCreateSpecialtyInput({
      name: "  باطنة  ",
      description: "   ",
    });

    assert.deepEqual(result, {
      success: true,
      data: {
        name: "باطنة",
        description: null,
        isActive: true,
      },
    });
  });

  it("validates specialty max lengths and partial updates", () => {
    const tooLong = parseCreateSpecialtyInput({
      name: "ت".repeat(101),
      description: "و".repeat(401),
    });
    assert.equal(tooLong.success, false);
    if (!tooLong.success) {
      assert.ok(tooLong.fieldErrors.name);
      assert.ok(tooLong.fieldErrors.description);
    }

    assert.equal(parseUpdateSpecialtyInput({}).success, false);
    assert.deepEqual(
      parseUpdateSpecialtyInput({ description: "" }),
      {
        success: true,
        data: { description: null },
      },
    );
  });
});

describe("doctor parsers", () => {
  it("creates doctor using seed UUIDs and formats consultationFee to two decimals", () => {
    const result = parseCreateDoctorInput({
      fullName: "  د. أحمد محمود  ",
      clinicId: SEED_CLINIC_ID,
      specialtyId: SEED_SPECIALTY_ID,
      bio: "  استشاري الباطنة  ",
      qualifications: "",
      experienceYears: "١٥",
      consultationFee: "250.5",
      slotDurationMinutes: 20,
      photoUrl: "/doctors/ahmed.jpg",
    });

    assert.deepEqual(result, {
      success: true,
      data: {
        fullName: "د. أحمد محمود",
        clinicId: SEED_CLINIC_ID,
        specialtyId: SEED_SPECIALTY_ID,
        bio: "استشاري الباطنة",
        qualifications: null,
        experienceYears: 15,
        consultationFee: "250.50",
        slotDurationMinutes: 20,
        photoUrl: "/doctors/ahmed.jpg",
        isActive: true,
      },
    });
  });

  it("accepts boundary numbers and https photo URLs while normalizing empty experienceYears", () => {
    const result = parseCreateDoctorInput({
      fullName: "د. سارة علي",
      clinicId: SEED_CLINIC_ID,
      specialtyId: SEED_SPECIALTY_ID,
      experienceYears: "",
      consultationFee: 0,
      slotDurationMinutes: 480,
      photoUrl: "https://example.supabase.co/storage/v1/object/public/doctor-photos/doc.webp",
      isActive: false,
    });

    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.experienceYears, null);
      assert.equal(result.data.consultationFee, "0.00");
      assert.equal(result.data.slotDurationMinutes, 480);
      assert.equal(result.data.isActive, false);
    }
  });

  it("rejects unsafe photoUrl protocols, traversal paths, and invalid numeric ranges", () => {
    for (const badUrl of [
      "javascript:alert(1)",
      "data:image/png;base64,AAAA",
      "http://example.com/photo.jpg",
      "//evil.com/photo.jpg",
      "/other/photo.jpg",
      "/doctors/../secret.jpg",
      "/doctors/",
    ]) {
      const result = parseUpdateDoctorInput({ photoUrl: badUrl });
      assert.equal(result.success, false, `Expected ${badUrl} to fail`);
      if (!result.success) {
        assert.ok(result.fieldErrors.photoUrl);
      }
    }

    const badNums = parseCreateDoctorInput({
      fullName: "أ",
      clinicId: "bad",
      specialtyId: "bad",
      experienceYears: 71,
      consultationFee: 100001,
      slotDurationMinutes: 4,
    });
    assert.equal(badNums.success, false);
    if (!badNums.success) {
      assert.ok(badNums.fieldErrors.fullName);
      assert.ok(badNums.fieldErrors.clinicId);
      assert.ok(badNums.fieldErrors.specialtyId);
      assert.ok(badNums.fieldErrors.experienceYears);
      assert.ok(badNums.fieldErrors.consultationFee);
      assert.ok(badNums.fieldErrors.slotDurationMinutes);
    }

    const decimalExp = parseUpdateDoctorInput({ experienceYears: 3.5 });
    assert.equal(decimalExp.success, false);
    const negativeExp = parseUpdateDoctorInput({ experienceYears: -1 });
    assert.equal(negativeExp.success, false);
    const overPrecisionFee = parseUpdateDoctorInput({ consultationFee: "150.123" });
    assert.equal(overPrecisionFee.success, false);
    assert.equal(parseUpdateDoctorInput({}).success, false);
  });
});

describe("validateDoctorPhotoFile", () => {
  it("accepts JPEG, PNG, and WebP files with matching magic bytes", () => {
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]);
    assert.deepEqual(
      validateDoctorPhotoFile({ type: "image/jpeg", size: jpegBytes.length }, jpegBytes),
      { success: true, contentType: "image/jpeg", extension: "jpg" },
    );

    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    assert.deepEqual(
      validateDoctorPhotoFile({ type: "image/png", size: pngBytes.length }, pngBytes),
      { success: true, contentType: "image/png", extension: "png" },
    );

    const webpBytes = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);
    assert.deepEqual(
      validateDoctorPhotoFile({ type: "image/webp", size: webpBytes.length }, webpBytes),
      { success: true, contentType: "image/webp", extension: "webp" },
    );
  });

  it("rejects mismatched magic bytes, unsupported MIME types, empty files, and >5MB files", () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert.equal(
      validateDoctorPhotoFile({ type: "image/jpeg", size: pngBytes.length }, pngBytes).success,
      false,
    );
    assert.equal(
      validateDoctorPhotoFile({ type: "image/svg+xml", size: pngBytes.length }, pngBytes).success,
      false,
    );
    assert.equal(
      validateDoctorPhotoFile({ type: "image/png", size: 0 }, new Uint8Array([])).success,
      false,
    );
    assert.equal(
      validateDoctorPhotoFile(
        { type: "image/png", size: 5 * 1024 * 1024 + 1 },
        pngBytes,
      ).success,
      false,
    );
  });
});

describe("scheduling parsers", () => {
  it("parses weekly schedules and normalizes HH:MM:SS to HH:MM", () => {
    const created = parseCreateWeeklyScheduleInput({
      dayOfWeek: 6,
      startTime: "09:00:00",
      endTime: "17:30:00",
    });

    assert.deepEqual(created, {
      success: true,
      data: {
        dayOfWeek: 6,
        startTime: "09:00",
        endTime: "17:30",
        isActive: true,
      },
    });

    const badOrder = parseCreateWeeklyScheduleInput({
      dayOfWeek: 0,
      startTime: "17:00",
      endTime: "17:00",
    });
    assert.equal(badOrder.success, false);

    const outOfRangeDay = parseCreateWeeklyScheduleInput({
      dayOfWeek: 7,
      startTime: "09:00",
      endTime: "12:00",
    });
    assert.equal(outOfRangeDay.success, false);

    assert.equal(parseUpdateWeeklyScheduleInput({}).success, false);
    assert.deepEqual(
      parseUpdateWeeklyScheduleInput({ isActive: false }),
      { success: true, data: { isActive: false } },
    );
    assert.equal(
      parseUpdateWeeklyScheduleInput({ startTime: "15:00", endTime: "14:00" }).success,
      false,
    );
  });

  it("validates calendar dates for manual availability and rejects impossible dates", () => {
    const valid = parseCreateManualAvailabilityInput({
      availabilityDate: "2024-02-29",
      startTime: "18:00:00",
      endTime: "21:00",
    });
    assert.deepEqual(valid, {
      success: true,
      data: {
        availabilityDate: "2024-02-29",
        startTime: "18:00",
        endTime: "21:00",
      },
    });

    for (const impossibleDate of ["2026-02-30", "2025-02-29", "2026-11-31"]) {
      const result = parseCreateManualAvailabilityInput({
        availabilityDate: impossibleDate,
        startTime: "10:00",
        endTime: "12:00",
      });
      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(result.fieldErrors.availabilityDate);
      }
    }
  });

  it("enforces CLOSED vs MODIFIED_HOURS/EXTRA_HOURS rules on schedule exceptions", () => {
    const closedValid = parseCreateScheduleExceptionInput({
      exceptionDate: "2026-12-01",
      exceptionType: "CLOSED",
      startTime: "",
      endTime: null,
      reason: "  إجازة رسمية  ",
    });
    assert.deepEqual(closedValid, {
      success: true,
      data: {
        exceptionDate: "2026-12-01",
        exceptionType: "CLOSED",
        startTime: null,
        endTime: null,
        reason: "إجازة رسمية",
      },
    });

    const closedWithTimes = parseCreateScheduleExceptionInput({
      exceptionDate: "2026-12-01",
      exceptionType: "CLOSED",
      startTime: "09:00",
      endTime: "12:00",
    });
    assert.equal(closedWithTimes.success, false);
    if (!closedWithTimes.success) {
      assert.ok(closedWithTimes.fieldErrors.startTime);
      assert.ok(closedWithTimes.fieldErrors.endTime);
    }

    const modifiedValid = parseCreateScheduleExceptionInput({
      exceptionDate: "2026-12-02",
      exceptionType: "MODIFIED_HOURS",
      startTime: "12:00",
      endTime: "16:00:00",
      reason: "",
    });
    assert.deepEqual(modifiedValid, {
      success: true,
      data: {
        exceptionDate: "2026-12-02",
        exceptionType: "MODIFIED_HOURS",
        startTime: "12:00",
        endTime: "16:00",
        reason: null,
      },
    });

    const extraMissingTime = parseCreateScheduleExceptionInput({
      exceptionDate: "2026-12-03",
      exceptionType: "EXTRA_HOURS",
      startTime: "18:00",
    });
    assert.equal(extraMissingTime.success, false);
    if (!extraMissingTime.success) {
      assert.ok(extraMissingTime.fieldErrors.endTime);
    }
  });
});

describe("receptionist parsers", () => {
  it("validates receptionist creation with seed clinicId and normalized email", () => {
    const result = parseCreateReceptionistInput({
      name: "  منى إبراهيم  ",
      email: "  Mona.Reception@Clinic.EG  ",
      password: "Password123!",
      clinicId: SEED_CLINIC_ID,
    });

    assert.deepEqual(result, {
      success: true,
      data: {
        name: "منى إبراهيم",
        email: "mona.reception@clinic.eg",
        password: "Password123!",
        clinicId: SEED_CLINIC_ID,
      },
    });
  });

  it("rejects short, whitespace-only, or invalid receptionist fields", () => {
    const result = parseCreateReceptionistInput({
      name: "أ",
      email: "bad-email",
      password: "        ",
      clinicId: "bad-id",
    });

    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.fieldErrors.name);
      assert.ok(result.fieldErrors.email);
      assert.ok(result.fieldErrors.password);
      assert.ok(result.fieldErrors.clinicId);
    }

    const shortPass = parseCreateReceptionistInput({
      name: "منى إبراهيم",
      email: "mona@clinic.eg",
      password: "1234567",
      clinicId: SEED_CLINIC_ID,
    });
    assert.equal(shortPass.success, false);

    assert.equal(parseUpdateReceptionistInput({}).success, false);
    assert.deepEqual(
      parseUpdateReceptionistInput({ clinicId: SEED_CLINIC_ID, isActive: false }),
      {
        success: true,
        data: { clinicId: SEED_CLINIC_ID, isActive: false },
      },
    );
  });
});

describe("parseOwnerAppointmentsFilter", () => {
  it("accepts URLSearchParams and Record inputs including seed UUIDs", () => {
    const params = new URLSearchParams({
      clinicId: SEED_CLINIC_ID,
      doctorId: SEED_DOCTOR_ID,
      status: "CONFIRMED",
      dateFrom: "2026-11-01",
      dateTo: "2026-11-30",
      query: "  DR-8K29P4  ",
    });

    assert.deepEqual(parseOwnerAppointmentsFilter(params), {
      success: true,
      data: {
        clinicId: SEED_CLINIC_ID,
        doctorId: SEED_DOCTOR_ID,
        status: "CONFIRMED",
        dateFrom: "2026-11-01",
        dateTo: "2026-11-30",
        query: "DR-8K29P4",
      },
    });

    assert.deepEqual(
      parseOwnerAppointmentsFilter({
        clinicId: "",
        date: "2026-11-26",
      }),
      {
        success: true,
        data: {
          date: "2026-11-26",
        },
      },
    );
  });

  it("rejects inverted date ranges, invalid statuses, invalid dates, and long queries", () => {
    const inverted = parseOwnerAppointmentsFilter({
      dateFrom: "2026-11-20",
      dateTo: "2026-11-10",
    });
    assert.equal(inverted.success, false);
    if (!inverted.success) {
      assert.ok(inverted.fieldErrors.dateTo);
    }

    const badFields = parseOwnerAppointmentsFilter({
      clinicId: "bad",
      status: "PENDING",
      date: "2026-02-30",
      query: "ق".repeat(101),
    });
    assert.equal(badFields.success, false);
    if (!badFields.success) {
      assert.ok(badFields.fieldErrors.clinicId);
      assert.ok(badFields.fieldErrors.status);
      assert.ok(badFields.fieldErrors.date);
      assert.ok(badFields.fieldErrors.query);
    }
  });
});
