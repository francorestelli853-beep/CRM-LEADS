import { headers } from "next/headers";
import { chatGPTSignInPath, getChatGPTUser } from "./chatgpt-auth";
import CrmApp from "./crm-app";

export const dynamic = "force-dynamic";

export default async function Home() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "";
  const user = await getChatGPTUser();
  const isLocal = host.includes("localhost") || host.includes("127.0.0.1");

  if (!user && !isLocal) {
    return (
      <main className="login-shell">
        <section className="login-card">
          <div className="brand-mark" aria-hidden="true"><span className="logo-node light"/><span className="logo-bridge"/><span className="logo-node clay"/></div>
          <p className="eyebrow">Sincro AI · CRM Comercial</p>
          <h1>Tu operación comercial, sincronizada.</h1>
          <p>Ingresá para acceder a la base compartida, el pipeline y las métricas del equipo.</p>
          <a className="primary-button login-button" href={chatGPTSignInPath("/")}>Ingresar al CRM</a>
          <small>Acceso privado para el equipo de Sincro AI.</small>
        </section>
      </main>
    );
  }

  return <CrmApp currentUser={user?.displayName ?? "Franco · Vista local"} />;
}
