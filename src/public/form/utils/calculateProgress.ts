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
    "tenant",
  ];

  let filled = 0;

  // Campos simples
  fields.forEach((f) => {
    const v = values[f];
    const isFilled = v !== undefined && v !== null && v !== "";
    if (isFilled) filled++;
  });

  // Validar SKUs
  if (Array.isArray(values.skus) && values.skus.length > 0) {
    filled++;
  }

  // Total de campos considerados
  const total = fields.length + 1; // +1 = SKUs

  return (filled / total) * 100;
}
