import { cookies } from "next/headers";

const FIN_TOKEN = "fin_token";
const FIN_TENANT = "fin_tenant";

export async function getSession() {
  const store = await cookies();
  const token = store.get(FIN_TOKEN)?.value;
  const tenant = store.get(FIN_TENANT)?.value;
  return { token, tenant, isAuthenticated: Boolean(token) };
}

export async function setSession(token: string, tenant: string) {
  const store = await cookies();
  store.set(FIN_TOKEN, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  store.set(FIN_TENANT, tenant, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(FIN_TOKEN);
  store.delete(FIN_TENANT);
}
