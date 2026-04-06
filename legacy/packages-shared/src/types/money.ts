export type MoneyTx = {
  id: string;
  dateISO: string;
  type: "expense" | "income" | "borrowed" | "repayment";
  amount: number;
  category: string | null;
  bucket: "need" | "want" | null;
  note: string | null;
  loanId: string | null;
};

export type MoneyLoan = {
  id: string;
  lender: string | null;
  amount: number;
  dateISO: string;
  dueISO: string | null;
  status: "unpaid" | "paid";
};

export type Budget = {
  id?: number;
  category: string;
  monthlyLimit: number;
  createdAt: number;
};
