import PublicSite from "@/components/PublicSite";
import { readPublished } from "@/lib/db";
export const dynamic = "force-dynamic";
export default function Page() {
  return <PublicSite site={readPublished()} report />;
}
