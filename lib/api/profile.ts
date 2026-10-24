import { financialApiFetch } from "./client";
import type { AuthMe } from "./types";

type AuthMeUser = {
  id: string;
  firstName: string;
  lastName?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
};

type AuthMeResponse = { user: AuthMeUser };

function toAuthMe({ user }: AuthMeResponse): AuthMe {
  return {
    id: user.id,
    fullName: [user.firstName, user.lastName].filter(Boolean).join(" ").trim(),
    phone: user.phone?.trim() ? user.phone.trim() : null,
    avatarUrl: user.avatarUrl ?? null,
  };
}

/**
 * /auth/me answers with the full auth envelope ({ user, memberships }); the
 * profile only needs the account row, flattened to a single full name.
 */
export async function getAuthMe() {
  return toAuthMe(await financialApiFetch<AuthMeResponse>("/auth/me"));
}

/**
 * The profile edits one full-name field; the API still stores the split
 * first/last columns, so split on the first whitespace boundary.
 */
export function updateAuthMe(payload: { fullName: string; phone?: string; avatarUrl?: string }) {
  const [firstName, ...rest] = payload.fullName.trim().split(/\s+/);
  const body: { firstName: string; lastName: string; phone: string; avatarUrl?: string } = {
    firstName,
    lastName: rest.join(" "),
    phone: payload.phone?.trim() ?? "",
  };
  const avatarUrl = payload.avatarUrl?.trim() ?? "";
  if (avatarUrl) body.avatarUrl = avatarUrl;
  return financialApiFetch<AuthMeResponse>("/auth/me", {
    method: "PUT",
    body: JSON.stringify(body),
  }).then(toAuthMe);
}

export function changeAuthPassword(payload: { currentPassword: string; newPassword: string }) {
  return financialApiFetch<{ changed: boolean }>("/auth/me/password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
