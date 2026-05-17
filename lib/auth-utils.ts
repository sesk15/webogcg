import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";

export async function getSessionUser() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const dbUser = await prisma.user.findUnique({
      where: { supabaseUserId: user.id },
      select: {
        id: true,
        email: true,
        supabaseUserId: true,
        isMaster: true,
        isArchiver: true,
        isSeller: true,
        isSectionLeader: true
      }
    });

    return dbUser;
  } catch (error) {
    console.error("Error in getSessionUser:", error);
    return null;
  }
}

export async function getUserBySupabaseId(supabaseUserId: string) {
  try {
    return prisma.user.findUnique({
      where: { supabaseUserId },
      select: {
        id: true,
        email: true,
        name: true,
        surname: true,
        supabaseUserId: true,
        isMaster: true,
        isArchiver: true,
        isSeller: true,
        isSectionLeader: true
      }
    });
  } catch (error) {
    console.error("Error in getUserBySupabaseId:", error);
    return null;
  }
}
