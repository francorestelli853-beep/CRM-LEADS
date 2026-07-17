import { headers } from "next/headers";
import CrmApp from "./crm-app";

export const dynamic = "force-dynamic";

export default async function Home() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "";
  const isLocal = host.includes("localhost") || host.includes("127.0.0.1");
  const defaultActor = process.env.CRM_DEFAULT_ACTOR ?? "Equipo Sincro";

  return <CrmApp currentUser={isLocal ? "Franco - Vista local" : defaultActor} />;
}
