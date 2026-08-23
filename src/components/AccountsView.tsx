import React, { useState, useEffect } from 'react';
import { useData } from '../store/DataContext';
import { formatCurrency } from '../lib/utils';
import { AccountType } from '../types';

export default function AccountsView() {
  const { data, addAccount, deleteAccount, updateAccount, moveAccount } = useData();
  const { monthlyRecords, settings } = data;
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  
  // Retirement Progress Calculations
  const sortedRecords = [...monthlyRecords].sort((a,b) => a.yearMonth.localeCompare(b.yearMonth));
  const latestRecord = sortedRecords.length > 0 ? sortedRecords[sortedRecords.length - 1] : null;
  const totalValuation = latestRecord ? latestRecord.records.reduce((acc, r) => acc + r.valuation, 0) : 0;
  const goalProgress = Math.min((totalValuation / settings.retirementGoal) * 100, 100);

  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<AccountType>('General');
  const [newLimit, setNewLimit] = useState('');

  const [editState, setEditState] = useState<{id: string, name: string, type: AccountType, annualLimit: string} | null>(null);

  useEffect(() => {
    if (editState) {
      const exists = data.accounts.some(a => a.id === editState.id);
      if (!exists) {
        setEditState(null);
      }
    }
  }, [data.accounts]);
  
  const handleAddAccount = () => {
    if (!newName.trim()) return;
    addAccount({
      name: newName,
      type: newType,
      annualLimit: newLimit ? parseInt(newLimit.replace(/[^0-9]/g, ''), 10) : undefined
    });
    setNewName('');
    setNewLimit('');
    setIsAddingAccount(false);
  };

  const getYearlyDeposit = (accountId: string) => {
    const currentYear = new Date().getFullYear().toString();
    const thisYearRecords = data.monthlyRecords.filter(r => r.yearMonth.startsWith(currentYear));
    if (thisYearRecords.length === 0) return 0;
    
    const prevYearEndValue = data.monthlyRecords
      .filter(r => r.yearMonth < `${currentYear}-01`)
      .sort((a,b) => b.yearMonth.localeCompare(a.yearMonth))[0]
      ?.records.find(r => r.accountId === accountId)?.principal || 0;

    thisYearRecords.sort((a,b) => b.yearMonth.localeCompare(a.yearMonth));
    const latestValue = thisYearRecords[0].records.find(r => r.accountId === accountId)?.principal || 0;

    return Math.max(0, latestValue - prevYearEndValue);
  };

  const taxAccounts = data.accounts.filter(a => a.type !== 'General');

  return (
    <div className="space-y-6">
      {/* 경제적 자유 달성률 (Moved from Dashboard) */}
      <section className="bg-white border border-gray-100 shadow-sm overflow-hidden relative p-8 rounded-3xl">
        <div className="relative z-10">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">경제적 자유 달성률</h3>
          <div className="flex justify-between items-baseline mb-3">
             <div className="flex items-baseline gap-1">
               <span className="text-4xl font-black text-gray-900 tracking-tighter">{goalProgress.toFixed(1)}</span>
               <span className="text-xl font-black text-blue-500">%</span>
             </div>
             <div className="text-right">
                <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-0.5">은퇴 목표 금액</div>
                <div className="text-xs text-gray-600 font-mono font-bold">₩{new Intl.NumberFormat('ko-KR').format(settings.retirementGoal)}</div>
             </div>
          </div>
          <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden shadow-inner">
            <div className="bg-gradient-to-r from-blue-600 to-blue-400 h-full transition-all duration-1000 ease-out" style={{ width: `${goalProgress}%` }}></div>
          </div>
        </div>
        <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-blue-600 rounded-full blur-[100px] opacity-10"></div>
      </section>

      {/* 절세 계좌 한도 관리 */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-6 flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
          당해 연도 납입 한도 현황
        </h3>
        <div className="space-y-8">
          {taxAccounts.map(acc => {
            const yearlyDeposit = getYearlyDeposit(acc.id);
            const limit = acc.annualLimit || 0;
            const progress = limit > 0 ? Math.min((yearlyDeposit / limit) * 100, 100) : 0;
            
            return (
              <div key={acc.id} className="space-y-3 p-4 bg-gray-50/50 rounded-2xl border border-gray-100">
                <div className="flex flex-col gap-1">
                  <span className="font-black flex items-center text-gray-900 text-sm">
                    {acc.name} 
                    <span className="ml-2 text-[8px] text-gray-400 font-black bg-white border border-gray-100 px-1.5 py-0.5 rounded tracking-widest uppercase">{acc.type}</span>
                  </span>
                </div>

                <div className="w-full bg-white h-2 rounded-full overflow-hidden border border-gray-200 shadow-inner">
                  <div className={`h-full transition-all duration-1000 ease-out ${progress >= 100 ? 'bg-green-500' : 'bg-blue-600'}`} style={{ width: `${progress}%` }}></div>
                </div>

                <div className="grid grid-cols-2 gap-y-3 text-[10px] font-bold">
                   <div className="flex flex-col">
                      <span className="text-[8px] text-gray-400 uppercase tracking-widest mb-1">올해 납입액</span>
                      <span className="text-blue-600 font-mono font-black">{formatCurrency(yearlyDeposit)}</span>
                   </div>
                   <div className="flex flex-col text-right">
                      <span className="text-[8px] text-gray-400 uppercase tracking-widest mb-1">연간 한도</span>
                      <span className="text-gray-900 font-mono">{formatCurrency(limit)}</span>
                   </div>
                   <div className="flex flex-col">
                      <span className="text-[8px] text-gray-400 uppercase tracking-widest mb-1">진행률</span>
                      <span className={`${progress >= 100 ? 'text-green-600' : 'text-gray-900'} font-black`}>{Math.round(progress)}%</span>
                   </div>
                   <div className="flex flex-col text-right">
                      <span className="text-[8px] text-gray-400 uppercase tracking-widest mb-1">남은 금액</span>
                      <span className="font-black text-gray-900 font-mono">{formatCurrency(Math.max(0, limit - yearlyDeposit))}</span>
                   </div>
                </div>
              </div>
            )
          })}
          {taxAccounts.length === 0 && (
            <div className="text-center py-4 bg-gray-50 border border-dashed rounded-xl text-[10px] text-gray-400 uppercase font-black tracking-widest">등록된 절세 계좌가 없습니다</div>
          )}
        </div>
      </div>

      {/* 전체 계좌 목록 */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-gray-900 rounded-full"></span>
            등록된 계좌 목록
          </h3>
          <button onClick={() => setIsAddingAccount(!isAddingAccount)} className="px-4 py-2 rounded-xl bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all active:scale-95">
            계좌 추가
          </button>
        </div>

        {isAddingAccount && (
          <div className="mb-8 p-6 bg-gray-50 rounded-2xl space-y-5 border border-blue-50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">계좌 이름 (별칭)</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="예: 키움증권 ISA" className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white text-xs font-bold" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">계좌 유형</label>
                <select value={newType} onChange={(e) => setNewType(e.target.value as AccountType)} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white text-xs font-bold appearance-none">
                  <option value="General">일반 주식계좌</option>
                  <option value="Pension">연금저축</option>
                  <option value="IRP">IRP</option>
                  <option value="ISA">ISA</option>
                </select>
              </div>
            </div>
            {newType !== 'General' && (
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">연간 납입 한도 (원)</label>
                <input value={newLimit} onChange={e => setNewLimit(newIntFilter(e.target.value))} placeholder="예: 20,000,000" className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white text-xs font-bold" inputMode="numeric" />
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={handleAddAccount} className="flex-1 py-3.5 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all">계좌 생성</button>
              <button onClick={() => setIsAddingAccount(false)} className="flex-1 py-3.5 rounded-xl bg-white border border-gray-200 text-gray-400 text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all">취소</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.accounts.map((acc, idx) => (
            <div key={acc.id} className="group relative border border-gray-100 rounded-2xl p-5 hover:border-blue-100 hover:shadow-xl hover:shadow-blue-50 transition-all">
              {editState?.id === acc.id ? (
                <div className="space-y-4">
                  <input value={editState.name} onChange={e => setEditState({...editState, name: e.target.value})} className="w-full p-2.5 border border-blue-100 rounded-xl text-xs font-bold focus:outline-none" placeholder="계좌 이름" />
                  <div className="grid grid-cols-2 gap-2">
                    <select value={editState.type} onChange={e => setEditState({...editState, type: e.target.value as AccountType})} className="p-2.5 border border-blue-100 rounded-xl text-[10px] font-bold bg-white outline-none">
                      <option value="General">일반</option>
                      <option value="ISA">ISA</option>
                      <option value="Pension">연금저축</option>
                      <option value="IRP">IRP</option>
                    </select>
                    {editState.type !== 'General' && (
                      <input value={editState.annualLimit} onChange={e => setEditState({...editState, annualLimit: newIntFilter(e.target.value)})} className="p-2.5 border border-blue-100 rounded-xl text-[10px] font-bold outline-none" placeholder="한도" />
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { updateAccount({...acc, name: editState.name, type: editState.type, annualLimit: editState.annualLimit ? parseInt(editState.annualLimit.replace(/[^0-9]/g, ''), 10) : undefined}); setEditState(null); }} className="flex-1 py-2 bg-gray-900 text-white text-[10px] rounded-lg uppercase font-black">저장</button>
                    <button onClick={() => setEditState(null)} className="flex-1 py-2 bg-gray-50 border border-gray-100 text-gray-400 text-[10px] rounded-lg uppercase font-black">취소</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-900 text-white rounded-xl flex items-center justify-center font-black text-sm shadow-lg group-hover:bg-blue-600 transition-colors shrink-0">{acc.name.charAt(0)}</div>
                      <div className="flex flex-col min-w-0">
                         <div className="flex items-center gap-2 mb-0.5">
                           <h4 className="font-black text-gray-900 text-sm truncate">{acc.name}</h4>
                           <span className="text-[8px] bg-gray-50 border border-gray-100 text-gray-400 px-1.5 py-0.5 rounded font-black tracking-widest uppercase shrink-0">{acc.type}</span>
                         </div>
                         <p className="text-[9px] text-gray-400 font-medium truncate">기록하기 탭에서 월별 관리</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button disabled={idx === 0} onClick={() => moveAccount(acc.id, -1)} className="p-1.5 text-gray-300 hover:text-blue-600 disabled:hidden transition-colors"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg></button>
                      <button disabled={idx === data.accounts.length - 1} onClick={() => moveAccount(acc.id, 1)} className="p-1.5 text-gray-300 hover:text-blue-600 disabled:hidden transition-colors"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg></button>
                    </div>
                  </div>
                  
                  <div className="absolute top-4 right-4 flex gap-2">
                    <button onClick={() => setEditState({id: acc.id, name: acc.name, type: acc.type, annualLimit: acc.annualLimit?.toString() || ''})} className="text-[9px] font-black text-gray-300 hover:text-blue-600 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all">수정</button>
                    <button onClick={() => window.confirm('이 계좌를 삭제하시겠습니까?') && deleteAccount(acc.id)} className="text-[9px] font-black text-gray-300 hover:text-red-500 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all">삭제</button>
                  </div>
                </>
              )}
            </div>
          ))}
          {data.accounts.length === 0 && (
            <div className="col-span-1 md:col-span-2 text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
              <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest">등록된 계좌가 없습니다</div>
              <p className="text-[9px] text-gray-300 mt-2">첫 계좌를 추가하여 자산 관리를 시작해보세요.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function newIntFilter(val: string) {
  const n = parseInt(val.replace(/[^0-9]/g, ''), 10);
  return isNaN(n) ? '' : new Intl.NumberFormat('ko-KR').format(n);
}
