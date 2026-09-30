export const SUPPLIERS = [
  { name: "Lahore Textile Studio", city: "Lahore", moq: 20, discount: 0.18, delivery: 1800, days: 7 },
  { name: "Faisalabad Wholesale Co.", city: "Faisalabad", moq: 50, discount: 0.26, delivery: 2400, days: 10 },
  { name: "Karachi Trade Collective", city: "Karachi", moq: 10, discount: 0.12, delivery: 1200, days: 4 },
];

export function compareQuotes(price: number, quantity: number, budget: number, maxDays: number) {
  return SUPPLIERS.map(s => {
    const unitPrice = Math.round(price * (1 - s.discount));
    const total = unitPrice * quantity + s.delivery;
    return { ...s, unitPrice, total, perUnit: total / quantity,
      eligible: quantity >= s.moq && s.days <= maxDays && total <= budget };
  }).sort((a, b) => Number(b.eligible) - Number(a.eligible) || a.total - b.total);
}
