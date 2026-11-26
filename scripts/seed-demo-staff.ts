/**
 * Fictional demo staff provisioning script (SRS §12).
 * All accounts below use RFC 2606 `.example` addresses and made-up Arabic
 * names strictly for demonstrating Owner and Clinic Receptionist workflows.
 *
 * Usage: npx tsx scripts/seed-demo-staff.ts
 */

import { pathToFileURL } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminRole, Database } from "@/types/database";

const DEFAULT_DEMO_STAFF_PASSWORD = "DemoStaff!2026";
const LIST_USERS_PER_PAGE = 1000;

export type DemoStaffAccount = {
  email: string;
  name: string;
  role: AdminRole;
  clinicId: string | null;
};

export const DEMO_STAFF_ACCOUNTS: readonly DemoStaffAccount[] = [
  {
    email: "owner@beheira-demo.example",
    name: "إدارة المنصة (تجريبي)",
    role: "OWNER",
    clinicId: null,
  },
  {
    email: "nile.reception@beheira-demo.example",
    name: "استقبال عيادة النيل (تجريبي)",
    role: "RECEPTIONIST",
    clinicId: "11000000-0000-0000-0000-000000000001",
  },
  {
    email: "beach.reception@beheira-demo.example",
    name: "استقبال عيادة الشاطئ (تجريبي)",
    role: "RECEPTIONIST",
    clinicId: "11000000-0000-0000-0000-000000000002",
  },
  {
    email: "station.reception@beheira-demo.example",
    name: "استقبال عيادة المحطة (تجريبي)",
    role: "RECEPTIONIST",
    clinicId: "11000000-0000-0000-0000-000000000003",
  },
];

export type SeedDemoStaffAccountResult = {
  email: string;
  userId: string;
  role: AdminRole;
  clinicId: string | null;
  action: "created" | "updated";
};

export type SeedDemoStaffResult = {
  accounts: SeedDemoStaffAccountResult[];
};

function resolveAndValidatePassword(password?: string): string {
  const resolvedPassword =
    password ?? process.env.DEMO_STAFF_PASSWORD ?? DEFAULT_DEMO_STAFF_PASSWORD;

  if (resolvedPassword.trim().length < 6) {
    throw new Error(
      "Demo staff password must be at least 6 non-whitespace characters."
    );
  }

  return resolvedPassword;
}

async function listExistingUsersByEmail(
  adminClient: SupabaseClient<Database>
): Promise<Map<string, { id: string }>> {
  const existingUsersByEmail = new Map<string, { id: string }>();
  let page = 1;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: LIST_USERS_PER_PAGE,
    });

    if (error) {
      throw new Error(
        `Failed to list existing auth users (page ${page}): ${error.message}`
      );
    }

    const users = data?.users ?? [];
    for (const user of users) {
      if (user.email) {
        existingUsersByEmail.set(user.email.toLowerCase(), { id: user.id });
      }
    }

    if (data && "nextPage" in data) {
      if (typeof data.nextPage === "number" && data.nextPage > page) {
        page = data.nextPage;
        continue;
      }
      break;
    }

    if (users.length < LIST_USERS_PER_PAGE) {
      break;
    }

    page += 1;
  }

  return existingUsersByEmail;
}

/**
 * Idempotently provisions fictional Owner and Clinic Receptionist Auth users
 * and their matching `admin_profiles` rows.
 */
export async function seedDemoStaff(
  adminClient: SupabaseClient<Database>,
  password?: string
): Promise<SeedDemoStaffResult> {
  const resolvedPassword = resolveAndValidatePassword(password);
  const existingUsersByEmail = await listExistingUsersByEmail(adminClient);
  const accounts: SeedDemoStaffAccountResult[] = [];

  for (const account of DEMO_STAFF_ACCOUNTS) {
    const normalizedEmail = account.email.toLowerCase();
    const existing = existingUsersByEmail.get(normalizedEmail);
    const userMetadata = {
      name: account.name,
      role: account.role,
      clinic_id: account.clinicId,
    };

    let userId: string;
    let action: "created" | "updated";

    if (!existing) {
      const { data, error } = await adminClient.auth.admin.createUser({
        email: account.email,
        password: resolvedPassword,
        email_confirm: true,
        user_metadata: userMetadata,
      });

      if (error || !data?.user) {
        throw new Error(
          `Failed to create auth user for ${account.email}: ${
            error?.message ?? "No user returned."
          }`
        );
      }

      userId = data.user.id;
      action = "created";
    } else {
      const { data, error } = await adminClient.auth.admin.updateUserById(
        existing.id,
        {
          password: resolvedPassword,
          email_confirm: true,
          user_metadata: userMetadata,
        }
      );

      if (error || !data?.user) {
        throw new Error(
          `Failed to update auth user for ${account.email} (${existing.id}): ${
            error?.message ?? "No user returned."
          }`
        );
      }

      userId = data.user.id;
      action = "updated";
    }

    const { error: profileError } = await adminClient
      .from("admin_profiles")
      .upsert(
        {
          id: userId,
          name: account.name,
          email: account.email,
          role: account.role,
          clinic_id: account.clinicId,
          is_active: true,
        },
        { onConflict: "id" }
      );

    if (profileError) {
      throw new Error(
        `Failed to upsert admin_profile for ${account.email} (${userId}): ${profileError.message}`
      );
    }

    existingUsersByEmail.set(normalizedEmail, { id: userId });
    accounts.push({
      email: account.email,
      userId,
      role: account.role,
      clinicId: account.clinicId,
      action,
    });
  }

  return { accounts };
}

async function main(): Promise<void> {
  const adminClient = createAdminClient();
  const result = await seedDemoStaff(adminClient);

  for (const account of result.accounts) {
    console.log(
      `[${account.action}] ${account.email} | role=${account.role} | clinicId=${
        account.clinicId ?? "none"
      }`
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Demo staff seeding failed: ${message}`);
    process.exit(1);
  });
}
