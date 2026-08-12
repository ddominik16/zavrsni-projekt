"""FastAPI backend za zavrsni rad — graf filmske suradnje u Neo4ju.

Pokretanje:
    uvicorn main:app --reload

Dokumentacija endpointa je na /docs (FastAPI je sam generira).
"""

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


# ------------------------------------------------------------------ pregled

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


# ----------------------------------------------------------------- pretraga

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


# ---------------------------------------------------------------- preporuke

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

    # Cypher vraca ravnu listu; razdvajamo je na dvije razine za frontend.
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


# -------------------------------------------------------------------- mreza

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


# ---------------------------------------------------------------- analitika

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
