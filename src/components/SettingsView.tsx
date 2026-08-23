import React, { useRef, useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useData } from '../store/DataContext';
import { formatCurrency } from '../lib/utils';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { Account, Holding, RecordDetail, MonthlyRecord, AppData } from '../types';
import { APP_VERSION } from '../constants';
import { Eye, EyeOff } from 'lucide-react';

export default function SettingsView() {
  const { data, storageSource, githubToken, gistId, updateGistConfig, testConnection, updateSettings, exportData, importData, setAppData } = useData();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  const [tokenInput, setTokenInput] = useState(githubToken);
  const [gistIdInput, setGistIdInput] = useState(gistId);
  const [showToken, setShowToken] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setTokenInput(githubToken);
    setGistIdInput(gistId);
  }, [githubToken, gistId]);

  
  const [goalInput, setGoalInput] = useState(() => 
    new Intl.NumberFormat('ko-KR').format(data.settings.retirementGoal)
  );

  const handleGoalSave = () => {
    const val = parseInt(goalInput.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(val)) {
      updateSettings({ ...data.settings, retirementGoal: val });
      alert('목표 금액이 저장되었습니다.');
    }
  };

  const handleGoalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(val)) {
      setGoalInput(new Intl.NumberFormat('ko-KR').format(val));
    } else {
      setGoalInput('');
    }
  };

  const handleExport = () => {
    const jsonStr = exportData();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = format(new Date(), 'yyyy-MM-dd');
    const userName = data.settings.userName || 'user';
    a.download = `wealthtrack-backup-${userName}-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const inputPin = window.prompt('데이터를 복원하려면 PIN 번호를 입력하세요.');
    
    if (inputPin === null) {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return; // Canceled
    }

    if (inputPin !== data.settings.pin) {
      alert('PIN 번호가 일치하지 않습니다.');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    if (window.confirm('현재 데이터가 모두 덮어씌워집니다. 계속하시겠습니까?')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          if (importData(content)) {
            alert('데이터 복원이 완료되었습니다.');
          } else {
            alert('올바르지 않은 백업 파일입니다.');
          }
        } catch (err) {
          alert('파일을 읽는 중 오류가 발생했습니다.');
        }
      };
      reader.readAsText(file);
    }
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDownloadExcelTemplate = () => {
    // 엑셀 데이터 템플릿(Column) 헤더
    const rows: any[][] = [
      ['연월', '계좌명', '종목명', '수량', '평단가', '현재가', '배당금', '예수금', '당월입금액', '누적원금']
    ];

    const hasData = data.monthlyRecords && data.monthlyRecords.length > 0;
    
    // 이전 달 누적원금 참고용
    const sortedRecords = [...data.monthlyRecords].sort((a,b) => a.yearMonth.localeCompare(b.yearMonth));

    if (hasData) {
      sortedRecords.forEach((mr, index) => {
        const prevMr = index > 0 ? sortedRecords[index - 1] : null;
        
        mr.records.forEach(r => {
          const accountName = data.accounts.find(a => a.id === r.accountId)?.name || '알수없음';
          
          const prevAccRec = prevMr ? prevMr.records.find(pr => pr.accountId === r.accountId) : null;
          const prevPrincipal = prevAccRec ? prevAccRec.principal : 0;
          const monthlyDeposit = r.principal - prevPrincipal;
          
          let accountRowAdded = false;

          if (r.cashBalance) {
            rows.push([mr.yearMonth, accountName, '', 0, 0, 0, 0, r.cashBalance, accountRowAdded ? 0 : monthlyDeposit, accountRowAdded ? 0 : r.principal]);
            accountRowAdded = true;
          }

          if (r.holdings && r.holdings.length > 0) {
            r.holdings.forEach(h => {
              rows.push([mr.yearMonth, accountName, h.name, h.quantity, h.avgPrice, h.price, h.dividend || 0, 0, accountRowAdded ? 0 : monthlyDeposit, accountRowAdded ? 0 : r.principal]);
              accountRowAdded = true;
            });
          }
          
          if (!accountRowAdded) {
             // In case there's no holdings and no cash balance but an account has a record
             rows.push([mr.yearMonth, accountName, '', 0, 0, 0, 0, 0, monthlyDeposit, r.principal]);
          }
        });
      });
    }

    if (rows.length === 1) { // No data found, fallback to sample
      rows.push(['2026-05', '키움증권', '삼성전자', 100, 70000, 75000, 0, 0, 500000, 7000000]);
      rows.push(['2026-05', '키움증권', '', 0, 0, 0, 0, 1500000, 0, 0]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, 'snowball_data.xlsx');
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const dataBuffer = event.target?.result;
        const workbook = XLSX.read(dataBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Ensure we parse dates as strings if they are formatted, or handle raw values
        const rows = XLSX.utils.sheet_to_json<any>(worksheet, { defval: '' });

        const newAccounts = [...data.accounts];
        const newMonthlyRecordsMap = new Map<string, MonthlyRecord>();

        // Pre-fill map with existing records so we can merge/overwrite nicely
        data.monthlyRecords.forEach(mr => {
          newMonthlyRecordsMap.set(mr.yearMonth, { ...mr, records: [...mr.records.map(r => ({...r, holdings: [...r.holdings]}))] });
        });

        // Group loaded rows by yearMonth -> accountName
        const parsedData: Record<string, Record<string, {
          holdings: Holding[];
          cashBalance: number;
          dividend: number;
          explicitPrincipal: number | null;
          explicitMonthlyDeposit: number | null;
        }>> = {};

        rows.forEach(row => {
          let ym = String(row['연월'] || '').trim();
          const accName = String(row['계좌명'] || '').trim();
          const holdingName = String(row['종목명'] || '').trim();
          const qty = Number(row['수량']) || 0;
          const avgPrice = Number(row['평단가']) || 0;
          const currentPrice = Number(row['현재가']) || 0;
          const dividend = Number(row['배당금']) || 0;
          const cashBalance = Number(row['예수금']) || 0;
          
          const rawMonthlyDeposit = row['당월입금액'];
          const monthlyDeposit = rawMonthlyDeposit !== '' && rawMonthlyDeposit !== undefined ? Number(rawMonthlyDeposit) : null;
          
          const rawPrincipal = row['누적원금'];
          const principal = rawPrincipal !== '' && rawPrincipal !== undefined ? Number(rawPrincipal) : null;

          if (!ym || !accName) return;
          
          // SheetJS might sometimes return date objects or excel date serials, but assuming plain string like "2026-05" for now
          // If it's pure number it might be an excel date, but we instructed format "yyyy-MM"

          if (!parsedData[ym]) parsedData[ym] = {};
          if (!parsedData[ym][accName]) {
            parsedData[ym][accName] = { 
              holdings: [], 
              cashBalance: 0, 
              dividend: 0, 
              explicitPrincipal: null,
              explicitMonthlyDeposit: null,
            };
          }

          if (cashBalance !== 0) {
            parsedData[ym][accName].cashBalance += cashBalance;
          }
          
          if (monthlyDeposit !== null && monthlyDeposit !== 0 && parsedData[ym][accName].explicitMonthlyDeposit === null) {
            parsedData[ym][accName].explicitMonthlyDeposit = monthlyDeposit;
          }
          if (principal !== null && principal !== 0 && parsedData[ym][accName].explicitPrincipal === null) {
            parsedData[ym][accName].explicitPrincipal = principal;
          }
          
          if (holdingName !== '') {
            parsedData[ym][accName].holdings.push({
              id: uuidv4(),
              name: holdingName,
              quantity: qty,
              avgPrice: avgPrice,
              price: currentPrice,
              dividend: dividend
            });
          }
          parsedData[ym][accName].dividend += dividend;
        });

        const monthsToImport = Object.keys(parsedData).sort();
        if (monthsToImport.length === 0) {
          alert('가져올 데이터가 없거나 양식이 올바르지 않습니다.');
          return;
        }

        // Check if any month already exists
        const exists = monthsToImport.some(ym => newMonthlyRecordsMap.has(ym));
        if (exists) {
          if (!window.confirm('업로드한 엑셀 파일에 이미 존재하는 연월의 데이터가 포함되어 있습니다. 기존 데이터를 엑셀의 최신 데이터로 완전히 덮어쓰시겠습니까?')) {
            if (excelInputRef.current) excelInputRef.current.value = '';
            return;
          }
        }

        // Apply parsed data, process sequentially to handle prevPrincipal correctly
        monthsToImport.forEach(ym => {
          const accMap = parsedData[ym];
          const recordDetails: RecordDetail[] = [];
          
          // find previous month for prevPrincipal references
          const allMonths = Array.from(newMonthlyRecordsMap.keys()).concat(monthsToImport);
          const sortedMonths = Array.from(new Set(allMonths)).sort();
          const currIdx = sortedMonths.indexOf(ym);
          let prevMr = currIdx > 0 ? newMonthlyRecordsMap.get(sortedMonths[currIdx - 1]) : null;

          Object.entries(accMap).forEach(([accName, accData]) => {
            let account = newAccounts.find(a => a.name === accName);
            if (!account) {
              account = { id: uuidv4(), name: accName, type: 'General' };
              newAccounts.push(account);
            }

            const prevAccRec = prevMr ? prevMr.records.find(r => r.accountId === account.id) : null;
            const prevPrincipal = prevAccRec ? prevAccRec.principal : 0;
            
            let finalPrincipal = accData.holdings.reduce((sum, h) => sum + (h.quantity * h.avgPrice), 0) + accData.cashBalance;
            
            if (accData.explicitPrincipal !== null) {
              finalPrincipal = accData.explicitPrincipal;
            } else if (accData.explicitMonthlyDeposit !== null) {
              finalPrincipal = prevPrincipal + accData.explicitMonthlyDeposit;
            }

            const valuation = accData.holdings.reduce((sum, h) => sum + (h.quantity * h.price), 0) + accData.cashBalance;

            recordDetails.push({
              accountId: account.id,
              principal: finalPrincipal,
              valuation,
              dividend: accData.dividend,
              cashBalance: accData.cashBalance,
              holdings: accData.holdings
            });
          });

          // Completely replace records for this month based on Excel
          if (newMonthlyRecordsMap.has(ym)) {
            const existingMr = newMonthlyRecordsMap.get(ym)!;
            newMonthlyRecordsMap.set(ym, {
              ...existingMr,
              records: recordDetails
            });
          } else {
            newMonthlyRecordsMap.set(ym, {
              id: uuidv4(),
              yearMonth: ym,
              records: recordDetails,
              createdAt: Date.now()
            });
          }
        });

        const updatedMonthlyRecords = Array.from(newMonthlyRecordsMap.values()).sort((a,b) => a.yearMonth.localeCompare(b.yearMonth));

        setAppData({
          ...data,
          accounts: newAccounts,
          monthlyRecords: updatedMonthlyRecords
        });

        alert('엑셀 데이터가 성공적으로 동기화되었습니다.');

      } catch (err) {
        console.error(err);
        alert('엑셀 파일을 읽고 파싱하는 중 오류가 발생했습니다.');
      } finally {
        if (excelInputRef.current) {
          excelInputRef.current.value = '';
        }
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleTestAndSave = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testConnection(tokenInput, gistIdInput);
      setTestResult(res);
      if (res.success) {
        updateGistConfig(tokenInput, gistIdInput);
      }
    } catch (e: any) {
      setTestResult({ success: false, message: e.message || '요청 도중 알 수 없는 에러가 발생했습니다.' });
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = () => {
    if (window.confirm('GitHub Gist 클라우드 연동을 해제하고 오프라인 로컬 전용 모드로 전환하시겠습니까?')) {
      setTokenInput('');
      setGistIdInput('');
      updateGistConfig('', '');
      setTestResult({ success: true, message: '성공적으로 연동이 해제되었으며 로컬 오프라인 모드로 전환되었습니다.' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-6">
        <div className="flex justify-between items-center border-b border-gray-50 pb-4">
          <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">클라우드 데이터 동기화 (GitHub Gist)</h3>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${storageSource === 'Gist' ? 'bg-green-500 animate-pulse' : 'bg-orange-400'}`} />
            <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${storageSource === 'Gist' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-orange-50 text-orange-700 border border-orange-100'}`}>
              {storageSource === 'Gist' ? 'Cloud Sync' : 'Local Mode'}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl flex flex-col border bg-gray-50/50 border-gray-100">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1.5">현재 데이터 동기화 상태</span>
          <span className="text-xs font-bold text-gray-700">
            {storageSource === 'Gist' 
              ? 'GitHub Gist 클라우드 저장소와 안전하게 연동 중입니다. 모든 입력값은 백그라운드에서 실시간 동기화됩니다.'
              : '현재 오프라인 로컬 저장소 모드입니다. 데이터는 브라우저 내부(LocalStorage)에 보관되며, 아래 자격 증명을 등록하여 클라우드 백업을 활성화할 수 있습니다.'}
          </span>
        </div>

        {/* Input Fields */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest">GitHub Personal Access Token</label>
            <div className="relative">
              <input 
                type={showToken ? 'text' : 'password'}
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                placeholder="ghp_로 시작하는 토큰을 입력하세요"
                className="w-full bg-gray-50/50 border border-gray-200 focus:bg-white focus:border-blue-500 rounded-xl pl-4 pr-12 py-3 text-sm font-mono text-gray-800 outline-none transition-all"
              />
              <button 
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3.5 top-3 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="text-[10px] text-gray-400">Gist 읽기/쓰기 권한(gist 스코프)이 부여된 토큰이 필요합니다.</p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest">Gist ID</label>
            <input 
              type="text"
              value={gistIdInput}
              onChange={e => setGistIdInput(e.target.value)}
              placeholder="32자리 Gist 식별 번호를 입력하세요"
              className="w-full bg-gray-50/50 border border-gray-200 focus:bg-white focus:border-blue-500 rounded-xl px-4 py-3 text-sm font-mono text-gray-800 outline-none transition-all"
            />
          </div>
        </div>

        {/* Connection Feedbacks */}
        {testResult && (
          <div className={`p-4 rounded-xl border text-xs font-bold leading-relaxed ${
            testResult.success 
              ? 'bg-green-50 text-green-700 border-green-100' 
              : 'bg-red-50 text-red-600 border-red-100'
          }`}>
            {testResult.success ? '✓ ' : '⚠️ '} {testResult.message}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button 
            onClick={handleTestAndSave}
            disabled={testing}
            className="flex-1 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 text-white py-3.5 rounded-xl text-xs font-black tracking-wider transition-all shadow-md shadow-blue-600/10 flex items-center justify-center gap-2"
          >
            {testing ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                테스트 중...
              </>
            ) : (
              '연결 테스트 및 동기화 활성화'
            )}
          </button>

          {(githubToken || gistId) && (
            <button 
              onClick={handleDisconnect}
              className="px-5 bg-red-50 hover:bg-red-100 active:scale-[0.98] text-red-600 border border-red-100 py-3.5 rounded-xl text-xs font-black tracking-wider transition-all"
            >
              연동 해제 / 로컬 모드 전환
            </button>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-widest mb-6">목표 설정</h3>
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-2 uppercase tracking-wider">은퇴 목표 달성 금액</label>
          <div className="flex space-x-2">
            <div className="relative flex-1">
              <input 
                type="text" 
                inputMode="numeric"
                value={goalInput}
                onChange={handleGoalChange}
                className="w-full p-3 text-right font-mono border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8 bg-gray-50 text-gray-900 text-sm"
              />
              <span className="absolute right-3 top-4 text-gray-400 font-mono text-sm">원</span>
            </div>
            <button 
              onClick={handleGoalSave}
              className="bg-gray-900 text-white px-6 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors whitespace-nowrap"
            >
              저장
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col flex-1">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-widest mb-4">데이터 백업 & 복원</h3>
        <p className="text-[11px] text-gray-500 mb-6 leading-relaxed">
          기록된 모든 데이터는 브라우저 내부에만 저장됩니다. 유실에 대비하거나 다른 기기로 이동 시 아래 백업 및 복원 기능을 활용하세요.
        </p>
        
        <div className="flex flex-col gap-2 mt-auto">
          <button 
            onClick={handleExport}
            className="w-full py-3 rounded-xl bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-widest hover:bg-blue-100 transition-colors flex justify-center items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
            백업 다운로드 JSON
          </button>

          <button 
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-3 rounded-xl border border-gray-100 text-[10px] font-bold text-gray-500 uppercase tracking-widest hover:bg-gray-50 transition-colors flex justify-center items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
            기존 데이터 복원
          </button>
          <input 
            type="file" 
            accept=".json" 
            ref={fileInputRef} 
            onChange={handleImport} 
            className="hidden" 
          />
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col flex-1">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-widest mb-4">엑셀 데이터 연동</h3>
        <p className="text-[11px] text-gray-500 mb-6 leading-relaxed">
          정해진 양식에 맞춰 엑셀(.xlsx, .csv) 파일을 업로드하면 데이터를 동기화할 수 있습니다.
        </p>
        
        <div className="flex flex-col gap-2 mt-auto">
          <button 
            onClick={handleDownloadExcelTemplate}
            className="w-full py-3 rounded-xl border border-blue-100 bg-blue-50/50 text-blue-700 text-[10px] font-bold uppercase tracking-widest hover:bg-blue-100 transition-colors flex justify-center items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            엑셀 데이터 다운로드
          </button>

          <button 
            onClick={() => excelInputRef.current?.click()}
            className="w-full py-3 rounded-xl bg-gray-900 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors flex justify-center items-center shadow-md shadow-gray-200"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
            업로드 및 동기화
          </button>
          <input 
            type="file" 
            accept=".xlsx, .csv" 
            ref={excelInputRef} 
            onChange={handleExcelImport} 
            className="hidden" 
          />
        </div>
      </div>

{/* Info section explaining PWA */}
      <div className="text-center text-xs text-gray-400 mt-8 mb-4">
        <p>자산관리 프로그램 Snow Ball</p>
        <p className="mt-1">{APP_VERSION}</p>
      </div>
    </div>
  );
}
