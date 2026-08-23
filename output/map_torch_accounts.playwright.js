async (page) => {
  const fs = require("fs");
  const stores = JSON.parse(
    fs.readFileSync(
      "/Users/kylechristiansen/spark-front-client/output/torch_twm_geocoded_stores.json",
      "utf8",
    ),
  ).stores;
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
          Authorization: token ? `JWT ${token}` : "",
        },
        body: JSON.stringify({ query, variables }),
      });
      const json = await res.json();
      return json;
    };

    const parseCityStateZip = (address) => {
      const m = String(address || "").match(
        /,\s*([^,]+),\s*([A-Za-z]{2})\s+(\d{5})(?:-\d{4})?\s*$/,
      );
      if (!m) return { city: "", state: "", zip: "" };
      return {
        city: m[1].trim(),
        state: m[2].trim().toUpperCase(),
        zip: m[3].trim(),
      };
    };

    const summary = {
      requests: 0,
      uniqueStoresOnTracker: 0,
      retailersCreated: 0,
      locationsCreated: 0,
      requestsUpdated: 0,
      eventsUpdated: 0,
      skippedNoCoords: 0,
      skippedAlreadyMapped: 0,
      errors: [],
    };

    const reqQ = await gql(
      `query TorchReqs($first: Int, $filters: RequestFiltersInput) {
        requests(first: $first, filters: $filters) {
          totalCount
          edges {
            node {
              id uuid name address storeNumber coordinates retailerName
              date startTime endTime
              timezone { id }
              requestType { id }
              retailer { id uuid name }
              event { id coordinates }
              products { id }
              status { slug name }
            }
          }
        }
      }`,
      { first: 500, filters: tenantId ? { tenantId } : null },
    );
    if (reqQ.errors?.length) {
      summary.errors.push(
        "requests query: " + reqQ.errors.map((e) => e.message).join("; "),
      );
      return summary;
    }
    const nodes =
      reqQ.data?.requests?.edges?.map((e) => e.node).filter(Boolean) || [];
    summary.requests = nodes.length;

    const statesQ = await gql(
      `query { states(first: 60) { edges { node { id code } } } }`,
      {},
    );
    const stateByCode = new Map();
    for (const e of statesQ.data?.states?.edges || []) {
      const code = (e.node?.code || "").toUpperCase();
      if (code) stateByCode.set(code, e.node.id);
    }

    const locCache = new Map();
    const getLocationId = async (city, stateCode, zip) => {
      const key = `${city}|${stateCode}|${zip}`.toLowerCase();
      if (locCache.has(key)) return locCache.get(key);
      const q = await gql(
        `query Loc($q: String, $first: Int) {
          locations(q: $q, first: $first) {
            edges { node { id name zip } }
          }
        }`,
        { q: city, first: 20 },
      );
      const match = (q.data?.locations?.edges || []).find((e) => {
        const n = e.node;
        if (!n) return false;
        const zipOk = !zip || !n.zip || String(n.zip).startsWith(zip.slice(0, 5));
        return zipOk && (n.name || "").toLowerCase() === city.toLowerCase();
      });
      if (match) {
        locCache.set(key, match.node.id);
        return match.node.id;
      }
      const stateId = stateByCode.get(stateCode);
      const created = await gql(
        `mutation C($input: CreateLocationInput!) {
          createLocation(input: $input) {
            success message location { id }
          }
        }`,
        {
          input: {
            name: (city || "Unknown").slice(0, 50),
            code: `${stateCode || "XX"}-${zip || "00000"}`.slice(0, 50),
            zip: (zip || "00000").slice(0, 10),
            stateId: stateId || null,
            tenantId: tenantId || null,
          },
        },
      );
      const locId = created.data?.createLocation?.location?.id;
      if (created.data?.createLocation?.success && locId) {
        summary.locationsCreated += 1;
        locCache.set(key, locId);
        return locId;
      }
      summary.errors.push(
        `location ${city}: ${created.data?.createLocation?.message || created.errors?.[0]?.message || "fail"}`,
      );
      locCache.set(key, null);
      return null;
    };

    const storeByNumber = new Map(
      stores.map((s) => [String(s.store_number), s]),
    );
    const retailerByStore = new Map();
    const uniqueStoreNumbers = [
      ...new Set(nodes.map((n) => String(n.storeNumber || "")).filter(Boolean)),
    ];
    summary.uniqueStoresOnTracker = uniqueStoreNumbers.length;

    for (const sn of uniqueStoreNumbers) {
      const geo = storeByNumber.get(sn);
      const sample = nodes.find((n) => String(n.storeNumber) === sn);
      const address = (geo?.address || sample?.address || "").slice(0, 100);
      const { city, state, zip } = parseCityStateZip(
        geo?.address || sample?.address || "",
      );
      const locationId = await getLocationId(city || "Unknown", state, zip);
      if (!locationId) continue;
      const created = await gql(
        `mutation C($input: CreateRetailerInput!) {
          createRetailer(input: $input) {
            success message retailer { id uuid name }
          }
        }`,
        {
          input: {
            name: "Total Wine",
            address: address || "Total Wine",
            storeContact: "-",
            locationId,
            tenantId: tenantId || null,
            isNational: false,
          },
        },
      );
      const rid = created.data?.createRetailer?.retailer?.id;
      if (created.data?.createRetailer?.success && rid) {
        summary.retailersCreated += 1;
        retailerByStore.set(sn, rid);
      } else {
        summary.errors.push(
          `retailer #${sn}: ${created.data?.createRetailer?.message || created.errors?.[0]?.message || "fail"}`,
        );
      }
    }

    const validCoords = (c) =>
      Array.isArray(c) &&
      c.length >= 2 &&
      !(Number(c[0]) === 0 && Number(c[1]) === 0);

    for (const n of nodes) {
      const sn = String(n.storeNumber || "");
      const geo = storeByNumber.get(sn);
      if (!geo || geo.lat == null || geo.lng == null) {
        summary.skippedNoCoords += 1;
        continue;
      }
      const coords = [geo.lat, geo.lng];
      const retailerId = retailerByStore.get(sn) || n.retailer?.id || null;
      const already =
        validCoords(n.coordinates) &&
        n.retailer?.name === "Total Wine" &&
        retailerByStore.has(sn);
      if (already) {
        summary.skippedAlreadyMapped += 1;
        continue;
      }
      const products = (n.products || [])
        .filter((p) => p?.id)
        .map((p) => ({ productId: String(p.id) }));
      const upd = await gql(
        `mutation U($input: UpdateRequestInput!) {
          updateRequest(input: $input) { success message }
        }`,
        {
          input: {
            id: n.id,
            name: n.name || "Request",
            date: n.date,
            startTime: n.startTime,
            endTime: n.endTime,
            address: n.address,
            coordinates: coords,
            timezoneId: n.timezone?.id,
            requestTypeId: n.requestType?.id,
            retailerId,
            details: [],
            products,
          },
        },
      );
      if (upd.data?.updateRequest?.success) {
        summary.requestsUpdated += 1;
      } else {
        summary.errors.push(
          `request ${sn}: ${upd.data?.updateRequest?.message || upd.errors?.[0]?.message || "fail"}`,
        );
      }
      if (n.event?.id) {
        const ev = await gql(
          `mutation E($input: UpdateEventInput!) {
            updateEvent(input: $input) { success message }
          }`,
          { input: { id: n.event.id, coordinates: coords } },
        );
        if (ev.data?.updateEvent?.success) summary.eventsUpdated += 1;
      }
    }

    if (summary.errors.length > 12) {
      summary.errors = summary.errors.slice(0, 12).concat([
        `…and ${summary.errors.length - 12} more`,
      ]);
    }
    return summary;
  }, stores);
}
