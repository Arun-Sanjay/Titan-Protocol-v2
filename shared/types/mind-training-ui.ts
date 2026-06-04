export type ExerciseOption = {
  id: string;
  text: string;
  description?: string;
};

export type Exercise = {
  id: string;
  type: string;
  category: string;
  scenario: string;
  question: string;
  options: ExerciseOption[];
  correct: string;
  explanation: string;
  insight?: string;
};
