async (page) => {
  const fs = await import("fs");
  const path = await import("path");
  const { execFileSync } = await import("child_process");

  const OUT = "/Users/kylechristiansen/spark-front-client/output";
  const idsPath = path.join(OUT, "torch_binnys_type_ids.json");

  page.setDefaultTimeout(180000);

  const ids = await page.evaluate(async () => {
    const token = localStorage.getItem("@token") || "";
    const tenantId = localStorage.getItem("@tenantId") || "";
    const entries = performance.getEntriesByType("resource") || [];
    const gqlUrl =
      entries.map((e) => e.name).find((n) => n.includes("/graphql/")) ||
      "https://spark-api-new-490085168610.us-central1.run.app/api/v483927/graphql/spark";
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
    const tpl = await gql(
      `mutation BatchTemplate($input: RequestBatchTemplateInput!) {
        requestBatchTemplateDownloadUrl(input: $input) {
          success message fileBase64 fileName
        }
      }`,
      { input: tenantId ? { tenantId } : {} },
    );
    const r = tpl.data && tpl.data.requestBatchTemplateDownloadUrl;
    return {
      ok: !!(r && r.success && r.fileBase64),
      message: (r && r.message) || (tpl.errors && tpl.errors[0] && tpl.errors[0].message) || "",
      fileName: r && r.fileName,
      fileBase64: r && r.fileBase64,
      tenantId,
      gqlUrl,
      loggedIn: Boolean(token),
    };
  });

  if (!ids.ok || !ids.fileBase64) {
    return { step: "template", error: ids.message || "template download failed", loggedIn: ids.loggedIn };
  }

  fs.writeFileSync(path.join(OUT, "torch_binnys_template.xlsx"), Buffer.from(ids.fileBase64, "base64"));
  fs.writeFileSync(
    idsPath,
    JSON.stringify({ tenantId: ids.tenantId, gqlUrl: ids.gqlUrl, fileName: ids.fileName }, null, 2),
  );

  const py = execFileSync(
    "uv",
    ["run", "python", path.join(OUT, "import_torch_binnys.py"), "rebuild-from-template"],
    {
      cwd: "/Users/kylechristiansen/spark-api",
      encoding: "utf8",
      timeout: 60000,
    },
  );

  const ready = path.join(OUT, "torch_binnys_retail_schedule.ready.xlsx");
  const xlsxB64 = fs.readFileSync(ready).toString("base64");

  const dry = await page.evaluate(async (xlsxB64) => {
    const token = localStorage.getItem("@token") || "";
    const tenantId = localStorage.getItem("@tenantId") || "";
    const entries = performance.getEntriesByType("resource") || [];
    const gqlUrl =
      entries.map((e) => e.name).find((n) => n.includes("/graphql/")) ||
      "https://spark-api-new-490085168610.us-central1.run.app/api/v483927/graphql/spark";
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
    const bytes = Uint8Array.from(atob(xlsxB64), (c) => c.charCodeAt(0));
    const stamp = Date.now();
    const filePath = `requests/batch-uploads/tenant-${tenantId}/${stamp}_torch_binnys_retail_schedule.xlsx`;
    const up = await gql(
      `query GetUploadUrl($filePath: String!, $contentType: String!) {
        getUploadUrl(filePath: $filePath, contentType: $contentType) {
          uploadUrl blobName
        }
      }`,
      {
        filePath,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    );
    if (up.errors) return { step: "upload-url", errors: up.errors.map((e) => e.message) };
    const blobName = up.data.getUploadUrl.blobName;
    const put = await fetch(up.data.getUploadUrl.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
      body: bytes,
    });
    if (!put.ok) return { step: "gcs-put", status: put.status, text: await put.text() };
    const run = async (dryRun) => {
      const data = await gql(
        `mutation Import($input: ImportRequestsBatchInput!) {
          importRequestsBatch(input: $input) {
            success message totalRows successCount failedCount skippedCount rolledBack errors
            rows { rowNumber success message requestId requestUuid skipped }
          }
        }`,
        {
          input: {
            tenantId,
            file: blobName,
            sheetName: "Requests",
            dryRun,
            rollbackOnError: true,
          },
        },
      );
      if (data.errors) return { gqlErrors: data.errors.map((e) => e.message) };
      return data.data.importRequestsBatch;
    };
    const dryResult = await run(true);
    return { blobName, dry: dryResult };
  }, xlsxB64);

  fs.writeFileSync(path.join(OUT, "torch_binnys_dryrun.json"), JSON.stringify(dry, null, 2));

  return {
    templatePy: py.trim().split("\n").slice(-8),
    dry: dry && dry.dry
      ? {
          success: dry.dry.success,
          message: dry.dry.message,
          totalRows: dry.dry.totalRows,
          successCount: dry.dry.successCount,
          skippedCount: dry.dry.skippedCount,
          failedCount: dry.dry.failedCount,
          rolledBack: dry.dry.rolledBack,
          errors: dry.dry.errors,
          sampleFails: (dry.dry.rows || [])
            .filter((r) => !r.success && !r.skipped)
            .slice(0, 8),
        }
      : dry,
  };
}
