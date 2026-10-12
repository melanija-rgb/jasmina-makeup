/* Jasmina MakeUp - zajednički kod za glavnu i admin stranicu
   VAŽNO: termini se trenutno čuvaju u pregledniku (localStorage) uređaja na kojem je stranica otvorena.
   Da bi termini sa telefona klijenata stizali na admin stranicu na drugom uređaju,
   potreban je server/baza (vidi README.txt). Cijeli pristup bazi je na jednom mjestu - ovdje. */

var JMU = (function () {
  var APPT_KEY = 'jmu_termini';
  var PASS_KEY = 'jmu_admin_hash';
  var SESSION_KEY = 'jmu_admin_session';

  // SHA-256 hash lozinke "Jasmina2026!" - promijeni lozinku u admin panelu (Promijeni lozinku)
  var DEFAULT_HASH = '9fac4d42c744b54fdadc13cca87a816359a9216d2480c6924a8c0fcb570bd5ae';

  // Radno vrijeme / termini (promijeni po potrebi)
  var SLOTS = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'];

  function sha256(ascii) {
    function rr(v, a) { return (v >>> a) | (v << (32 - a)); }
    var mathPow = Math.pow, maxWord = mathPow(2, 32), lp = 'length', i, j, result = '';
    var words = [], bitLen = ascii[lp] * 8;
    var hash = sha256.h = sha256.h || [], k = sha256.k = sha256.k || [], pc = k[lp], comp = {};
    for (var c = 2; pc < 64; c++) {
      if (!comp[c]) {
        for (i = 0; i < 313; i += c) comp[i] = c;
        hash[pc] = (mathPow(c, .5) * maxWord) | 0;
        k[pc++] = (mathPow(c, 1 / 3) * maxWord) | 0;
      }
    }
    ascii += '\x80';
    while (ascii[lp] % 64 - 56) ascii += '\x00';
    for (i = 0; i < ascii[lp]; i++) {
      j = ascii.charCodeAt(i);
      if (j >> 8) return null;
      words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words[lp]] = (bitLen / maxWord) | 0;
    words[words[lp]] = bitLen;
    for (j = 0; j < words[lp];) {
      var w = words.slice(j, j += 16), old = hash;
      hash = hash.slice(0, 8);
      for (i = 0; i < 64; i++) {
        var w15 = w[i - 15], w2 = w[i - 2], a = hash[0], e = hash[4];
        var t1 = hash[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & hash[5]) ^ (~e & hash[6])) + k[i] +
          (w[i] = (i < 16) ? w[i] : (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
        var t2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(t1 + t2) | 0].concat(hash);
        hash[4] = (hash[4] + t1) | 0;
      }
      for (i = 0; i < 8; i++) hash[i] = (hash[i] + old[i]) | 0;
    }
    for (i = 0; i < 8; i++) for (j = 3; j + 1; j--) {
      var b = (hash[i] >> (j * 8)) & 255;
      result += ((b < 16) ? 0 : '') + b.toString(16);
    }
    return result;
  }
  function hashPass(p) { return sha256(unescape(encodeURIComponent('jmu::' + p))); }

  function load() {
    try { return JSON.parse(localStorage.getItem(APPT_KEY)) || []; } catch (e) { return []; }
  }
  function save(list) {
    try { localStorage.setItem(APPT_KEY, JSON.stringify(list)); return true; } catch (e) { return false; }
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  return {
    SLOTS: SLOTS,
    all: load,
    add: function (a) {
      var list = load();
      a.id = uid(); a.status = 'novi'; a.created = new Date().toISOString();
      list.push(a);
      return save(list);
    },
    update: function (id, patch) {
      var list = load();
      list.forEach(function (x) { if (x.id === id) Object.assign(x, patch); });
      save(list);
    },
    remove: function (id) { save(load().filter(function (x) { return x.id !== id; })); },
    // zauzeti termini za datum (otkazani ne računaju)
    taken: function (date) {
      return load().filter(function (x) { return x.date === date && x.status !== 'otkazan'; })
                   .map(function (x) { return x.time; });
    },
    checkPass: function (p) {
      var stored = null;
      try { stored = localStorage.getItem(PASS_KEY); } catch (e) {}
      return hashPass(p) === (stored || DEFAULT_HASH);
    },
    setPass: function (p) { try { localStorage.setItem(PASS_KEY, hashPass(p)); return true; } catch (e) { return false; } },
    login: function () { try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (e) {} },
    logout: function () { try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {} },
    isLoggedIn: function () { try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch (e) { return false; } },
    esc: function (s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    },
    _hashPass: hashPass
  };
})();
