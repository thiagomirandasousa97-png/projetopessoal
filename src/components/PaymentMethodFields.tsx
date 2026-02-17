import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { paymentMethodOptions, type PaymentMethod } from "@/lib/payments";

type PaymentMethodFieldsProps = {
  method: PaymentMethod;
  onMethodChange: (value: PaymentMethod) => void;
  expectedDate: string;
  onExpectedDateChange: (value: string) => void;
  showExpectedDateForAccount?: boolean;
};

export default function PaymentMethodFields({
  method,
  onMethodChange,
  expectedDate,
  onExpectedDateChange,
  showExpectedDateForAccount = true,
}: PaymentMethodFieldsProps) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Forma de pagamento</Label>
        <Select value={method} onValueChange={(value) => onMethodChange(value as PaymentMethod)}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {paymentMethodOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showExpectedDateForAccount && method === "account" ? (
        <div>
          <Label>Data prevista para recebimento</Label>
          <Input type="date" value={expectedDate} onChange={(event) => onExpectedDateChange(event.target.value)} />
        </div>
      ) : null}
    </div>
  );
}
