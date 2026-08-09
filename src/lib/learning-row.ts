import type { learningLogSource, learningLogs } from "@/db/schema";

export type LearningLogSource = typeof learningLogSource.enumValues[number];

export type LearningLogRow = {
  id: string;
  learnDate: string;
  topic: string;
  content: string | null;
  explainBack: string | null;
  source: LearningLogSource;
  updatedAt: Date;
};

type RowInput = typeof learningLogs.$inferSelect;

export function toLearningLogRow(row: RowInput): LearningLogRow {
  return {
    id: row.id,
    learnDate: row.learnDate,
    topic: row.topic,
    content: row.content,
    explainBack: row.explainBack,
    source: row.source,
    updatedAt: row.updatedAt,
  };
}