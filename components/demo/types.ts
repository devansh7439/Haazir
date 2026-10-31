import type { DemoService } from "@/lib/modules/demo/demo.service";

export type DemoStatus = Awaited<ReturnType<typeof DemoService.status>>;
export type Notice = { ok: boolean; text: string };
export type PhoneEntry = { phone: string; whatsapp: string };
