export function calculateProgress(values: any): number {
  const step1 = [
    "name",
    "date",
    "start_time",
    "end_time",
    "address",
    "latitude",
    "longitude",
  ];

  const step2 = ["client", "distributor", "retailer", "request_type"];

  let filled = 0;

  step1.forEach((f) => {
    const v = values[f];
    if (v !== undefined && v !== null && v !== "") {
      filled++;
    }
  });

  step2.forEach((f) => {
    const v = values[f];
    if (v !== undefined && v !== null && v !== "") {
      filled++;
    }
  });

  if (Array.isArray(values.skus) && values.skus.length > 0) {
    filled++;
  }

  const totalRequired = step1.length + step2.length + 1;

  return (filled / totalRequired) * 100;
}
