/* Tieks Tweewielers — servicegebiedkaart en rijafstandchecker. */
/* Exacte afstanden en bereikbare zone komen UITSLUITEND van de serverrouteprovider. */
(() => {
  "use strict";
  const root = document.querySelector("[data-servicechecker]");
  if (!root) return;
  const form = root.querySelector("[data-distance-form]");
  const input = root.querySelector("[data-address]");
  const submit = root.querySelector("[data-submit]");
  const status = root.querySelector("[data-check-status]");
  const zoneStatus = root.querySelector("[data-zone-status]");
  const output = root.querySelector("[data-check-result]");
  const addressLabel = root.querySelector("[data-result-address]");
  const distanceLabel = root.querySelector("[data-result-distance]");
  const actions = root.querySelector("[data-result-actions]");

  if (!window.L) {
    zoneStatus.textContent = "De kaart kan niet worden geladen. Bel Tieks voor informatie over ons servicegebied.";
    output.hidden = false;
    status.textContent = "De kaartdienst is tijdelijk niet beschikbaar. U kunt ons wel bellen of mailen.";
    form.querySelector("button").disabled = true;
    return;
  }

  const L = window.L;
  const map = L.map("tieks-service-map", {
    scrollWheelZoom: false,
    zoomControl: true,
    tap: true
  });
  // Begin bij de regio; de exacte winkelpositie wordt door de routeprovider opgezocht.
  map.setView([52.85, 7.0], 9);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>',
    referrerPolicy: "strict-origin-when-cross-origin"
  }).addTo(map);

  let zoneLayer = null;
  let routeLayer = null;
  let destinationMarker = null;
  let storeMarker = null;

  async function callService(body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch("/api/servicegebied", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Afstandscontrole is momenteel niet beschikbaar.");
      return payload;
    } catch (e) {
      if (e.name === "AbortError") throw new Error("De afstandscontrole duurt te lang. Probeer het later opnieuw.");
      if (e instanceof SyntaxError || e instanceof TypeError) throw new Error("De kaartdienst is tijdelijk niet bereikbaar. Bel Tieks voor informatie.");
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  async function loadZone() {
    zoneStatus.textContent = "Servicegebied op basis van de wegenkaart laden…";
    // De exacte winkelmarker is via de Nederlandse adresdienst beschikbaar.
    try {
      const position = await callService({ action: "origin" });
      const point = position.origin?.coordinates;
      if (Array.isArray(point) && point.length === 2) {
        storeMarker = L.marker([point[1], point[0]]).addTo(map).bindPopup("Tieks Tweewielers · Nieuw-Weerdinge");
        map.setView([point[1], point[0]], 10);
      }
    } catch {
      // Gebruik geen onbevestigde winkelpositie.
    }
    try {
      const data = await callService({ action: "zone" });
      if (!data.area?.geometry || !Array.isArray(data.origin?.coordinates)) throw new Error("Servicezone niet beschikbaar.");
      const position = [data.origin.coordinates[1], data.origin.coordinates[0]];
      if (!storeMarker) storeMarker = L.marker(position).addTo(map).bindPopup("Tieks Tweewielers · Nieuw-Weerdinge");
      zoneLayer = L.geoJSON(data.area, {
        style: { color: "#14170e", weight: 2, fillColor: "#e4df16", fillOpacity: 0.30, opacity: 0.9 }
      }).addTo(map);
      if (zoneLayer.getBounds().isValid()) map.fitBounds(zoneLayer.getBounds(), { padding: [20, 20], maxZoom: 10 });
      else map.setView(position, 11);
      zoneStatus.textContent = "Gele gebied: ongeveer 50 km bereikbaar over de weg. De individuele routeberekening bepaalt of uw adres binnen het servicegebied valt.";
    } catch (error) {
      zoneStatus.textContent = error.message || "De servicezone kan momenteel niet worden geladen. U kunt Tieks telefonisch bereiken.";
    }
  }

  function showResult(data) {
    const inside = data.inside === true;
    if (!Array.isArray(data.destination) || !data.route || !Number.isFinite(data.distanceKm)) {
      throw new Error("Het resultaat kon niet worden gecontroleerd.");
    }
    if (routeLayer) map.removeLayer(routeLayer);
    if (destinationMarker) map.removeLayer(destinationMarker);
    routeLayer = L.geoJSON(data.route, {
      style: { color: inside ? "#246434" : "#ad4425", weight: 5, opacity: 0.96 }
    }).addTo(map);
    destinationMarker = L.marker([data.destination[1], data.destination[0]]).addTo(map).bindPopup("Gecontroleerd adres");
    const bounds = routeLayer.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [35, 35], maxZoom: 13 });

    output.hidden = false;
    output.className = "service-result " + (inside ? "service-result--yes" : "service-result--no");
    status.textContent = inside
      ? "Goed nieuws! Uw adres valt binnen ons gratis haal- en brenggebied."
      : "Uw adres ligt buiten ons standaard servicegebied. Neem contact op om de mogelijkheden te bespreken.";
    addressLabel.textContent = data.address;
    distanceLabel.textContent = "Kortste berekende autoroute: " +
      new Intl.NumberFormat("nl-NL", { minimumFractionDigits: 1, maximumFractionDigits: 3 }).format(data.distanceKm) + " km";
    actions.hidden = false;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const address = input.value.trim();
    output.hidden = true;
    actions.hidden = true;
    if (address.length < 7 || address.length > 150 || !/\d/.test(address)) {
      output.hidden = false;
      output.className = "service-result service-result--error";
      status.textContent = "Vul een postcode en huisnummer of een volledig adres met huisnummer in.";
      input.focus();
      return;
    }

    submit.disabled = true;
    submit.textContent = "Afstand berekenen…";
    output.hidden = false;
    output.className = "service-result";
    addressLabel.textContent = "";
    distanceLabel.textContent = "";
    status.textContent = "Uw adres wordt gecontroleerd. Een moment alstublieft.";
    try {
      const data = await callService({ action: "check", address });
      showResult(data);
    } catch (error) {
      status.textContent = error.message || "De adrescontrole is tijdelijk niet mogelijk. Bel of mail Tieks.";
      output.hidden = false;
      output.className = "service-result service-result--error";
      addressLabel.textContent = "";
      distanceLabel.textContent = "";
      actions.hidden = false;
    } finally {
      submit.disabled = false;
      submit.textContent = "Controleer mijn adres";
    }
  });

  loadZone();
})();