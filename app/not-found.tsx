import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card p-6">
      <h1 className="text-xl font-bold">Not found</h1>
      <p className="mt-2"><Link className="text-blue-800 underline" href="/">Start a new referral</Link></p>
    </div>
  );
}
