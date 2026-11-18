export interface AiResult {
  personality: { title: string; description: string };
  moments: Array<{ title: string; description: string }>;
  roasts: Array<{ member: string; title: string; roast: string }>;
  prediction: string;
  motto: string;
}
