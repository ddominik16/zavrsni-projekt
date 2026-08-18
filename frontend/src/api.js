// Sve pozive prema backendu drzim ovdje da komponente ne znaju za URL-ove.

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function get(path) {
  const res = await fetch(BASE + path);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (body.detail) detail = body.detail;
    } catch {
      // odgovor nije JSON, ostavljamo statusText
    }
    throw new Error(detail);
  }
  return res.json();
}

export const getStats = () => get("/api/stats");
export const getDecades = () => get("/api/stats/decades");
export const getTopPairs = (limit = 6) => get(`/api/stats/pairs?limit=${limit}`);

export const searchMovies = (q) =>
  get(`/api/search/movies?q=${encodeURIComponent(q)}`);
export const searchPeople = (q) =>
  get(`/api/search/people?q=${encodeURIComponent(q)}`);

export const getMovie = (id) => get(`/api/movies/${encodeURIComponent(id)}`);
export const getRecommendations = (id) =>
  get(`/api/movies/${encodeURIComponent(id)}/recommendations`);

export const getNetwork = (personId, limit = 60) =>
  get(`/api/network/${encodeURIComponent(personId)}?limit=${limit}`);
export const getPerson = (personId) =>
  get(`/api/people/${encodeURIComponent(personId)}`);
export const getPath = (fromId, toId) =>
  get(
    `/api/path?from=${encodeURIComponent(fromId)}&to=${encodeURIComponent(toId)}`
  );

export const getCentrality = (measure = "pageRank", limit = 20) =>
  get(`/api/analytics/centrality?measure=${measure}&limit=${limit}`);
export const getCommunities = (limit = 12) =>
  get(`/api/analytics/communities?limit=${limit}`);
export const getCommunityMembers = (id, limit = 20) =>
  get(`/api/analytics/communities/${id}?limit=${limit}`);

export const getBridging = (limit = 8) =>
  get(`/api/analytics/bridging?limit=${limit}`);
export const getGenreMatrix = (communities = 8, top = 10) =>
  get(`/api/analytics/genres?communities=${communities}&top=${top}`);
export const getSpread = () => get("/api/analytics/spread");
export const getCompare = (a = "degree", b = "betweenness", limit = 12) =>
  get(`/api/analytics/compare?a=${a}&b=${b}&limit=${limit}`);
export const getBridgeCutoff = () => get("/api/analytics/bridge-cutoff");

export const getWhyNot = (movieId, candidateId) =>
  get(
    `/api/movies/${encodeURIComponent(movieId)}/why?candidate=` +
      encodeURIComponent(candidateId)
  );
