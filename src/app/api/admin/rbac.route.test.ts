import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GET as ownerMeGet } from "@/app/api/owner/me/route";
import { GET as receptionistMeGet } from "@/app/api/receptionist/me/route";
import { assertRole } from "@/services/auth";
import type { AuthErrorResponse, StaffProfile } from "@/types/auth";
import type { AdminRole } from "@/types/database";

import {
  createOwnerMeGetHandler,
  createReceptionistMeGetHandler,
} from "./_shared";

const OWNER_ID = "aa000000-0000-0000-0000-000000000001";
const RECEPTIONIST_ID = "aa000000-0000-0000-0000-000000000002";
const CLINIC_ID = "11000000-0000-0000-0000-000000000001";
const OTHER_CLINIC_ID = "11000000-0000-0000-0000-000000000002";

const OWNER_PROFILE: StaffProfile = {
  id: OWNER_ID,
  name: "أحمد شريف",
  email: "owner@example.com",
  role: "OWNER",
  clinicId: null,
  clinicName: null,
  isActive: true,
};

const RECEPTIONIST_PROFILE: StaffProfile = {
  id: RECEPTIONIST_ID,
  name: "منى إبراهيم",
  email: "receptionist@example.com",
  role: "RECEPTIONIST",
  clinicId: CLINIC_ID,
  clinicName: "عيادة النيل التخصصية",
  isActive: true,
};

function makeRequireAdminSpy(session: StaffProfile | null) {
  const requestedRoles: Array<readonly AdminRole[] | undefined> = [];

  const requireAdmin = async (
    allowedRoles?: readonly AdminRole[],
  ): Promise<StaffProfile> => {
    requestedRoles.push(allowedRoles);
    return assertRole(session, allowedRoles);
  };

  return { requireAdmin, requestedRoles };
}

describe("Admin RBAC route handlers", () => {
  it("exports Next.js GET handlers on /api/owner/me and /api/receptionist/me", () => {
    assert.equal(typeof ownerMeGet, "function");
    assert.equal(typeof receptionistMeGet, "function");
  });

  describe("GET /api/owner/me", () => {
    it("returns 401 UNAUTHORIZED when unauthenticated", async () => {
      const { requireAdmin, requestedRoles } = makeRequireAdminSpy(null);
      const handler = createOwnerMeGetHandler({ requireAdmin });

      const response = await handler();

      assert.equal(response.status, 401);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.deepEqual(requestedRoles, [["OWNER"]]);
      assert.deepEqual((await response.json()) as AuthErrorResponse, {
        error: "لازم تسجل دخول الأول.",
        code: "UNAUTHORIZED",
      });
    });

    it("returns 403 FORBIDDEN when called by a receptionist", async () => {
      const { requireAdmin } = makeRequireAdminSpy(RECEPTIONIST_PROFILE);
      const handler = createOwnerMeGetHandler({ requireAdmin });

      const response = await handler();

      assert.equal(response.status, 403);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.deepEqual((await response.json()) as AuthErrorResponse, {
        error: "معندكش صلاحية تدخل هنا.",
        code: "FORBIDDEN",
      });
    });

    it("returns 403 ACCOUNT_INACTIVE when owner profile is inactive", async () => {
      const { requireAdmin } = makeRequireAdminSpy({
        ...OWNER_PROFILE,
        isActive: false,
      });
      const handler = createOwnerMeGetHandler({ requireAdmin });

      const response = await handler();

      assert.equal(response.status, 403);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.deepEqual((await response.json()) as AuthErrorResponse, {
        error: "الحساب ده غير نشط حالياً.",
        code: "ACCOUNT_INACTIVE",
      });
    });

    it("returns 200 with owner user and Cache-Control: no-store", async () => {
      const { requireAdmin, requestedRoles } =
        makeRequireAdminSpy(OWNER_PROFILE);
      const handler = createOwnerMeGetHandler({ requireAdmin });

      const response = await handler();

      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.deepEqual(requestedRoles, [["OWNER"]]);
      assert.deepEqual(await response.json(), { user: OWNER_PROFILE });
    });
  });

  describe("GET /api/receptionist/me", () => {
    it("returns 401 UNAUTHORIZED when unauthenticated", async () => {
      const { requireAdmin, requestedRoles } = makeRequireAdminSpy(null);
      const handler = createReceptionistMeGetHandler({ requireAdmin });

      const response = await handler(
        new Request("http://localhost/api/receptionist/me"),
      );

      assert.equal(response.status, 401);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.deepEqual(requestedRoles, [["RECEPTIONIST"]]);
      assert.deepEqual((await response.json()) as AuthErrorResponse, {
        error: "لازم تسجل دخول الأول.",
        code: "UNAUTHORIZED",
      });
    });

    it("returns 403 FORBIDDEN when called by an owner", async () => {
      const { requireAdmin } = makeRequireAdminSpy(OWNER_PROFILE);
      const handler = createReceptionistMeGetHandler({ requireAdmin });

      const response = await handler(
        new Request("http://localhost/api/receptionist/me"),
      );

      assert.equal(response.status, 403);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.deepEqual((await response.json()) as AuthErrorResponse, {
        error: "معندكش صلاحية تدخل هنا.",
        code: "FORBIDDEN",
      });
    });

    it("returns 200 for receptionist without ?clinicId= or with blank ?clinicId=", async () => {
      const { requireAdmin, requestedRoles } =
        makeRequireAdminSpy(RECEPTIONIST_PROFILE);
      const handler = createReceptionistMeGetHandler({ requireAdmin });

      const withoutParam = await handler(
        new Request("http://localhost/api/receptionist/me"),
      );
      assert.equal(withoutParam.status, 200);
      assert.equal(withoutParam.headers.get("cache-control"), "no-store");
      assert.deepEqual(await withoutParam.json(), {
        user: RECEPTIONIST_PROFILE,
      });

      const blankParam = await handler(
        new Request("http://localhost/api/receptionist/me?clinicId=%20%20"),
      );
      assert.equal(blankParam.status, 200);
      assert.equal(blankParam.headers.get("cache-control"), "no-store");
      assert.deepEqual(await blankParam.json(), {
        user: RECEPTIONIST_PROFILE,
      });

      assert.deepEqual(requestedRoles, [["RECEPTIONIST"], ["RECEPTIONIST"]]);
    });

    it("returns 200 for receptionist querying their own ?clinicId=", async () => {
      const { requireAdmin } = makeRequireAdminSpy(RECEPTIONIST_PROFILE);
      const handler = createReceptionistMeGetHandler({ requireAdmin });

      const response = await handler(
        new Request(
          `http://localhost/api/receptionist/me?clinicId=${CLINIC_ID}`,
        ),
      );

      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.deepEqual(await response.json(), { user: RECEPTIONIST_PROFILE });

      const paddedResponse = await handler(
        new Request(
          `http://localhost/api/receptionist/me?clinicId=%20${CLINIC_ID}%20`,
        ),
      );
      assert.equal(paddedResponse.status, 200);
      assert.equal(paddedResponse.headers.get("cache-control"), "no-store");
    });

    it("returns 403 FORBIDDEN for receptionist querying another ?clinicId=", async () => {
      const { requireAdmin } = makeRequireAdminSpy(RECEPTIONIST_PROFILE);
      const handler = createReceptionistMeGetHandler({ requireAdmin });

      const response = await handler(
        new Request(
          `http://localhost/api/receptionist/me?clinicId=${OTHER_CLINIC_ID}`,
        ),
      );

      assert.equal(response.status, 403);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.deepEqual((await response.json()) as AuthErrorResponse, {
        error: "معندكش صلاحية تدخل على بيانات عيادة تانية.",
        code: "FORBIDDEN",
      });
    });
  });
});
