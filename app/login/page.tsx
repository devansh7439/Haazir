import { LoginForm } from "@/components/LoginForm";
import { env } from "@/lib/config";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <LoginForm mode={env.authMode} />;
}
