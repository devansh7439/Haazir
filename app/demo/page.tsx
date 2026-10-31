import { DemoPanel } from "@/components/DemoPanel";
import { demoStatus } from "@/lib/modules/demo/demo.service";
import { pageSession } from "@/lib/modules/auth/session.service";

export const dynamic = "force-dynamic";

export default async function DemoPage() {
  await pageSession({ demo: true });
  return <DemoPanel initial={JSON.parse(JSON.stringify(await demoStatus()))} />;
}
