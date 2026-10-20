// Netlify serverfunctie voor gratis 50 km haal- en brengservice.
// PDOK valideert Nederlandse adressen (gratis); openrouteservice berekent echte autoroutes.
// ORS_API_KEY wordt uitsluitend als Netlify-omgevingsvariabele ingesteld, nooit in de code.
const ORS = "https://api.openrouteservice.org";
const PDOK = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free";
const STORE = "Weerdingerkanaal Noordzijde 161, 7831 HL Nieuw-Weerdinge";
const LIMIT = 50000; // meters, shortest road-driving route
let storeCache;
let isoCache;
const hits = new Map();

function response(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  } });
}

async function fetchJSON(url, init = {}) {
  const rsp = await fetch(url, { ...init, signal: AbortSignal.timeout(14000) });
  if (rsp.status === 429) throw new Error("LIMIT");
  if (!rsp.ok) throw new Error("UPSTREAM");
  return rsp.json();
}
async function ors(path, body) {
  return fetchJSON(ORS + path, {
    method: "POST",
    headers: { "Authorization": process.env.ORS_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

function parsePoint(value) {
  const p = /^POINT\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)$/.exec(value || "");
  if (!p) return null;
  const coordinates = [Number(p[1]), Number(p[2])];
  if (!coordinates.every(Number.isFinite)) return null;
  return coordinates;
}

// Strikte postcodecontrole voorkomt dat een adres per ongeluk aan een verkeerde locatie wordt gekoppeld.
async function pdok(query, isStore = false) {
  const url = new URL(PDOK);
  url.searchParams.set("q", query);
  url.searchParams.set("fq", "type:adres");
  url.searchParams.set("rows", isStore ? "12" : "10");
  url.searchParams.set("fl", "weergavenaam,centroide_ll,postcode,huisnummer,woonplaatsnaam");
  const data = await fetchJSON(url);
  const docs = data?.response?.docs || [];
  const postcode = query.toUpperCase().match(/\b([1-9]\d{3})\s*([A-Z]{2})\b/);
  const requestedPostal = postcode && (postcode[1] + postcode[2]);
  const part = requestedPostal ? query.slice(postcode.index + postcode[0].length) : query;
  const before = requestedPostal ? query.slice(0, postcode.index) : query;
  // Zoek het huisnummer vóór of na de postcode, en niet de postcode zelf.
  const house = (requestedPostal
    ? (part.match(/^\s*[, -]*\s*(\d{1,5}[a-z]?)\b/i) || before.match(/\b(\d{1,5}[a-z]?)\s*[,\s]*$/i))
    : query.match(/\b(\d{1,5}[a-z]?)\b/));
  const houseNo = house?.[1]?.toLowerCase() || "";
  for (const doc of docs) {
    const coords = parsePoint(doc.centroide_ll);
    if (!coords || !doc.weergavenaam) continue;
    if (requestedPostal && String(doc.postcode || "").replace(/\s/g, "").toUpperCase() !== requestedPostal) continue;
    if (houseNo && String(doc.huisnummer || "").toLowerCase() !== houseNo.replace(/[a-z]$/i, "")) continue;
    if (isStore && (!/Weerdingerkanaal Noordzijde/i.test(doc.weergavenaam) || String(doc.huisnummer) !== "161")) continue;
    return { coordinates: coords, label: doc.weergavenaam };
  }
  return null;
}

async function orsGeocode(query) {
  const u = new URL(ORS + "/geocode/search");
  u.searchParams.set("text", query);
  u.searchParams.set("size", "6");
  const data = await fetchJSON(u, { headers: { Authorization: process.env.ORS_API_KEY } });
  const result = (data.features || []).find(f => {
    const p = f.properties || {};
    return Array.isArray(f.geometry?.coordinates) && f.geometry.coordinates.length === 2 &&
      (p.layer === "address" || p.housenumber) &&
      /Deutschland|Germany|Duitsland/i.test((p.label || "") + " " + (p.country || ""));
  });
  return result ? { coordinates: result.geometry.coordinates, label: result.properties.label } : null;
}

async function origin() {
  if (storeCache) return storeCache;
  const pos = await pdok(STORE, true);
  if (!pos) throw new Error("STORE_NOT_FOUND");
  storeCache = pos;
  return pos;
}

async function zone() {
  const start = await origin();
  if (isoCache && Date.now() - isoCache.created < 12 * 3600000) return isoCache.data;
  const data = await ors("/v2/isochrones/driving-car", {
    locations: [start.coordinates],
    range: [LIMIT],
    range_type: "distance"
  });
  if (!data.features?.[0]?.geometry) throw new Error("NO_ZONE");
  const payload = { origin: start, area: data.features[0], notice: "De bereikbare wegzone is indicatief; de individuele routeberekening is bepalend." };
  isoCache = { created: Date.now(), data: payload };
  return payload;
}

export default async function handler(req) {
  if (req.method !== "POST") return response({ error: "Gebruik de adreschecker op de website." }, 405);
  const callerOrigin = req.headers.get("origin");
  if (callerOrigin && callerOrigin !== new URL(req.url).origin) return response({ error: "Ongeldige aanvraag." }, 403);
  if (+req.headers.get("content-length") > 1800) return response({ error: "Invoer is te lang." }, 413);

  // Basisbescherming tegen misbruik. In een serverloze omgeving is dit best-effort, niet een globale limiet.
  const client = req.headers.get("x-nf-client-connection-ip") || "anonymous";
  const now = Date.now();
  for (const [ip, value] of hits) if (now - value.since > 60000) hits.delete(ip);
  const item = hits.get(client) || { since: now, count: 0 };
  if (now - item.since > 60000) { item.since = now; item.count = 0; }
  item.count++;
  hits.set(client, item);
  if (item.count > 12) return response({ error: "Te veel aanvragen. Probeer het over een minuut opnieuw." }, 429);

  let body;
  try {
    const raw = await req.text();
    if (raw.length > 1800) return response({ error: "Invoer is te lang." }, 413);
    body = JSON.parse(raw);
  } catch { return response({ error: "Ongeldige invoer." }, 400); }
  if (!body || !["origin", "zone", "check"].includes(body.action)) return response({ error: "Ongeldige aanvraag." }, 400);

  try {
    if (body.action === "origin") return response({ origin: await origin() });
    if (!process.env.ORS_API_KEY) return response({
      error: "De adreschecker wordt nog ingericht. Bel of mail Tieks voor de mogelijkheden.",
      code: "NOT_CONFIGURED"
    }, 503);
    if (body.action === "zone") return response(await zone());

    const text = typeof body.address === "string" ? body.address.trim().replace(/\s+/g, " ") : "";
    if (text.length < 7 || text.length > 150 || !/\d/.test(text)) return response({
      error: "Vul een volledig adres met huisnummer in, bijvoorbeeld een postcode en huisnummer."
    }, 400);
    const german = /\b(?:Deutschland|Germany|Duitsland|DE-\d{5})\b|\b\d{5}\b/i.test(text);
    const destination = german ? await orsGeocode(text) : await pdok(text);
    if (!destination) return response({
      error: "We kunnen dit adres niet betrouwbaar vinden. Controleer postcode, huisnummer en plaats."
    }, 422);
    const start = await origin();
    const route = await ors("/v2/directions/driving-car/geojson", {
      coordinates: [start.coordinates, destination.coordinates],
      preference: "shortest",
      instructions: false
    });
    const feature = route.features?.[0];
    const meters = feature?.properties?.summary?.distance;
    if (!Number.isFinite(meters) || !feature?.geometry) throw new Error("NO_ROUTE");
    return response({
      inside: meters <= LIMIT,
      distanceKm: Math.round(meters / 100) / 10,
      address: destination.label,
      destination: destination.coordinates,
      route: feature.geometry
    });
  } catch (err) {
    if (err.message === "LIMIT") return response({ error: "De kaartdienst heeft tijdelijk te veel aanvragen. Probeer het later opnieuw." }, 503);
    if (err.message === "NO_ROUTE") return response({ error: "Voor dit adres kan geen betrouwbare autoroute worden berekend. Neem contact op met Tieks." }, 422);
    return response({ error: "De afstand kan momenteel niet worden berekend. Bel of mail Tieks." }, 503);
  }
}
export const config = { path: "/api/servicegebied" };
