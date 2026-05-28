import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useData } from '../store/DataContext';
import { formatCurrency, formatKoreanCurrency, formatCompactCurrency, formatPercent, getProfitColorClass } from '../lib/utils';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, LabelList } from 'recharts';
import { differenceInMonths, parse } from 'date-fns';
import { MonthlyRecord } from '../types';

import HelpGuide from './HelpGuide';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-100 flex flex-col gap-2 min-w-[140px]">
        <span className="text-sm font-semibold text-gray-500">20{label}</span>
        <div className="flex flex-col gap-1.5">
          {payload.map((entry: any, index: number) => {
            const valueDisp = typeof entry.value === 'number' ? formatKoreanCurrency(entry.value) : entry.value;
            return (
              <div key={index} className="flex items-center gap-1 text-[13px] font-bold tracking-tight" style={{ color: entry.color }}>
                {entry.name === '배당금' ? '배당 수익' : entry.name} : {valueDisp}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};

export default function DashboardView() {
  const { data } = useData();
  const { monthlyRecords, settings } = data;
  const [expandedAssets, setExpandedAssets] = useState<Record<string, boolean>>({});

  const toggleAssetExpand = (assetName: string) => {
    setExpandedAssets(prev => ({ ...prev, [assetName]: !prev[assetName] }));
  };

  const [fullscreenChart, setFullscreenChart] = useState<string | null>(null);

  const openFullscreen = async (chartId: string) => {
    setFullscreenChart(chartId);
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      if (typeof screen !== 'undefined' && screen.orientation && (screen.orientation as any).lock) {
        await (screen.orientation as any).lock('landscape').catch(() => {});
      }
    } catch (e) {
      console.log(e);
    }
  };

  const closeFullscreen = async () => {
    setFullscreenChart(null);
    try {
      if (typeof screen !== 'undefined' && screen.orientation && (screen.orientation as any).unlock) {
        (screen.orientation as any).unlock();
      }
      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(() => {});
      }
    } catch (e) {
      console.log(e);
    }
  };

  React.useEffect(() => {
    const handleFsChange = () => {
      if (!document.fullscreenElement && fullscreenChart) {
        setFullscreenChart(null);
        if (typeof screen !== 'undefined' && screen.orientation && (screen.orientation as any).unlock) {
          (screen.orientation as any).unlock();
        }
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, [fullscreenChart]);

  if (monthlyRecords.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-4 mt-8 md:mt-16 mb-20">
        <div className="bg-white p-8 md:p-10 rounded-3xl shadow-lg border border-gray-100 max-w-2xl w-full">
          <div className="flex justify-center mb-6">
            <img src="/icon.png?v=5" alt="Snow Ball Logo" className="w-16 h-16 rounded-2xl shadow-sm" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2 tracking-tight text-center">환영합니다!</h2>
          <p className="text-gray-500 mb-8 text-sm font-medium text-center">Snow Ball을 통해 자산을 효과적으로 관리해보세요.<br/>첫 스냅샷을 기록하기 전에 아래 사용 방법을 확인해주세요.</p>
          
          <HelpGuide />
        </div>
      </div>
    );
  }

  // Get latest and prev record
  const sortedRecords = [...monthlyRecords].sort((a,b) => a.yearMonth.localeCompare(b.yearMonth));
  const latestRecord = sortedRecords[sortedRecords.length - 1];
  const prevRecord = sortedRecords.length > 1 ? sortedRecords[sortedRecords.length - 2] : null;

  // Calculations for current month
  const totalPrincipal = latestRecord.records.reduce((acc, r) => acc + r.principal, 0);
  const totalValuation = latestRecord.records.reduce((acc, r) => acc + r.valuation, 0);
  const totalProfit = totalValuation - totalPrincipal;
  const totalReturnRate = totalPrincipal > 0 ? (totalProfit / totalPrincipal) * 100 : 0;

  // MoM calculations
  const prevValuation = prevRecord ? prevRecord.records.reduce((acc, r) => acc + r.valuation, 0) : totalPrincipal; 
  const momChange = totalValuation - prevValuation;

  // Retirement Goal Progress
  const goalProgress = Math.min((totalValuation / settings.retirementGoal) * 100, 100);

  // Chart Data Preparation
  const chartData = [...monthlyRecords].sort((a,b) => a.yearMonth.localeCompare(b.yearMonth)).map(record => {
    const principal = record.records.reduce((acc, r) => acc + r.principal, 0);
    const valuation = record.records.reduce((acc, r) => acc + r.valuation, 0);
    const dividend = record.records.reduce((acc, r) => acc + r.dividend, 0);
    return {
      name: record.yearMonth.substring(2), // e.g. "23-01"
      원금: principal,
      평가액: valuation,
      배당금: dividend,
      ...record.records.reduce((acc, r) => ({ ...acc, [r.accountId]: r.valuation }), {}) 
    };
  });

  // Calculate holding period in months
  const getHoldingPeriod = (holdingName: string, accountId: string, currentYM: string, records: MonthlyRecord[]) => {
    const sorted = [...records].sort((a,b) => a.yearMonth.localeCompare(b.yearMonth));
    const firstRecord = sorted.find(r => 
      r.records.find(accRec => 
        accRec.accountId === accountId && 
        accRec.holdings?.some(h => h.name === holdingName)
      )
    );
    
    if (!firstRecord) return 0;
    
    const startDate = parse(firstRecord.yearMonth, 'yyyy-MM', new Date());
    const currentDate = parse(currentYM, 'yyyy-MM', new Date());
    
    return Math.max(1, differenceInMonths(currentDate, startDate) + 1);
  };

  return (
    <div className="space-y-6">
      {fullscreenChart && createPortal(
        <div className="fixed inset-0 z-[9999] bg-white flex flex-col">
          <div className="flex justify-between items-center p-4 border-b border-gray-100">
            <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">
              {fullscreenChart === 'asset' ? '자산 성장 추이' : fullscreenChart === 'trend' ? '계좌별 자산 추이' : '월별 배당금'}
            </h3>
            <button onClick={closeFullscreen} className="p-2 text-gray-500 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="flex-1 p-4 w-full h-full pb-safe">
            <ResponsiveContainer width="100%" height="100%">
              {fullscreenChart === 'asset' ? (
                <ComposedChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }} style={{ outline: 'none' }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 'bold' }} dy={10} />
                  <YAxis domain={['dataMin - 1000000', 'dataMax + 1000000']} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 'bold' }} tickFormatter={formatCompactCurrency} width={45} />
                  <Tooltip content={<CustomTooltip />} cursor={{fill: '#f9fafb'}} />
                  <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'black', paddingBottom: '20px' }} />
                  <Bar dataKey="원금" fill="#F3F4F6" radius={[4, 4, 0, 0]} maxBarSize={40} name="투자원금" />
                  <Line type="monotone" dataKey="평가액" stroke="#111827" strokeWidth={4} dot={{ r: 0 }} activeDot={{ r: 6, fill: '#111827' }} name="평가액" />
                </ComposedChart>
              ) : fullscreenChart === 'trend' ? (
                <ComposedChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }} style={{ outline: 'none' }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 'bold' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 'bold' }} tickFormatter={formatCompactCurrency} width={45} />
                  <Tooltip content={<CustomTooltip />} cursor={{fill: '#f9fafb'}} />
                  <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'black', paddingBottom: '20px' }} />
                  {data.accounts.map((acc, index) => {
                    const colors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444'];
                    return <Line key={acc.id} type="monotone" dataKey={acc.id} name={acc.name} stroke={colors[index % colors.length]} strokeWidth={3} dot={{ r: 0 }} activeDot={{ r: 6, fill: colors[index % colors.length] }} />
                  })}
                </ComposedChart>
              ) : (
                <ComposedChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }} style={{ outline: 'none' }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 'bold' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 'bold' }} tickFormatter={formatCompactCurrency} width={45} />
                  <Tooltip content={<CustomTooltip />} cursor={{fill: '#f9fafb'}} />
                  <Bar dataKey="배당금" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={40} name="배당금">
                    <LabelList dataKey="배당금" position="top" formatter={(value: number) => value > 0 ? formatKoreanCurrency(value) : ''} style={{ fontSize: '10px', fill: '#10B981', fontWeight: 'bold' }} />
                  </Bar>
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>,
        document.body
      )}

      {/* 1. Main Highlight */}
      <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 relative overflow-hidden">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
          <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">총 운영 자산</h2>
        </div>
        <div className="text-4xl font-black text-gray-900 tracking-tighter">
          <span className="text-gray-300 font-light mr-1">₩</span>{new Intl.NumberFormat('ko-KR').format(Math.round(totalValuation))}
        </div>
        <div className="mt-4 flex items-center gap-4 border-t border-gray-50 pt-4">
          <div className="flex flex-col">
            <span className="text-[9px] text-gray-400 uppercase font-black tracking-widest mb-0.5">이번달 증감표</span>
            <span className={`inline-flex items-center text-xs font-black ${getProfitColorClass(momChange)}`}>
              {momChange > 0 ? '+' : ''}{new Intl.NumberFormat('ko-KR').format(Math.round(momChange))}
              <span className="ml-1 font-mono text-[9px]">({formatPercent(prevValuation > 0 ? (momChange / prevValuation) * 100 : 0)})</span>
            </span>
          </div>
        </div>
      </section>

      {/* 2. Grid Stats */}
      <section className="grid grid-cols-10 gap-4">
        <div className="col-span-6 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest mb-3">순수익</p>
          <div className="flex items-baseline gap-1">
            <span className={`text-xl font-black ${getProfitColorClass(totalProfit)}`}>
              {totalProfit > 0 ? '+' : ''}₩{new Intl.NumberFormat('ko-KR').format(Math.round(Math.abs(totalProfit)))}
            </span>
          </div>
        </div>
        <div className="col-span-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest mb-3">누적 수익률</p>
          <div className="flex items-baseline gap-1">
            <span className={`text-xl font-black ${getProfitColorClass(totalReturnRate)}`}>
              {formatPercent(totalReturnRate)}
            </span>
          </div>
        </div>
      </section>

      {/* Charts */}
      <section className="space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">자산 성장 추이</h3>
            <button onClick={() => openFullscreen('asset')} className="p-1.5 text-gray-400 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none" title="전체화면">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" /></svg>
            </button>
          </div>

          <div className="h-64 w-full cursor-crosshair">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart 
                data={chartData} 
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                style={{ outline: 'none' }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#9CA3AF', fontWeight: 'bold' }} dy={10} />
                <YAxis 
                  domain={['dataMin - 1000000', 'dataMax + 1000000']} 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fill: '#9CA3AF', fontWeight: 'bold' }}
                  tickFormatter={formatCompactCurrency}
                  width={40}
                />
                <Tooltip content={<CustomTooltip />} cursor={{fill: '#f9fafb'}} />
                <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'black', textTransform: 'uppercase', paddingBottom: '20px', letterSpacing: '0.1em' }} />
                <Bar dataKey="원금" fill="#F3F4F6" radius={[4, 4, 0, 0]} maxBarSize={30} name="투자원금" />
                <Line type="monotone" dataKey="평가액" stroke="#111827" strokeWidth={4} dot={{ r: 0 }} activeDot={{ r: 6, fill: '#111827' }} name="평가액" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">계좌별 자산 추이</h3>
            <button onClick={() => openFullscreen('trend')} className="p-1.5 text-gray-400 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none" title="전체화면">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" /></svg>
            </button>
          </div>

          <div className="h-64 w-full cursor-crosshair">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart 
                data={chartData} 
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                style={{ outline: 'none' }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#9CA3AF', fontWeight: 'bold' }} dy={10} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fill: '#9CA3AF', fontWeight: 'bold' }}
                  tickFormatter={formatCompactCurrency}
                  width={40}
                />
                <Tooltip content={<CustomTooltip />} cursor={{fill: '#f9fafb'}} />
                <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'black', textTransform: 'uppercase', paddingBottom: '20px', letterSpacing: '0.1em' }} />
                {data.accounts.map((acc, index) => {
                  const colors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444'];
                  return (
                    <Line key={acc.id} type="monotone" dataKey={acc.id} name={acc.name} stroke={colors[index % colors.length]} strokeWidth={3} dot={{ r: 0 }} activeDot={{ r: 6, fill: colors[index % colors.length] }} />
                  )
                })}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">월별 배당금</h3>
            <button onClick={() => openFullscreen('dividend')} className="p-1.5 text-gray-400 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none" title="전체화면">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" /></svg>
            </button>
          </div>

          <div className="h-48 w-full cursor-crosshair">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart 
                data={chartData} 
                margin={{ top: 20, right: 10, left: 0, bottom: 0 }}
                style={{ outline: 'none' }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#9CA3AF', fontWeight: 'bold' }} dy={10} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fill: '#9CA3AF', fontWeight: 'bold' }}
                  tickFormatter={formatCompactCurrency}
                  width={40}
                />
                <Tooltip content={<CustomTooltip />} cursor={{fill: '#f9fafb'}} />
                <Bar dataKey="배당금" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={30} name="배당금">
                  <LabelList 
                    dataKey="배당금" 
                    position="top" 
                    formatter={(value: number) => value > 0 ? formatKoreanCurrency(value) : ''} 
                    style={{ fontSize: '9px', fill: '#10B981', fontWeight: 'bold' }} 
                  />
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Detailed Portfolio Breakdown */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">보유 종목 성과</h3>
          <div className="flex flex-col gap-3">
            {(() => {
              const holdingOrder = (() => {
                try {
                  const saved = localStorage.getItem('snowball_holding_order');
                  return saved ? JSON.parse(saved) : [];
                } catch { return []; }
              })();

              const aggregated: Record<string, any> = {};
              latestRecord.records.forEach(accRec => {
                const acc = data.accounts.find(a => a.id === accRec.accountId);
                (accRec.holdings || []).forEach(h => {
                  const name = h.name.trim();
                  if (!name) return;
                  const valuation = h.price * h.quantity;
                  const principal = h.avgPrice * h.quantity;
                  const months = getHoldingPeriod(name, accRec.accountId, latestRecord.yearMonth, data.monthlyRecords);
                  
                  if (!aggregated[name]) {
                    aggregated[name] = {
                      name,
                      accounts: [acc?.name].filter(Boolean),
                      quantity: h.quantity,
                      principal,
                      valuation,
                      maxMonths: months,
                      currentPrice: h.price
                    };
                  } else {
                    if (acc?.name && !aggregated[name].accounts.includes(acc.name)) {
                      aggregated[name].accounts.push(acc.name);
                    }
                    aggregated[name].quantity += h.quantity;
                    aggregated[name].principal += principal;
                    aggregated[name].valuation += valuation;
                    aggregated[name].maxMonths = Math.max(aggregated[name].maxMonths, months);
                  }
                });
              });

              const results = Object.values(aggregated).sort((a, b) => {
                const idxA = holdingOrder.indexOf(a.name);
                const idxB = holdingOrder.indexOf(b.name);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
                return b.valuation - a.valuation;
              });

              if (results.length === 0) {
                return (
                  <div className="py-20 text-center text-[10px] text-gray-300 font-black uppercase tracking-widest italic bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                    이번 달 저장된 스냅샷이 없습니다
                  </div>
                );
              }

              return results.map(h => {
                const profit = h.valuation - h.principal;
                const returnRate = h.principal > 0 ? (profit / h.principal) * 100 : 0;
                const avgPrice = h.quantity > 0 ? h.principal / h.quantity : 0;
                const isExpanded = !!expandedAssets[h.name];

                return (
                  <div key={h.name} className="relative bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col group">
                    <div 
                      className="p-5 cursor-pointer hover:bg-gray-50/50 transition-colors"
                      onClick={() => toggleAssetExpand(h.name)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex flex-col gap-0.5">
                          <h4 className="font-black text-gray-900 text-sm truncate w-32 sm:w-auto">{h.name}</h4>
                          <span className="text-[9px] text-gray-400 font-bold uppercase mt-0.5">{h.accounts.join(', ')}</span>
                          <div className="mt-2 text-[10px] font-black text-gray-900 uppercase">
                            {formatCurrency(h.valuation)}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                           <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[9px] font-black uppercase tracking-wider mb-0.5">
                             {h.maxMonths}개월
                           </span>
                           <div className={`text-xs font-black ${getProfitColorClass(returnRate)}`}>
                             {returnRate > 0 ? '+' : ''}{formatPercent(returnRate)}
                           </div>
                           <div className={`text-[9px] font-bold opacity-60 ${getProfitColorClass(profit)}`}>
                             {profit > 0 ? '+' : ''}{new Intl.NumberFormat('ko-KR').format(Math.round(profit))}
                           </div>
                           <div className={`text-gray-300 mt-2 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7 7" /></svg>
                           </div>
                        </div>
                      </div>
                    </div>
                    {isExpanded && (
                       <div className="p-4 pt-0 border-t border-gray-50 bg-gray-50/30">
                         <div className="mt-4 grid grid-cols-3 gap-2">
                           <div className="bg-white p-3 border border-gray-100 rounded-xl">
                             <div className="text-[9px] text-gray-400 font-bold uppercase mb-1">수량</div>
                             <div className="text-[11px] font-mono font-bold text-gray-700">{h.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
                           </div>
                           <div className="bg-white p-3 border border-gray-100 rounded-xl">
                             <div className="text-[9px] text-gray-400 font-bold uppercase mb-1">평단가</div>
                             <div className="text-[11px] font-mono font-bold text-gray-700">{avgPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                           </div>
                           <div className="bg-white p-3 border border-blue-50 rounded-xl">
                             <div className="text-[9px] text-blue-400 font-bold uppercase mb-1">현재가</div>
                             <div className="text-[11px] font-mono font-black text-blue-600">{h.currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                           </div>
                         </div>
                       </div>
                    )}
                  </div>
                );
              });
            })()}
            
            {/* Total Cash Balance */}
            <div className="flex border border-blue-100 rounded-2xl bg-blue-50/30 p-5 mt-2 items-center justify-between">
              <span className="text-xs font-black text-blue-600 uppercase tracking-widest">총 예수금</span>
              <span className="text-sm font-black text-blue-600 font-mono">
                {formatCurrency(Math.round(latestRecord.records.reduce((sum, r) => sum + (r.cashBalance || 0), 0)))}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
