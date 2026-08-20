// Boje za zajednice.
//
// Prva verzija je imala dvanaest prigusenih boja, po jednu za svaku
// zajednicu. Provjera razlucivosti pokazala je da to ne valja: dvije boje
// (#7b5c8a i #4e6e8e) razlikuju se za manje od jednog stupnja pri
// deuteranopiji, a i s normalnim vidom je pola palete bilo na granici.
// Dvanaest prigusenih boja jednostavno ne moze biti razlicito.
//
// Zato ih je sada cetiri, provjereno razlicite u svim kombinacijama i pri
// sve tri vrste daltonizma, plus neutralna za sve ostalo. Manje boja, ali
// se stvarno razlikuju. Uz svaku boju svugdje stoji i naziv zajednice, pa
// boja nigdje nije jedini nosilac informacije.
//
// Ove boje su tamnije od onih u sucelju (--petrol, --mustard) jer moraju
// stajati kao male oznake na svijetloj podlozi, a ne kao velike plohe.

const PALETTE = [
  "#c04a24", // cigla
  "#d9a017", // senf
  "#0d9186", // petrolej
  "#4577cc", // plava
];

// Nije peta boja nego "sve ostalo". Namjerno je isprana i svjetlija od
// cetiri gornje da se vidi kako ne oznacava jednu zajednicu. Prema senfnoj
// je na granici razlucivosti, ali uz nju uvijek pise "ostale zajednice".
const OSTALO = "#b3b8ad";

// Jednobojna ljestvica za toplinsku kartu. Sekvencijalna mjera ide od
// svijetlog prema tamnom u istoj boji, nikad kroz duginu.
export const RAMP = ["#e8f0ee", "#bcd9d5", "#86bdb6", "#47a096", "#0d7c74"];

// Ocekuje id-ove poredane po velicini. Prve cetiri zajednice dobivaju
// boju, ostale zajednicku neutralnu.
export function buildColorMap(communityIds) {
  const map = new Map();
  communityIds.forEach((id, i) => {
    map.set(id, i < PALETTE.length ? PALETTE[i] : OSTALO);
  });
  return map;
}

export function colorFor(map, communityId) {
  return map.get(communityId) || OSTALO;
}

// Koliko je vrijednost udaljena od nule prema najvecoj, u koracima ljestvice.
export function rampFor(share, max) {
  if (!max || share <= 0) return RAMP[0];
  const i = Math.min(RAMP.length - 1, Math.round((share / max) * (RAMP.length - 1)));
  return RAMP[i];
}

export { PALETTE, OSTALO };
