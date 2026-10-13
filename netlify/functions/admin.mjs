import {
  clearLoginFailures,
  deleteBooking,
  json,
  listBookings,
  loginAllowed,
  passwordMatches,
  readSession,
  recordLoginFailure,
  sessionCookie,
  signSession,
  updateBooking
} from "../lib/bookings.mjs";

function passwordKeyExists() {
  return Boolean(process.env.ADMIN_PASSWORD);
}

async function requireSession(req) {
  if (!passwordKeyExists()) return json({ error: "Prijava trenutno nije podešena." }, 503);
  if (!readSession(req)) return json({ error: "Niste prijavljeni." }, 401);
  return null;
}

export default async (req) => {
  try {
    if (req.method === "GET") {
      const denied = await requireSession(req);
      if (denied) return denied;
      return json({ bookings: await listBookings() });
    }
    if (req.method !== "POST") return json({ error: "Metoda nije dozvoljena." }, 405);
    const body = await req.json().catch(() => ({}));
    if (body.action === "logout") {
      return json({ ok: true }, 200, { "set-cookie": sessionCookie(req, "") });
    }
    if (body.action === "login") {
      if (!passwordKeyExists()) return json({ error: "Prijava trenutno nije podešena." }, 503);
      if (!(await loginAllowed(req))) {
        return json({ error: "Previše pokušaja. Pokušajte ponovo za nekoliko minuta." }, 429);
      }
      if (!passwordMatches(body.password || "")) {
        await recordLoginFailure(req);
        return json({ error: "Pogrešna šifra." }, 401);
      }
      await clearLoginFailures(req);
      return json({ ok: true }, 200, { "set-cookie": sessionCookie(req, signSession()) });
    }
    const denied = await requireSession(req);
    if (denied) return denied;
    if (body.action === "update") {
      const result = await updateBooking(body.id, body.status);
      return json(result.body, result.status);
    }
    if (body.action === "delete") {
      const result = await deleteBooking(body.id);
      return json(result.body, result.status);
    }
    return json({ error: "Nepoznata radnja." }, 400);
  } catch (err) {
    console.error("admin", err && err.message);
    return json({ error: "Greška na serveru." }, 500);
  }
};
