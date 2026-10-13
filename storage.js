/* Jasmina MakeUp — termini i admin prijava idu preko Netlify funkcija.
   Javna forma smije samo poslati zahtjev i vidjeti zauzeta vremena.
   Cijela lista termina vidljiva je samo prijavljenom adminu. */

var JMU = (function () {
  var BOOK = "/.netlify/functions/bookings";
  var ADMIN = "/.netlify/functions/admin";
  var SLOTS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];

  function call(url, options) {
    return fetch(url, Object.assign({
      credentials: "same-origin",
      headers: { "content-type": "application/json", "accept": "application/json" }
    }, options || {})).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        data._status = res.status;
        return data;
      });
    });
  }

  return {
    SLOTS: SLOTS,
    taken: function (date) {
      return call(BOOK + "?date=" + encodeURIComponent(date)).then(function (data) {
        if (data._status !== 200 || !Array.isArray(data.taken)) throw new Error("taken");
        return data.taken;
      });
    },
    add: function (a) {
      return call(BOOK, { method: "POST", body: JSON.stringify(a) }).then(function (data) {
        if (data._status === 200 || data._status === 201) return { ok: true };
        if (data._status === 409) return { ok: false, conflict: true };
        return { ok: false, error: data.error || "" };
      }).catch(function () { return { ok: false }; });
    },
    all: function () {
      return call(ADMIN).then(function (data) {
        if (data._status === 401 || data._status === 503) return { ok: false, status: data._status, error: data.error || "", bookings: [] };
        if (data._status !== 200 || !Array.isArray(data.bookings)) throw new Error("list");
        return { ok: true, bookings: data.bookings };
      });
    },
    update: function (id, patch) {
      return call(ADMIN, {
        method: "POST",
        body: JSON.stringify({ action: "update", id: id, status: patch.status })
      }).then(function (data) {
        if (data._status !== 200) throw new Error(data.error || "update");
        return data.bookings || [];
      });
    },
    remove: function (id) {
      return call(ADMIN, {
        method: "POST",
        body: JSON.stringify({ action: "delete", id: id })
      }).then(function (data) {
        if (data._status !== 200) throw new Error(data.error || "delete");
        return data.bookings || [];
      });
    },
    login: function (password) {
      return call(ADMIN, {
        method: "POST",
        body: JSON.stringify({ action: "login", password: password })
      }).then(function (data) {
        return { ok: data._status === 200, status: data._status, error: data.error || "" };
      }).catch(function () { return { ok: false, status: 0, error: "" }; });
    },
    logout: function () {
      return call(ADMIN, { method: "POST", body: JSON.stringify({ action: "logout" }) });
    },
    esc: function (s) {
      return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    }
  };
})();
