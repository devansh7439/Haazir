import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card mx-auto max-w-md p-8 text-center">
      <h1 className="text-lg font-semibold">Page not found</h1>
      <p className="mt-1 text-sm text-zinc-500">That referral or page doesn&apos;t exist.</p>
      <Link className="btn btn-primary mt-5" href="/">Start a new referral</Link>
    </div>
  );
}
