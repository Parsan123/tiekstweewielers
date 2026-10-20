# Tieks Tweewielers — fase 1 configuratie en testplan

**Branch:** `feature/tieks-servicegebied-en-contact-20261020`  
**Uitvoering:** contactformulier verwijderen; service promoten; 50 km servicegebied op basis van **rijafstand**; werkende adrescheck-interface; privacypagina en beveiligingsheaders bijwerken.  
**Nog niet:** nieuwe winkelfoto's/collectie 2027, DNS aanpassen of livegang via tiekstweewielers.nl.

## 1. Belangrijke architectuur

- HTML/CSS/JavaScript worden statisch gepubliceerd via Netlify.
- Het contactformulier wordt vervangen door `tel:+31591522709` en `mailto:info@tiekstweewielers.nl`.
- De kaart gebruikt Leaflet 1.9.4 (vastgepind met Subresource Integrity) en OpenStreetMap-kaarttegels met zichtbare bronvermelding.
- De adreschecker gebruikt `POST /api/servicegebied` (Netlify Function `netlify/functions/servicegebied.mjs`).
- Nederlandse adressen worden via de **gratis PDOK Locatieserver** opgezocht; hiervoor is geen sleutel nodig.
- Duitse adressen worden via de Pelias-dienst van HeiGIT opgezocht.
- De routeberekening en het 50 km-bereikbare gebied gebruiken **openrouteservice bij HeiGIT**, met de `driving-car`-modus en `preference: shortest`.
- De werkelijke routeafstand in meters bepaalt de uitkomst, niet een hemelsbrede afstandscirkel. De zone op de kaart is een benadering; de individuele routecontrole is bepalend.
- De routesleutel blijft server-side en verschijnt niet in de GitHub-repository of browsercode.
- Invoer wordt niet in de app opgeslagen of in de code gelogd. Externe leveranciers verwerken wel technisch noodzakelijke informatie.

## 2. Noodzakelijke activering vóór live-test

1. Maak of gebruik een account op https://account.heigit.org voor openrouteservice en controleer eerst dat het gekozen plan en quota passen bij dit zakelijke gebruik.
2. Maak een API-sleutel aan voor de openrouteservice-, isochrone- en geocodingdiensten.
3. Open de Netlify-site van Tieks. Ga naar **Site configuration → Environment variables**, voeg de variabele `ORS_API_KEY` toe en geef deze toegang voor **Functions**.
4. Voeg de sleutel **alleen in Netlify** toe; niet in GitHub, in de websitecode of in een chat.
5. Deploy de branch eerst in een geïsoleerde preview (of na review/expliciet akkoord), en voer de tests hieronder uit.
6. Als geen sleutel is ingesteld, laat de checker uitdrukkelijk zien dat de functie nog niet beschikbaar is, in plaats van fictieve routes te tonen.

API-domeinen: `https://api.heigit.org/openrouteservice/v2/` voor route en bereikbare zone, `https://api.heigit.org/pelias/v1/search` voor Duitse geocoding. Het oude domein `api.openrouteservice.org` wordt uitgefaseerd.

## 3. Handmatige acceptatietests

- [ ] De contactpagina toont geen contactformulier meer. Bellen en e-mailen openen de juiste apps.
- [ ] Homepage en werkplaatspagina presenteren de gratis haal- en brengservice duidelijk.
- [ ] Kaart toont na activering de exacte winkelmarker, een rijafstandzone en copyrightinformatie.
- [ ] Invoer van het **werkelijke winkeladres** toont een route bij/nagenoeg nul kilometer en ligt binnen 50 km.
- [ ] Geldig adres in Emmen toont herkenbare locatie, een autoroute en een berekende afstand.
- [ ] Geldig adres buiten de 50 km (bijvoorbeeld een adres ver buiten Drenthe) wordt correct afgewezen.
- [ ] Een grensadres rond 50 km wordt exact beoordeeld; controleer dat afronding het resultaat niet verandert.
- [ ] Onbekend huisnummer, ongeldige postcode, leeg invoerveld en routefout geven een duidelijke foutmelding.
- [ ] Op iPhone, Android en desktop werken de kaartbediening en knoppen.
- [ ] De console geeft geen relevante JavaScriptfouten en er worden geen privésleutels naar de browser verzonden.
- [ ] Bevestig dat de privacytekst klopt met de werkelijk gebruikte externe kaart- en routeproviders.
- [ ] Controleer de API-quota en verwachte belasting van isochrone- en routeaanvragen.

## 4. Beveiliging en overdracht

- De Netlify-configuratie bevat een basis-CSP, X-Frame-Options, nosniff, Referrer-Policy en Permissions-Policy.
- Controleer in de beheeraccounts of **tweestapsverificatie** geactiveerd is; dit kan niet vanuit de broncode worden vastgesteld.
- `X-Robots-Tag: noindex, nofollow, noarchive` blijft tijdens de demo intact. Verwijder dit **pas** op de dag van de officiële livegang en controleer dan ook HTML-meta-robots.
- Maak een definitieve ZIP van de websitebestanden (zonder tokens of geheimen) om volgens de overeenkomst aan Tieks te verstrekken.

## 5. DNS en foto's

De DNS-records van `tiekstweewielers.nl` zijn in deze fase niet aangepast. Voor latere koppeling eerst alle huidige DNS-records vastleggen, waaronder **MX, SPF, DKIM en DMARC**, zodat de zakelijke mail niet onnodig wordt onderbroken. Koppel alleen na toestemming van Tieks.

De door Mirjan aangekondigde nieuwe winkelfoto's en collectie 2027 zijn nog niet aangeleverd. **Laat alle huidige foto's, modellen en prijzen onaangetast** tot de volgende afgesproken ronde.

## 6. Bronvermelding en gebruikslimieten

- Leaflet: https://leafletjs.com/download.html
- OpenStreetMap tegels en voorwaarden: https://operations.osmfoundation.org/policies/tiles/
- PDOK Locatieserver: https://api.pdok.nl/
- HeiGIT openrouteservice: https://account.heigit.org en https://openrouteservice.org/restrictions/
- Netlify Functions: https://docs.netlify.com/build/functions/get-started/

De publieke kaart- en route-API's bieden geen gegarandeerde beschikbaarheid. Houd rekening met de toepasselijke quota, bronvermelding en voorwaarden.
