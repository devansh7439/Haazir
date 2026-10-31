import { LoginForm } from "@/components/auth/LoginForm";
import { env } from "@/lib/core/config";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <LoginForm mode={env.authMode} />;
}
