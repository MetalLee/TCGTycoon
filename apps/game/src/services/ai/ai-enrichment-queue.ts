export type AiEnrichmentTask = () => Promise<void>;

export interface AiEnrichmentQueue {
  enqueue(task: AiEnrichmentTask): void;
}
