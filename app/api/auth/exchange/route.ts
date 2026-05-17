import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-utils";
import { getUserBySupabaseId } from "@/lib/auth-utils";
import { generateCode, consumeCode } from "@/lib/auth-code-store";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const appName = searchParams.get("app");

  if (appName === "butacas" && !user.isSeller && !user.isMaster) {
    return NextResponse.json(
      { error: "No tienes permisos para acceder a esta aplicación" },
      { status: 403 }
    );
  }

  const code = generateCode(user.supabaseUserId || "");
  return NextResponse.json({ code });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Código requerido" }, { status: 400 });
  }

  const result = consumeCode(code);
  if (!result) {
    return NextResponse.json({ error: "Código inválido o expirado" }, { status: 404 });
  }

  const dbUser = await getUserBySupabaseId(result.userId);
  if (!dbUser) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    supabaseUserId: result.userId,
    email: dbUser.email,
    name: dbUser.name,
    surname: dbUser.surname,
    isMaster: dbUser.isMaster,
    isArchiver: dbUser.isArchiver,
    isSeller: dbUser.isSeller,
    isSectionLeader: dbUser.isSectionLeader,
  });
}
