import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-utils";
import { generateCode } from "@/lib/auth-code-store";

function getExternalApps(): Record<string, string> {
  const raw = process.env.EXTERNAL_APPS || "";
  const apps: Record<string, string> = {};
  for (const pair of raw.split(",").filter(Boolean)) {
    const [name, url] = pair.split(":");
    if (name && url) apps[name.trim()] = url.trim();
  }
  return apps;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const appName = searchParams.get("app");
  const returnPath = searchParams.get("return") || "/";

  const apps = getExternalApps();
  if (!appName || !apps[appName]) {
    return NextResponse.json(
      { error: "Aplicación no configurada" },
      { status: 400 }
    );
  }

  const appUrl = apps[appName];
  const user = await getSessionUser();

  if (!user) {
    const next = `/api/auth/exchange-redirect?app=${appName}&return=${encodeURIComponent(returnPath)}`;
    return NextResponse.redirect(
      new URL(`/sign-in?next=${encodeURIComponent(next)}`, req.url)
    );
  }

  if (appName === "butacas" && !user.isSeller && !user.isMaster) {
    return NextResponse.json(
      { error: "No tienes permisos para acceder a esta aplicación" },
      { status: 403 }
    );
  }

  const code = generateCode(user.supabaseUserId || "");
  const callbackUrl = `${appUrl}/auth/callback?code=${code}&return=${encodeURIComponent(returnPath)}`;
  return NextResponse.redirect(new URL(callbackUrl));
}
