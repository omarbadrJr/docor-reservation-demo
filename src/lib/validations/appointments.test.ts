import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

import {
  bookingFormSchema,
  normalizePhoneNumber,
  parseCreateAppointmentInput,
  type BookingFormValues,
} from "./appointments";

const VALID_DOCTOR_ID = "22000000-0000-0000-0000-000000000001";

describe("normalizePhoneNumber", () => {
  it("converts Arabic-Indic digits and strips formatting characters", () => {
    assert.equal(normalizePhoneNumber("  ٠١٠-١٢٣٤ (٥٦٧٨)  "), "01012345678");
  });

  it("converts Persian/Eastern Arabic-Indic digits and keeps leading plus", () => {
    assert.equal(normalizePhoneNumber(" +۲۰ ۱۰۹ ۸۷۶ ۵۴۳۲ "), "+201098765432");
  });

  it("handles mixed localized and ASCII digits with tabs and spaces", () => {
    assert.equal(normalizePhoneNumber("\t01٠ 1۲34-5678\n"), "01012345678");
  });

  it("preserves non-digit characters other than stripped formatting", () => {
    assert.equal(normalizePhoneNumber("010abc1234"), "010abc1234");
  });
});

describe("bookingFormSchema", () => {
  it("keeps identical input and output types without transforms for react-hook-form", () => {
    type InputType = z.input<typeof bookingFormSchema>;
    type OutputType = z.output<typeof bookingFormSchema>;

    const sampleInput: InputType = {
      patientName: "  أحمد محمد  ",
      patientPhone: "٠١٠ ١٢٣٤ ٥٦٧٨",
    };
    const sampleOutput: OutputType = sampleInput;
    const typedValues: BookingFormValues = sampleOutput;

    assert.equal(typeof zodResolver(bookingFormSchema), "function");

    const result = bookingFormSchema.safeParse(typedValues);
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.patientName, "  أحمد محمد  ");
      assert.equal(result.data.patientPhone, "٠١٠ ١٢٣٤ ٥٦٧٨");
    }
  });

  it("enforces patientName trimmed length boundaries (3 to 100 chars)", () => {
    assert.equal(
      bookingFormSchema.safeParse({
        patientName: "  مي  ",
        patientPhone: "01012345678",
      }).success,
      false,
    );

    assert.equal(
      bookingFormSchema.safeParse({
        patientName: "  علي  ",
        patientPhone: "01012345678",
      }).success,
      true,
    );

    assert.equal(
      bookingFormSchema.safeParse({
        patientName: `  ${"أ".repeat(100)}  `,
        patientPhone: "01012345678",
      }).success,
      true,
    );

    const tooLong = bookingFormSchema.safeParse({
      patientName: "أ".repeat(101),
      patientPhone: "01012345678",
    });
    assert.equal(tooLong.success, false);
    if (!tooLong.success) {
      assert.equal(
        tooLong.error.issues[0]?.message,
        "الاسم طويل أوي، اختصره شوية.",
      );
    }
  });

  it("enforces patientPhone digit count boundaries and rejects invalid characters", () => {
    assert.equal(
      bookingFormSchema.safeParse({
        patientName: "أحمد علي",
        patientPhone: "123456",
      }).success,
      false,
    );

    assert.equal(
      bookingFormSchema.safeParse({
        patientName: "أحمد علي",
        patientPhone: "1234567",
      }).success,
      true,
    );

    assert.equal(
      bookingFormSchema.safeParse({
        patientName: "أحمد علي",
        patientPhone: `+${"1".repeat(20)}`,
      }).success,
      true,
    );

    assert.equal(
      bookingFormSchema.safeParse({
        patientName: "أحمد علي",
        patientPhone: "1".repeat(21),
      }).success,
      false,
    );

    assert.equal(
      bookingFormSchema.safeParse({
        patientName: "أحمد علي",
        patientPhone: "010+1234567",
      }).success,
      false,
    );

    assert.equal(
      bookingFormSchema.safeParse({
        patientName: "أحمد علي",
        patientPhone: "0101234abcd",
      }).success,
      false,
    );
  });

  it("rejects non-string field values with the expected Arabic error messages", () => {
    const result = bookingFormSchema.safeParse({
      patientName: 123,
      patientPhone: null,
    });
    assert.equal(result.success, false);
    if (!result.success) {
      assert.deepEqual(
        result.error.issues.map((issue) => issue.message),
        [
          "اكتب اسمك بالكامل (3 حروف على الأقل).",
          "اكتب رقم موبايل صح (أرقام بس، من 7 لـ 20 رقم).",
        ],
      );
    }
  });
});

describe("parseCreateAppointmentInput", () => {
  it("accepts a valid payload and trims name while normalizing phone", () => {
    const result = parseCreateAppointmentInput({
      doctorId: VALID_DOCTOR_ID,
      appointmentDate: "2026-11-26",
      startTime: "09:30",
      patientName: "  سارة محمود علي  ",
      patientPhone: " +٢٠ (٠١٠) ١٢٣٤-٥٦٧٨ ",
    });

    assert.deepEqual(result, {
      success: true,
      data: {
        doctorId: VALID_DOCTOR_ID,
        appointmentDate: "2026-11-26",
        startTime: "09:30",
        patientName: "سارة محمود علي",
        patientPhone: "+2001012345678",
      },
    });
  });

  it("accepts boundary startTime values 00:00 and 23:59", () => {
    const midnight = parseCreateAppointmentInput({
      doctorId: VALID_DOCTOR_ID,
      appointmentDate: "2026-11-26",
      startTime: "00:00",
      patientName: "كريم حسن",
      patientPhone: "01012345678",
    });
    const endOfDay = parseCreateAppointmentInput({
      doctorId: VALID_DOCTOR_ID,
      appointmentDate: "2026-11-26",
      startTime: "23:59",
      patientName: "كريم حسن",
      patientPhone: "01012345678",
    });

    assert.equal(midnight.success, true);
    assert.equal(endOfDay.success, true);
  });

  it("rejects non-object payloads with generic error and empty fieldErrors", () => {
    for (const badPayload of [null, undefined, "str", 42, []]) {
      assert.deepEqual(parseCreateAppointmentInput(badPayload), {
        success: false,
        error: "بيانات الحجز مش مظبوطة، راجعها وحاول تاني.",
        fieldErrors: {},
      });
    }
  });

  it("surfaces a single field error for an invalid doctorId", () => {
    assert.deepEqual(
      parseCreateAppointmentInput({
        doctorId: "not-a-uuid",
        appointmentDate: "2026-11-26",
        startTime: "09:30",
        patientName: "سارة محمود",
        patientPhone: "01012345678",
      }),
      {
        success: false,
        error: "رقم الدكتور غير صحيح.",
        fieldErrors: {
          doctorId: "رقم الدكتور غير صحيح.",
        },
      },
    );
  });

  it("rejects impossible or non-string appointmentDate values", () => {
    for (const badDate of ["2026-02-31", "2025-02-29", "2026-11", 20261126]) {
      assert.deepEqual(
        parseCreateAppointmentInput({
          doctorId: VALID_DOCTOR_ID,
          appointmentDate: badDate,
          startTime: "09:30",
          patientName: "سارة محمود",
          patientPhone: "01012345678",
        }),
        {
          success: false,
          error: "التاريخ غير صحيح.",
          fieldErrors: {
            appointmentDate: "التاريخ غير صحيح.",
          },
        },
      );
    }
  });

  it("rejects invalid or non-string startTime values", () => {
    for (const badTime of ["24:00", "12:60", "9:00", "09:00:00", 930]) {
      assert.deepEqual(
        parseCreateAppointmentInput({
          doctorId: VALID_DOCTOR_ID,
          appointmentDate: "2026-11-26",
          startTime: badTime,
          patientName: "سارة محمود",
          patientPhone: "01012345678",
        }),
        {
          success: false,
          error: "المعاد غير صحيح.",
          fieldErrors: {
            startTime: "المعاد غير صحيح.",
          },
        },
      );
    }
  });

  it("surfaces a single field error for patientName or patientPhone", () => {
    assert.deepEqual(
      parseCreateAppointmentInput({
        doctorId: VALID_DOCTOR_ID,
        appointmentDate: "2026-11-26",
        startTime: "09:30",
        patientName: "  أ ",
        patientPhone: "01012345678",
      }),
      {
        success: false,
        error: "اكتب اسمك بالكامل (3 حروف على الأقل).",
        fieldErrors: {
          patientName: "اكتب اسمك بالكامل (3 حروف على الأقل).",
        },
      },
    );

    assert.deepEqual(
      parseCreateAppointmentInput({
        doctorId: VALID_DOCTOR_ID,
        appointmentDate: "2026-11-26",
        startTime: "09:30",
        patientName: "سارة محمود",
        patientPhone: "123",
      }),
      {
        success: false,
        error: "اكتب رقم موبايل صح (أرقام بس، من 7 لـ 20 رقم).",
        fieldErrors: {
          patientPhone: "اكتب رقم موبايل صح (أرقام بس، من 7 لـ 20 رقم).",
        },
      },
    );
  });

  it("uses the generic error when multiple fields fail and returns all fieldErrors", () => {
    assert.deepEqual(
      parseCreateAppointmentInput({
        doctorId: "bad",
        appointmentDate: "2026-02-31",
        startTime: "99:99",
        patientName: "أ".repeat(101),
        patientPhone: "abc",
      }),
      {
        success: false,
        error: "بيانات الحجز مش مظبوطة، راجعها وحاول تاني.",
        fieldErrors: {
          doctorId: "رقم الدكتور غير صحيح.",
          appointmentDate: "التاريخ غير صحيح.",
          startTime: "المعاد غير صحيح.",
          patientName: "الاسم طويل أوي، اختصره شوية.",
          patientPhone: "اكتب رقم موبايل صح (أرقام بس، من 7 لـ 20 رقم).",
        },
      },
    );
  });
});
