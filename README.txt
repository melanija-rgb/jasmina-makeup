JASMINA MAKEUP - web stranica

FAJLOVI
  index.html   glavna stranica (usluge, forma za termine, kontakt, Google Maps)
  admin/index.html   admin stranica (prijava sa šifrom, pregled i upravljanje terminima)
  style.css    izgled (crna pozadina, zlatna slova)
  storage.js   čuvanje termina i provjera šifre

ADMIN
  Adresa:  /admin (link "Admin" je u podnožju glavne stranice)
  Početna šifra: Jasmina2026!
  Odmah nakon prve prijave kliknite "Promijeni šifru".

VAŽNO - ČUVANJE TERMINA I SIGURNOST
  Trenutno se termini čuvaju u pregledniku uređaja (localStorage). To znači:
  termin poslat sa telefona klijenta NE stiže na admin stranicu na vašem uređaju.
  Šifra je provjera u samom pregledniku i ne štiti podatke od tehnički upućene osobe.
  Za pravo korištenje potrebna je baza i server (npr. Firebase ili Supabase) -
  sav pristup podacima je u storage.js, pa se zamjenjuje samo taj fajl.

POSTAVLJANJE NA INTERNET
  Sve četiri datoteke stavite u isti folder na hosting (npr. Netlify, GitHub Pages ili vlastiti domen).
