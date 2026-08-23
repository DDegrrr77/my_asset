import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppData, Account, MonthlyRecord, UserSettings, Holding, RecordDetail } from '../types';
import { v4 as uuidv4 } from 'uuid';

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
  storageSource: 'Gist' | 'LocalStorage';
  githubToken: string;
  gistId: string;
  syncing: boolean;
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
  updateGistConfig: (token: string, id: string) => void;
  testConnection: (token?: string, id?: string) => Promise<{ success: boolean; message: string }>;
  refreshFromGist: () => Promise<{ success: boolean; message: string }>;
}

const DataContext = createContext<DataContextType | null>(null);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<AppData>(defaultData);
  const [loaded, setLoaded] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [storageSource, setStorageSource] = useState<'Gist' | 'LocalStorage'>('LocalStorage');

  // Load credential tokens reactively from local storage
  const [githubToken, setGithubToken] = useState<string>(() => localStorage.getItem('WT_GITHUB_TOKEN') || '');
  const [gistId, setGistId] = useState<string>(() => localStorage.getItem('WT_GIST_ID') || '');

  // Helper migration function
  const runMigration = (parsedData: AppData) => {
    try {
      const anyData = parsedData as any;
      if (anyData['메타'] && !parsedData.meta) {
        parsedData.meta = anyData['메타'];
      }
      if (parsedData.meta) {
        const anyMeta = parsedData.meta as any;
        if (anyMeta['환율'] && !parsedData.meta.exchangeRate) {
          parsedData.meta.exchangeRate = String(anyMeta['환율']);
        }
        if (anyMeta['달러입력'] && !parsedData.meta.dollarInputs) {
          parsedData.meta.dollarInputs = anyMeta['달러입력'];
        }
        const rateNum = parseFloat(String(parsedData.meta.exchangeRate || anyMeta['환율'] || '').replace(/[^0-9.]/g, ''));
        if (!isNaN(rateNum) && rateNum > 0 && parsedData.settings) {
          parsedData.settings.usdExchangeRate = rateNum;
        }
      }

      if (parsedData.monthlyRecords) {
        parsedData.monthlyRecords.forEach(month => {
          const anyMonth = month as any;
          if (anyMonth['메타'] && !month.meta) {
            month.meta = anyMonth['메타'];
          }
          if (month.meta) {
            const anyMeta = month.meta as any;
            if (anyMeta['환율'] && !month.meta.exchangeRate) {
              month.meta.exchangeRate = String(anyMeta['환율']);
            }
            if (anyMeta['달러입력'] && !month.meta.dollarInputs) {
              month.meta.dollarInputs = anyMeta['달러입력'];
            }
          }

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

  // GitHub Gist loading helper (with Cache-Busting)
  const loadFromGist = async (token: string, id: string): Promise<AppData | null> => {
    if (!token || !id) {
      console.log('GitHub Gist credentials are not set. Falling back to LocalStorage.');
      return null;
    }

    try {
      const response = await fetch(`https://api.github.com/gists/${id}?_t=${Date.now()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'If-None-Match': '', // ETag 캐시 무효화
        },
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error(`Gist load failed with status: ${response.status}`);
      }

      const gistData = await response.json();
      // Look for the specific filename first, otherwise find the first key ending in .json
      let file = gistData.files && gistData.files[GIST_FILENAME];
      if (!file && gistData.files) {
        const firstJsonFileKey = Object.keys(gistData.files).find(k => k.endsWith('.json'));
        if (firstJsonFileKey) {
          file = gistData.files[firstJsonFileKey];
        }
      }

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

  // Manual Refresh / Sync helper from Gist or LocalStorage
  const refreshFromGist = async (): Promise<{ success: boolean; message: string }> => {
    if (!githubToken || !gistId) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as AppData;
          runMigration(parsed);
          setData(parsed);
        }
        return { success: true, message: '로컬 데이터가 새로고침되었습니다.' };
      } catch (e: any) {
        return { success: false, message: '로컬 데이터 불러오기 실패' };
      }
    }

    setSyncing(true);
    try {
      const loadedData = await loadFromGist(githubToken, gistId);
      if (loadedData) {
        if (!loadedData.settings) {
          loadedData.settings = defaultSettings;
        }
        runMigration(loadedData);
        setData(loadedData);
        setStorageSource('Gist');
        localStorage.setItem(STORAGE_KEY, JSON.stringify(loadedData));
        return { success: true, message: '최신 GitHub Gist 데이터와 성공적으로 동기화되었습니다.' };
      } else {
        return { success: false, message: 'Gist 데이터 로드에 실패했습니다. 자격 증명 또는 네트워크 상태를 확인해 주세요.' };
      }
    } catch (err: any) {
      return { success: false, message: `동기화 중 오류 발생: ${err.message || err}` };
    } finally {
      setSyncing(false);
    }
  };

  // GitHub Gist saving helper
  const saveToGist = async (newData: AppData) => {
    if (!githubToken || !gistId) {
      return;
    }

    setSyncing(true);
    try {
      const response = await fetch(`https://api.github.com/gists/${gistId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
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
      setStorageSource('Gist');
      console.log('Successfully saved to GitHub Gist cloud storage!');
    } catch (error) {
      setStorageSource('LocalStorage');
      console.error('Failed to save to Gist, data remains cached in LocalStorage:', error);
    } finally {
      setSyncing(false);
    }
  };

  // Connection testing helper
  const testConnection = async (tokenInput?: string, idInput?: string): Promise<{ success: boolean; message: string }> => {
    const activeToken = tokenInput !== undefined ? tokenInput : githubToken;
    const activeId = idInput !== undefined ? idInput : gistId;

    if (!activeToken || !activeId) {
      return { success: false, message: 'GitHub Token과 Gist ID를 모두 입력해 주세요.' };
    }

    try {
      const response = await fetch(`https://api.github.com/gists/${activeId}?_t=${Date.now()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${activeToken}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'If-None-Match': '',
        },
        cache: 'no-store'
      });

      if (response.status === 401) {
        return { success: false, message: '인증에 실패했습니다. 올바른 GitHub Personal Access Token인지 확인해 주세요. (HTTP 401)' };
      }
      if (response.status === 404) {
        return { success: false, message: 'Gist를 찾을 수 없습니다. 올바른 Gist ID인지 확인해 주세요. (HTTP 404)' };
      }
      if (!response.ok) {
        return { success: false, message: `연결 테스트 실패 (HTTP ${response.status})` };
      }

      const gistData = await response.json();
      let foundFile = gistData.files && (gistData.files[GIST_FILENAME] || Object.values(gistData.files).find((f: any) => f.filename.endsWith('.json')));
      
      if (!foundFile) {
        return { success: true, message: 'Gist 연결에 성공했으나 JSON 자산 데이터가 없습니다. 설정을 저장하면 새 데이터 동기화 파일이 생성됩니다.' };
      }

      return { success: true, message: '연결 테스트 성공! 유효한 Gist 데이터 소스를 찾았습니다.' };
    } catch (err: any) {
      return { success: false, message: `API 요청 중 오류가 발생했습니다: ${err.message || err}` };
    }
  };

  // Config updater helper
  const updateGistConfig = (token: string, id: string) => {
    const trimmedToken = token.trim();
    const trimmedId = id.trim();

    if (trimmedToken && trimmedId) {
      localStorage.setItem('WT_GITHUB_TOKEN', trimmedToken);
      localStorage.setItem('WT_GIST_ID', trimmedId);
      setGithubToken(trimmedToken);
      setGistId(trimmedId);

      setSyncing(true);
      loadFromGist(trimmedToken, trimmedId).then(loadedData => {
        if (loadedData) {
          if (!loadedData.settings) {
            loadedData.settings = defaultSettings;
          }
          runMigration(loadedData);
          setData(loadedData);
          setStorageSource('Gist');
          localStorage.setItem(STORAGE_KEY, JSON.stringify(loadedData));
        } else {
          // If load failed but settings are valid, initialize the Gist with existing data!
          saveToGist(data);
          setStorageSource('Gist');
        }
      }).finally(() => {
        setSyncing(false);
      });
    } else {
      localStorage.removeItem('WT_GITHUB_TOKEN');
      localStorage.removeItem('WT_GIST_ID');
      setGithubToken('');
      setGistId('');
      setStorageSource('LocalStorage');
    }
  };

  // Initialize and load data on app startup (instant local load)
  useEffect(() => {
    const initializeData = () => {
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
        console.error('Failed to load local storage data:', e);
        setData(defaultData);
      }

      if (githubToken && gistId) {
        setStorageSource('Gist');
      } else {
        setStorageSource('LocalStorage');
      }

      setLoaded(true);
    };

    initializeData();
  }, [githubToken, gistId]);

  // Debounced auto-sync to GitHub Gist when data changes
  useEffect(() => {
    if (!loaded) return;
    if (!githubToken || !gistId) return;

    const timer = setTimeout(() => {
      saveToGist(data);
    }, 1500);

    return () => clearTimeout(timer);
  }, [data, loaded, githubToken, gistId]);

  const persist = (newData: AppData) => {
    setData(newData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
  };

  const saveMonthlyRecord = (record: MonthlyRecord) => {
    const newData = { 
      ...data, 
      monthlyRecords: data.monthlyRecords.map(r => ({...r})),
      accounts: data.accounts.map(a => ({...a, holdings: (a.holdings || []).map((h: any) => ({...h}))})),
      settings: { ...data.settings }
    };
    
    // Update global USD exchange rate if available in record meta
    if (record.meta?.exchangeRate) {
      const numRate = parseFloat(record.meta.exchangeRate);
      if (!isNaN(numRate) && numRate > 0) {
        newData.settings.usdExchangeRate = numRate;
      }
    }

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

    // Update main accounts holdings and valuations with the new prices if editing current or latest month
    const latestMonth = newData.monthlyRecords.length > 0 ? newData.monthlyRecords[newData.monthlyRecords.length - 1].yearMonth : '';
    if (record.yearMonth >= latestMonth) {
      const recMap = new Map<string, RecordDetail>();
      record.records.forEach(r => recMap.set(r.accountId, r));
      const currentRate = parseFloat(record.meta?.exchangeRate || '') || newData.settings.usdExchangeRate || 1400;

      newData.accounts = newData.accounts.map(acc => {
        const accRec = recMap.get(acc.id);
        if (!accRec) return acc;

        const updatedHoldings = (acc.holdings || []).map((h: any) => {
          const matchedH = (accRec.holdings || []).find((rh: any) => 
            rh.name.trim() === (h.name || '').trim() || rh.id === h.id
          );
          if (matchedH && matchedH.price > 0) {
            const dollarVal = record.meta?.dollarInputs?.[matchedH.name.trim()];
            const priceUSD = dollarVal ? parseFloat(dollarVal) : (h.currentPriceUSD || (matchedH.price / currentRate));
            const qty = matchedH.quantity !== undefined ? matchedH.quantity : (h.quantity || 0);
            const totalVal = Math.round(qty * matchedH.price);

            return {
              ...h,
              price: matchedH.price,
              currentPrice: matchedH.price,
              currentPriceUSD: priceUSD && !isNaN(priceUSD) ? priceUSD : undefined,
              quantity: qty,
              avgPrice: matchedH.avgPrice !== undefined ? matchedH.avgPrice : h.avgPrice,
              totalValue: totalVal,
              valuation: totalVal
            };
          }
          return h;
        });

        const stockTotal = updatedHoldings.reduce((sum: number, h: any) => sum + (h.totalValue || h.valuation || ((h.price || 0) * (h.quantity || 0))), 0);
        const cash = accRec.cashBalance !== undefined ? accRec.cashBalance : (acc.cash || 0);

        return {
          ...acc,
          cash,
          totalValuation: stockTotal + cash,
          balance: stockTotal + cash,
          holdings: updatedHoldings.length > 0 ? updatedHoldings : acc.holdings
        };
      });
    }

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
    <DataContext.Provider value={{ data, storageSource, githubToken, gistId, syncing, saveMonthlyRecord, deleteMonthlyRecord, updateSettings, addAccount, deleteAccount, updateAccount, moveAccount, importData, exportData, setAppData, updateGistConfig, testConnection, refreshFromGist }}>
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
