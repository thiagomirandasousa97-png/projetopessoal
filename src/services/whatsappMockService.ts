export type WhatsAppPayload = {
  to: string;
  body: string;
  metadata?: Record<string, string>;
};

export type WhatsAppMockResult = {
  ok: boolean;
  provider: "mock-whatsapp";
  externalId: string;
};

export async function sendWhatsAppMock(payload: WhatsAppPayload): Promise<WhatsAppMockResult> {
  await new Promise((resolve) => setTimeout(resolve, 120));

  console.info("[WhatsApp Mock] mensagem enviada", {
    to: payload.to,
    body: payload.body,
    metadata: payload.metadata ?? {},
  });

  return {
    ok: true,
    provider: "mock-whatsapp",
    externalId: `mock-${Date.now()}`,
  };
}
