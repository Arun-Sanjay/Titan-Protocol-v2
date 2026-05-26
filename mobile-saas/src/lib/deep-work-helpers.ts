/**
 * Pure deep work types. Cloud state comes from useDeepWork hook.
 */

export type DeepWorkCategory =
  | "Main Job / College"
  | "Side Hustle"
  | "Freelance"
  | "Investments"
  | "Other";

export type DeepWorkTask = {
  id: number;
  taskName: string;
  category: DeepWorkCategory;
  createdAt: number;
};
