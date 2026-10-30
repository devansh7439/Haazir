import { DemoPanel } from "@/components/DemoPanel";
import { demoStatus } from "@/lib/demo";
import { pageSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DemoPage() {
  await pageSession({ demo: true });
  return <DemoPanel initial={JSON.parse(JSON.stringify(await demoStatus()))} />;
}
