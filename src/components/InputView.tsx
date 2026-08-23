import React, { useState, useEffect } from 'react';
import { useData } from '../store/DataContext';
import { v4 as uuidv4 } from 'uuid';
import { RecordDetail, Holding } from '../types';
import { format } from 'date-fns';
import { formatCurrency } from '../lib/utils';

type FormRecord = RecordDetail & { 
  monthlyDeposit: number | string; 
  prevPrincipal: number; 
  cashBalance: number | string;
};

export default function InputView() {
  const { data, saveMonthlyRecord, updateSettings } = useData();
  const [yearMonth, setYearMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [isBulkPriceModalOpen, setIsBulkPriceModalOpen] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<string>(() => {
    const latestRec = data.monthlyRecords.length > 0 ? data.monthlyRecords[data.monthlyRecords.length - 1] : null;
    return (
      (data.settings.usdExchangeRate ? String(data.settings.usdExchangeRate) : null) ||
      latestRec?.meta?.exchangeRate ||
      localStorage.getItem('snowball_exchange_rate') ||
      '1400'
    );
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
      return {};
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
        .flatMap((accRec: FormRecord) => accRec.holdings.map((h: Holding) => h.name.trim()))
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
    const currentRate = parseFloat(exchangeRate) || 1400;
    const initialDollarInputs: Record<string, string> = {};
    
    uniqueHoldingNames.forEach(name => {
      if (dollarFlags[name]) {
         const currentKRW = Object.values(records).flatMap((acc: FormRecord) => acc.holdings).find(h => h.name.trim() === name)?.price || 0;
         initialDollarInputs[name] = currentKRW ? (currentKRW / currentRate).toFixed(2) : '';
      }
    });

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
      const currentKRW = Object.values(records).flatMap((acc: FormRecord) => acc.holdings).find(h => h.name.trim() === name)?.price || 0;
      const rate = parseFloat(exchangeRate) || 1400;
      const newDollarVal = currentKRW ? (currentKRW / rate).toFixed(2) : '';
      setDollarInputs(prev => ({ ...prev, [name]: newDollarVal }));
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

  // Sync form with selected month's existing data or initialize blank
  useEffect(() => {
    const existing = data.monthlyRecords.find(r => r.yearMonth === yearMonth);
    const initialRecords: Record<string, FormRecord> = {};
    
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
          initialRecords[acc.id] = {
            ...accRec,
            monthlyDeposit: accRec.principal - prevPrincipal,
            prevPrincipal,
            cashBalance: accRec.cashBalance || 0,
            holdings: accRec.holdings || []
          };
          return;
        }
      }
      
      // If no existing record, try to copy from previous month or initialize empty
      if (prevAccRec) {
          initialRecords[acc.id] = { 
            accountId: acc.id, 
            principal: prevAccRec.principal, 
            valuation: 0, 
            dividend: 0,
            monthlyDeposit: 0,
            prevPrincipal,
            cashBalance: prevAccRec.cashBalance || 0,
            holdings: (prevAccRec.holdings || []).map(h => ({
              ...h,
              id: uuidv4(),
              price: 0,
              dividend: 0
            }))
          };
      } else {
        initialRecords[acc.id] = { 
          accountId: acc.id, 
          principal: 0, 
          valuation: 0, 
          dividend: 0, 
          monthlyDeposit: 0, 
          prevPrincipal: 0,
          cashBalance: 0,
          holdings: [] 
        };
      }
    });
    setRecords(initialRecords);
    if (existing && existing.meta && existing.meta.exchangeRate) {
      setExchangeRate(existing.meta.exchangeRate);
      setDollarInputs(existing.meta.dollarInputs || {});
    } else {
      const latestRec = data.monthlyRecords.length > 0 ? data.monthlyRecords[data.monthlyRecords.length - 1] : null;
      const rateVal = (
        (data.settings.usdExchangeRate ? String(data.settings.usdExchangeRate) : null) ||
        latestRec?.meta?.exchangeRate ||
        localStorage.getItem('snowball_exchange_rate') ||
        '1400'
      );
      setExchangeRate(rateVal);
      setDollarInputs({});
    }
  }, [yearMonth, data.accounts, data.monthlyRecords, data.settings]);

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
      const r = targetRecords[acc.id];
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
    alert('저장되었습니다.');
  };

  return (
    <div className="space-y-6">
      {/* Calendar Section - Redesigned */}
      <div className="bg-white p-4 md:p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => setCalendarYear(prev => prev - 1)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div className="text-center">
            <h2 className="text-xl font-black text-gray-900 tracking-tight">{calendarYear}</h2>
            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">자산 스냅샷 타임라인</div>
          </div>
          <button onClick={() => setCalendarYear(prev => prev + 1)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
        
        <div className="grid grid-cols-4 md:grid-cols-6 gap-2 md:gap-3">
          {Array.from({ length: 12 }, (_, i) => {
            const mStr = `${calendarYear}-${(i + 1).toString().padStart(2, '0')}`;
            const record = data.monthlyRecords.find(r => r.yearMonth === mStr);
            const totalValuation = record ? record.records.reduce((sum, r) => sum + r.valuation, 0) : null;
            const isSelected = yearMonth === mStr;
            const hasData = totalValuation !== null;

            return (
              <button key={mStr} onClick={() => setYearMonth(mStr)} className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all min-h-[60px] ${isSelected ? 'bg-blue-600 border-blue-600 text-white shadow-lg z-10' : 'bg-gray-50 border-gray-100 hover:bg-blue-50 hover:border-blue-200'}`}>
                <div className={`text-xs font-black ${isSelected ? 'text-blue-100' : 'text-gray-400'}`}>{i + 1}월</div>
                <div className={`text-[9px] font-mono tracking-tighter truncate w-full px-1 mt-1 ${isSelected ? 'text-white font-bold' : (hasData ? 'text-gray-900 font-bold' : 'text-gray-300')}`}>
                  {hasData ? formatCurrency(totalValuation) : '0'}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="mb-8 border-b border-gray-50 pb-5">
          <div className="mb-5">
            <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">
              {yearMonth.split('-')[0]}년 {parseInt(yearMonth.split('-')[1])}월 자산 기록
            </h3>
            <p className="text-[11px] text-gray-400 font-bold mt-1">당월 기준 보유 종목 및 평가 상태를 기록합니다.</p>
          </div>

          <div className="mb-5 flex flex-col md:flex-row gap-3 items-center bg-gray-50/50 p-4 rounded-xl border border-gray-100">
            <span className="text-[11px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">데이터 복제</span>
            <select 
              value={selectedCloneMonth} 
              onChange={e => setSelectedCloneMonth(e.target.value)}
              className="flex-1 w-full md:w-auto bg-white border border-gray-200 text-sm font-bold rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
            >
              <option value="">다른 월에서 데이터 불러오기</option>
              {data.monthlyRecords.map(r => (
                <option key={r.yearMonth} value={r.yearMonth}>{r.yearMonth.split('-')[0]}년 {parseInt(r.yearMonth.split('-')[1])}월</option>
              ))}
            </select>
            <button 
              onClick={cloneDataFromMonth}
              disabled={!selectedCloneMonth}
              className="w-full md:w-auto px-6 py-2.5 bg-white border border-gray-200 text-gray-700 text-[11px] font-black tracking-widest uppercase rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              불러오기
            </button>
          </div>

          <div className="flex gap-3">
            <button onClick={openBulkPriceModal} className="flex-1 py-3.5 bg-gray-900 text-white text-[11px] font-black uppercase tracking-widest rounded-xl shadow-lg hover:bg-gray-800 transition-all active:scale-95">
              현재가 입력
            </button>
            <button onClick={() => handleSave()} className="flex-1 py-3.5 bg-blue-600 text-white text-[11px] font-black uppercase tracking-widest rounded-xl shadow-blue-200 shadow-lg hover:bg-blue-700 transition-all active:scale-95">
              저장하기
            </button>
          </div>
        </div>
        
        <div className="space-y-12">
          {data.accounts.map((acc, aIdx) => {
            const accRec = records[acc.id];
            if (!accRec) return null;
            const isExpanded = !!expandedAccounts[acc.id];

            return (
              <div key={acc.id} className="relative bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
                <div 
                  className="p-5 cursor-pointer hover:bg-gray-50/50 transition-colors"
                  onClick={() => toggleAccountExpand(acc.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-gray-900 text-white rounded-lg flex items-center justify-center font-black text-xs shrink-0 mt-0.5">{acc.name.charAt(0)}</div>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-gray-900 text-sm truncate max-w-[150px] sm:max-w-xs">{acc.name}</h4>
                          <span className="text-[8px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-black uppercase tracking-widest">{acc.type} 계좌</span>
                        </div>
                        <div className="flex items-baseline gap-1.5 mt-1">
                          <span className="text-[10px] text-gray-400 font-bold uppercase">총 평가액</span>
                          <span className="text-sm font-black text-blue-600 font-mono">
                            {formatCurrency(accRec.holdings.reduce((sum, h) => sum + (h.price * h.quantity), 0) + (Number(accRec.cashBalance) || 0))}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className={`p-1 text-gray-400 transition-transform duration-200 mt-1 ${isExpanded ? 'rotate-180' : ''}`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7 7" /></svg>
                    </div>
                  </div>
                </div>

                {/* Body Content - Collapsible */}
                {isExpanded && (
                  <div className="p-5 pt-0 border-t border-gray-50">
                    {/* Cash Flows - Responsive Layout */}
                    <div className="mb-6">
                  {/* Desktop: 3-Column Grid */}
                  <div className="hidden md:grid md:grid-cols-3 gap-3">
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">당월 입금액</label>
                      <div className="relative">
                        <input type="text" inputMode="numeric" value={displayFormat(accRec.monthlyDeposit)} onChange={(e) => handleRecordChange(acc.id, 'monthlyDeposit', e.target.value)} className="w-full bg-transparent text-right font-mono text-base font-bold focus:outline-none pr-6 text-gray-900" placeholder="0" />
                        <span className="absolute right-0 top-0.5 text-gray-400 text-[10px] font-mono">원</span>
                      </div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">누적 원금</label>
                      <div className="relative">
                        <input type="text" inputMode="numeric" value={displayFormat(accRec.principal)} onChange={(e) => handleRecordChange(acc.id, 'principal', e.target.value)} className="w-full bg-transparent text-right font-mono text-base font-bold focus:outline-none pr-6 text-gray-900" placeholder="0" />
                        <span className="absolute right-0 top-0.5 text-gray-400 text-[10px] font-mono">원</span>
                      </div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl border border-blue-100 bg-blue-50/30">
                      <label className="block text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1.5">예수금 (현금)</label>
                      <div className="relative">
                        <input type="text" inputMode="numeric" value={displayFormat(accRec.cashBalance)} onChange={(e) => handleRecordChange(acc.id, 'cashBalance', e.target.value)} className="w-full bg-transparent text-right font-mono text-base font-bold focus:outline-none pr-6 text-blue-600" placeholder="0" />
                        <span className="absolute right-0 top-0.5 text-blue-400 text-[10px] font-mono">원</span>
                      </div>
                    </div>
                  </div>

                  {/* Mobile: Vertical List Box */}
                  <div className="md:hidden bg-gray-50 rounded-2xl border border-gray-100 divide-y divide-gray-200/50">
                    <div className="flex items-center justify-between p-4 px-5">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">당월 입금액</label>
                      <div className="relative flex-1 max-w-[150px]">
                        <input type="text" inputMode="numeric" value={displayFormat(accRec.monthlyDeposit)} onChange={(e) => handleRecordChange(acc.id, 'monthlyDeposit', e.target.value)} className="w-full bg-transparent text-right font-mono text-sm font-bold focus:outline-none pr-5 text-gray-900" placeholder="0" />
                        <span className="absolute right-0 top-0.5 text-gray-400 text-[9px] font-mono">원</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-4 px-5">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">누적 원금</label>
                      <div className="relative flex-1 max-w-[150px]">
                        <input type="text" inputMode="numeric" value={displayFormat(accRec.principal)} onChange={(e) => handleRecordChange(acc.id, 'principal', e.target.value)} className="w-full bg-transparent text-right font-mono text-sm font-bold focus:outline-none pr-5 text-gray-900" placeholder="0" />
                        <span className="absolute right-0 top-0.5 text-gray-400 text-[9px] font-mono">원</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-4 px-5 bg-blue-50/20 rounded-b-2xl">
                      <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest">예수금 (현금)</label>
                      <div className="relative flex-1 max-w-[150px]">
                        <input type="text" inputMode="numeric" value={displayFormat(accRec.cashBalance)} onChange={(e) => handleRecordChange(acc.id, 'cashBalance', e.target.value)} className="w-full bg-transparent text-right font-mono text-sm font-bold focus:outline-none pr-5 text-blue-600" placeholder="0" />
                        <span className="absolute right-0 top-0.5 text-blue-400 text-[9px] font-mono">원</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Holdings - Responsive Layout */}
                <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                  {/* Collapsible Accordion List View (Used across all screen sizes) */}
                  <div className="divide-y divide-gray-100">
                    {accRec.holdings.map((h, hIdx) => {
                      const priceTabM = 1000 + aIdx * 100 + hIdx;
                      const divTabM = 2000 + aIdx * 100 + hIdx;
                      const isExpanded = expandedHoldings.has(h.id);
                      const qty = parseFloat(String(h.quantity)) || 0;
                      const price = parseFloat(String(h.price)) || 0;
                      const valuation = qty * price;

                      return (
                      <div key={h.id} className="cursor-pointer bg-white" onClick={() => toggleHoldingExpand(h.id)}>
                        {/* Compact View */}
                        <div className="p-4 flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0 flex flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <input 
                              type="text" 
                              value={h.name} 
                              onChange={e => handleHoldingChange(acc.id, h.id, 'name', e.target.value)} 
                              placeholder="종목명" 
                              className="bg-transparent font-black text-gray-900 text-[15px] focus:outline-none w-full"
                            />
                            <div className="flex items-center text-gray-500 font-bold text-[12px] gap-0">
                              <input 
                                type="text" 
                                inputMode="decimal"
                                tabIndex={priceTabM}
                                data-focus-type="price"
                                onKeyDown={e => handleInputKeyDown(e, 'price')}
                                value={displayFormat(h.price)} 
                                onChange={e => handleHoldingChange(acc.id, h.id, 'price', e.target.value)} 
                                placeholder="0" 
                                className="bg-transparent focus:outline-none font-mono w-[64px]"
                              />
                              <span className="shrink-0 -ml-1">원</span>
                              <span className="text-gray-300 mx-2 shrink-0">·</span>
                              <input 
                                type="text" 
                                inputMode="decimal" 
                                value={displayFormat(h.quantity)} 
                                onChange={e => handleHoldingChange(acc.id, h.id, 'quantity', e.target.value)} 
                                placeholder="0" 
                                className="bg-transparent focus:outline-none font-mono w-[40px] text-right"
                              />
                              <span className="shrink-0 ml-1">주</span>
                            </div>
                          </div>
                          
                          <div className="flex flex-col items-end shrink-0 pl-2">
                            <div className="font-mono font-black text-blue-600 text-[14px]">{valuation ? displayFormat(valuation) : '0'}원</div>
                            <div className="text-gray-300 mt-1 cursor-pointer p-1 -mr-1 transition-transform duration-300" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                              <svg className={`w-4 h-4 ${isExpanded ? 'text-blue-500' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7 7" /></svg>
                            </div>
                          </div>
                        </div>

                        {/* Expanded Detail View */}
                        <div className={`overflow-hidden transition-all duration-300 ease-out bg-gray-50/50 ${isExpanded ? 'max-h-[120px] opacity-100 border-t border-gray-100' : 'max-h-0 opacity-0'}`} onClick={(e) => e.stopPropagation()}>
                          <div className="p-3 px-4 flex items-center justify-between">
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              <span className="hidden min-[769px]:inline text-[11px] font-black text-gray-400 shrink-0">평단가:</span>
                              <span className="inline min-[769px]:hidden text-[11px] font-black text-gray-400 shrink-0">평:</span>
                              <input 
                                type="text" 
                                inputMode="decimal" 
                                value={displayFormat(h.avgPrice)} 
                                onChange={e => handleHoldingChange(acc.id, h.id, 'avgPrice', e.target.value)} 
                                placeholder="0" 
                                className="flex-1 min-w-0 w-full bg-transparent focus:outline-none font-mono text-[13px] font-bold text-gray-700" 
                              />
                              <span className="text-[11px] font-bold text-gray-400 -ml-1">원</span>
                            </div>
                            
                            <div className="flex items-center gap-1.5 flex-1 min-w-0 px-2 border-l border-gray-200/60 mx-2">
                              <span className="hidden min-[769px]:inline text-[11px] font-black text-green-600 shrink-0">배당금:</span>
                              <span className="inline min-[769px]:hidden text-[11px] font-black text-green-600 shrink-0">배:</span>
                              <input 
                                type="text" 
                                inputMode="decimal" 
                                tabIndex={divTabM}
                                data-focus-type="dividend"
                                onKeyDown={e => handleInputKeyDown(e, 'dividend')}
                                value={displayFormat(h.dividend)} 
                                onChange={e => handleHoldingChange(acc.id, h.id, 'dividend', e.target.value)} 
                                placeholder="0" 
                                className="flex-1 min-w-0 w-full bg-transparent focus:outline-none font-mono text-[13px] font-black text-green-700" 
                              />
                              <span className="text-[11px] font-bold text-green-600 -ml-1">원</span>
                            </div>

                            <div className="hidden min-[769px]:flex shrink-0 items-center pl-2 ml-auto border-l border-gray-200/60">
                              <button 
                                onClick={(e) => { e.stopPropagation(); removeHoldingRow(acc.id, h.id); }} 
                                className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-red-500 bg-white hover:bg-red-50 rounded-xl shadow-[0_2px_8px_-4px_rgba(0,0,0,0.05)] border border-gray-100 transition-all text-sm"
                                aria-label="Delete asset"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                      )
                    })}
                  </div>

                  <button onClick={() => addHoldingRow(acc.id)} className="w-full py-3 bg-gray-50/50 text-[10px] font-black text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all border-t border-gray-50 flex items-center justify-center gap-2 uppercase tracking-widest">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
                    종목 추가
                  </button>
                </div>
              </div>
            )}
            </div>
          );
          })}
        </div>

        <button onClick={() => handleSave()} className="w-full mt-10 py-5 rounded-2xl bg-gray-900 text-white text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl hover:bg-blue-600 hover:shadow-blue-200 transition-all active:scale-[0.98]">
          스냅샷 저장
        </button>
      </div>

      {isBulkPriceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
              <h3 className="font-black text-gray-900 text-sm uppercase tracking-tight">현재가 입력</h3>
              <button onClick={() => setIsBulkPriceModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-900 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-4 px-6 bg-blue-50/30 border-b border-gray-100 flex items-center justify-between shrink-0">
              <span className="font-black text-[11px] text-gray-600 uppercase tracking-widest">달러 환율 ($)</span>
              <div className="relative w-32">
                 <input
                   type="text"
                   inputMode="decimal"
                   value={exchangeRate}
                   onChange={e => handleRateChange(e.target.value)}
                   className="w-full py-2 pr-6 pl-3 bg-white border border-blue-200 rounded-lg text-right font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm text-sm"
                 />
                 <span className="absolute right-3 top-2.5 text-[10px] text-gray-400 font-mono">원</span>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {uniqueHoldingNames.length === 0 ? (
                 <p className="text-center text-[10px] font-black tracking-widest text-gray-400 uppercase py-8">등록된 종목이 없습니다.</p>
              ) : (
                uniqueHoldingNames.map(name => {
                   const isDollar = !!dollarFlags[name];
                   const displayValue = isDollar ? (dollarInputs[name] || '') : (Object.values(records).flatMap((acc: FormRecord) => acc.holdings).find(h => h.name.trim() === name)?.price || '');
                   
                   return (
                     <div key={name} className="flex flex-col gap-2 bg-gray-50/50 p-4 rounded-2xl border border-gray-100 hover:border-blue-100 hover:bg-blue-50/20 transition-colors">
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
                           <input type="checkbox" checked={isDollar} onChange={e => handleDollarFlagChange(name, e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 mt-0.5" />
                           <span className="text-[10px] font-black tracking-widest text-gray-500">$ 입력</span>
                         </label>
                       </div>
                       <div className="relative w-full">
                         <input 
                           type="text" 
                           inputMode="decimal" 
                           value={displayValue} 
                           onChange={e => handlePriceInput(name, e.target.value)} 
                           placeholder="0" 
                           className="w-full p-3 bg-white border border-gray-200 rounded-xl text-right font-mono font-bold text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10 shadow-sm text-sm"
                         />
                         <span className="absolute right-3 top-3.5 text-[9px] text-gray-400 font-black uppercase tracking-widest">{isDollar ? '달러' : '원'}</span>
                       </div>
                     </div>
                   );
                })
              )}
            </div>
            <div className="p-6 border-t border-gray-100 bg-gray-50/50 shrink-0">
              <button 
                onClick={() => {
                  let next: Record<string, FormRecord> = {};
                  const priceMap: Record<string, number> = {};
                  uniqueHoldingNames.forEach(name => {
                    const found = Object.values(records).flatMap((acc: FormRecord) => acc.holdings).find(h => h.name.trim() === name && h.price > 0);
                    const fallback = Object.values(records).flatMap((acc: FormRecord) => acc.holdings).find(h => h.name.trim() === name)?.price || 0;
                    priceMap[name] = found ? found.price : fallback;
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
                className="w-full py-4 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-[0.98]"
              >
                완료
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


