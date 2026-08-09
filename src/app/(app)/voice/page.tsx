import { VoiceApp } from "@/components/voice/voice-app";
import {
  aiConfigured,
  listCategories,
  listNotes,
} from "@/app/(app)/voice/actions";

export const dynamic = "force-dynamic";

export default async function VoicePage() {
  const [categories, notes, aiReady] = await Promise.all([
    listCategories(),
    listNotes(),
    aiConfigured(),
  ]);
  return (
    <VoiceApp
      initialCategories={categories}
      initialNotes={notes}
      aiReady={aiReady}
    />
  );
}