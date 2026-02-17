export const paymentMethodOptions = [
  { value: "credit_card", label: "Cartao de credito" },
  { value: "debit_card", label: "Cartao de debito" },
  { value: "pix", label: "Pix" },
  { value: "cash", label: "Dinheiro" },
  { value: "account", label: "Conta" },
] as const;

export type PaymentMethod = (typeof paymentMethodOptions)[number]["value"];

export function paymentMethodLabel(value: string | null | undefined) {
  return paymentMethodOptions.find((item) => item.value === value)?.label ?? "Nao informado";
}
