import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

import database
import queries

load_dotenv()

# Tezine za sustav preporuka. Zbroj je 1.00 pa je konacni rezultat
# citljiv kao vrijednost izmedju 0 i 1.
WEIGHTS = {
    "genre": 0.25,
    "director": 0.20,
    "actor": 0.25,
    "gds": 0.15,
    "rating": 0.08,
    "community": 0.05,
    "award": 0.02,
}

MIN_VOTES = 10000
MIN_RATING = 6.0


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not database.check_connection():
        print("Upozorenje: nema veze s Neo4jem. Provjeri je li baza pokrenuta.")
    yield
    database.close_driver()


app = FastAPI(
    title="Filmski Graf API",
    description="Pristup grafu filmske suradnje i sustavu preporuka.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("CORS_ORIGIN", "http://localhost:5173")],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    ok = database.check_connection()
    return {"database": "ok" if ok else "unreachable"}


@app.get("/api/stats")
def stats():
    row = database.run_one(queries.STATS)
    if row is None:
        raise HTTPException(status_code=503, detail="Baza ne odgovara")
    return row


@app.get("/api/stats/decades")
def decades():
    return database.run(queries.DECADES)


@app.get("/api/stats/pairs")
def top_pairs(limit: int = Query(10, ge=1, le=50)):
    return database.run(queries.TOP_PAIRS, limit=limit)



@app.get("/api/search/movies")
def search_movies(q: str = Query(..., min_length=2),
                  limit: int = Query(12, ge=1, le=50)):
    return database.run(queries.SEARCH_MOVIES, q=q, limit=limit,
                        minVotes=MIN_VOTES)


@app.get("/api/search/people")
def search_people(q: str = Query(..., min_length=2),
                  limit: int = Query(12, ge=1, le=50)):
    return database.run(queries.SEARCH_PEOPLE, q=q, limit=limit)


@app.get("/api/movies/{movie_id}")
def movie_detail(movie_id: str):
    row = database.run_one(queries.MOVIE_DETAIL, movieId=movie_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Film nije pronadjen")
    return row




@app.get("/api/movies/{movie_id}/recommendations")
def recommendations(movie_id: str,
                    max_per_community: int = Query(2, ge=1, le=10)):
    rows = database.run(
        queries.RECOMMEND,
        movieId=movie_id,
        w=WEIGHTS,
        minVotes=MIN_VOTES,
        minRating=MIN_RATING,
        maxPerCommunity=max_per_community,
    )

    graph_tier = [r["item"] for r in rows if r["tier"] == 1]
    genre_tier = [r["item"] for r in rows if r["tier"] == 2]

    if not graph_tier and not genre_tier:
        raise HTTPException(status_code=404,
                            detail="Nema preporuka za taj film")

    return {
        "movieId": movie_id,
        "weights": WEIGHTS,
        "graphEvidence": graph_tier,
        "genreAndQuality": genre_tier,
    }



@app.get("/api/network/{person_id}")
def ego_network(person_id: str, limit: int = Query(60, ge=10, le=200)):
    row = database.run_one(queries.EGO_NETWORK, personId=person_id, limit=limit)
    if row is None:
        raise HTTPException(status_code=404, detail="Osoba nije pronadjena")
    return row


@app.get("/api/people/{person_id}")
def person_detail(person_id: str):
    row = database.run_one(queries.PERSON_DETAIL, personId=person_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Osoba nije pronadjena")
    return row


@app.get("/api/path")
def shortest_path(from_id: str = Query(..., alias="from"),
                  to_id: str = Query(..., alias="to")):
    row = database.run_one(queries.SHORTEST_PATH, fromId=from_id, toId=to_id)
    if row is None:
        raise HTTPException(status_code=404,
                            detail="Put izmedju te dvije osobe ne postoji")
    return row



@app.get("/api/analytics/centrality")
def centrality(measure: str = Query("pageRank"),
               limit: int = Query(20, ge=1, le=100)):
    allowed = ["degree", "pageRank", "betweenness", "closeness"]
    if measure not in allowed:
        raise HTTPException(status_code=400,
                            detail="Mjera mora biti jedna od: " + ", ".join(allowed))
    return database.run(queries.CENTRALITY, measure=measure, limit=limit)


@app.get("/api/analytics/communities")
def communities(limit: int = Query(12, ge=1, le=50)):
    return database.run(queries.COMMUNITIES, limit=limit)


@app.get("/api/analytics/communities/{community_id}")
def community_members(community_id: int, limit: int = Query(30, ge=1, le=100)):
    rows = database.run(queries.COMMUNITY_MEMBERS,
                        communityId=community_id, limit=limit)
    if not rows:
        raise HTTPException(status_code=404, detail="Zajednica nije pronadjena")
    return rows


_cache = {}


def cached(key, fn):
    if key not in _cache:
        _cache[key] = fn()
    return _cache[key]


@app.get("/api/analytics/bridging")
def bridging(limit: int = Query(8, ge=2, le=20)):
    """Koliki dio vanjskih veza zajednice nose njenih deset najpovezanijih."""

    def compute():
        totals = database.run(queries.COMMUNITY_TOTALS, communities=limit)
        rows = database.run(queries.BRIDGING, limit=limit)
        by_id = {r["communityId"]: r for r in rows}

        out = []
        for t in totals:
            r = by_id.get(t["communityId"], {})
            external = r.get("externalTies", 0) or 0
            top10 = r.get("top10Ties", 0) or 0
            out.append({
                "communityId": t["communityId"],
                "members": t["members"],
                "films": t["films"],
                "externalTies": external,
                "top10Ties": top10,
                "top10Share": (top10 / external) if external else 0.0,
                "tiesPerMember": (external / t["members"]) if t["members"] else 0.0,
            })
        return out

    return cached("bridging:%d" % limit, compute)


@app.get("/api/analytics/genres")
def genres(communities: int = Query(8, ge=2, le=20),
           top: int = Query(10, ge=3, le=20)):


    def compute():
        totals = database.run(queries.COMMUNITY_TOTALS, communities=communities)
        rows = database.run(queries.GENRE_MATRIX, communities=communities)

        po_zanru = {}
        for r in rows:
            po_zanru.setdefault(r["genre"], {})[r["communityId"]] = r["films"]

        redoslijed = sorted(po_zanru,
                            key=lambda g: sum(po_zanru[g].values()),
                            reverse=True)[:top]

        return {
            "communities": totals,
            "genres": [
                {
                    "genre": g,
                    "counts": po_zanru[g],
                    "total": sum(po_zanru[g].values()),
                }
                for g in redoslijed
            ],
        }

    return cached("genres:%d:%d" % (communities, top), compute)


@app.get("/api/analytics/spread")
def spread():
    def compute():
        out = []
        for measure in ("degree", "pageRank", "betweenness", "closeness"):
            rows = database.run(queries.CENTRALITY, measure=measure, limit=20)
            kljuc = {"degree": "degree", "pageRank": "pageRank",
                     "betweenness": "betweenness", "closeness": "closeness"}[measure]
            vrijednosti = [r[kljuc] for r in rows if r[kljuc] is not None]
            if not vrijednosti:
                continue
            vrh, dno = max(vrijednosti), min(vrijednosti)
            out.append({
                "measure": measure,
                "top": vrh,
                "bottom": dno,
                "spread": ((vrh - dno) / dno) if dno else 0.0,
                "values": vrijednosti,
            })
        return out

    return cached("spread", compute)


@app.get("/api/analytics/compare")
def compare(a: str = Query("degree"), b: str = Query("betweenness"),
            limit: int = Query(12, ge=5, le=25)):
    allowed = ["degree", "pageRank", "betweenness", "closeness"]
    for m in (a, b):
        if m not in allowed:
            raise HTTPException(status_code=400,
                                detail="Mjera mora biti jedna od: " + ", ".join(allowed))

    rows_a = database.run(queries.CENTRALITY, measure=a, limit=limit)
    rows_b = database.run(queries.CENTRALITY, measure=b, limit=limit)

    unija = {}
    for r in rows_a + rows_b:
        unija[r["personId"]] = r
    ljudi = list(unija.values())

    def poredak(mjera):
        redom = sorted(ljudi, key=lambda r: r[mjera] or 0, reverse=True)
        return {r["personId"]: i + 1 for i, r in enumerate(redom)}

    rank_a, rank_b = poredak(a), poredak(b)

    return {
        "a": a,
        "b": b,
        "people": sorted(
            [
                {
                    "personId": r["personId"],
                    "name": r["name"],
                    "communityId": r["communityId"],
                    "rankA": rank_a[r["personId"]],
                    "rankB": rank_b[r["personId"]],
                    "valueA": r[a],
                    "valueB": r[b],
                    "inA": any(x["personId"] == r["personId"] for x in rows_a),
                    "inB": any(x["personId"] == r["personId"] for x in rows_b),
                }
                for r in ljudi
            ],
            key=lambda p: p["rankA"],
        ),
    }


@app.get("/api/analytics/bridge-cutoff")
def bridge_cutoff():
    def compute():
        row = database.run_one(queries.BRIDGE_CUTOFF)
        return {"cutoff": (row or {}).get("cutoff") or 0.0}

    return cached("cutoff", compute)


@app.get("/api/movies/{movie_id}/why")
def why_not(movie_id: str, candidate: str = Query(...)):
    row = database.run_one(queries.WHY_NOT,
                           movieId=movie_id, candidateId=candidate,
                           w=WEIGHTS, minVotes=MIN_VOTES, minRating=MIN_RATING)
    if row is None:
        raise HTTPException(status_code=404, detail="Film nije pronadjen")
    return row
