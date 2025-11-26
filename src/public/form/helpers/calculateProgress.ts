export function calculateProgress(values: any): number {
  const fields = [
    "name",
    "date",
    "start_time",
    "end_time",
    "address",
    "latitude",
    "longitude",
    "client",
    "distributor",
    "retailer",
    "request_type",
    "status",
    "tenant",
  ];

  const filled = fields.filter((f) => {
    const v = values[f];
    return v !== undefined && v !== null && v !== "";
  }).length;

  return (filled / fields.length) * 100;
}
