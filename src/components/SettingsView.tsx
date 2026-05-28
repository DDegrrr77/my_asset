import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { useData } from '../store/DataContext';
import { formatCurrency } from '../lib/utils';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { Account, Holding, RecordDetail, MonthlyRecord, AppData } from '../types';
import { APP_VERSION } from '../constants';

export default function SettingsView() {
  const { data, updateSettings, exportData, importData, setAppData } = useData();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  
  const [goalInput, setGoalInput] = useState(() => 
    new Intl.NumberFormat('ko-KR').format(data.settings.retirementGoal)
  );

  const [userNameInput, setUserNameInput] = useState(data.settings.userName || '');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinError, setPinError] = useState('');

  const handleProfileSave = () => {
    let finalPin = data.settings.pin;
    
    if (newPin) {
      if (currentPin !== data.settings.pin) {
        setPinError('현재 PIN 번호가 틀립니다. 저장할 수 없습니다.');
        return;
      }
      if (newPin.length < 4) {
        setPinError('새 PIN 번호는 4자리 이상이어야 합니다.');
        return;
      }
      finalPin = newPin;
    }

    updateSettings({ ...data.settings, userName: userNameInput.trim(), pin: finalPin });
    setPinError('');
    setCurrentPin('');
    setNewPin('');
    alert('사용자 설정이 저장되었습니다.');
  };

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

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-widest mb-6">사용자 설정</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-2 uppercase tracking-wider">사용자 이름</label>
            <input 
              type="text" 
              value={userNameInput}
              onChange={(e) => setUserNameInput(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 text-gray-900 text-sm font-medium"
              placeholder="표시될 이름 입력"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-2 uppercase tracking-wider">새 PIN 번호 변경 (선택)</label>
            <div className="space-y-2">
              <input 
                type="password" 
                inputMode="numeric"
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 tracking-widest font-mono text-sm"
                placeholder="현재 PIN 입력"
              />
              <input 
                type="password" 
                inputMode="numeric"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 tracking-widest font-mono text-sm"
                placeholder="새 PIN 4자리 이상"
              />
            </div>
            {pinError && <p className="text-xs text-red-500 mt-2 font-medium">{pinError}</p>}
          </div>
          <button 
            onClick={handleProfileSave}
            className="w-full bg-gray-900 text-white p-4 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors"
          >
            설정 저장
          </button>
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
