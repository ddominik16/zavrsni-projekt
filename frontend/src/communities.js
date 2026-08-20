// Nazivi zajednica NISU u bazi. Louvain vraca samo brojeve i nema pojma o
// zemljama ni zanrovima. Ove oznake su dodane rucno, nakon pregleda
// najpoznatijih clanova svake zajednice i medijana godine njihovih filmova.
//
// Zato broj ostaje vidljiv svugdje uz naziv: broj je ono sto je algoritam
// izracunao, naziv je ono sto sam ja iz toga procitao.
//
// vrsta:
//   drzava     zajednica odgovara nacionalnoj kinematografiji
//   razdoblje  ista kinematografija, ali odvojena po vremenu
//   zanr       nije nacionalna nego zanrovska
//   produkcija nije nacionalna nego nacin produkcije

const ZAJEDNICE = {
  55589: { naziv: "Suvremeni Hollywood", vrsta: "drzava" , kratko: "Hollywood" },
  36364: { naziv: "Klasični Hollywood / britanski", vrsta: "razdoblje" , kratko: "Klasični" },
  48083: { naziv: "Indijska", vrsta: "drzava" , kratko: "Indijska" },
  14008: { naziv: "Francuska", vrsta: "drzava" , kratko: "Francuska" },
  54471: { naziv: "Japanska", vrsta: "drzava" , kratko: "Japanska" },
  25070: { naziv: "Nezavisna / kanadska", vrsta: "drzava", nesigurno: true , kratko: "Nezavisna" },
  54157: { naziv: "Španjolska / latinoamerička", vrsta: "drzava" , kratko: "Španjolska" },
  61742: { naziv: "Nordijska", vrsta: "drzava" , kratko: "Nordijska" },
  5123: { naziv: "Britanska / irska", vrsta: "drzava" , kratko: "Britanska" },
  13676: { naziv: "Njemačka", vrsta: "drzava" , kratko: "Njemačka" },
  36590: { naziv: "Hongkonška / kineska", vrsta: "drzava" , kratko: "Hongkong" },
  51759: { naziv: "Turska", vrsta: "drzava" , kratko: "Turska" },
  1505: { naziv: "Australska", vrsta: "drzava" , kratko: "Australska" },
  68887: { naziv: "Talijanska", vrsta: "drzava" , kratko: "Talijanska" },
  1767: { naziv: "Britanski karakterni glumci", vrsta: "drzava" , kratko: "Karakterni" },
  22337: { naziv: "Nezavisni horor", vrsta: "zanr" , kratko: "Horor" },
  22492: { naziv: "Korejska", vrsta: "drzava" , kratko: "Korejska" },
  10565: { naziv: "Direct-to-video akcija", vrsta: "produkcija" , kratko: "DTV akcija" },
  10128: { naziv: "Balkanska / ruska", vrsta: "drzava" , kratko: "Balkan" },
  26346: { naziv: "Sinkronizacija i animacija", vrsta: "produkcija" , kratko: "Animacija" },
};

// Sve sto nije u tablici gore vraca samo broj, bez izmisljanja naziva.
export function zajednica(id) {
  const z = ZAJEDNICE[id];
  if (!z) return { id, naziv: null, vrsta: null, nesigurno: false };
  return { id, ...z };
}

// "Indijska (48083)" ili samo "48083" ako naziv ne postoji.
export function imeZajednice(id) {
  if (id === null || id === undefined) return "—";
  const z = ZAJEDNICE[id];
  return z ? `${z.naziv} (${id})` : String(id);
}

// Kratki naziv za zaglavlja tablica gdje nema mjesta za puni.
export function kratkoIme(id) {
  const z = ZAJEDNICE[id];
  if (!z) return String(id);
  return z.kratko || z.naziv;
}

export const OZNAKE_VRSTA = {
  razdoblje: "razdoblje",
  zanr: "žanr",
  produkcija: "produkcija",
};

export default ZAJEDNICE;
