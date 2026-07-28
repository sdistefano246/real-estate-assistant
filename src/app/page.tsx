import { redirect } from "next/navigation";
import { getSessionPayload } from "@/lib/session.server";

export default async function Home() {
  const session = await getSessionPayload();
  redirect(session?.agentId ? "/dashboard" : "/login");
}
