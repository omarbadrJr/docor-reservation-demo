import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import NotFound from "@/app/not-found";
import OwnerError from "@/app/owner/error";
import ReceptionistError from "@/app/receptionist/error";
import { DEMO_STAFF_ACCOUNTS } from "../../scripts/seed-demo-staff";

const ROOT = process.cwd();

function walkFiles(
  dir: string,
  predicate: (filePath: string) => boolean,
  acc: string[] = [],
): string[] {
  if (!fs.existsSync(dir)) {
    return acc;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, predicate, acc);
    } else if (predicate(fullPath)) {
      acc.push(fullPath);
    }
  }
  return acc;
}

describe("Phase 12 Security & Release Readiness Audit", () => {
  it("never exposes SUPABASE_SERVICE_ROLE_KEY or admin client helpers in client components or NEXT_PUBLIC_ variables", () => {
    const sourceFiles = walkFiles(
      path.join(ROOT, "src"),
      (file) => /\.(ts|tsx)$/.test(file) && !/\.test\./.test(file),
    );

    const violations: string[] = [];
    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, "utf8");
      const rel = path.relative(ROOT, file);
      const isClientComponent = /^["']use client["']/.test(content.trimStart());

      if (
        isClientComponent &&
        /lib\/supabase\/admin|createAdminClient|getSupabaseServiceRoleKey|SUPABASE_SERVICE_ROLE_KEY/.test(
          content,
        )
      ) {
        violations.push(`client import/reference in ${rel}`);
      }

      if (/NEXT_PUBLIC_[A-Z0-9_]*(SERVICE|SECRET|PRIVATE)/.test(content)) {
        violations.push(`NEXT_PUBLIC secret variable in ${rel}`);
      }
    }

    assert.deepEqual(violations, []);
  });

  it("enforces server-side RBAC on every owner and receptionist API route handler", () => {
    const ownerSchedulesSrc = fs.readFileSync(
      path.join(ROOT, "src/services/owner-schedules.ts"),
      "utf8",
    );
    const ownerDoctorsSrc = fs.readFileSync(
      path.join(ROOT, "src/services/owner-doctors.ts"),
      "utf8",
    );
    const ownerClinicsSrc = fs.readFileSync(
      path.join(ROOT, "src/services/owner-clinics.ts"),
      "utf8",
    );
    const ownerSpecialtiesSrc = fs.readFileSync(
      path.join(ROOT, "src/services/owner-specialties.ts"),
      "utf8",
    );
    const ownerReceptionistsSrc = fs.readFileSync(
      path.join(ROOT, "src/services/owner-receptionists.ts"),
      "utf8",
    );
    const ownerAppointmentsSrc = fs.readFileSync(
      path.join(ROOT, "src/services/owner-appointments.ts"),
      "utf8",
    );
    const adminSharedSrc = fs.readFileSync(
      path.join(ROOT, "src/app/api/admin/_shared.ts"),
      "utf8",
    );
    const receptionistSrc = fs.readFileSync(
      path.join(ROOT, "src/services/receptionist-appointments.ts"),
      "utf8",
    );

    const moduleSources: Record<string, string> = {
      "@/services/owner-schedules": ownerSchedulesSrc,
      "@/services/owner-doctors": ownerDoctorsSrc,
      "@/services/owner-clinics": ownerClinicsSrc,
      "@/services/owner-specialties": ownerSpecialtiesSrc,
      "@/services/owner-receptionists": ownerReceptionistsSrc,
      "@/services/owner-appointments": ownerAppointmentsSrc,
      "@/app/api/admin/_shared": adminSharedSrc,
      "@/services/receptionist-appointments": receptionistSrc,
    };

    const ownerRoutes = walkFiles(
      path.join(ROOT, "src/app/api/owner"),
      (file) => path.basename(file) === "route.ts",
    );
    assert.ok(ownerRoutes.length >= 15);

    for (const routeFile of ownerRoutes) {
      const content = fs.readFileSync(routeFile, "utf8");
      const importMatch = content.match(/from\s+"([^"]+)"/);
      assert.ok(importMatch, `Expected factory import in ${routeFile}`);
      const targetSource = moduleSources[importMatch[1]];
      assert.ok(
        targetSource && targetSource.includes('requireAdmin(["OWNER"])'),
        `Owner route ${path.relative(ROOT, routeFile)} must enforce requireAdmin(["OWNER"])`,
      );
    }

    const receptionistRoutes = walkFiles(
      path.join(ROOT, "src/app/api/receptionist"),
      (file) => path.basename(file) === "route.ts",
    );
    assert.ok(receptionistRoutes.length >= 6);

    for (const routeFile of receptionistRoutes) {
      const content = fs.readFileSync(routeFile, "utf8");
      const importMatch = content.match(/from\s+"([^"]+)"/);
      assert.ok(importMatch, `Expected factory import in ${routeFile}`);
      const targetSource = moduleSources[importMatch[1]];
      assert.ok(
        targetSource &&
          targetSource.includes('requireAdmin(["RECEPTIONIST"])') &&
          (targetSource.includes("assertReceptionistClinic") ||
            targetSource.includes("assertClinicAccess")),
        `Receptionist route ${path.relative(ROOT, routeFile)} must enforce RECEPTIONIST role & clinic isolation`,
      );
    }
  });

  it("documents environment variables cleanly in .env.example and keeps real .env files ignored", () => {
    const envExample = fs.readFileSync(path.join(ROOT, ".env.example"), "utf8");
    const gitignore = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8");

    assert.match(envExample, /^NEXT_PUBLIC_SUPABASE_URL=/m);
    assert.match(envExample, /^NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=/m);
    assert.match(envExample, /^SUPABASE_SERVICE_ROLE_KEY=\s*$/m);
    assert.match(envExample, /DEMO_STAFF_PASSWORD=/);
    assert.doesNotMatch(envExample, /eyJ[A-Za-z0-9_-]{10,}/);

    assert.match(gitignore, /^\.env$/m);
    assert.match(gitignore, /^\.env\.\*$/m);
    assert.match(gitignore, /^!\.env\.example$/m);
  });

  it("verifies SRS §12 fictional demo dataset completeness in seed.sql and seed-demo-staff.ts", () => {
    const seedSql = fs.readFileSync(
      path.join(ROOT, "supabase/seed.sql"),
      "utf8",
    );

    assert.match(seedSql, /DEMO \/ FICTIONAL DATA/);

    const clinicIds = seedSql.match(/'11000000-0000-0000-0000-00000000000\d'/g) ?? [];
    assert.ok(new Set(clinicIds).size >= 3, "Expected >= 3 fictional clinics");

    const specialtyIds = seedSql.match(/'22000000-0000-0000-0000-00000000000\d'/g) ?? [];
    assert.ok(
      new Set(specialtyIds).size >= 5,
      "Expected >= 5 fictional specialties",
    );

    const doctorIds = seedSql.match(/'33000000-0000-0000-0000-00000000000\d'/g) ?? [];
    assert.ok(new Set(doctorIds).size > 5, "Expected > 5 fictional doctors");
    assert.match(seedSql, /غير نشط \(تجريبي\)/);

    assert.match(seedSql, /insert into public\.weekly_schedules/);
    assert.match(seedSql, /insert into public\.manual_availability/);
    assert.match(seedSql, /insert into public\.schedule_exceptions/);
    assert.match(seedSql, /'CLOSED'/);
    assert.match(seedSql, /'MODIFIED_HOURS'/);
    assert.match(seedSql, /'EXTRA_HOURS'/);

    for (const status of [
      "CONFIRMED",
      "CHECKED_IN",
      "COMPLETED",
      "CANCELLED",
      "NO_SHOW",
    ]) {
      assert.match(seedSql, new RegExp(`'${status}'`));
    }

    const ownerAccounts = DEMO_STAFF_ACCOUNTS.filter((a) => a.role === "OWNER");
    const receptionistAccounts = DEMO_STAFF_ACCOUNTS.filter(
      (a) => a.role === "RECEPTIONIST",
    );
    assert.ok(ownerAccounts.length >= 1, "Expected >= 1 demo owner");
    assert.ok(
      receptionistAccounts.length >= 3,
      "Expected 1 demo receptionist per demo clinic",
    );
    assert.ok(
      DEMO_STAFF_ACCOUNTS.every((a) => a.email.endsWith(".example")),
      "All demo staff emails must use RFC 2606 .example domain",
    );
  });

  it("configures production security headers and dynamic Supabase image remotePatterns", () => {
    const nextConfigSrc = fs.readFileSync(
      path.join(ROOT, "next.config.ts"),
      "utf8",
    );

    assert.match(nextConfigSrc, /poweredByHeader:\s*false/);
    assert.match(nextConfigSrc, /X-Content-Type-Options/);
    assert.match(nextConfigSrc, /X-Frame-Options/);
    assert.match(nextConfigSrc, /Referrer-Policy/);
    assert.match(nextConfigSrc, /Permissions-Policy/);
    assert.match(nextConfigSrc, /camera=\(self\)/);
    assert.match(nextConfigSrc, /\*\.supabase\.co/);
  });

  it("renders global not-found and owner/receptionist error boundaries in Egyptian Arabic without warnings", () => {
    const notFoundHtml = renderToStaticMarkup(createElement(NotFound));
    assert.match(notFoundHtml, /الصفحة دي مش موجودة/);
    assert.match(notFoundHtml, /الرجوع للرئيسية/);
    assert.match(notFoundHtml, /احجز عند دكتور/);

    const ownerErrorHtml = renderToStaticMarkup(
      createElement(OwnerError, { error: new Error("boom"), reset: () => {} }),
    );
    assert.match(ownerErrorHtml, /حصلت مشكلة في تحميل الصفحة/);
    assert.match(ownerErrorHtml, /جرّب تاني/);
    assert.doesNotMatch(ownerErrorHtml, /boom/);

    const receptionistErrorHtml = renderToStaticMarkup(
      createElement(ReceptionistError, {
        error: new Error("secret-db-err"),
        reset: () => {},
      }),
    );
    assert.match(receptionistErrorHtml, /حصلت مشكلة في تحميل الصفحة/);
    assert.match(receptionistErrorHtml, /جرّب تاني/);
    assert.doesNotMatch(receptionistErrorHtml, /secret-db-err/);
  });
});
