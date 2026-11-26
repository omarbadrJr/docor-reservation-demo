import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { SpecialtyCard } from "./specialty-card";

const ID = "22000000-0000-0000-0000-000000000001";

describe("SpecialtyCard", () => {
  it("links to the doctors list for that specialty", () => {
    const html = renderToStaticMarkup(
      <SpecialtyCard
        specialty={{ id: ID, name: "باطنة", description: "أمراض الجهاز الهضمي" }}
      />,
    );

    assert.match(html, /href="\/doctors\?specialtyId=22000000-0000-0000-0000-000000000001"/);
    assert.match(html, /باطنة/);
    assert.match(html, /أمراض الجهاز الهضمي/);
  });

  it("still renders when the description is missing", () => {
    const html = renderToStaticMarkup(
      <SpecialtyCard specialty={{ id: ID, name: "قلب", description: null }} />,
    );

    assert.match(html, /قلب/);
  });
});
