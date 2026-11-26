import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { DoctorProfileData } from "@/types/catalog";

import { DoctorProfile } from "./doctor-profile";

const ID = "33000000-0000-0000-0000-000000000001";

const doctor: DoctorProfileData = {
  id: ID,
  fullName: "د. أحمد مصطفى",
  specialtyName: "باطنة",
  bio: "متابعة أمراض الجهاز الهضمي",
  clinicName: "عيادة النيل",
  clinicAddress: "شارع النيل، الدنجاوة، البحيرة",
  consultationFee: "150.00",
  photoUrl: null,
  qualifications: "بكالوريوس طب - زمالة باطنة",
  experienceYears: 12,
  workingSchedule: [
    { day_of_week: 0, start_time: "09:00:00", end_time: "17:00:00" },
  ],
};

describe("DoctorProfile", () => {
  it("prints the full slip and links to available slots", () => {
    const html = renderToStaticMarkup(<DoctorProfile doctor={doctor} />);

    assert.match(html, /د\. أحمد مصطفى/);
    assert.match(html, /باطنة/);
    assert.match(html, /بكالوريوس طب - زمالة باطنة/);
    assert.match(html, /12 سنين خبرة/);
    assert.match(html, /عيادة النيل/);
    assert.match(html, /شارع النيل، الدنجاوة، البحيرة/);
    assert.match(html, /عنوان العيادة/);
    assert.match(html, /150 جنيه/);
    assert.match(html, /الأحد: 9:00 الصبح - 5:00 بالليل/);
    assert.match(html, /المواعيد المتاحة/);
    assert.match(html, /href="\/booking\?doctorId=33000000-0000-0000-0000-000000000001"/);
  });
});
