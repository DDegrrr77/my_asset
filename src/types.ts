export type AccountType = 'General' | 'Pension' | 'IRP' | 'ISA';

export interface Holding {
  id: string;
  name: string;
  quantity: number;
  avgPrice: number;
  price: number;
  dividend: number;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  annualLimit?: number; 
}

export interface RecordDetail {
  accountId: string;
  principal: number; // 누적 원금
  valuation: number; // 현재 평가액
  dividend: number;  // 당월 배당
  cashBalance?: number; // 예수금
  holdings: Holding[];
}

export interface MonthlyRecord {
  id: string;
  yearMonth: string; // "YYYY-MM"
  records: RecordDetail[];
  createdAt: number;
  meta?: {
    exchangeRate: string;
    dollarInputs: Record<string, string>;
  };
}

export interface UserSettings {
  retirementGoal: number;
  userName?: string;
  pin?: string;
}

export interface AppData {
  accounts: Account[];
  monthlyRecords: MonthlyRecord[];
  settings: UserSettings;
}
