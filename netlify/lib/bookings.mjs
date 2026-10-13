import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getStore } from "@netlify/blobs";

export const SLOTS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];

export const SERVICES = [
  "Dnevna šminka",
  "Večernja šminka",
  "Mladenačka šminka",
  "Maturska šminka",
  "Probna šminka",
  "Ostalo (napišite u napomeni)"
];

const STORE = "jmu-termini";
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const COOKIE = "jmu_session";

function blobs() {
  return getStore({ name: STORE, consistency: "strong" });
}

function apptKey(id) {
  return "appt:" + id;
}

function holdKey(date, time) {
  return "hold:" + date + ":" + time;
}

export function json(data, status, headers) {
  const out = new Headers(headers || {});
  out.set("content-type", "application/json; charset=utf-8");
  out.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { status: status || 200, headers: out });
}

function sarajevoParts() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Sarajevo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type).value;
  return { date: get("year") + "-" + get("month") + "-" + get("day"), hour: Number(get("hour")) };
}

function cleanText(value, max) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max);
}

export function validateBooking(input) {
  const name = cleanText(input && input.name, 80);
  const phone = cleanText(input && input.phone, 25);
  const service = cleanText(input && input.service, 80);
  const date = cleanText(input && input.date, 10);
  const time = cleanText(input && input.time, 5);
  const note = cleanText(input && input.note, 400);
  if (!name) return { error: "Unesite ime." };
  if (phone.replace(/\D/g, "").length < 8) return { error: "Unesite ispravan broj telefona." };
  if (!SERVICES.includes(service)) return { error: "Izaberite uslugu." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Izaberite datum." };
  if (!SLOTS.includes(time)) return { error: "Izaberite vrijeme." };
  const now = sarajevoParts();
  if (date < now.date) return { error: "Taj datum je prošao." };
  if (date === now.date && Number(time.slice(0, 2)) <= now.hour) return { error: "To vrijeme je prošlo." };
  return { value: { name, phone, service, date, time, note } };
}

async function updateIndex(mutator) {
  const store = blobs();
  for (let attempt = 0; attempt < 6; attempt++) {
    const cur = await store.getWithMetadata("index", { type: "json", consistency: "strong" });
    const ids = Array.isArray(cur && cur.data) ? cur.data : [];
    const next = mutator(ids.slice());
    if (!cur) {
      const created = await store.setJSON("index", next, { onlyIfNew: true });
      if (created.modified) return;
      continue;
    }
    if (cur.etag) {
      const updated = await store.setJSON("index", next, { onlyIfMatch: cur.etag });
      if (updated.modified) return;
      continue;
    }
    await store.setJSON("index", next);
    return;
  }
  throw new Error("index");
}

export async function takenTimes(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  const store = blobs();
  const found = await Promise.all(SLOTS.map(async (time) => {
    const id = await store.get(holdKey(date, time), { consistency: "strong" });
    return id ? time : null;
  }));
  return found.filter(Boolean);
}

export async function createBooking(input) {
  const parsed = validateBooking(input);
  if (parsed.error) return { status: 400, body: { error: parsed.error } };
  const item = parsed.value;
  const store = blobs();
  const id = Date.now().toString(36) + randomBytes(4).toString("hex");
  const hold = await store.set(holdKey(item.date, item.time), id, { onlyIfNew: true });
  if (!hold.modified) return { status: 409, body: { error: "Termin je zauzet." } };
  const booking = {
    id,
    name: item.name,
    phone: item.phone,
    service: item.service,
    date: item.date,
    time: item.time,
    note: item.note,
    status: "novi",
    created: new Date().toISOString()
  };
  try {
    await store.setJSON(apptKey(id), booking);
    await updateIndex((ids) => ids.concat(id));
  } catch (err) {
    await store.delete(holdKey(item.date, item.time)).catch(() => {});
    await store.delete(apptKey(id)).catch(() => {});
    throw err;
  }
  return { status: 201, body: { ok: true } };
}

export async function listBookings() {
  const store = blobs();
  const cur = await store.getWithMetadata("index", { type: "json", consistency: "strong" });
  const ids = Array.isArray(cur && cur.data) ? cur.data : [];
  const items = await Promise.all(ids.map((id) => store.get(apptKey(id), { type: "json", consistency: "strong" })));
  return items.filter(Boolean);
}

async function releaseHold(booking) {
  if (!booking) return;
  const store = blobs();
  const key = holdKey(booking.date, booking.time);
  const holder = await store.get(key, { consistency: "strong" });
  if (holder === booking.id) await store.delete(key);
}

export async function updateBooking(id, status) {
  if (!/^[a-z0-9]+$/i.test(String(id || ""))) return { status: 400, body: { error: "Nepoznat termin." } };
  if (!["potvrdjen", "otkazan", "novi"].includes(status)) return { status: 400, body: { error: "Nepoznat status." } };
  const store = blobs();
  const booking = await store.get(apptKey(id), { type: "json", consistency: "strong" });
  if (!booking) return { status: 404, body: { error: "Termin nije pronađen." } };
  booking.status = status;
  await store.setJSON(apptKey(id), booking);
  if (status === "otkazan") await releaseHold(booking);
  else await store.set(holdKey(booking.date, booking.time), booking.id);
  return { status: 200, body: { ok: true, bookings: await listBookings() } };
}

export async function deleteBooking(id) {
  if (!/^[a-z0-9]+$/i.test(String(id || ""))) return { status: 400, body: { error: "Nepoznat termin." } };
  const store = blobs();
  const booking = await store.get(apptKey(id), { type: "json", consistency: "strong" });
  if (booking) await releaseHold(booking);
  await store.delete(apptKey(id));
  await updateIndex((ids) => ids.filter((item) => item !== id));
  return { status: 200, body: { ok: true, bookings: await listBookings() } };
}

export function passwordKey() {
  return process.env.ADMIN_PASSWORD || "";
}

function mac(value) {
  return createHmac("sha256", "jmu-login").update(String(value)).digest();
}

export function passwordMatches(input) {
  const expected = passwordKey();
  if (!expected) return false;
  return timingSafeEqual(mac(input), mac(expected));
}

export function signSession() {
  const secret = passwordKey();
  if (!secret) return "";
  const payload = Buffer.from(JSON.stringify({
    exp: Date.now() + SESSION_MS,
    n: randomBytes(8).toString("hex")
  })).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return payload + "." + sig;
}

export function readSession(req) {
  const secret = passwordKey();
  if (!secret) return null;
  const raw = req.headers.get("cookie") || "";
  let token = "";
  for (const part of raw.split(/;\s*/)) {
    const eq = part.indexOf("=");
    if (eq > 0 && part.slice(0, eq) === COOKIE) token = decodeURIComponent(part.slice(eq + 1));
  }
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!data.exp || data.exp < Date.now()) return null;
    return data;
  } catch (err) {
    return null;
  }
}

function cookieSecure(req) {
  return (req.headers.get("x-forwarded-proto") || "").split(",")[0].trim() === "https";
}

export function sessionCookie(req, token) {
  const secure = cookieSecure(req) ? "; Secure" : "";
  if (!token) return COOKIE + "=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0" + secure;
  return COOKIE + "=" + token + "; HttpOnly; Path=/; SameSite=Lax; Max-Age=" + Math.floor(SESSION_MS / 1000) + secure;
}

function failKey(req) {
  const ip = req.headers.get("x-nf-client-connection-ip")
    || String(req.headers.get("x-forwarded-for") || "").split(",")[0].trim()
    || "local";
  return "fail:" + createHmac("sha256", "jmu-fail").update(ip).digest("hex").slice(0, 24);
}

export async function loginAllowed(req) {
  try {
    const row = await blobs().get(failKey(req), { type: "json", consistency: "strong" });
    if (row && row.until && row.until > Date.now()) return false;
  } catch (err) {
    return true;
  }
  return true;
}

export async function recordLoginFailure(req) {
  try {
    const store = blobs();
    const key = failKey(req);
    const row = await store.get(key, { type: "json", consistency: "strong" }) || { n: 0, until: 0 };
    const fresh = !row.until || row.until < Date.now() - 15 * 60 * 1000;
    const n = fresh ? 1 : (row.n || 0) + 1;
    const until = n >= 8 ? Date.now() + 10 * 60 * 1000 : 0;
    await store.setJSON(key, { n: until ? 0 : n, until });
  } catch (err) {
    /* lockout is best-effort */
  }
}

export async function clearLoginFailures(req) {
  try { await blobs().delete(failKey(req)); } catch (err) { /* ignore */ }
}
