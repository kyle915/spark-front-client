async (page) => {
  const stores = [{"store_number": "1801", "address": "13887 Manchester Road, TOWN AND COUNTRY, MO 63011", "lat": 38.5983759, "lng": -90.484567}, {"store_number": "1802", "address": "90 Brentwood Promenede Court, BRENTWOOD, MO 63144", "lat": 38.6261864, "lng": -90.341044}, {"store_number": "1803", "address": "1781 Clarkson Road, CHESTERFIELD, MO 63017", "lat": 38.6425528, "lng": -90.5693737}, {"store_number": "1804", "address": "2257 State Hwy K, O'Fallon, MO 63368", "lat": 38.7734315, "lng": -90.701864}, {"store_number": "1805", "address": "8520 N Evanston Ave., KANSAS CITY, MO 64157", "lat": 39.2477567, "lng": -94.4608221}, {"store_number": "1806", "address": "13657 Washington Street, KANSAS CITY, MO 64145", "lat": 38.9132507, "lng": -94.5963198}, {"store_number": "1807", "address": "1648 NW Chipman Road, LEE'S SUMMIT, MO 64081", "lat": 38.9267837, "lng": -94.4225665}, {"store_number": "1808", "address": "4201 Main Street, KANSAS CITY, MO 64111", "lat": 39.0505493, "lng": -94.5860147}, {"store_number": "1809", "address": "3308 S. GLENSTONE AVE, SPRINGFIELD, MO 65804", "lat": 37.1530733, "lng": -93.2603409}, {"store_number": "501", "address": "9350 N Central Expy, Dallas, TX 75231", "lat": 32.8744604, "lng": -96.7682142}, {"store_number": "505", "address": "721 N Central Expy #200, Plano, TX 75075", "lat": 33.0104142, "lng": -96.7094523}, {"store_number": "509", "address": "5601 Brodie Ln #800, Sunset Valley, TX 78745", "lat": 30.2253837, "lng": -97.8209392}, {"store_number": "510", "address": "11066 Pecan Park Blvd Suite 117, Cedar Park, TX 78613", "lat": 30.4698531, "lng": -97.7992026}, {"store_number": "515", "address": "18740 Gulf Fwy, Friendswood, TX 77546", "lat": 29.5475708, "lng": -95.1515454}, {"store_number": "522", "address": "10001 Research Blvd #300, Austin, TX 78759", "lat": 30.3917293, "lng": -97.7444326}, {"store_number": "523", "address": "3101 Texas Sage Trail, Fort Worth, TX 76177", "lat": 32.9136209, "lng": -97.3118574}, {"store_number": "528", "address": "2501 Rio Grande Blvd, Euless, TX 76039", "lat": 32.8721983, "lng": -97.1033875}, {"store_number": "530", "address": "2857 Katy Fwy Ste 100, Houston, TX 77007", "lat": 29.7734436, "lng": -95.3883728}, {"store_number": "531", "address": "3810 Congress Ave, Dallas, TX 75219", "lat": 32.8073924, "lng": -96.8109862}, {"store_number": "803", "address": "124 PERIMETER CENTER WEST, , ATLANTA, GA 30346", "lat": 33.9270777, "lng": -84.3447482}, {"store_number": "804", "address": "3954A PEACHTREE ROAD NE, , BROOKHAVEN, GA 30319", "lat": 33.8589424, "lng": -84.3420443}, {"store_number": "805", "address": "2955 COBB PKWY NW STE 308, , ATLANTA, GA 30339", "lat": 33.8828686, "lng": -84.4608027}, {"store_number": "902", "address": "13711 S Tamiami Trl, Fort Myers, FL 33912", "lat": 26.5442615, "lng": -81.8687949}, {"store_number": "903", "address": "11221 Legacy Ave, Palm Beach Gardens, FL 33410", "lat": 26.8404085, "lng": -80.0932074}, {"store_number": "907", "address": "4413 Town Center Pkwy Ste 300, Jacksonville, FL 32246", "lat": 30.2627623, "lng": -81.5268641}, {"store_number": "909", "address": "2712 E Colonial Dr, Orlando, FL 32803", "lat": 28.5527675, "lng": -81.3485958}, {"store_number": "924", "address": "8280 S Tamiami Trail, Sarasota, FL 34238", "lat": 27.230653, "lng": -82.4966982}, {"store_number": "925", "address": "160 E Altamonte Dr, Altamonte Springs, FL 32701", "lat": 28.661234, "lng": -81.3849008}, {"store_number": "928", "address": "11211 Causeway Blvd, Brandon, FL 33511", "lat": 27.9214109, "lng": -82.3259932}, {"store_number": "934", "address": "25535 Sierra Center Blvd, Lutz, FL 33559", "lat": 28.1955582, "lng": -82.3955595}, {"store_number": "937", "address": "1660 Airport Blvd Unit 145, Pensacola, FL 32504", "lat": 30.4810929, "lng": -87.2072024}, {"store_number": "938", "address": "1400-31 Village Square Blvd, Tallahassee, FL 32312", "lat": 30.5120456, "lng": -84.2478957}];
  page.setDefaultTimeout(180000);
  return page.evaluate(async (stores) => {
    const token = localStorage.getItem("@token") || "";
    const tenantId = localStorage.getItem("@tenantId") || "";
    const entries = performance.getEntriesByType("resource") || [];
    const gqlUrl =
      entries.map((e) => e.name).find((n) => n.includes("/graphql/")) ||
      "https://spark-api-new-490085168610.us-central1.run.app/api/v615204/graphql/clients";
    const gql = async (query, variables) => {
      const res = await fetch(gqlUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? "JWT " + token : "",
        },
        body: JSON.stringify({ query, variables }),
      });
      return res.json();
    };
    const parseCityStateZip = (address) => {
      const m = String(address || "").match(/,\s*([^,]+),\s*([A-Za-z]{2})\s+(\d{5})(?:-\d{4})?\s*$/);
      if (!m) return { city: "", state: "", zip: "" };
      return { city: m[1].trim(), state: m[2].trim().toUpperCase(), zip: m[3].trim() };
    };
    const summary = {
      requests: 0, uniqueStoresOnTracker: 0, retailersCreated: 0, locationsCreated: 0,
      requestsUpdated: 0, eventsUpdated: 0, skippedNoCoords: 0, errors: [],
    };
    const reqQ = await gql(`query TorchReqs($first: Int, $filters: RequestFiltersInput) {
      requests(first: $first, filters: $filters) {
        totalCount
        edges { node {
          id uuid name address storeNumber coordinates retailerName
          date startTime endTime
          timezone { id } requestType { id }
          retailer { id uuid name }
          event { id coordinates }
          products { id }
        } }
      }
    }`, { first: 500, filters: tenantId ? { tenantId } : null });
    if (reqQ.errors && reqQ.errors.length) {
      summary.errors.push("requests query: " + reqQ.errors.map((e) => e.message).join("; "));
      return summary;
    }
    const nodes = (reqQ.data && reqQ.data.requests && reqQ.data.requests.edges || []).map((e) => e.node).filter(Boolean);
    summary.requests = nodes.length;
    const statesQ = await gql(`query { states(first: 60) { edges { node { id code } } } }`, {});
    const stateByCode = new Map();
    for (const e of (statesQ.data && statesQ.data.states && statesQ.data.states.edges) || []) {
      const code = (e.node && e.node.code || "").toUpperCase();
      if (code) stateByCode.set(code, e.node.id);
    }
    const locCache = new Map();
    const getLocationId = async (city, stateCode, zip) => {
      const key = (city + "|" + stateCode + "|" + zip).toLowerCase();
      if (locCache.has(key)) return locCache.get(key);
      const q = await gql(`query Loc($q: String, $first: Int) {
        locations(q: $q, first: $first) { edges { node { id name zip } } }
      }`, { q: city, first: 20 });
      const edges = q.data && q.data.locations && q.data.locations.edges || [];
      const match = edges.find((e) => {
        const n = e.node;
        if (!n) return false;
        const zipOk = !zip || !n.zip || String(n.zip).startsWith(zip.slice(0, 5));
        return zipOk && (n.name || "").toLowerCase() === city.toLowerCase();
      });
      if (match) { locCache.set(key, match.node.id); return match.node.id; }
      const stateId = stateByCode.get(stateCode);
      const created = await gql(`mutation C($input: CreateLocationInput!) {
        createLocation(input: $input) { success message location { id } }
      }`, { input: {
        name: (city || "Unknown").slice(0, 50),
        code: ((stateCode || "XX") + "-" + (zip || "00000")).slice(0, 50),
        zip: (zip || "00000").slice(0, 10),
        stateId: stateId || null,
        tenantId: tenantId || null,
      }});
      const locId = created.data && created.data.createLocation && created.data.createLocation.location && created.data.createLocation.location.id;
      if (created.data && created.data.createLocation && created.data.createLocation.success && locId) {
        summary.locationsCreated += 1;
        locCache.set(key, locId);
        return locId;
      }
      const errMsg = (created.data && created.data.createLocation && created.data.createLocation.message) || (created.errors && created.errors[0] && created.errors[0].message) || "fail";
      summary.errors.push("location " + city + ": " + errMsg);
      locCache.set(key, null);
      return null;
    };
    const storeByNumber = new Map(stores.map((s) => [String(s.store_number), s]));
    const retailerByStore = new Map();
    const uniqueStoreNumbers = [...new Set(nodes.map((n) => String(n.storeNumber || "")).filter(Boolean))];
    summary.uniqueStoresOnTracker = uniqueStoreNumbers.length;
    for (const sn of uniqueStoreNumbers) {
      const geo = storeByNumber.get(sn);
      const sample = nodes.find((n) => String(n.storeNumber) === sn);
      const address = ((geo && geo.address) || (sample && sample.address) || "").slice(0, 100);
      const parsed = parseCityStateZip((geo && geo.address) || (sample && sample.address) || "");
      const locationId = await getLocationId(parsed.city || "Unknown", parsed.state, parsed.zip);
      if (!locationId) continue;
      const created = await gql(`mutation C($input: CreateRetailerInput!) {
        createRetailer(input: $input) { success message retailer { id uuid name } }
      }`, { input: {
        name: "Total Wine",
        address: address || "Total Wine",
        storeContact: "-",
        locationId,
        tenantId: tenantId || null,
        isNational: false,
      }});
      const rid = created.data && created.data.createRetailer && created.data.createRetailer.retailer && created.data.createRetailer.retailer.id;
      if (created.data && created.data.createRetailer && created.data.createRetailer.success && rid) {
        summary.retailersCreated += 1;
        retailerByStore.set(sn, rid);
      } else {
        const errMsg = (created.data && created.data.createRetailer && created.data.createRetailer.message) || (created.errors && created.errors[0] && created.errors[0].message) || "fail";
        summary.errors.push("retailer #" + sn + ": " + errMsg);
      }
    }
    for (const n of nodes) {
      const sn = String(n.storeNumber || "");
      const geo = storeByNumber.get(sn);
      if (!geo || geo.lat == null || geo.lng == null) { summary.skippedNoCoords += 1; continue; }
      const coords = [geo.lat, geo.lng];
      const retailerId = retailerByStore.get(sn) || (n.retailer && n.retailer.id) || null;
      const products = (n.products || []).filter((p) => p && p.id).map((p) => ({ productId: String(p.id) }));
      const upd = await gql(`mutation U($input: UpdateRequestInput!) {
        updateRequest(input: $input) { success message }
      }`, { input: {
        id: n.id,
        name: n.name || "Request",
        date: n.date,
        startTime: n.startTime,
        endTime: n.endTime,
        address: n.address,
        coordinates: coords,
        timezoneId: n.timezone && n.timezone.id,
        requestTypeId: n.requestType && n.requestType.id,
        retailerId,
        details: [],
        products,
      }});
      if (upd.data && upd.data.updateRequest && upd.data.updateRequest.success) summary.requestsUpdated += 1;
      else {
        const errMsg = (upd.data && upd.data.updateRequest && upd.data.updateRequest.message) || (upd.errors && upd.errors[0] && upd.errors[0].message) || "fail";
        summary.errors.push("request " + sn + ": " + errMsg);
      }
      if (n.event && n.event.id) {
        const ev = await gql(`mutation E($input: UpdateEventInput!) {
          updateEvent(input: $input) { success message }
        }`, { input: { id: n.event.id, coordinates: coords } });
        if (ev.data && ev.data.updateEvent && ev.data.updateEvent.success) summary.eventsUpdated += 1;
      }
    }
    if (summary.errors.length > 12) {
      summary.errors = summary.errors.slice(0, 12).concat(["…and " + (summary.errors.length - 12) + " more"]);
    }
    return summary;
  }, stores);
}
