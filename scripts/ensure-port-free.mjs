// Runs before `bun run dev` and `bun run serve`.
// A second Next server on the same port, or a `next build` that rewrites `.next` under a running `next start`, leaves the page
// without CSS or scripts (the assets answer 404 text/plain and the browser refuses them). Stop here instead, with the fix.
import net from "node:net";

const port = Number(process.env.PORT ?? 3000);

const busy = await new Promise((resolve) => {
  const probe = net.createServer();
  probe.once("error", (err) => resolve(err.code === "EADDRINUSE"));
  probe.once("listening", () => probe.close(() => resolve(false)));
  probe.listen(port);
});

if (busy) {
  const stop = process.platform === "win32" ? `Get-NetTCPConnection -LocalPort ${port} -State Listen | % { Stop-Process -Id $_.OwningProcess -Force }` : `lsof -ti :${port} | xargs kill`;
  console.error(`\nPort ${port} is already in use. Another dev or production server is running there.`);
  console.error(`Stop it first (${stop}), then run this again.\n`);
  process.exit(1);
}
