import { DemoPanel } from "@/components/DemoPanel";
import { demoStatus } from "@/lib/demo";

export const dynamic = "force-dynamic";

export default async function DemoPage() {
  return <DemoPanel initial={JSON.parse(JSON.stringify(await demoStatus()))} />;
}
