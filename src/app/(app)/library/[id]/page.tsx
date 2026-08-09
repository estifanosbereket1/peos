import { notFound } from "next/navigation";

import { ReaderApp } from "@/components/library/reader";
import { getBook } from "@/app/(app)/library/actions";

export const dynamic = "force-dynamic";

export default async function BookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const book = await getBook(id);
  if (!book) notFound();
  return <ReaderApp book={book} />;
}
