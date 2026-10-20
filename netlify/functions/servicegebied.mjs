// Netlify Function — betaalde of gratis ORS-sleutel uitsluitend server-side.
// Geen adresgegevens in logs. De kaartdienst ontvangt adreszoekopdrachten en routecoördinaten.
// Om te activeren: stel ORS_API_KEY in via Netlify > Environment variables en deploy opnieuw.
const BASE = "https://api.openrouteservice.org";
const STORE = "Weerdingerkanaal Noordzijde 161, 7831 HL Nieuw-Weerdinge, Nederland";
const MAX_METRES = 50000;
let originCache = null;
let zoneCache = null;
const hits = new Map();

function reply(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

async function provider(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { Authorization: process.env.ORS_API_KEY, ...(options.headers || {}) },
    signal: AbortSignal.timeout(13000)
  });
  if (!response.ok) {
    if (response.status === 429) throw new Error("LIMIT");
    throw new Error("PROVIDER");
  }
  return response.json();
}

async function location(query, { isStore = false } = {}) {
  const url = new URL(BASE + "/geocode/search");
  url.searchParams.set("text", query);
  url.searchParams.set("size", isStore ? "3" : "5");
  url.searchParams.set("lang", "nl");
  const data = await provider(url);
  const features = data.features || [];
  if (isStore) {
    const best = features.find(f => /nieuw.weerdinge|7831/i.test(f.properties?.label || ""));
    if (!best || !Array.isArray(best.geometry?.coordinates)) throw new Error("STORE_NOT_FOUND");
    return { coordinates: best.geometry.coordinates, label: best.properties.label };
  }
  // We vragen een volledig adres om fouten door enkel een plaatsnaam te beperken.
  const match = features.find(f =>
    f.geometry?.coordinates?.length === 2 &&
    (f.properties?.layer === "address" || f.properties?.housenumber) &&
    /(?:Nederland|Netherlands|Duitsland|Germany)/i.test(f.properties?.label || "")
  );
  if (!match) return null;
  return { coordinates: match.geometry.coordinates, label: match.properties.label };
}

async function origin() {
  if (originCache) return originCache;
  originCache = await location(STORE, { isStore: true });
  return originCache;
}

async function zone() {
  const start = await origin();
  if (zoneCache && Date.now() - zoneCache.at < 12 * 60 * 60 * 1000) return zoneCache.value;
  const data = await provider(BASE + "/v2/isochrones/driving-car", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      locations: [start.coordinates],
      range: [MAX_METRES],
      range_type: "distance"
    })
  });
  if (!data.features?.[0]?.geometry) throw new Error("PROVIDER");
  const value = {
    origin: start,
    area: data.features[0],
    notice: "Kaartgrens is een benadering op basis van het wegennet. De individuele routecontrole is bepalend."
  };
  zoneCache = { at: Date.now(), value };
  return value;
}

export default async (request) => {
  if (request.method !== "POST") return reply({ error: "Gebruik de adreschecker op de website." }, 405);
  const reqOrigin = request.headers.get("origin");
  if (reqOrigin && reqOrigin !== new URL(request.url).origin) return reply({ error: "Ongeldige aanvraag." }, 403);
  if (Number(request.headers.get("content-length") || 0) > 1600) return reply({ error: "Invoer is te lang." }, 413);
  if (!process.env.ORS_API_KEY) {
    return reply({ error: "De adreschecker wordt momenteel ingericht. Neem voor de mogelijkheden contact op met Tieks.", code: "NOT_CONFIGURED" }, 503);
  }

  // Voorzichtig basistempo om onnodige externe API-kosten en misbruik te beperken.
  const ip = request.headers.get("x-nf-client-connection-ip") || "unknown";
  const now = Date.now();
  for (const [key, obj] of hits) if (now - obj.since > 60000) hits.delete(key);
  const record = hits.get(ip) || { since: now, count: 0 };
  if (now - record.since > 60000) { record.since = now; record.count = 0; }
  record.count++;
  hits.set(ip, record);
  if (record.count > 12) return reply({ error: "Te veel controles achter elkaar. Probeer het over een minuut opnieuw." }, 429);

  let body;
  try {
    body = await request.json();
  } catch {
    return reply({ error: "Vul een geldig adres in." }, 400);
  }
  if (body?.action !== "zone" && body?.action !== "check") return reply({ error: "Ongeldige aanvraag." }, 400);

  try {
    if (body.action === "zone") return reply(await zone());

    const raw = typeof body.address === "string" ? body.address.trim().replace(/\s+/g, " ") : "";
    if (raw.length < 7 || raw.length > 150 || !/\d/.test(raw)) {
      return reply({ error: "Vul een volledig adres in met huisnummer, plaats of postcode." }, 400);
    }
    const address = /(?:nederland|netherlands|duitsland|germany|deutschland)\b/i.test(raw)
      ? raw : raw + ", Nederland";
    const destination = await location(address);
    if (!destination) return reply({ error: "We kunnen dit adres niet vinden. Vul postcode, huisnummer en plaats in." }, 422);

    const start = await origin();
    const route = await provider(BASE + "/v2/directions/driving-car/geojson", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        coordinates: [start.coordinates, destination.coordinates],
        preference: "shortest",
        instructions: false
      })
    });
    const feature = route.features?.[0];
    const metres = feature?.properties?.summary?.distance;
    if (!Number.isFinite(metres) || !feature?.geometry) throw new Error("NO_ROUTE");
    return reply({
      address: destination.label,
      distanceKm: Math.round(metres / 100) / 10,
      inside: metres <= MAX_METRES,
      route: feature.geometry,
      origin: start.coordinates,
      destination: destination.coordinates
    });
  } catch (err) {
    if (err.message === "LIMIT") return reply({ error: "De kaartdienst is tijdelijk druk. Probeer het later opnieuw of bel Tieks." }, 503);
    if (err.message === "NO_ROUTE") return reply({ error: "Voor dit adres kan geen betrouwbare autoroute worden berekend. Neem contact op met Tieks." }, 422);
    return reply({ error: "De afstand kan momenteel niet worden berekend. Bel of mail Tieks voor een persoonlijke controle." }, 503);
  }
};

export const config = { path: "/api/servicegebied" };
