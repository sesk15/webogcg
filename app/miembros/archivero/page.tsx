import { getSessionUser } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import ArchiveroPageClient from "./ArchiveroPageClient";

export default async function Page() {
  const user = await getSessionUser();

  if (!user || (!user.isMaster && !user.isArchiver)) {
    redirect("/miembros/tablon");
  }

  return <ArchiveroPageClient />;
}
