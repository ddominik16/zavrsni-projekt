STATS = """
MATCH (p:Person) WITH count(p) AS persons
MATCH (m:Movie)  WITH persons, count(m) AS movies
MATCH ()-[r:COLLABORATED_WITH]->() WITH persons, movies, count(r) AS collabs
MATCH (p2:Person) WHERE p2.communityId IS NOT NULL
RETURN persons, movies, collabs,
       count(DISTINCT p2.communityId) AS communities
"""

DECADES = """
MATCH (m:Movie)
WHERE m.year IS NOT NULL
WITH (m.year / 10) * 10 AS decade, count(*) AS films
WHERE decade >= 1950
RETURN decade, films
ORDER BY decade
"""

TOP_PAIRS = """
MATCH (a:Person)-[r:COLLABORATED_WITH]->(b:Person)
RETURN a.name AS actor1, b.name AS actor2,
       r.collaborationCount AS sharedFilms,
       r.lastCollabYear AS lastYear
ORDER BY sharedFilms DESC, actor1
LIMIT $limit
"""

SEARCH_MOVIES = """
MATCH (m:Movie)
WHERE toLower(m.title) CONTAINS toLower($q)
  AND m.votes >= $minVotes
RETURN m.movieId AS movieId, m.title AS title, m.year AS year,
       m.rating AS rating, m.votes AS votes, m.communityId AS communityId
ORDER BY m.votes DESC
LIMIT $limit
"""

SEARCH_PEOPLE = """
MATCH (p:Person)
WHERE toLower(p.name) CONTAINS toLower($q)
  AND p.degreeCentrality IS NOT NULL
RETURN p.personId AS personId, p.name AS name,
       toInteger(p.degreeCentrality) AS degree,
       p.communityId AS communityId
ORDER BY p.degreeCentrality DESC
LIMIT $limit
"""

MOVIE_DETAIL = """
MATCH (m:Movie {movieId: $movieId})
OPTIONAL MATCH (m)-[:BELONGS_TO_GENRE]->(g:Genre)
WITH m, collect(DISTINCT g.name) AS genres
OPTIONAL MATCH (m)<-[:DIRECTED]-(d:Person)
WITH m, genres, collect(DISTINCT d.name) AS directors
OPTIONAL MATCH (m)<-[r:ACTED_IN]-(a:Person)
WITH m, genres, directors, a, r
ORDER BY coalesce(r.billingOrder, 99)
RETURN m.movieId AS movieId, m.title AS title, m.year AS year,
       m.rating AS rating, m.votes AS votes,
       m.communityId AS communityId,
       genres, directors,
       collect(a.name)[0..8] AS cast
"""


RECOMMEND = """
MATCH (t:Movie {movieId: $movieId})

CALL {
  WITH t
  MATCH (t)<-[:ACTED_IN]-(:Person)-[:ACTED_IN]->(c:Movie)
  WHERE c <> t
  RETURN c
  UNION
  WITH t
  MATCH (t)<-[:DIRECTED]-(:Person)-[:DIRECTED]->(c:Movie)
  WHERE c <> t
  RETURN c
  UNION
  WITH t
  MATCH (t)-[:SIMILAR_TO]->(c:Movie)
  RETURN c
  UNION
  WITH t
  MATCH (t)-[:BELONGS_TO_GENRE]->(g:Genre)<-[:BELONGS_TO_GENRE]-(c:Movie)
  WHERE c <> t
    AND c.votes  >= 50000
    AND c.rating >= 6.5
    AND abs(c.year - t.year) <= 15
  WITH c, count(g) AS shared
  WHERE shared >= 2
  RETURN c
}

WITH t, c
WHERE c.votes >= $minVotes AND c.rating >= $minRating

OPTIONAL MATCH (t)-[sim:SIMILAR_TO]->(c)
WITH t, c, coalesce(sim.score, 0.0) AS gdsScore

WITH t, c, gdsScore,
     size([(t)<-[:ACTED_IN]-(p:Person)-[:ACTED_IN]->(c)   | p]) AS sharedActors,
     size([(t)<-[:DIRECTED]-(d:Person)-[:DIRECTED]->(c)   | d]) AS sharedDirectors,
     size([(t)-[:BELONGS_TO_GENRE]->(g:Genre)<-[:BELONGS_TO_GENRE]-(c) | g]) AS sharedGenres,
     size([(t)-[:BELONGS_TO_GENRE]->(g1:Genre) | g1])            AS genresT,
     size([(t)-[:WON_AWARD]->(a:Award)<-[:WON_AWARD]-(c) | a])   AS sharedAwards

WITH t, c, sharedActors, sharedDirectors, sharedGenres, genresT, sharedAwards, gdsScore,
     CASE WHEN sharedActors >= 2 OR sharedDirectors > 0 OR gdsScore > 0
          THEN 1 ELSE 2 END AS tier

WITH t, c, tier, sharedActors, sharedDirectors, sharedGenres, gdsScore,
     CASE WHEN genresT > 0 THEN sharedGenres * 1.0 / genresT ELSE 0.0 END AS nGenre,
     CASE WHEN sharedDirectors > 0 THEN 1.0 ELSE 0.0 END                  AS nDirector,
     CASE WHEN sharedActors >= 5 THEN 1.0 ELSE sharedActors / 5.0 END     AS nActor,
     gdsScore                                                             AS nGds,
     c.rating / 10.0                                                      AS nQuality,
     CASE WHEN c.votes >= 1000000 THEN 1.0 ELSE log10(c.votes) / 6.0 END  AS nPopularity,
     CASE WHEN t.year IS NULL OR c.year IS NULL THEN 0.0
          ELSE 1.0 - abs(t.year - c.year) / 50.0 END                      AS nRecency,
     CASE WHEN t.communityId IS NOT NULL AND t.communityId = c.communityId
          THEN 1.0 ELSE 0.0 END                                           AS nCommunity,
     CASE WHEN sharedAwards >= 2 THEN 1.0 ELSE sharedAwards / 2.0 END     AS nAward

WHERE tier = 1 OR nGenre >= 0.5

WITH t, c, tier, sharedActors, sharedDirectors, sharedGenres,
     nGenre, nDirector, nActor, nGds, nQuality, nCommunity, nAward,
     CASE WHEN tier = 1
          THEN nGenre      * $w.genre
             + nDirector   * $w.director
             + nActor      * $w.actor
             + nGds        * $w.gds
             + nQuality    * $w.rating
             + nCommunity  * $w.community
             + nAward      * $w.award
          ELSE nGenre      * 0.40
             + nQuality    * 0.35
             + nPopularity * 0.15
             + nRecency    * 0.10
     END AS score

WITH t, c, tier, score, sharedActors, sharedDirectors, sharedGenres, nGenre,
     nDirector, nActor, nGds, nQuality, nCommunity, nAward,
     coalesce(c.communityId, -1) AS community
ORDER BY tier ASC, score DESC, c.votes DESC

WITH t, tier, community,
     collect({
       movieId: c.movieId, title: c.title, year: c.year,
       rating: c.rating, votes: c.votes, score: score,
       sharedActors: sharedActors, sharedDirectors: sharedDirectors,
       sharedGenres: sharedGenres, genreCoverage: nGenre,
       signals: {
         genre: nGenre * $w.genre, director: nDirector * $w.director,
         actor: nActor * $w.actor, gds: nGds * $w.gds,
         quality: nQuality * $w.rating, community: nCommunity * $w.community,
         award: nAward * $w.award
       }
     }) AS group

WITH t, tier, community,
     CASE WHEN tier = 1                  THEN group[0..6]
          WHEN community = t.communityId THEN group[0..5]
          ELSE group[0..$maxPerCommunity] END AS kept

UNWIND kept AS r
RETURN tier, r AS item
ORDER BY tier ASC, r.score DESC
"""


EGO_NETWORK = """
MATCH (seed:Person {personId: $personId})
CALL {
  WITH seed
  MATCH (seed)-[r:COLLABORATED_WITH]-(n:Person)
  RETURN n
  ORDER BY r.collaborationCount DESC, n.pageRank DESC
  LIMIT $limit
}
WITH seed, collect(n) AS susjedi
WITH seed, susjedi + [seed] AS nodes
CALL {
  WITH nodes
  UNWIND nodes AS a
  MATCH (a)-[r:COLLABORATED_WITH]-(b)
  WHERE b IN nodes AND elementId(a) < elementId(b)
  RETURN collect(DISTINCT {
           source: a.personId, target: b.personId,
           weight: r.collaborationCount
         }) AS links
}
RETURN seed.personId AS seedId,
       [x IN nodes | {
          id: x.personId, name: x.name,
          community: x.communityId,
          degree: toInteger(coalesce(x.degreeCentrality, 0)),
          pageRank: x.pageRank,
          betweenness: x.betweennessCentrality
       }] AS nodes,
       links
"""

PERSON_DETAIL = """
MATCH (p:Person {personId: $personId})
OPTIONAL MATCH (p)-[:ACTED_IN]->(m:Movie)
WITH p, m ORDER BY m.votes DESC
RETURN p.personId AS personId, p.name AS name,
       toInteger(coalesce(p.degreeCentrality, 0)) AS degree,
       p.pageRank AS pageRank,
       p.betweennessCentrality AS betweenness,
       p.closenessCentrality AS closeness,
       p.communityId AS communityId,
       count(m) AS filmCount,
       collect(m.title)[0..6] AS topFilms
"""

SHORTEST_PATH = """
MATCH (a:Person {personId: $fromId}), (b:Person {personId: $toId})
MATCH path = shortestPath((a)-[:COLLABORATED_WITH*..8]-(b))
RETURN length(path) AS hops,
       [n IN nodes(path) | {
          id: n.personId, name: n.name,
          community: n.communityId,
          betweenness: n.betweennessCentrality
       }] AS people
"""

CENTRALITY = """
MATCH (p:Person)
WHERE p.pageRank IS NOT NULL
RETURN p.personId AS personId, p.name AS name,
       toInteger(coalesce(p.degreeCentrality, 0)) AS degree,
       p.pageRank AS pageRank,
       p.betweennessCentrality AS betweenness,
       p.closenessCentrality AS closeness,
       p.communityId AS communityId
ORDER BY
  CASE $measure
    WHEN 'degree'      THEN p.degreeCentrality
    WHEN 'pageRank'    THEN p.pageRank
    WHEN 'betweenness' THEN p.betweennessCentrality
    WHEN 'closeness'   THEN p.closenessCentrality
    ELSE p.pageRank
  END DESC
LIMIT $limit
"""

COMMUNITIES = """
MATCH (p:Person)
WHERE p.communityId IS NOT NULL
WITH p.communityId AS communityId, count(*) AS members
ORDER BY members DESC
LIMIT $limit
CALL {
  WITH communityId
  MATCH (:Person {communityId: communityId})-[:ACTED_IN]->(m:Movie)
  RETURN count(DISTINCT m) AS films,
         percentileCont(m.year, 0.5) AS medianYear
}
CALL {
  WITH communityId
  MATCH (p2:Person {communityId: communityId})
  WITH p2 ORDER BY p2.pageRank DESC LIMIT 5
  RETURN collect(p2.name) AS topMembers
}
RETURN communityId, members, films,
       toInteger(medianYear) AS medianYear, topMembers
ORDER BY members DESC
"""

COMMUNITY_MEMBERS = """
MATCH (p:Person {communityId: $communityId})
RETURN p.personId AS personId, p.name AS name,
       toInteger(coalesce(p.degreeCentrality, 0)) AS degree,
       p.pageRank AS pageRank,
       p.betweennessCentrality AS betweenness
ORDER BY p.pageRank DESC
LIMIT $limit
"""


# ---------------------------------------------------- zanr po zajednici
#
# Koliko filmova svakog zanra pripada svakoj od najvecih zajednica.
# Film nasljedjuje zajednicu od svoje glumacke ekipe (faza 6, korak 7).

GENRE_MATRIX = """
MATCH (p:Person)
WHERE p.communityId IS NOT NULL
WITH p.communityId AS cid, count(*) AS members
ORDER BY members DESC
LIMIT $communities
WITH collect(cid) AS ids
MATCH (m:Movie)-[:BELONGS_TO_GENRE]->(g:Genre)
WHERE m.communityId IN ids
RETURN g.name AS genre, m.communityId AS communityId,
       count(DISTINCT m) AS films
"""

COMMUNITY_TOTALS = """
MATCH (p:Person)
WHERE p.communityId IS NOT NULL
WITH p.communityId AS cid, count(*) AS members
ORDER BY members DESC
LIMIT $communities
CALL {
  WITH cid
  MATCH (m:Movie {communityId: cid})
  RETURN count(m) AS films
}
RETURN cid AS communityId, members, films
ORDER BY members DESC
"""


BRIDGING = """
MATCH (p:Person)
WHERE p.communityId IS NOT NULL
WITH p.communityId AS cid, count(*) AS members
ORDER BY members DESC
LIMIT $limit
WITH collect(cid) AS ids

MATCH (a:Person)-[:COLLABORATED_WITH]-(b:Person)
WHERE a.communityId IN ids
  AND b.communityId IS NOT NULL
  AND b.communityId <> a.communityId
WITH a.communityId AS cid, a, count(DISTINCT b) AS ext
ORDER BY cid, ext DESC
WITH cid, collect(ext) AS exts
RETURN cid AS communityId,
       reduce(s = 0, x IN exts | s + x)         AS externalTies,
       reduce(s = 0, x IN exts[0..10] | s + x)  AS top10Ties,
       size(exts)                               AS peopleWithExternal
"""


BRIDGE_CUTOFF = """
MATCH (p:Person)
WHERE p.betweennessCentrality > 0
RETURN percentileCont(p.betweennessCentrality, 0.99) AS cutoff
"""


WHY_NOT = """
MATCH (t:Movie {movieId: $movieId}), (c:Movie {movieId: $candidateId})

OPTIONAL MATCH (t)-[sim:SIMILAR_TO]->(c)
WITH t, c, coalesce(sim.score, 0.0) AS gdsScore

WITH t, c, gdsScore,
     size([(t)<-[:ACTED_IN]-(p:Person)-[:ACTED_IN]->(c)   | p]) AS sharedActors,
     size([(t)<-[:DIRECTED]-(d:Person)-[:DIRECTED]->(c)   | d]) AS sharedDirectors,
     size([(t)-[:BELONGS_TO_GENRE]->(g:Genre)<-[:BELONGS_TO_GENRE]-(c) | g]) AS sharedGenres,
     size([(t)-[:BELONGS_TO_GENRE]->(g1:Genre) | g1])            AS genresT,
     size([(t)-[:WON_AWARD]->(a:Award)<-[:WON_AWARD]-(c) | a])   AS sharedAwards

WITH t, c, gdsScore, sharedActors, sharedDirectors, sharedGenres,
     genresT, sharedAwards,
     CASE WHEN sharedActors >= 2 OR sharedDirectors > 0 OR gdsScore > 0
          THEN 1 ELSE 2 END AS tier

WITH t, c, gdsScore, sharedActors, sharedDirectors, sharedGenres,
     sharedAwards, tier,
     CASE WHEN genresT > 0 THEN sharedGenres * 1.0 / genresT ELSE 0.0 END AS nGenre,
     CASE WHEN sharedDirectors > 0 THEN 1.0 ELSE 0.0 END                  AS nDirector,
     CASE WHEN sharedActors >= 5 THEN 1.0 ELSE sharedActors / 5.0 END     AS nActor,
     gdsScore                                                             AS nGds,
     c.rating / 10.0                                                      AS nQuality,
     CASE WHEN c.votes >= 1000000 THEN 1.0 ELSE log10(c.votes) / 6.0 END  AS nPopularity,
     CASE WHEN t.year IS NULL OR c.year IS NULL THEN 0.0
          ELSE 1.0 - abs(t.year - c.year) / 50.0 END                      AS nRecency,
     CASE WHEN t.communityId IS NOT NULL AND t.communityId = c.communityId
          THEN 1.0 ELSE 0.0 END                                           AS nCommunity,
     CASE WHEN sharedAwards >= 2 THEN 1.0 ELSE sharedAwards / 2.0 END     AS nAward

RETURN c.movieId AS movieId, c.title AS title, c.year AS year,
       c.rating AS rating, c.votes AS votes,
       coalesce(c.communityId, -1) AS communityId,
       tier, sharedActors, sharedDirectors, sharedGenres, sharedAwards,
       nGenre AS genreCoverage,
       CASE WHEN tier = 1
            THEN nGenre     * $w.genre
               + nDirector  * $w.director
               + nActor     * $w.actor
               + nGds       * $w.gds
               + nQuality   * $w.rating
               + nCommunity * $w.community
               + nAward     * $w.award
            ELSE nGenre      * 0.40
               + nQuality    * 0.35
               + nPopularity * 0.15
               + nRecency    * 0.10
       END AS score,
       {
         genre: nGenre * $w.genre, director: nDirector * $w.director,
         actor: nActor * $w.actor, gds: nGds * $w.gds,
         quality: nQuality * $w.rating, community: nCommunity * $w.community,
         award: nAward * $w.award
       } AS signals,
       {
         votes:  c.votes  >= $minVotes,
         rating: c.rating >= $minRating,
         floor:  tier = 1 OR nGenre >= 0.5,
         candidate: sharedActors > 0 OR sharedDirectors > 0 OR gdsScore > 0
                    OR (sharedGenres >= 2 AND c.votes >= 50000
                        AND c.rating >= 6.5 AND abs(c.year - t.year) <= 15)
       } AS gates
"""
