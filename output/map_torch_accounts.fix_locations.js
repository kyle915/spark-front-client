async (page) => {
  const stores = [{"store_number": "1801", "address": "13887 Manchester Road, TOWN AND COUNTRY, MO 63011"}, {"store_number": "1802", "address": "90 Brentwood Promenede Court, BRENTWOOD, MO 63144"}, {"store_number": "1803", "address": "1781 Clarkson Road, CHESTERFIELD, MO 63017"}, {"store_number": "1804", "address": "2257 State Hwy K, O'Fallon, MO 63368"}, {"store_number": "1805", "address": "8520 N Evanston Ave., KANSAS CITY, MO 64157"}, {"store_number": "1806", "address": "13657 Washington Street, KANSAS CITY, MO 64145"}, {"store_number": "1807", "address": "1648 NW Chipman Road, LEE'S SUMMIT, MO 64081"}, {"store_number": "1808", "address": "4201 Main Street, KANSAS CITY, MO 64111"}, {"store_number": "1809", "address": "3308 S. GLENSTONE AVE, SPRINGFIELD, MO 65804"}, {"store_number": "501", "address": "9350 N Central Expy, Dallas, TX 75231"}, {"store_number": "505", "address": "721 N Central Expy #200, Plano, TX 75075"}, {"store_number": "509", "address": "5601 Brodie Ln #800, Sunset Valley, TX 78745"}, {"store_number": "510", "address": "11066 Pecan Park Blvd Suite 117, Cedar Park, TX 78613"}, {"store_number": "515", "address": "18740 Gulf Fwy, Friendswood, TX 77546"}, {"store_number": "522", "address": "10001 Research Blvd #300, Austin, TX 78759"}, {"store_number": "523", "address": "3101 Texas Sage Trail, Fort Worth, TX 76177"}, {"store_number": "528", "address": "2501 Rio Grande Blvd, Euless, TX 76039"}, {"store_number": "530", "address": "2857 Katy Fwy Ste 100, Houston, TX 77007"}, {"store_number": "531", "address": "3810 Congress Ave, Dallas, TX 75219"}, {"store_number": "803", "address": "124 PERIMETER CENTER WEST, , ATLANTA, GA 30346"}, {"store_number": "804", "address": "3954A PEACHTREE ROAD NE, , BROOKHAVEN, GA 30319"}, {"store_number": "805", "address": "2955 COBB PKWY NW STE 308, , ATLANTA, GA 30339"}, {"store_number": "902", "address": "13711 S Tamiami Trl, Fort Myers, FL 33912"}, {"store_number": "903", "address": "11221 Legacy Ave, Palm Beach Gardens, FL 33410"}, {"store_number": "907", "address": "4413 Town Center Pkwy Ste 300, Jacksonville, FL 32246"}, {"store_number": "909", "address": "2712 E Colonial Dr, Orlando, FL 32803"}, {"store_number": "924", "address": "8280 S Tamiami Trail, Sarasota, FL 34238"}, {"store_number": "925", "address": "160 E Altamonte Dr, Altamonte Springs, FL 32701"}, {"store_number": "928", "address": "11211 Causeway Blvd, Brandon, FL 33511"}, {"store_number": "934", "address": "25535 Sierra Center Blvd, Lutz, FL 33559"}, {"store_number": "937", "address": "1660 Airport Blvd Unit 145, Pensacola, FL 32504"}, {"store_number": "938", "address": "1400-31 Village Square Blvd, Tallahassee, FL 32312"}];
  page.setDefaultTimeout(180000);
  return page.evaluate(async (stores) => {
    const token = localStorage.getItem("@token") || "";
    const tenantId = localStorage.getItem("@tenantId") || "";
    const gqlUrl = "https://spark-api-new-490085168610.us-central1.run.app/api/v615204/graphql/clients";
    const gql = async (query, variables) => {
      const res = await fetch(gqlUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: token ? "JWT " + token : "" },
        body: JSON.stringify({ query, variables }),
      });
      return res.json();
    };
    const parseCityStateZip = (address) => {
      const m = String(address || "").match(/,\s*([^,]+),\s*([A-Za-z]{2})\s+(\d{5})(?:-\d{4})?\s*$/);
      if (!m) return { city: "", state: "", zip: "" };
      return { city: m[1].trim(), state: m[2].trim().toUpperCase(), zip: m[3].trim() };
    };
    const summary = { retailersFixed: 0, alreadyOk: 0, locationsCreated: 0, mismatchesBefore: [], errors: [] };
    const reqQ = await gql(`query TorchReqs($first: Int, $filters: RequestFiltersInput) {
      requests(first: $first, filters: $filters) {
        edges { node {
          storeNumber
          retailer { id name address storeContact isNational
            location { id name zip state { id code } } }
        } }
      }
    }`, { first: 500, filters: tenantId ? { tenantId } : null });
    if (reqQ.errors) { summary.errors.push(reqQ.errors.map(e => e.message).join("; ")); return summary; }
    const nodes = (reqQ.data.requests.edges || []).map(e => e.node).filter(Boolean);
    const statesQ = await gql(`query { states(first: 60) { edges { node { id code } } } }`, {});
    const stateByCode = new Map();
    for (const e of (statesQ.data && statesQ.data.states && statesQ.data.states.edges) || []) {
      const code = (e.node && e.node.code || "").toUpperCase();
      if (code) stateByCode.set(code, e.node.id);
    }
    const locCache = new Map();
    const getLocationId = async (city, stateCode, zip) => {
      const key = (city + "|" + stateCode).toLowerCase();
      if (locCache.has(key)) return locCache.get(key);
      const stateId = stateByCode.get(stateCode) || null;
      const q = await gql(`query Loc($q: String, $first: Int, $filters: LocationFiltersInput) {
        locations(q: $q, first: $first, filters: $filters) {
          edges { node { id name zip state { code } } }
        }
      }`, { q: city, first: 50, filters: stateId ? { stateId } : null });
      const edges = q.data && q.data.locations && q.data.locations.edges || [];
      const match = edges.find((e) => {
        const n = e.node;
        if (!n) return false;
        const nameOk = (n.name || "").toLowerCase() === city.toLowerCase();
        const stOk = !stateCode || ((n.state && n.state.code) || "").toUpperCase() === stateCode;
        return nameOk && stOk;
      });
      if (match && match.node) { locCache.set(key, match.node.id); return match.node.id; }
      const created = await gql(`mutation C($input: CreateLocationInput!) {
        createLocation(input: $input) { success message location { id } }
      }`, { input: {
        name: (city || "Unknown").slice(0, 50),
        code: ((city || "X").slice(0, 20) + "-" + (stateCode || "XX") + "-" + (zip || "00000")).slice(0, 50),
        zip: (zip || "00000").slice(0, 10),
        stateId: stateId,
      }});
      const locId = created.data && created.data.createLocation && created.data.createLocation.location && created.data.createLocation.location.id;
      if (created.data && created.data.createLocation && created.data.createLocation.success && locId) {
        summary.locationsCreated += 1;
        locCache.set(key, locId);
        return locId;
      }
      summary.errors.push("location " + city + " " + stateCode + ": " + ((created.data && created.data.createLocation && created.data.createLocation.message) || (created.errors && created.errors[0] && created.errors[0].message) || "fail"));
      locCache.set(key, null);
      return null;
    };
    const storeByNumber = new Map(stores.map((s) => [String(s.store_number), s]));
    const seenRetailer = new Set();
    for (const n of nodes) {
      const sn = String(n.storeNumber || "");
      const r = n.retailer;
      if (!r || !r.id || seenRetailer.has(r.id)) continue;
      seenRetailer.add(r.id);
      const geo = storeByNumber.get(sn);
      const parsed = parseCityStateZip((geo && geo.address) || "");
      const curCity = (r.location && r.location.name) || "";
      const curSt = (r.location && r.location.state && r.location.state.code) || "";
      if (parsed.city && curCity.toLowerCase() === parsed.city.toLowerCase() && curSt.toUpperCase() === parsed.state) {
        summary.alreadyOk += 1;
        continue;
      }
      summary.mismatchesBefore.push(sn + ": " + curCity + ", " + curSt + " -> " + parsed.city + ", " + parsed.state);
      const locationId = await getLocationId(parsed.city || "Unknown", parsed.state, parsed.zip);
      if (!locationId) continue;
      const upd = await gql(`mutation U($input: UpdateRetailerInput!) {
        updateRetailer(input: $input) { success message retailer { id location { name state { code } } } }
      }`, { input: {
        id: r.id,
        name: r.name || "Total Wine",
        address: (r.address || (geo && geo.address) || "Total Wine").slice(0, 100),
        storeContact: r.storeContact || "-",
        locationId,
        tenantId: tenantId || null,
        isNational: !!r.isNational,
      }});
      if (upd.data && upd.data.updateRetailer && upd.data.updateRetailer.success) summary.retailersFixed += 1;
      else summary.errors.push("retailer " + sn + ": " + ((upd.data && upd.data.updateRetailer && upd.data.updateRetailer.message) || (upd.errors && upd.errors[0] && upd.errors[0].message) || "fail"));
    }
    return summary;
  }, stores);
}
