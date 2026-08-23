import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppData, Account, MonthlyRecord, UserSettings, Holding } from '../types';
import { v4 as uuidv4 } from 'uuid';

const GITHUB_TOKEN = import.meta.env.VITE_GITHUB_TOKEN || "";
const GIST_ID = import.meta.env.VITE_GIST_ID || "";
const GIST_FILENAME = "wealthtrack-data.json";

const STORAGE_KEY = 'wealthtrack_data_v1';

const defaultSettings: UserSettings = {
  retirementGoal: 1000000000, // 10억
};

const DEFAULT_GENERAL_ID = 'acc-general-1';
const DEFAULT_PENSION_ID = 'acc-pension-1';
const DEFAULT_IRP_ID = 'acc-irp-1';
const DEFAULT_ISA_ID = 'acc-isa-1';

const defaultAccounts: Account[] = [
  { id: DEFAULT_GENERAL_ID, name: '주식 계좌', type: 'General' },
  { id: DEFAULT_PENSION_ID, name: '연금저축펀드', type: 'Pension', annualLimit: 6000000 },
  { id: DEFAULT_IRP_ID, name: '개인형 IRP', type: 'IRP', annualLimit: 3000000 },
  { id: DEFAULT_ISA_ID, name: '중개형 ISA', type: 'ISA', annualLimit: 20000000 },
];

const defaultHoldingsStock: Holding[] = [
  { id: 'h-1', name: '맥쿼리인프라', quantity: 150, avgPrice: 12000, price: 12500, dividend: 600 },
  { id: 'h-2', name: '삼성전자우', quantity: 100, avgPrice: 60000, price: 62000, dividend: 361 },
];

const defaultHoldingsPension: Holding[] = [
  { id: 'h-3', name: 'TIGER 미국S&P500', quantity: 300, avgPrice: 15000, price: 16500, dividend: 40 },
];

const defaultHoldingsIRP: Holding[] = [
  { id: 'h-4', name: 'KODEX 24-12 은행채(AA-이상)액티브', quantity: 50, avgPrice: 100000, price: 101000, dividend: 0 },
];

const defaultHoldingsISA: Holding[] = [
  { id: 'h-5', name: 'TIGER 미국배당다우존스', quantity: 400, avgPrice: 10000, price: 10800, dividend: 35 },
];

const defaultMonthlyRecords: MonthlyRecord[] = [
  {
    id: 'sample-record-1',
    yearMonth: '2026-05',
    createdAt: Date.now(),
    records: [
      {
        accountId: DEFAULT_GENERAL_ID,
        principal: 8000000,
        valuation: 8075000,
        dividend: 126100,
        cashBalance: 200000,
        holdings: defaultHoldingsStock
      },
      {
        accountId: DEFAULT_PENSION_ID,
        principal: 4500000,
        valuation: 4950000,
        dividend: 12000,
        cashBalance: 0,
        holdings: defaultHoldingsPension
      },
      {
        accountId: DEFAULT_IRP_ID,
        principal: 5000000,
        valuation: 5050000,
        dividend: 0,
        cashBalance: 0,
        holdings: defaultHoldingsIRP
      },
      {
        accountId: DEFAULT_ISA_ID,
        principal: 4000000,
        valuation: 4320000,
        dividend: 14000,
        cashBalance: 0,
        holdings: defaultHoldingsISA
      }
    ],
    meta: {
      exchangeRate: '1350',
      dollarInputs: {}
    }
  }
];

const defaultData: AppData = {
  accounts: defaultAccounts,
  monthlyRecords: defaultMonthlyRecords,
  settings: defaultSettings,
};

interface DataContextType {
  data: AppData;
  saveMonthlyRecord: (record: MonthlyRecord) => void;
  deleteMonthlyRecord: (id: string) => void;
  updateSettings: (settings: UserSettings) => void;
  addAccount: (account: Omit<Account, 'id'>) => void;
  deleteAccount: (id: string) => void;
  updateAccount: (account: Account) => void;
  moveAccount: (id: string, direction: -1 | 1) => void;
  importData: (jsonData: string) => boolean;
  exportData: () => string;
  setAppData: (data: AppData) => void;
}

const DataContext = createContext<DataContextType | null>(null);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<AppData>(defaultData);
  const [loaded, setLoaded] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Helper migration function
  const runMigration = (parsedData: AppData) => {
    try {
      if (parsedData.monthlyRecords) {
        parsedData.monthlyRecords.forEach(month => {
          month.records.forEach(record => {
            if (record.cashBalance === undefined) {
              const cashHolding = record.holdings?.find?.(h => h?.name?.trim?.() === '현금');
              if (cashHolding) {
                record.cashBalance = (cashHolding.quantity || 0) * (cashHolding.price || 0);
                record.holdings = record.holdings.filter(h => h?.name?.trim?.() !== '현금');
              } else {
                record.cashBalance = 0;
              }
            }
            if (!record.holdings) record.holdings = [];
          });
        });
      }
    } catch (migErr) {
      console.error("Migration error", migErr);
    }
  };

  // GitHub Gist loading helper
  const loadFromGist = async (): Promise<AppData | null> => {
    if (!GITHUB_TOKEN || !GIST_ID) {
      console.log('GitHub Gist credentials are not set. Falling back to LocalStorage.');
      return null;
    }

    try {
      const response = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        throw new Error(`Gist load failed with status: ${response.status}`);
      }

      const gistData = await response.json();
      const file = gistData.files && gistData.files[GIST_FILENAME];
      if (file && file.content) {
        const parsed = JSON.parse(file.content) as AppData;
        if (parsed && parsed.accounts && parsed.monthlyRecords) {
          console.log('Successfully synchronized from GitHub Gist!');
          return parsed;
        }
      }
      throw new Error('Gist file not found or empty.');
    } catch (error) {
      console.error('Failed to load from Gist, falling back to LocalStorage:', error);
      return null;
    }
  };

  // GitHub Gist saving helper
  const saveToGist = async (newData: AppData) => {
    if (!GITHUB_TOKEN || !GIST_ID) {
      return;
    }

    setSyncing(true);
    try {
      const response = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          description: 'WealthTrack Application Data Sync',
          files: {
            [GIST_FILENAME]: {
              content: JSON.stringify(newData, null, 2),
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Gist save failed with status: ${response.status}`);
      }
      console.log('Successfully saved to GitHub Gist cloud storage!');
    } catch (error) {
      console.error('Failed to save to Gist, data remains cached in LocalStorage:', error);
    } finally {
      setSyncing(false);
    }
  };

  // Initialize and load data on app startup
  useEffect(() => {
    const initializeData = async () => {
      setSyncing(true);
      let loadedData: AppData | null = null;

      if (GITHUB_TOKEN && GIST_ID) {
        loadedData = await loadFromGist();
      }

      if (loadedData) {
        // Ensure settings exist
        if (!loadedData.settings) {
          loadedData.settings = defaultSettings;
        }
        runMigration(loadedData);
        setData(loadedData);
        // Sync local storage as fallback
        localStorage.setItem(STORAGE_KEY, JSON.stringify(loadedData));
      } else {
        // Fallback to local storage
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            const parsedData = JSON.parse(stored) as AppData;
            if (!parsedData.settings) {
              parsedData.settings = defaultSettings;
            }
            runMigration(parsedData);
            setData(parsedData);
          } else {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultData));
            setData(defaultData);
          }
        } catch (e) {
          console.error('Failed to load local storage data fallback:', e);
        }
      }
      setLoaded(true);
      setSyncing(false);
    };

    initializeData();
  }, []);

  // Debounced auto-sync to GitHub Gist when data changes
  useEffect(() => {
    if (!loaded) return;
    if (!GITHUB_TOKEN || !GIST_ID) return;

    const timer = setTimeout(() => {
      saveToGist(data);
    }, 1500);

    return () => clearTimeout(timer);
  }, [data, loaded]);

  const persist = (newData: AppData) => {
    setData(newData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
  };

  const saveMonthlyRecord = (record: MonthlyRecord) => {
    const newData = { ...data, monthlyRecords: data.monthlyRecords.map(r => ({...r})) };
    
    // Find the old record to calculate principal deltas
    let oldRecord = newData.monthlyRecords.find(r => r.yearMonth === record.yearMonth);
    if (!oldRecord) {
      const sorted = [...newData.monthlyRecords].sort((a,b) => a.yearMonth.localeCompare(b.yearMonth));
      const pastRecords = sorted.filter(r => r.yearMonth < record.yearMonth);
      oldRecord = pastRecords.length > 0 ? pastRecords[pastRecords.length - 1] : undefined;
    }

    const deltas: Record<string, number> = {};
    record.records.forEach(newAccRec => {
      const oldAccRec = oldRecord ? oldRecord.records.find(r => r.accountId === newAccRec.accountId) : undefined;
      const oldPrincipal = oldAccRec ? oldAccRec.principal : 0;
      deltas[newAccRec.accountId] = newAccRec.principal - oldPrincipal;
    });

    const existingIndex = newData.monthlyRecords.findIndex(r => r.yearMonth === record.yearMonth);
    if (existingIndex >= 0) {
      newData.monthlyRecords[existingIndex] = record; // override
    } else {
      newData.monthlyRecords.push(record);
      newData.monthlyRecords.sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
    }

    // Apply deltas to subsequent records
    newData.monthlyRecords.forEach(r => {
      if (r.yearMonth > record.yearMonth) {
        let changed = false;
        const newRecords = r.records.map(accRec => {
          const delta = deltas[accRec.accountId] || 0;
          if (delta !== 0) {
            changed = true;
            return { ...accRec, principal: accRec.principal + delta };
          }
          return accRec;
        });
        if (changed) {
          r.records = newRecords;
        }
      }
    });

    persist(newData);
  };

  const deleteMonthlyRecord = (id: string) => {
    const newData = { ...data, monthlyRecords: data.monthlyRecords.filter(r => r.id !== id) };
    persist(newData);
  };

  const updateSettings = (settings: UserSettings) => {
    persist({ ...data, settings });
  };

  const addAccount = (acc: Omit<Account, 'id'>) => {
    persist({ ...data, accounts: [...data.accounts, { ...acc, id: uuidv4() }] });
  };

  const deleteAccount = (id: string) => {
    // Only delete if no records depend on it? Actually just delete.
    persist({ ...data, accounts: data.accounts.filter(a => a.id !== id) });
  };

  const updateAccount = (account: Account) => {
    persist({ ...data, accounts: data.accounts.map(a => a.id === account.id ? account : a) });
  };

  const moveAccount = (id: string, direction: -1 | 1) => {
    const idx = data.accounts.findIndex(a => a.id === id);
    if (idx < 0) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= data.accounts.length) return;
    
    const newAccounts = [...data.accounts];
    const temp = newAccounts[idx];
    newAccounts[idx] = newAccounts[newIdx];
    newAccounts[newIdx] = temp;
    
    persist({ ...data, accounts: newAccounts });
  };

  const importData = (jsonData: string) => {
    try {
      const parsed = JSON.parse(jsonData);
      if (parsed && parsed.accounts && parsed.monthlyRecords) {
        // preserve settings if they are missing from imported data or just keep original settings?
        // Let's just ensure settings is there.
        if (!parsed.settings) {
          parsed.settings = data.settings || defaultSettings;
        }
        persist(parsed);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const exportData = () => {
    return JSON.stringify(data, null, 2);
  };

  const setAppData = (newData: AppData) => {
    persist(newData);
  };

  if (!loaded) return null; // Or skeleton

  return (
    <DataContext.Provider value={{ data, saveMonthlyRecord, deleteMonthlyRecord, updateSettings, addAccount, deleteAccount, updateAccount, moveAccount, importData, exportData, setAppData }}>
      {children}
      {syncing && (
        <div className="fixed inset-0 bg-gray-950/20 backdrop-blur-sm flex flex-col items-center justify-center z-[9999]">
          <div className="bg-white px-8 py-6 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.08)] border border-gray-100 flex flex-col items-center gap-4 text-center max-w-xs animate-pulse">
            <div className="w-10 h-10 border-[3.5px] border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
            <div>
              <p className="text-[14px] font-black text-gray-800">클라우드 동기화 중</p>
              <p className="text-[11px] font-semibold text-gray-400 mt-1">Gist API를 통해 자산 정보를 실시간 업로드/다운로드하고 있습니다.</p>
            </div>
          </div>
        </div>
      )}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
};
