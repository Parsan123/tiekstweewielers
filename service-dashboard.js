/* Tieks: luxe service-dashboard, zonder account of API-sleutel. */
(() => {
"use strict";
const widget = document.querySelector("[data-premium-service]");
if (!widget) return;
const choices = [...widget.querySelectorAll("[data-service-option]")];
const email = widget.querySelector("[data-service-mail]");
const mapBtn = widget.querySelector("[data-load-map]");
const placeholder = widget.querySelector("[data-map-placeholder]");
const mapView = widget.querySelector("[data-map-view]");
const mapFrame = widget.querySelector("[data-map-iframe]");
const receiver = "info@tiekstweewielers.nl";
function setService(name) {
  choices.forEach(btn => {
    const active = btn.dataset.serviceOption === name;
    btn.classList.toggle("is-selected", active);
    btn.setAttribute("aria-pressed", String(active));
  });
  const subject = "Aanvraag gratis haal- en brengservice — " + name;
  const body = [
    "Beste Tieks Tweewielers,",
    "",
    "Ik wil graag informeren naar de gratis haal- en brengservice.",
    "",
    "Type service: " + name,
    "Mijn naam:",
    "Mijn ophaaladres (postcode, huisnummer en plaats):",
    "Merk/type fiets:",
    "Omschrijving van het probleem:",
    "Mijn telefoonnummer:",
    "Eventuele voorkeursdag:",
    "",
    "Ik begrijp dat Tieks de rijafstand (maximaal 50 km over de weg) en het ophaalmoment nog bevestigt.",
    "",
    "Met vriendelijke groet,"
  ].join("\n");
  email.href = "mailto:" + receiver + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
}
choices.forEach(btn => btn.addEventListener("click", () => setService(btn.dataset.serviceOption)));
setService("Reparatie");
if (mapBtn && mapFrame && mapView && placeholder) {
  mapBtn.addEventListener("click", () => {
    if (mapView.hidden) {
      // Pas na een expliciete klik wordt Google Maps geladen.
      mapFrame.src = "https://www.google.com/maps?q=" + encodeURIComponent("Weerdingerkanaal Noordzijde 161, 7831 HL Nieuw-Weerdinge") + "&output=embed";
      mapView.hidden = false;
      placeholder.hidden = true;
      mapBtn.textContent = "Verberg kaart";
    } else {
      mapFrame.removeAttribute("src");
      mapView.hidden = true;
      placeholder.hidden = false;
      mapBtn.textContent = "Toon kaart";
    }
  });
}
})();