import { TimeLogApp } from "@/components/time/time-log-app";
import { listCategories } from "./actions";

export const dynamic = "force-dynamic";

export default async function TimePage() {
  const categories = await listCategories();
  return <TimeLogApp categories={categories} />;
}