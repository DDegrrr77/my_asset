import React, { useState, useEffect, useCallback } from 'react';
import { useData } from '../store/DataContext';
import { v4 as uuidv4 } from 'uuid';
import { RecordDetail, Holding } from '../types';
import { format } from 'date-fns';
import { formatCurrency } from '../lib/utils';
import { RefreshCw, CheckCircle2, TrendingUp } from 'lucide-react';

type FormRecord = RecordDetail & { 
  monthlyDeposit: number | string; 
  prevPrincipal: number; 
  cashBalance: number | string;
};

export default function InputView() {
  const { data, saveMonthlyRecord, updateSettings, refreshFromGist, syncing } = useData();
  const [yearMonth, setYearMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [isBulkPriceModalOpen, setIsBulkPriceModalOpen] = useState(false);
  const [isFetchingLatestPrices, setIsFetchingLatestPrices] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const getLatestStockMap = useCallback(() => {
    const anyData = data as any;
    const rootMeta = anyData.meta || anyData['메타'] || anyData.settings?.meta || anyData.settings?.['메타'];

    // Scan sorted records to find latest metadata
    const sortedRecords = [...data.monthlyRecords].sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
    const latestRec = sortedRecords.length > 0 ? sortedRecords[sortedRecords.length - 1] : null;
    const latestRecAny = latestRec as any;
    const latestRecMeta = latestRecAny?.meta || latestRecAny?.['메타'];

    // 1. Determine latest rate priority: rootMeta > latestRecMeta > settings
    const rawRate = rootMeta?.exchangeRate || rootMeta?.['환율'] ||
                    latestRecMeta?.exchangeRate || latestRecMeta?.['환율'] ||
                    data.settings?.usdExchangeRate ||
                    anyData.settings?.['환율'];

    const latestRate = (rawRate ? parseFloat(String(rawRate).replace(/[^0-9.]/g, '')) : null) || 1400;

    // 2. Aggregate all dollar inputs from meta / 메타 across history, with latest overriding
    const combinedDollarInputs: Record<string, string> = {};

    sortedRecords.forEach(r => {
      const rAny = r as any;
      const m = rAny.meta || rAny['메타'];
      if (m) {
        const dInputs = m.dollarInputs || m['dollarInputs'] || m.달러입력 || m['달러입력'] || m.usdInputs;
        if (dInputs && typeof dInputs === 'object') {
          Object.entries(dInputs).forEach(([k, v]) => {
            if (v !== undefined && v !== null && String(v).trim() !== '') {
              combinedDollarInputs[k.trim()] = String(v);
            }
          });
        }
      }
    });

    if (rootMeta) {
      const dInputs = rootMeta.dollarInputs || rootMeta['dollarInputs'] || rootMeta.달러입력 || rootMeta['달러입력'] || rootMeta.usdInputs;
      if (dInputs && typeof dInputs === 'object') {
        Object.entries(dInputs).forEach(([k, v]) => {
          if (v !== undefined && v !== null && String(v).trim() !== '') {
            combinedDollarInputs[k.trim()] = String(v);
          }
        });
      }
    }

    const stockMap: Record<string, {
      priceKRW: number;
      priceUSD?: number;
      isUSD: boolean;
    }> = {};

    // 3. Scan data.accounts
    data.accounts.forEach(acc => {
      (acc.holdings || []).forEach((h: any) => {
        const name = (h.name || '').trim();
        if (!name) return;
        
        const isUSMarket = ['US', 'USA', 'OVERSEAS', 'NASDAQ', 'NYSE'].includes(String(h.market || '').toUpperCase());
        const hasUSD = typeof h.currentPriceUSD === 'number' && h.currentPriceUSD > 0;
        const dollarValFromMeta = combinedDollarInputs[name] ? parseFloat(combinedDollarInputs[name]) : undefined;
        const usdPrice = dollarValFromMeta !== undefined ? dollarValFromMeta : (hasUSD ? h.currentPriceUSD : (h.priceUSD || h.usdPrice || (h['달러가격'] ? parseFloat(h['달러가격']) : undefined)));
        const isUSD = isUSMarket || hasUSD || usdPrice !== undefined || !!combinedDollarInputs[name];

        const krwPrice = Number(h.currentPrice || h.price || 0);

        stockMap[name] = {
          priceKRW: (usdPrice && usdPrice > 0) ? Math.round(usdPrice * latestRate) : (krwPrice > 0 ? krwPrice : 0),
          priceUSD: usdPrice,
          isUSD
        };
      });
    });

    // 4. Scan latest monthly records
    if (latestRec) {
      latestRec.records.forEach(accRec => {
        (accRec.holdings || []).forEach(h => {
          const name = (h.name || '').trim();
          if (!name) return;
          
          const existing = stockMap[name];
          const dollarValFromMeta = combinedDollarInputs[name] ? parseFloat(combinedDollarInputs[name]) : undefined;
          const usdVal = dollarValFromMeta !== undefined ? dollarValFromMeta : existing?.priceUSD;
          const isDollar = !!combinedDollarInputs[name] || (existing?.isUSD ?? false);

          if (!existing || existing.priceKRW === 0 || (usdVal && usdVal > 0)) {
            stockMap[name] = {
              priceKRW: (usdVal && usdVal > 0) ? Math.round(usdVal * latestRate) : (h.price > 0 ? h.price : 0),
              priceUSD: usdVal,
              isUSD: isDollar
            };
          }
        });
      });
    }

    // 5. Add any remaining dollarInputs
    Object.entries(combinedDollarInputs).forEach(([name, valStr]) => {
      const val = parseFloat(valStr);
      if (!isNaN(val) && val > 0) {
        if (!stockMap[name]) {
          stockMap[name] = {
            priceKRW: Math.round(val * latestRate),
            priceUSD: val,
            isUSD: true
          };
        } else {
          stockMap[name].priceUSD = val;
          stockMap[name].isUSD = true;
          if (stockMap[name].priceKRW === 0) {
            stockMap[name].priceKRW = Math.round(val * latestRate);
          }
        }
      }
    });

    return { 
      stockMap, 
      latestRate, 
      combinedDollarInputs, 
      rawRateStr: rawRate ? String(rawRate) : String(latestRate) 
    };
  }, [data.accounts, data.monthlyRecords, data.settings]);

  const [exchangeRate, setExchangeRate] = useState<string>(() => {
    const { latestRate } = getLatestStockMap();
    return String(latestRate);
  });

  const [dollarFlags, setDollarFlags] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('snowball_dollar_flags');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [dollarInputs, setDollarInputs] = useState<Record<string, string>>({});
  const [holdingOrder, setHoldingOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('snowball_holding_order');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  
  // Local state for the form
  const [records, setRecords] = useState<Record<string, FormRecord>>({});
  const [expandedAccounts, setExpandedAccounts] = useState<Record<string, boolean>>({});
  const [expandedHoldings, setExpandedHoldings] = useState<Set<string>>(new Set());
  const [selectedCloneMonth, setSelectedCloneMonth] = useState('');

  const toggleHoldingExpand = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedHoldings(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const cloneDataFromMonth = () => {
    if (!selectedCloneMonth) return;
    const sourceRecord = data.monthlyRecords.find(r => r.yearMonth === selectedCloneMonth);
    if (!sourceRecord) return;
    
    if (!confirm(`${selectedCloneMonth.split('-')[0]}년 ${parseInt(selectedCloneMonth.split('-')[1])}월 데이터를 불러오시겠습니까? 현재 입력된 내용은 덮어써집니다.`)) return;

    setRecords(prev => {
      const initialRecords: Record<string, FormRecord> = {};
      
      data.accounts.forEach(acc => {
        const currentAcc = prev[acc.id];
        const prevAccRec = sourceRecord.records.find(r => r.accountId === acc.id);
        
        if (prevAccRec) {
          initialRecords[acc.id] = { 
            ...currentAcc, 
            cashBalance: prevAccRec.cashBalance || 0,
            holdings: (prevAccRec.holdings || []).map(h => ({
              ...h,
              id: uuidv4(),
              price: h.price || 0,
              dividend: 0
            }))
          };
        } else {
          initialRecords[acc.id] = currentAcc;
        }
      });
      return initialRecords;
    });
  };

  const handleInputKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    type: 'price' | 'dividend'
  ) => {
    if (e.key === 'Tab') {
      const inputs = Array.from(document.querySelectorAll(`input[data-focus-type="${type}"]`)) as HTMLInputElement[];
      const index = inputs.indexOf(e.currentTarget);
      
      if (e.shiftKey) {
        if (index > 0) {
          e.preventDefault();
          inputs[index - 1].focus();
          inputs[index - 1].select();
        }
      } else {
        if (index > -1 && index < inputs.length - 1) {
          e.preventDefault();
          inputs[index + 1].focus();
          inputs[index + 1].select();
        }
      }
    }
  };

  const toggleAccountExpand = (accountId: string) => {
    setExpandedAccounts(prev => ({ ...prev, [accountId]: !prev[accountId] }));
  };

  const uniqueHoldingNames = Array.from(
    new Set(
      Object.values(records)
        .flatMap((accRec: FormRecord) => (accRec.holdings || []).map((h: Holding) => h.name.trim()))
        .concat(data.accounts.flatMap(a => (a.holdings || []).map((h: any) => (h.name || '').trim())))
        .filter(n => n && n !== '현금')
    )
  ).sort((a, b) => {
    const idxA = holdingOrder.indexOf(a);
    const idxB = holdingOrder.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  const moveHolding = (name: string, direction: 'up' | 'down') => {
    const newOrder = [...uniqueHoldingNames];
    const idx = newOrder.indexOf(name);
    if (idx === -1) return;
    
    if (direction === 'up' && idx > 0) {
      [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]];
    } else if (direction === 'down' && idx < newOrder.length - 1) {
      [newOrder[idx + 1], newOrder[idx]] = [newOrder[idx], newOrder[idx + 1]];
    } else {
      return;
    }
    
    setHoldingOrder(newOrder);
    localStorage.setItem('snowball_holding_order', JSON.stringify(newOrder));
  };

  const openBulkPriceModal = () => {
    const { stockMap, latestRate, combinedDollarInputs } = getLatestStockMap();
    const isCurrentOrFuture = yearMonth >= format(new Date(), 'yyyy-MM');
    const existingAny = data.monthlyRecords.find(r => r.yearMonth === yearMonth) as any;
    const existingMeta = existingAny?.meta || existingAny?.['메타'];
    const existingRate = existingMeta?.exchangeRate || existingMeta?.['환율'];
    const existingDollarInputs = existingMeta?.dollarInputs || existingMeta?.['dollarInputs'] || existingMeta?.달러입력 || existingMeta?.['달러입력'] || existingMeta?.usdInputs;

    const activeRate = (existingRate && !isCurrentOrFuture)
      ? parseFloat(String(existingRate).replace(/[^0-9.]/g, '')) || latestRate
      : (data.settings?.usdExchangeRate || latestRate);
    
    setExchangeRate(String(activeRate));
    
    const initialDollarInputs: Record<string, string> = { ...dollarInputs, ...combinedDollarInputs };
    if (existingDollarInputs && typeof existingDollarInputs === 'object') {
      Object.entries(existingDollarInputs).forEach(([k, v]) => {
        if (v !== undefined && v !== null && String(v).trim() !== '') {
          initialDollarInputs[k.trim()] = String(v);
        }
      });
    }

    const initialDollarFlags: Record<string, boolean> = { ...dollarFlags };
    
    uniqueHoldingNames.forEach(name => {
      const stockInfo = stockMap[name];
      if (stockInfo?.isUSD || initialDollarFlags[name] || initialDollarInputs[name]) {
        initialDollarFlags[name] = true;
        if (initialDollarInputs[name]) {
          // Keep existing or meta dollar input
        } else if (stockInfo?.priceUSD) {
          initialDollarInputs[name] = String(stockInfo.priceUSD);
        } else {
          const currentKRW = Object.values(records).flatMap((acc: FormRecord) => acc.holdings).find(h => h.name.trim() === name)?.price || stockInfo?.priceKRW || 0;
          initialDollarInputs[name] = currentKRW ? (currentKRW / activeRate).toFixed(2) : (initialDollarInputs[name] || '');
        }
      }
    });

    setDollarFlags(initialDollarFlags);
    setDollarInputs(initialDollarInputs);
    setIsBulkPriceModalOpen(true);
  };

  const handleBulkPriceChange = (name: string, value: string) => {
    const numValue = value === '' ? 0 : parseFloat(value.replace(/[^0-9.]/g, '')) || 0;
    setRecords(prev => {
      const next = { ...prev };
      for (const accId in next) {
        next[accId] = { 
          ...next[accId], 
          holdings: next[accId].holdings.map(h => h.name.trim() === name ? { ...h, price: numValue } : h) 
        };
      }
      return next;
    });
  };

  const handleRateChange = (val: string) => {
    setExchangeRate(val);
    localStorage.setItem('snowball_exchange_rate', val);
    const numRate = parseFloat(val);
    if (!isNaN(numRate) && numRate > 0) {
      updateSettings({
        ...data.settings,
        usdExchangeRate: numRate
      });
    }
    const rate = numRate || 1;
    
    setRecords(prev => {
      const next = { ...prev };
      const priceMap: Record<string, number> = {};
      Object.keys(dollarFlags).forEach(name => {
        if (dollarFlags[name]) {
           const dv = parseFloat(dollarInputs[name] || '0');
           priceMap[name] = dv * rate;
        }
      });
  
      for (const accId in next) {
        if (next[accId]) {
          next[accId] = {
             ...next[accId],
             holdings: next[accId].holdings.map(h => {
                if (h.name.trim() in priceMap) {
                   return { ...h, price: priceMap[h.name.trim()] };
                }
                return h;
             })
          };
        }
      }
      return next;
    });
  };

  const handleDollarFlagChange = (name: string, checked: boolean) => {
    setDollarFlags(prev => {
      const next = { ...prev, [name]: checked };
      localStorage.setItem('snowball_dollar_flags', JSON.stringify(next));
      return next;
    });
    
    if (checked) {
      const { stockMap, latestRate } = getLatestStockMap();
      const stockInfo = stockMap[name];
      const rate = parseFloat(exchangeRate) || latestRate;
      
      if (stockInfo?.priceUSD) {
        setDollarInputs(prev => ({ ...prev, [name]: String(stockInfo.priceUSD) }));
      } else {
        const currentKRW = Object.values(records).flatMap((acc: FormRecord) => acc.holdings).find(h => h.name.trim() === name)?.price || stockInfo?.priceKRW || 0;
        const newDollarVal = currentKRW ? (currentKRW / rate).toFixed(2) : '';
        setDollarInputs(prev => ({ ...prev, [name]: newDollarVal }));
      }
    }
  };
  
  const handlePriceInput = (name: string, val: string) => {
    if (dollarFlags[name]) {
      setDollarInputs(prev => ({ ...prev, [name]: val }));
      const rate = parseFloat(exchangeRate) || 1400;
      const num = parseFloat(val.replace(/[^0-9.]/g, '')) || 0;
      handleBulkPriceChange(name, String(num * rate));
    } else {
      handleBulkPriceChange(name, val);
    }
  };

  // Live Gist Sync Button Handler in modal
  const handleFetchLatestPricesFromGist = async () => {
    setIsFetchingLatestPrices(true);
    try {
      await refreshFromGist();
      const { stockMap, latestRate } = getLatestStockMap();
      const currentRate = data.settings?.usdExchangeRate || latestRate;
      setExchangeRate(String(currentRate));

      const updatedDollarInputs: Record<string, string> = { ...dollarInputs };
      const updatedDollarFlags: Record<string, boolean> = { ...dollarFlags };
      const priceMap: Record<string, number> = {};

      uniqueHoldingNames.forEach(name => {
        const info = stockMap[name];
        if (!info) return;

        if (info.isUSD || updatedDollarFlags[name]) {
          updatedDollarFlags[name] = true;
          if (info.priceUSD) {
            updatedDollarInputs[name] = String(info.priceUSD);
            priceMap[name] = Math.round(info.priceUSD * currentRate);
          } else if (info.priceKRW > 0) {
            updatedDollarInputs[name] = (info.priceKRW / currentRate).toFixed(2);
            priceMap[name] = info.priceKRW;
          }
        } else if (info.priceKRW > 0) {
          priceMap[name] = info.priceKRW;
        }
      });

      setDollarFlags(updatedDollarFlags);
      setDollarInputs(updatedDollarInputs);

      // Apply price map to records
      setRecords(prev => {
        const next = { ...prev };
        for (const accId in next) {
          if (next[accId]) {
            next[accId] = {
              ...next[accId],
              holdings: next[accId].holdings.map(h => {
                const name = h.name.trim();
                if (typeof priceMap[name] === 'number') {
                  return { ...h, price: priceMap[name] };
                }
                return h;
              })
            };
          }
        }
        return next;
      });

      setSyncNotice(`✓ 최신 시세 및 환율(${currentRate.toLocaleString()}원) 동기화 완료`);
      setTimeout(() => setSyncNotice(null), 3000);
    } catch (err: any) {
      setSyncNotice('시세 불러오기 실패: 네트워크 상태를 확인해주세요.');
      setTimeout(() => setSyncNotice(null), 3000);
    } finally {
      setIsFetchingLatestPrices(false);
    }
  };

  // Sync form with selected month's existing data or initialize blank
  useEffect(() => {
    const existing = data.monthlyRecords.find(r => r.yearMonth === yearMonth);
    const initialRecords: Record<string, FormRecord> = {};
    const { stockMap, latestRate, combinedDollarInputs } = getLatestStockMap();
    const isCurrentOrFuture = yearMonth >= format(new Date(), 'yyyy-MM');
    
    // Auto-fill from previous month
    const sortedRecords = [...data.monthlyRecords].sort((a,b) => a.yearMonth.localeCompare(b.yearMonth));
    let prevRecord = null;
    const firstGreaterOrEqualIndex = sortedRecords.findIndex(r => r.yearMonth >= yearMonth);
    if (firstGreaterOrEqualIndex === -1) {
      prevRecord = sortedRecords.length > 0 ? sortedRecords[sortedRecords.length - 1] : null;
    } else if (firstGreaterOrEqualIndex > 0) {
      prevRecord = sortedRecords[firstGreaterOrEqualIndex - 1];
    }

    data.accounts.forEach(acc => {
      const prevAccRec = prevRecord ? prevRecord.records.find(r => r.accountId === acc.id) : null;
      const prevPrincipal = prevAccRec ? prevAccRec.principal : 0;

      if (existing) {
        const accRec = existing.records.find(r => r.accountId === acc.id);
        if (accRec) {
          // If current month or holding price is 0, provide default recommended price from stockMap
          const holdingsWithLatestPrices = (accRec.holdings || []).map(h => {
            const stockInfo = stockMap[h.name.trim()];
            const price = (isCurrentOrFuture && stockInfo?.priceKRW) ? stockInfo.priceKRW : (h.price || stockInfo?.priceKRW || 0);
            return {
              ...h,
              price
            };
          });

          initialRecords[acc.id] = {
            ...accRec,
            monthlyDeposit: accRec.principal - prevPrincipal,
            prevPrincipal,
            cashBalance: accRec.cashBalance || 0,
            holdings: holdingsWithLatestPrices
          };
          return;
        }
      }
      
      // If no existing record, try to copy from previous month or initialize empty with latest recommended prices
      if (prevAccRec) {
          initialRecords[acc.id] = { 
            accountId: acc.id, 
            principal: prevAccRec.principal, 
            valuation: 0, 
            dividend: 0,
            monthlyDeposit: 0,
            prevPrincipal,
            cashBalance: prevAccRec.cashBalance || 0,
            holdings: (prevAccRec.holdings || []).map(h => {
              const stockInfo = stockMap[h.name.trim()];
              return {
                ...h,
                id: uuidv4(),
                price: stockInfo?.priceKRW || h.price || 0,
                dividend: 0
              };
            })
          };
      } else {
        const accHoldings = (acc.holdings || []).map((h: any) => {
          const stockInfo = stockMap[(h.name || '').trim()];
          return {
            id: uuidv4(),
            name: h.name || '',
            quantity: h.quantity || 0,
            avgPrice: h.avgPrice || 0,
            price: stockInfo?.priceKRW || h.price || h.currentPrice || 0,
            dividend: 0
          };
        });

        initialRecords[acc.id] = { 
          accountId: acc.id, 
          principal: 0, 
          valuation: 0, 
          dividend: 0, 
          monthlyDeposit: 0, 
          prevPrincipal: 0,
          cashBalance: acc.cash || 0,
          holdings: accHoldings 
        };
      }
    });

    setRecords(initialRecords);

    const existingAny = existing as any;
    const existingMeta = existingAny?.meta || existingAny?.['메타'];
    const existingRate = existingMeta?.exchangeRate || existingMeta?.['환율'];
    const existingDollarInputs = existingMeta?.dollarInputs || existingMeta?.['dollarInputs'] || existingMeta?.달러입력 || existingMeta?.['달러입력'] || existingMeta?.usdInputs;

    if (existingRate && !isCurrentOrFuture) {
      setExchangeRate(String(existingRate));
    } else {
      const activeRate = data.settings?.usdExchangeRate || latestRate;
      setExchangeRate(String(activeRate));
    }

    const mergedDollarInputs: Record<string, string> = { ...combinedDollarInputs };
    if (existingDollarInputs && typeof existingDollarInputs === 'object') {
      Object.entries(existingDollarInputs).forEach(([k, v]) => {
        if (v !== undefined && v !== null && String(v).trim() !== '') {
          mergedDollarInputs[k.trim()] = String(v);
        }
      });
    }

    Object.keys(stockMap).forEach(name => {
      if (stockMap[name]?.priceUSD && !mergedDollarInputs[name]) {
        mergedDollarInputs[name] = String(stockMap[name].priceUSD);
      }
    });

    setDollarInputs(mergedDollarInputs);

    setDollarFlags(prev => {
      const next = { ...prev };
      Object.keys(mergedDollarInputs).forEach(k => {
        if (mergedDollarInputs[k]) next[k] = true;
      });
      Object.keys(stockMap).forEach(k => {
        if (stockMap[k]?.isUSD) next[k] = true;
      });
      return next;
    });
  }, [yearMonth, data.accounts, data.monthlyRecords, data.settings, getLatestStockMap]);

  const handleRecordChange = (accountId: string, field: 'monthlyDeposit' | 'principal' | 'cashBalance', value: string) => {
    let sanitized = value.replace(/[^0-9-]/g, '');
    if (sanitized.lastIndexOf('-') > 0) {
      sanitized = '-' + sanitized.replace(/-/g, '');
    }
    let numValue: string | number = parseInt(sanitized, 10);
    if (sanitized === '-') numValue = '-';
    else if (isNaN(numValue as number)) numValue = 0;

    setRecords(prev => {
      const current = prev[accountId];
      const updated = { ...current, [field]: numValue };
      if (field === 'monthlyDeposit') {
        updated.principal = current.prevPrincipal + (Number(numValue) || 0);
      } else if (field === 'principal') {
        updated.monthlyDeposit = (Number(numValue) || 0) - current.prevPrincipal;
      }
      return { ...prev, [accountId]: updated };
    });
  };

  const handleHoldingChange = (accountId: string, holdingId: string, field: keyof Holding, value: string) => {
    setRecords(prev => {
      const accRec = prev[accountId];
      const updatedHoldings = accRec.holdings.map(h => {
        if (h.id === holdingId) {
          let val: string | number = value;
          if (field !== 'name') {
            val = value === '' ? 0 : parseFloat(value.replace(/[^0-9.]/g, '')) || 0;
          }
          return { ...h, [field]: val };
        }
        return h;
      });
      return { ...prev, [accountId]: { ...accRec, holdings: updatedHoldings } };
    });
  };

  const addHoldingRow = (accountId: string) => {
    setRecords(prev => {
      const accRec = prev[accountId];
      const newHolding: Holding = {
        id: uuidv4(),
        name: '',
        quantity: 0,
        avgPrice: 0,
        price: 0,
        dividend: 0
      };
      return { ...prev, [accountId]: { ...accRec, holdings: [...accRec.holdings, newHolding] } };
    });
  };

  const removeHoldingRow = (accountId: string, holdingId: string) => {
    setRecords(prev => {
      const accRec = prev[accountId];
      return { ...prev, [accountId]: { ...accRec, holdings: accRec.holdings.filter(h => h.id !== holdingId) } };
    });
  };

  const moveHoldingInAccount = (accountId: string, holdingIndex: number, direction: 'up' | 'down') => {
    setRecords(prev => {
      const accRec = prev[accountId];
      const holdings = [...accRec.holdings];
      
      if (direction === 'up' && holdingIndex > 0) {
        [holdings[holdingIndex - 1], holdings[holdingIndex]] = [holdings[holdingIndex], holdings[holdingIndex - 1]];
      } else if (direction === 'down' && holdingIndex < holdings.length - 1) {
        [holdings[holdingIndex + 1], holdings[holdingIndex]] = [holdings[holdingIndex], holdings[holdingIndex + 1]];
      } else {
        return prev;
      }
      
      return { ...prev, [accountId]: { ...accRec, holdings } };
    });
  };

  const displayFormat = (val: number | string) => {
    if (val === '-') return '-';
    if (val === 0 || val === '0') return '';
    return new Intl.NumberFormat('ko-KR').format(Number(val));
  };

  const handleSave = (customRecords?: Record<string, FormRecord>) => {
    const targetRecords = customRecords || records;
    const recordList: RecordDetail[] = data.accounts.map(acc => {
      const r = targetRecords[acc.id] || {
        accountId: acc.id,
        principal: 0,
        valuation: 0,
        cashBalance: 0,
        dividend: 0,
        holdings: []
      };
      const holdings = r.holdings || [];
      const cash = Number(r.cashBalance) || 0;
      const valuation = holdings.reduce((sum, h) => sum + (h.price * h.quantity), 0) + cash;
      const accDividend = holdings.reduce((sum, h) => sum + h.dividend, 0);

      return {
        accountId: acc.id,
        principal: Number(r.principal) || 0,
        valuation,
        cashBalance: cash,
        dividend: accDividend,
        holdings
      };
    });
    
    const existing = data.monthlyRecords.find(r => r.yearMonth === yearMonth);
    saveMonthlyRecord({
      id: existing ? existing.id : uuidv4(),
      yearMonth,
      records: recordList,
      createdAt: existing ? existing.createdAt : Date.now(),
      meta: {
        exchangeRate,
        dollarInputs
      }
    });
    alert('자산 스냅샷 및 종목 시세가 성공적으로 저장되었습니다.');
  };

  return (
    <div className="space-y-6">
      {/* Calendar Section */}
      <div className="bg-white p-4 md:p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => setCalendarYear(prev => prev - 1)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <span className="font-mono font-black text-xl text-gray-900 tracking-tight">{calendarYear}</span>
          <button onClick={() => setCalendarYear(prev => prev + 1)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-2">
          {Array.from({ length: 12 }, (_, i) => {
            const m = (i + 1).toString().padStart(2, '0');
            const ym = `${calendarYear}-${m}`;
            const isSelected = yearMonth === ym;
            const record = data.monthlyRecords.find(r => r.yearMonth === ym);
            const isSaved = !!record;
            const isCurrentMonth = format(new Date(), 'yyyy-MM') === ym;

            const totalValuation = isSaved 
              ? record.records.reduce((sum, r) => sum + r.valuation, 0)
              : null;

            return (
              <button
                key={m}
                onClick={() => setYearMonth(ym)}
                className={`relative flex flex-col items-center justify-between p-3 rounded-xl border transition-all text-left min-h-[72px] ${
                  isSelected 
                    ? 'border-blue-600 bg-blue-50/40 shadow-sm ring-2 ring-blue-600/20' 
                    : isSaved
                      ? 'border-gray-200 bg-white hover:border-blue-200 hover:bg-gray-50/50'
                      : 'border-dashed border-gray-200 bg-gray-50/30 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="w-full flex justify-between items-start">
                  <span className={`font-mono text-sm font-black ${isSelected ? 'text-blue-600' : isSaved ? 'text-gray-900' : 'text-gray-400'}`}>
                    {i + 1}월
                  </span>
                  {isCurrentMonth && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                  )}
                </div>

                <div className="w-full mt-2">
                  {isSaved && totalValuation !== null ? (
                    <div className="text-[10px] font-mono font-bold text-gray-500 truncate text-right">
                      {formatCurrency(totalValuation)}
                    </div>
                  ) : (
                    <div className="text-[9px] font-bold text-gray-300 text-right uppercase tracking-wider">
                      미작성
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Input Form */}
      <div className="bg-white p-4 md:p-8 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 pb-6 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-3">
              <span>{yearMonth.split('-')[0]}년 {parseInt(yearMonth.split('-')[1])}월 스냅샷</span>
              {data.monthlyRecords.some(r => r.yearMonth === yearMonth) && (
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-100/80">
                  작성완료
                </span>
              )}
            </h2>
            <p className="text-xs font-semibold text-gray-400 mt-1">계좌별 납입 원금과 보유 종목 수량을 기록해 주세요.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Clone Button */}
            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200/80 rounded-xl p-1.5">
              <select
                value={selectedCloneMonth}
                onChange={e => setSelectedCloneMonth(e.target.value)}
                className="bg-transparent text-xs font-bold text-gray-700 focus:outline-none px-2 cursor-pointer"
              >
                <option value="">과거 내역 복사</option>
                {data.monthlyRecords
                  .filter(r => r.yearMonth !== yearMonth)
                  .sort((a, b) => b.yearMonth.localeCompare(a.yearMonth))
                  .map(r => (
                    <option key={r.yearMonth} value={r.yearMonth}>
                      {r.yearMonth.split('-')[0]}년 {parseInt(r.yearMonth.split('-')[1])}월
                    </option>
                  ))}
              </select>
              <button
                onClick={cloneDataFromMonth}
                disabled={!selectedCloneMonth}
                className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 hover:text-blue-600 hover:border-blue-200 disabled:opacity-40 disabled:hover:text-gray-700 disabled:hover:border-gray-200 rounded-lg text-xs font-black transition-all shadow-sm"
              >
                불러오기
              </button>
            </div>

            {/* Bulk Price Input Modal Trigger */}
            <button
              onClick={openBulkPriceModal}
              className="px-4 py-2.5 bg-blue-50 text-blue-600 hover:bg-blue-100/80 border border-blue-200/80 rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-sm"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              현재가 일괄 입력
            </button>
          </div>
        </div>

        {/* Account Records List */}
        <div className="space-y-6">
          {data.accounts.map(acc => {
            const formRec = records[acc.id] || {
              accountId: acc.id,
              principal: 0,
              monthlyDeposit: 0,
              prevPrincipal: 0,
              cashBalance: 0,
              valuation: 0,
              dividend: 0,
              holdings: []
            };

            const isExpanded = !!expandedAccounts[acc.id]; // default collapsed (false)

            const accountStockValuation = (formRec.holdings || []).reduce((sum, h) => sum + (h.price * h.quantity), 0);
            const totalAccountValuation = accountStockValuation + (Number(formRec.cashBalance) || 0);

            return (
              <div key={acc.id} className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:border-gray-200 transition-all bg-white">
                {/* Account Header */}
                <div 
                  onClick={() => toggleAccountExpand(acc.id)}
                  className="p-4 md:p-5 bg-gray-50/50 hover:bg-gray-50 flex items-center justify-between cursor-pointer border-b border-gray-100 select-none transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0"></div>
                    <div>
                      <span className="font-black text-sm text-gray-900">{acc.name}</span>
                      <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-200/60 text-gray-600">{acc.type}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-mono font-black text-sm text-gray-900">{formatCurrency(totalAccountValuation)}</div>
                      <div className="text-[10px] font-bold text-gray-400">평가액 합계</div>
                    </div>
                    <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-4 md:p-6 space-y-6">
                    {/* Principal & Cash Inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-50/30 p-4 rounded-xl border border-gray-100">
                      <div>
                        <label className="block text-[11px] font-black text-gray-500 uppercase tracking-wider mb-1.5">
                          당월 입금액 (원)
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={displayFormat(formRec.monthlyDeposit)}
                          onChange={e => handleRecordChange(acc.id, 'monthlyDeposit', e.target.value)}
                          placeholder="0"
                          className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-right font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-black text-gray-500 uppercase tracking-wider mb-1.5">
                          누적 원금 (원)
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={displayFormat(formRec.principal)}
                          onChange={e => handleRecordChange(acc.id, 'principal', e.target.value)}
                          placeholder="0"
                          className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-right font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-black text-gray-500 uppercase tracking-wider mb-1.5">
                          예수금 / 현금 (원)
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={displayFormat(formRec.cashBalance)}
                          onChange={e => handleRecordChange(acc.id, 'cashBalance', e.target.value)}
                          placeholder="0"
                          className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-right font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm text-sm"
                        />
                      </div>
                    </div>

                    {/* Holdings Table */}
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-black text-gray-700 tracking-tight">보유 종목 리스트</span>
                        <button
                          onClick={() => addHoldingRow(acc.id)}
                          className="text-[11px] font-black text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline"
                        >
                          + 종목 추가
                        </button>
                      </div>

                      <div className="space-y-2">
                        {(formRec.holdings || []).map((h, idx) => {
                          const valuation = (h.price || 0) * (h.quantity || 0);
                          const isHoldingExpanded = expandedHoldings.has(h.id);

                          return (
                            <div key={h.id} className="border border-gray-100 rounded-xl overflow-hidden bg-white hover:border-gray-200 transition-colors">
                              <div className="p-3 px-4 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <div className="flex flex-col gap-0.5 shrink-0">
                                    <button onClick={() => moveHoldingInAccount(acc.id, idx, 'up')} className="text-gray-300 hover:text-blue-600 transition-colors">
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 15l7-7 7 7" /></svg>
                                    </button>
                                    <button onClick={() => moveHoldingInAccount(acc.id, idx, 'down')} className="text-gray-300 hover:text-blue-600 transition-colors">
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                                    </button>
                                  </div>
                                  <input
                                    type="text"
                                    value={h.name}
                                    onChange={e => handleHoldingChange(acc.id, h.id, 'name', e.target.value)}
                                    placeholder="종목명"
                                    className="font-bold text-sm text-gray-900 bg-transparent focus:outline-none w-full"
                                  />
                                </div>

                                <div className="flex items-center gap-3 shrink-0">
                                  <div className="flex items-center bg-gray-50 border border-gray-200/80 rounded-lg px-2.5 py-1">
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={displayFormat(h.quantity)}
                                      onChange={e => handleHoldingChange(acc.id, h.id, 'quantity', e.target.value)}
                                      placeholder="0"
                                      className="w-16 bg-transparent text-right font-mono font-bold text-xs text-gray-900 focus:outline-none"
                                    />
                                    <span className="text-[10px] font-bold text-gray-400 ml-1">주</span>
                                  </div>

                                  <div className="text-right min-w-[80px]">
                                    <div className="font-mono font-black text-xs text-blue-600">{displayFormat(valuation) || '0'}원</div>
                                    <div className="text-[9px] font-bold text-gray-400">@{displayFormat(h.price) || '0'}원</div>
                                  </div>

                                  <button
                                    onClick={() => toggleHoldingExpand(h.id)}
                                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                  >
                                    <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${isHoldingExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </button>
                                </div>
                              </div>

                              {isHoldingExpanded && (
                                <div className="p-3 px-4 bg-gray-50/50 border-t border-gray-100 flex flex-wrap items-center justify-between gap-4">
                                  <div className="flex items-center gap-4 flex-wrap">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[11px] font-black text-gray-400">평단가:</span>
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        value={displayFormat(h.avgPrice)}
                                        onChange={e => handleHoldingChange(acc.id, h.id, 'avgPrice', e.target.value)}
                                        placeholder="0"
                                        className="w-24 p-1.5 bg-white border border-gray-200 rounded-lg text-right font-mono font-bold text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      />
                                      <span className="text-[10px] font-bold text-gray-400">원</span>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[11px] font-black text-green-600">배당금:</span>
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        value={displayFormat(h.dividend)}
                                        onChange={e => handleHoldingChange(acc.id, h.id, 'dividend', e.target.value)}
                                        placeholder="0"
                                        className="w-24 p-1.5 bg-white border border-gray-200 rounded-lg text-right font-mono font-bold text-xs text-green-700 focus:outline-none focus:ring-1 focus:ring-green-500"
                                      />
                                      <span className="text-[10px] font-bold text-green-600">원</span>
                                    </div>
                                  </div>

                                  <button
                                    onClick={() => removeHoldingRow(acc.id, h.id)}
                                    className="text-xs font-bold text-red-500 hover:text-red-700 hover:underline"
                                  >
                                    삭제
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button 
          onClick={() => handleSave()} 
          className="w-full mt-8 py-4 rounded-xl bg-gray-900 hover:bg-blue-600 text-white text-xs font-black uppercase tracking-widest transition-all shadow-md active:scale-[0.99]"
        >
          스냅샷 저장하기
        </button>
      </div>

      {/* Bulk Price Input Modal */}
      {isBulkPriceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
              <div>
                <h3 className="font-black text-gray-900 text-sm uppercase tracking-tight">종목별 현재가 일괄 입력</h3>
                <p className="text-[10px] font-semibold text-gray-400 mt-0.5">시세 정보를 업데이트하면 메인 계좌 및 스냅샷에 동시 반영됩니다.</p>
              </div>
              <button onClick={() => setIsBulkPriceModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-900 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            {/* Live Gist Sync Action & Rate Bar */}
            <div className="p-4 px-6 bg-blue-50/40 border-b border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <button
                onClick={handleFetchLatestPricesFromGist}
                disabled={isFetchingLatestPrices || syncing}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-50 text-white rounded-xl text-xs font-black tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm shadow-blue-600/10"
              >
                <RefreshCw size={13} className={isFetchingLatestPrices || syncing ? 'animate-spin' : ''} />
                최신 시세/환율 가져오기
              </button>

              <div className="flex items-center gap-2 justify-end">
                <span className="font-black text-[11px] text-gray-600 uppercase tracking-wider">기준 환율 ($)</span>
                <div className="relative w-28">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={exchangeRate}
                    onChange={e => handleRateChange(e.target.value)}
                    className="w-full py-1.5 pr-6 pl-2.5 bg-white border border-blue-200 rounded-lg text-right font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm text-xs"
                  />
                  <span className="absolute right-2 top-2 text-[10px] text-gray-400 font-mono">원</span>
                </div>
              </div>
            </div>

            {syncNotice && (
              <div className="px-6 py-2 bg-emerald-50 border-b border-emerald-100 text-emerald-700 text-xs font-black flex items-center gap-1.5">
                <CheckCircle2 size={14} />
                <span>{syncNotice}</span>
              </div>
            )}

            {/* Holdings Price Input List */}
            <div className="p-6 overflow-y-auto flex-1 space-y-3">
              {uniqueHoldingNames.length === 0 ? (
                <p className="text-center text-xs font-bold text-gray-400 py-8">등록된 종목이 없습니다.</p>
              ) : (
                uniqueHoldingNames.map(name => {
                  const isDollar = !!dollarFlags[name];
                  const currentHoldingPrice = Object.values(records).flatMap((acc: FormRecord) => acc.holdings).find(h => h.name.trim() === name)?.price;
                  const displayValue = isDollar 
                    ? (dollarInputs[name] || '') 
                    : (currentHoldingPrice !== undefined && currentHoldingPrice > 0 ? String(currentHoldingPrice) : '');
                  
                  return (
                    <div key={name} className="flex flex-col gap-2 bg-gray-50/50 p-3.5 rounded-2xl border border-gray-100 hover:border-blue-100 hover:bg-blue-50/20 transition-colors">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col gap-0">
                            <button onClick={() => moveHolding(name, 'up')} className="p-0.5 text-gray-300 hover:text-blue-600 transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 15l7-7 7 7" /></svg>
                            </button>
                            <button onClick={() => moveHolding(name, 'down')} className="p-0.5 text-gray-300 hover:text-blue-600 transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                            </button>
                          </div>
                          <span className="font-black text-xs text-gray-900 leading-tight break-words">{name}</span>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={isDollar} 
                            onChange={e => handleDollarFlagChange(name, e.target.checked)} 
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 mt-0.5" 
                          />
                          <span className="text-[10px] font-black tracking-wider text-gray-500">$ 달러 입력</span>
                        </label>
                      </div>
                      <div className="relative w-full">
                        <input 
                          type="text" 
                          inputMode="decimal" 
                          value={displayValue} 
                          onChange={e => handlePriceInput(name, e.target.value)} 
                          placeholder="0" 
                          className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-right font-mono font-bold text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-12 shadow-sm text-sm"
                        />
                        <span className="absolute right-3 top-3 text-[10px] text-gray-400 font-black uppercase tracking-wider">{isDollar ? '달러 ($)' : '원'}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-5 border-t border-gray-100 bg-gray-50/50 shrink-0">
              <button 
                onClick={() => {
                  let next: Record<string, FormRecord> = {};
                  const priceMap: Record<string, number> = {};
                  const rate = parseFloat(exchangeRate) || 1400;

                  uniqueHoldingNames.forEach(name => {
                    if (dollarFlags[name] && dollarInputs[name]) {
                      const usd = parseFloat(dollarInputs[name].replace(/[^0-9.]/g, '')) || 0;
                      priceMap[name] = Math.round(usd * rate);
                    } else {
                      const found = Object.values(records).flatMap((acc: FormRecord) => acc.holdings).find(h => h.name.trim() === name && h.price > 0);
                      const fallback = Object.values(records).flatMap((acc: FormRecord) => acc.holdings).find(h => h.name.trim() === name)?.price || 0;
                      priceMap[name] = found ? found.price : fallback;
                    }
                  });

                  next = { ...records };
                  for (const accId in next) {
                    if (next[accId]) {
                      next[accId] = {
                        ...next[accId],
                        holdings: next[accId].holdings.map(h => ({
                          ...h,
                          price: typeof priceMap[h.name.trim()] === 'number' ? priceMap[h.name.trim()] : h.price
                        }))
                      };
                    }
                  }
                  setRecords(next);
                  handleSave(next);
                  setIsBulkPriceModalOpen(false);
                }} 
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md shadow-blue-600/10 active:scale-[0.99]"
              >
                적용 및 저장하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
