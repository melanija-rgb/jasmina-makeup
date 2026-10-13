JASMINA MAKEUP - web stranica

FAJLOVI
  index.html            glavna stranica
  admin/index.html      admin stranica (prijava, pregled i upravljanje terminima)
  style.css             izgled
  storage.js            veza forme i admina sa serverom
  netlify/functions     čuvanje termina i provjera šifre
  netlify.toml          Netlify podešavanje

ADMIN
  Adresa: /admin
  Šifra nije u kodu. Postavlja se u Netlifyu kao ADMIN_PASSWORD.
  Nakon prijave vide se termini sa svih uređaja, mogu se potvrditi, otkazati ili obrisati.

ČUVANJE TERMINA
  Zahtjev sa forme čuva se u Netlify Blobs. Isti podaci se vide na admin stranici
  sa telefona, tableta ili računara. Zauzeto vrijeme više nije slobodno za druge klijente.

NETLIFY
  Potrebna je samo jedna podešena vrijednost: ADMIN_PASSWORD.
  Blobs rade bez dodatnog naloga ili baze.
