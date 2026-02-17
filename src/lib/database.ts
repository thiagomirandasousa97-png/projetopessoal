export function toCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function createId() {
  return crypto.randomUUID();
}
