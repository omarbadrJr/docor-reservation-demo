import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { AdminProfile, Database } from "@/types/database";
import { DEMO_STAFF_ACCOUNTS, seedDemoStaff } from "./seed-demo-staff";

type MockAuthUser = {
  id: string;
  email: string;
  password?: string;
  email_confirm?: boolean;
  user_metadata?: Record<string, unknown>;
};

type CreateUserCall = {
  email?: string;
  password?: string;
  email_confirm?: boolean;
  user_metadata?: Record<string, unknown>;
};

type UpdateUserCall = {
  id: string;
  attributes: {
    password?: string;
    email_confirm?: boolean;
    user_metadata?: Record<string, unknown>;
  };
};

type ProfileUpsertCall = {
  row: Database["public"]["Tables"]["admin_profiles"]["Insert"];
  options?: { onConflict?: string };
};

type MockClientOptions = {
  initialUsers?: MockAuthUser[];
  pagedUsers?: MockAuthUser[][];
  failListUsersMessage?: string;
  failCreateUserForEmail?: string;
  failUpdateUserForEmail?: string;
  failProfileUpsertForEmail?: string;
};

function createMockSupabaseAdmin(options: MockClientOptions = {}) {
  const usersById = new Map<string, MockAuthUser>();
  for (const user of options.initialUsers ?? []) {
    usersById.set(user.id, { ...user });
  }
  for (const page of options.pagedUsers ?? []) {
    for (const user of page) {
      usersById.set(user.id, { ...user });
    }
  }

  const profilesById = new Map<string, AdminProfile>();
  const listUsersCalls: Array<{ page?: number; perPage?: number }> = [];
  const createUserCalls: CreateUserCall[] = [];
  const updateUserCalls: UpdateUserCall[] = [];
  const upsertProfileCalls: ProfileUpsertCall[] = [];
  let nextId = 1;

  const client = {
    auth: {
      admin: {
        async listUsers(params?: { page?: number; perPage?: number }) {
          listUsersCalls.push({ page: params?.page, perPage: params?.perPage });

          if (options.failListUsersMessage) {
            return {
              data: { users: [] },
              error: { message: options.failListUsersMessage },
            };
          }

          if (options.pagedUsers) {
            const pageNumber = params?.page ?? 1;
            const pageIndex = pageNumber - 1;
            const pageUsers = options.pagedUsers[pageIndex] ?? [];
            const hasMore = pageNumber < options.pagedUsers.length;
            return {
              data: {
                users: pageUsers,
                aud: "authenticated",
                nextPage: hasMore ? pageNumber + 1 : null,
                lastPage: options.pagedUsers.length,
                total: options.pagedUsers.reduce(
                  (sum, page) => sum + page.length,
                  0
                ),
              },
              error: null,
            };
          }

          const allUsers = Array.from(usersById.values());
          return {
            data: {
              users: allUsers,
              aud: "authenticated",
              nextPage: null,
              lastPage: 1,
              total: allUsers.length,
            },
            error: null,
          };
        },

        async createUser(attributes: CreateUserCall) {
          createUserCalls.push(attributes);

          if (
            options.failCreateUserForEmail &&
            attributes.email === options.failCreateUserForEmail
          ) {
            return {
              data: { user: null },
              error: { message: "Auth createUser failed" },
            };
          }

          const id = `00000000-0000-4000-8000-${String(nextId++).padStart(
            12,
            "0"
          )}`;
          const createdUser: MockAuthUser = {
            id,
            email: attributes.email ?? "",
            password: attributes.password,
            email_confirm: attributes.email_confirm,
            user_metadata: attributes.user_metadata,
          };
          usersById.set(id, createdUser);

          return {
            data: { user: createdUser },
            error: null,
          };
        },

        async updateUserById(
          id: string,
          attributes: UpdateUserCall["attributes"]
        ) {
          updateUserCalls.push({ id, attributes });
          const existing = usersById.get(id);

          if (
            options.failUpdateUserForEmail &&
            existing?.email.toLowerCase() ===
              options.failUpdateUserForEmail.toLowerCase()
          ) {
            return {
              data: { user: null },
              error: { message: "Auth updateUserById failed" },
            };
          }

          if (!existing) {
            return {
              data: { user: null },
              error: { message: `Unknown user id: ${id}` },
            };
          }

          const updatedUser: MockAuthUser = {
            ...existing,
            password: attributes.password ?? existing.password,
            email_confirm: attributes.email_confirm ?? existing.email_confirm,
            user_metadata: attributes.user_metadata ?? existing.user_metadata,
          };
          usersById.set(id, updatedUser);

          return {
            data: { user: updatedUser },
            error: null,
          };
        },
      },
    },

    from(table: string) {
      assert.equal(table, "admin_profiles");

      return {
        async upsert(
          row: Database["public"]["Tables"]["admin_profiles"]["Insert"],
          upsertOptions?: { onConflict?: string }
        ) {
          upsertProfileCalls.push({ row, options: upsertOptions });

          if (
            options.failProfileUpsertForEmail &&
            row.email === options.failProfileUpsertForEmail
          ) {
            return {
              data: null,
              error: { message: "admin_profiles upsert constraint violation" },
            };
          }

          const now = "2026-01-01T00:00:00.000Z";
          profilesById.set(row.id, {
            id: row.id,
            name: row.name,
            email: row.email,
            role: row.role,
            clinic_id: row.clinic_id ?? null,
            is_active: row.is_active ?? true,
            created_at: now,
            updated_at: now,
          });

          return { data: null, error: null };
        },
      };
    },
  };

  return {
    adminClient: client as unknown as SupabaseClient<Database>,
    usersById,
    profilesById,
    listUsersCalls,
    createUserCalls,
    updateUserCalls,
    upsertProfileCalls,
  };
}

describe("DEMO_STAFF_ACCOUNTS", () => {
  it("defines 1 OWNER without clinicId and 3 RECEPTIONISTs matching the 3 seed clinics", () => {
    assert.equal(DEMO_STAFF_ACCOUNTS.length, 4);

    const emails = DEMO_STAFF_ACCOUNTS.map((account) => account.email);
    assert.equal(new Set(emails).size, 4);
    for (const account of DEMO_STAFF_ACCOUNTS) {
      assert.match(account.email, /^[a-z0-9.]+@beheira-demo\.example$/);
      assert.ok(account.name.trim().length > 0);
    }

    const owners = DEMO_STAFF_ACCOUNTS.filter(
      (account) => account.role === "OWNER"
    );
    assert.equal(owners.length, 1);
    assert.equal(owners[0].clinicId, null);

    const receptionists = DEMO_STAFF_ACCOUNTS.filter(
      (account) => account.role === "RECEPTIONIST"
    );
    assert.equal(receptionists.length, 3);

    const clinicIds = receptionists.map((account) => account.clinicId);
    assert.deepEqual(clinicIds, [
      "11000000-0000-0000-0000-000000000001",
      "11000000-0000-0000-0000-000000000002",
      "11000000-0000-0000-0000-000000000003",
    ]);
  });
});

describe("seedDemoStaff", () => {
  it("creates missing Auth users and upserts matching admin_profiles rows", async () => {
    const mock = createMockSupabaseAdmin();

    const result = await seedDemoStaff(mock.adminClient, "CustomPass!2026");

    assert.equal(result.accounts.length, 4);
    assert.equal(mock.listUsersCalls.length, 1);
    assert.deepEqual(mock.listUsersCalls[0], { page: 1, perPage: 1000 });
    assert.equal(mock.createUserCalls.length, 4);
    assert.equal(mock.updateUserCalls.length, 0);
    assert.equal(mock.upsertProfileCalls.length, 4);

    for (let i = 0; i < DEMO_STAFF_ACCOUNTS.length; i++) {
      const account = DEMO_STAFF_ACCOUNTS[i];
      const summary = result.accounts[i];
      const createCall = mock.createUserCalls[i];
      const upsertCall = mock.upsertProfileCalls[i];

      assert.equal(summary.email, account.email);
      assert.equal(summary.role, account.role);
      assert.equal(summary.clinicId, account.clinicId);
      assert.equal(summary.action, "created");

      assert.equal(createCall.email, account.email);
      assert.equal(createCall.password, "CustomPass!2026");
      assert.equal(createCall.email_confirm, true);
      assert.deepEqual(createCall.user_metadata, {
        name: account.name,
        role: account.role,
        clinic_id: account.clinicId,
      });

      assert.deepEqual(upsertCall.options, { onConflict: "id" });
      assert.deepEqual(upsertCall.row, {
        id: summary.userId,
        name: account.name,
        email: account.email,
        role: account.role,
        clinic_id: account.clinicId,
        is_active: true,
      });
    }
  });

  it("is idempotent on re-run and updates existing users across paginated listUsers", async () => {
    const mock = createMockSupabaseAdmin();
    const firstRun = await seedDemoStaff(mock.adminClient, "InitialPass!1");

    mock.createUserCalls.length = 0;
    mock.updateUserCalls.length = 0;
    mock.upsertProfileCalls.length = 0;

    const secondRun = await seedDemoStaff(mock.adminClient, "RotatedPass!2");

    assert.equal(mock.createUserCalls.length, 0);
    assert.equal(mock.updateUserCalls.length, 4);
    assert.equal(mock.upsertProfileCalls.length, 4);

    for (let i = 0; i < DEMO_STAFF_ACCOUNTS.length; i++) {
      assert.equal(secondRun.accounts[i].action, "updated");
      assert.equal(secondRun.accounts[i].userId, firstRun.accounts[i].userId);
      assert.equal(
        mock.updateUserCalls[i].id,
        firstRun.accounts[i].userId
      );
      assert.equal(
        mock.updateUserCalls[i].attributes.password,
        "RotatedPass!2"
      );
      assert.equal(mock.updateUserCalls[i].attributes.email_confirm, true);
    }

    const pagedMock = createMockSupabaseAdmin({
      pagedUsers: [
        [
          {
            id: "existing-owner-id",
            email: "OWNER@BEHEIRA-DEMO.EXAMPLE",
          },
        ],
        [
          {
            id: "existing-nile-id",
            email: "nile.reception@beheira-demo.example",
          },
        ],
      ],
    });

    const pagedResult = await seedDemoStaff(pagedMock.adminClient, "PagedPass!9");

    assert.deepEqual(pagedMock.listUsersCalls, [
      { page: 1, perPage: 1000 },
      { page: 2, perPage: 1000 },
    ]);
    assert.equal(pagedMock.updateUserCalls.length, 2);
    assert.equal(pagedMock.createUserCalls.length, 2);
    assert.equal(pagedResult.accounts[0].userId, "existing-owner-id");
    assert.equal(pagedResult.accounts[0].action, "updated");
    assert.equal(pagedResult.accounts[1].userId, "existing-nile-id");
    assert.equal(pagedResult.accounts[1].action, "updated");
    assert.equal(pagedResult.accounts[2].action, "created");
    assert.equal(pagedResult.accounts[3].action, "created");
  });

  it("rejects empty or short passwords before calling Supabase and supports DEMO_STAFF_PASSWORD", async () => {
    for (const invalidPassword of ["", "     ", "12345", "  abc  "]) {
      const mock = createMockSupabaseAdmin();
      await assert.rejects(
        () => seedDemoStaff(mock.adminClient, invalidPassword),
        /at least 6/
      );
      assert.equal(mock.listUsersCalls.length, 0);
      assert.equal(mock.createUserCalls.length, 0);
    }

    const previousEnvPassword = process.env.DEMO_STAFF_PASSWORD;
    try {
      process.env.DEMO_STAFF_PASSWORD = "EnvPassword!99";
      const envMock = createMockSupabaseAdmin();
      await seedDemoStaff(envMock.adminClient);
      assert.equal(envMock.createUserCalls[0].password, "EnvPassword!99");

      delete process.env.DEMO_STAFF_PASSWORD;
      const defaultMock = createMockSupabaseAdmin();
      await seedDemoStaff(defaultMock.adminClient);
      assert.equal(defaultMock.createUserCalls[0].password, "DemoStaff!2026");
    } finally {
      if (previousEnvPassword === undefined) {
        delete process.env.DEMO_STAFF_PASSWORD;
      } else {
        process.env.DEMO_STAFF_PASSWORD = previousEnvPassword;
      }
    }
  });

  it("propagates listUsers, createUser, updateUserById, and admin_profiles upsert errors", async () => {
    const listErrorMock = createMockSupabaseAdmin({
      failListUsersMessage: "Auth service unavailable",
    });
    await assert.rejects(
      () => seedDemoStaff(listErrorMock.adminClient, "ValidPass!1"),
      /Failed to list existing auth users \(page 1\): Auth service unavailable/
    );

    const createErrorMock = createMockSupabaseAdmin({
      failCreateUserForEmail: "nile.reception@beheira-demo.example",
    });
    await assert.rejects(
      () => seedDemoStaff(createErrorMock.adminClient, "ValidPass!1"),
      /Failed to create auth user for nile\.reception@beheira-demo\.example: Auth createUser failed/
    );

    const updateErrorMock = createMockSupabaseAdmin({
      initialUsers: [
        {
          id: "existing-owner-id",
          email: "owner@beheira-demo.example",
        },
      ],
      failUpdateUserForEmail: "owner@beheira-demo.example",
    });
    await assert.rejects(
      () => seedDemoStaff(updateErrorMock.adminClient, "ValidPass!1"),
      /Failed to update auth user for owner@beheira-demo\.example \(existing-owner-id\): Auth updateUserById failed/
    );

    const profileErrorMock = createMockSupabaseAdmin({
      failProfileUpsertForEmail: "beach.reception@beheira-demo.example",
    });
    await assert.rejects(
      () => seedDemoStaff(profileErrorMock.adminClient, "ValidPass!1"),
      /Failed to upsert admin_profile for beach\.reception@beheira-demo\.example \(.*\): admin_profiles upsert constraint violation/
    );
  });
});
