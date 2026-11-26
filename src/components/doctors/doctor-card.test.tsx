import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { DoctorCardData } from "@/types/catalog";

import { DoctorCard } from "./doctor-card";

const ID = "33000000-0000-0000-0000-000000000001";

const doctor: DoctorCardData = {
  id: ID,
  fullName: "د. أحمد مصطفى",
  specialtyName: "باطنة",
  bio: null,
  clinicName: "عيادة النيل",
  clinicAddress: "شارع النيل، الدنجاوة، البحيرة",
  consultationFee: "150.00",
  photoUrl: null,
};

describe("DoctorCard", () => {
  it("prints the doctor details, fallback photo, booking button, and profile link", () => {
    const html = renderToStaticMarkup(<DoctorCard doctor={doctor} />);

    assert.match(html, /د\. أحمد مصطفى/);
    assert.match(html, /باطنة/);
    assert.match(html, /عيادة النيل/);
    assert.match(html, /شارع النيل، الدنجاوة، البحيرة/);
    assert.match(html, /150 جنيه/);
    assert.match(html, /مفيش وصف مضاف للدكتور/);
    assert.match(html, /صورة غير متاحة لـ د\. أحمد مصطفى/);
    assert.match(
      html,
      /href="\/booking\?doctorId=33000000-0000-0000-0000-000000000001"[^>]*>احجز عند الدكتور/,
    );
    assert.match(
      html,
      /href="\/doctors\/33000000-0000-0000-0000-000000000001"[^>]*>تفاصيل الدكتور/,
    );
  });

  it("renders the doctor photograph when photoUrl is present", () => {
    const html = renderToStaticMarkup(
      <DoctorCard
        doctor={{ ...doctor, photoUrl: "/doctors/demo-portrait.svg" }}
      />,
    );

    assert.match(html, /<img[^>]+alt="صورة د\. أحمد مصطفى"/);
    assert.match(html, /<img[^>]+src="\/doctors\/demo-portrait\.svg"/);
  });
});
