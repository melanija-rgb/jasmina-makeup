import { createBooking, json, takenTimes } from "../lib/bookings.mjs";

export default async (req) => {
  try {
    if (req.method === "GET") {
      const date = new URL(req.url).searchParams.get("date") || "";
      return json({ taken: await takenTimes(date) });
    }
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const result = await createBooking(body);
      return json(result.body, result.status);
    }
    return json({ error: "Metoda nije dozvoljena." }, 405);
  } catch (err) {
    console.error("bookings", err && err.message);
    return json({ error: "Greška pri slanju." }, 500);
  }
};
