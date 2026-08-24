# Filmski Graf

Web aplikacija nad Neo4j grafom filmske suradnje. Dio zavrsnog rada.

Baza sadrzi oko 166 tisuca osoba i 19 tisuca filmova, a iz zajednickih
pojavljivanja izvedeno je 784 tisuce veza suradnje. Nad tim grafom su
pokrenuti GDS algoritmi za centralnost i detekciju zajednica, a rezultati su
zapisani natrag na cvorove — aplikacija ih samo cita i nista ne racuna u
trenutku otvaranja stranice.

Cetiri su dijela: pregled brojki, sustav preporuka, istrazivac mreze i
analitika centralnosti.


## Kako pokrenuti

Treba samo Docker. Ni Python ni Node ni Neo4j se ne instaliraju rucno.

```
git clone https://github.com/ddominik16/zavrsni-projekt
cd zavrsni-projekt
cp .env.example .env          # na Windowsu: copy .env.example .env
```

U `.env` upisi lozinku po izboru; Neo4j trazi barem osam znakova. Zatim:

```
docker compose up --build
```

| Sto | Adresa |
|---|---|
| Aplikacija | http://localhost:5173 |
| API i dokumentacija | http://localhost:8000/docs |
| Neo4j Browser | http://localhost:7474 |

Prvi build traje najduze jer se skidaju slike i GDS plugin, pa tada treba
internet.

**Baza se digne prazna, pa su na pocetku sve stranice prazne.** 

### Punjenje baze

Dump nije u repozitoriju jer je prevelik za git. Skini `neo4j.dump` sa
stranice **Releases** ovog repozitorija i spremi ga u `neo4j/backups/`.
Onda, uz zaustavljenu bazu:

```
docker compose stop neo4j
docker compose --profile tools run --rm neo4j-admin
docker compose start neo4j
```

Datoteka mora biti imenovana `neo4j.dump` jer se ucitava u bazu `neo4j`.
Ucitavanje ide zasebnom slikom `neo4j/neo4j-admin`, koja je u compose
datoteci pod profilom `tools` pa se ne dize sama.

Provjera u Neo4j Browseru na http://localhost:7474:

```cypher
MATCH (p:Person) RETURN count(p);
```

Zaustavljanje je `docker compose down`. Podaci prezive gasenje jer stoje u
imenovanom volumenu `neo4j-data`; `docker compose down -v` brise i njih.

### Pokretanje bez Dockera

Trebaju dva terminala i pokrenuta lokalna Neo4j instanca.

```
cd backend
python -m venv venv
venv\Scripts\activate          # na Windowsu
pip install -r requirements.txt
copy .env.example .env         # pa upisi lozinku
uvicorn main:app --reload
```

```
cd frontend
npm install
npm run dev
```

Ako backend radi na drugoj adresi, kopiraj `frontend/.env.example` u
`frontend/.env` i promijeni `VITE_API_URL`.


## Struktura

```
docker-compose.yml   tri servisa: neo4j, backend, frontend

backend/
  main.py          FastAPI aplikacija i svi endpointi
  database.py      driver i pomocne funkcije za upite
  queries.py       svi Cypher upiti
  Dockerfile

frontend/
  src/
    App.jsx        navigacija izmedju stranica
    api.js         pozivi prema backendu
    useFetch.js    hook za loading i error stanja
    colors.js      paleta za zajednice
    communities.js nazivi zajednica
    format.js      hrvatski format brojeva
    components/    NetworkGraph, charts, Panel, RankList, States
    pages/         Overview, Recommendations, Network, Analytics
  Dockerfile
  nginx.conf

neo4j/
  backups/         ovdje ide neo4j.dump
  import/          ovdje idu CSV-ovi za LOAD CSV
```

## Endpointi

| Metoda | Putanja | Opis |
|---|---|---|
| GET | `/api/health` | radi li veza s bazom |
| GET | `/api/stats` | osnovne brojke |
| GET | `/api/stats/decades` | broj filmova po desetljecima |
| GET | `/api/stats/pairs` | najcesci parovi suradnika |
| GET | `/api/search/movies?q=` | pretraga filmova |
| GET | `/api/search/people?q=` | pretraga osoba |
| GET | `/api/movies/{id}` | detalji filma |
| GET | `/api/movies/{id}/recommendations` | preporuke, dvije razine |
| GET | `/api/movies/{id}/why?candidate=` | zasto je film prosao ili pao |
| GET | `/api/network/{personId}` | ego-mreza oko osobe |
| GET | `/api/people/{personId}` | detalji osobe |
| GET | `/api/path?from=&to=` | najkraci put izmedju dvije osobe |
| GET | `/api/analytics/centrality?measure=` | ljestvica po mjeri |
| GET | `/api/analytics/communities` | popis zajednica |
| GET | `/api/analytics/communities/{id}` | clanovi jedne zajednice |
| GET | `/api/analytics/bridging` | koncentracija vanjskih veza po zajednici |
| GET | `/api/analytics/genres` | matrica zanr x zajednica |
| GET | `/api/analytics/spread` | koliko svaka mjera razdvaja vrh ljestvice |
| GET | `/api/analytics/compare?a=&b=` | promjena mjesta izmedju dvije mjere |
| GET | `/api/analytics/bridge-cutoff` | granica za oznaku posrednika |

Dva endpointa prolaze kroz gotovo cijeli graf i prvi put traju nekoliko
sekundi: `/api/analytics/bridging` i `/api/analytics/genres`. Rezultat im se
ne mijenja dok se baza ne promijeni, pa ga backend zapamti u memoriji do
gasenja. Isto vrijedi za `/api/analytics/spread` i
`/api/analytics/bridge-cutoff`, koji su brzi ali se takodjer ne mijenjaju.

## Kako radi sustav preporuka

Sedam signala, svaki normaliziran na raspon 0-1, s tezinama koje zbrajaju
1,00: zanr 0,25 · glumci 0,25 · redatelj 0,20 · GDS slicnost 0,15 ·
kvaliteta 0,08 · zajednica 0,05 · nagrade 0,02.

Rezultati se dijele u dvije razine jer bodovi nisu usporedivi izmedju njih:

- **dokaz iz grafa** — zajednicki redatelj, dva ili vise zajednickih glumaca,
  ili postojeca `SIMILAR_TO` veza
- **zanr i kvaliteta** — nema veze u grafu, rangira se po poklapanju zanra i
  kvaliteti filma

Razlog za podjelu je da jedan zajednicki glumac nije dokaz slicnosti nego
podatak da je netko glumio u dva filma. 

Stranica preporuka ima i provjeru **zasto neki film nije prosao**: za bilo
koji naslov prikazu se svih sedam signala i uvjeti koje film mora zadovoljiti,
pa se vidi je li ispao na uvjetu ili mu je samo nedostajalo bodova.

## Nazivi zajednica

Louvain vraca samo brojeve. Nazivi uz njih ("Indijska", "Klasicni
Hollywood", "Nezavisni horor") nisu u bazi nego stoje u
`frontend/src/communities.js`, a dodani su rucno nakon pregleda
najpoznatijih clanova i medijana godine svake zajednice. Zato broj ostaje
vidljiv svugdje uz naziv: broj je ono sto je algoritam izracunao, naziv je
ono sto je iz toga procitano.

Tri zajednice nisu nacionalne nego zanrovske ili produkcijske i oznacene su
posebno u sucelju.


## Ogranicenje kod crtanja mreze

Cijeli graf ima 166 tisuca cvorova i ne moze se nacrtati odjednom. Stranica
Mreza zato dohvaca ego-mrezu oko jedne osobe (do 60 susjeda) i korisnik se
klikom na cvor pomice dalje kroz graf.
