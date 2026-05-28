import React, { useState } from 'react';
import { useData } from '../store/DataContext';
import { APP_VERSION } from '../constants';

export default function AuthView({ isSetup, onComplete }: { isSetup: boolean, onComplete: () => void }) {
  const { data, updateSettings } = useData();
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isSetup) {
      if (!name.trim()) {
        setError('이름을 입력해주세요.');
        return;
      }
      if (pin.length < 4) {
        setError('PIN 번호는 4자리 이상이어야 합니다.');
        return;
      }
      updateSettings({ ...data.settings, userName: name.trim(), pin });
      onComplete();
    } else {
      if (pin === data.settings.pin) {
        onComplete();
      } else {
        setError('PIN 번호가 맞지 않습니다. 다시 시도해주세요.');
        setPin(''); 
      }
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-gray-50 text-gray-900 items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col">
        <div className="mb-10 text-center flex flex-col items-center">
          <img src="/icon.png" alt="Snow Ball Logo" className="w-16 h-16 rounded-3xl shadow-sm mb-4" />
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Asset Manager</p>
          <h1 className="text-3xl font-light text-gray-900 tracking-tight">Snow Ball</h1>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {isSetup ? (
            <>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-2 uppercase tracking-widest">사용자 이름</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  placeholder="예: 홍길동"
                  className="w-full p-4 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-2 uppercase tracking-widest">PIN 번호 설정</label>
                <input 
                  type="password" 
                  inputMode="numeric"
                  value={pin} 
                  onChange={e => setPin(e.target.value.replace(/[^0-9]/g, ''))} 
                  placeholder="숫자 4자리 이상"
                  className="w-full p-4 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg tracking-widest text-center"
                />
              </div>
            </>
          ) : (
            <div>
              <div className="mb-6 text-center">
                <h2 className="text-sm font-bold text-gray-700">{data.settings.userName}님, 환영합니다.</h2>
                <p className="text-xs text-gray-500 mt-1">계속하려면 PIN 번호를 입력하세요.</p>
              </div>
              <input 
                type="password" 
                inputMode="numeric"
                value={pin} 
                onChange={e => setPin(e.target.value.replace(/[^0-9]/g, ''))} 
                placeholder="PIN 입력"
                className="w-full p-4 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg tracking-widest text-center"
                autoFocus
              />
            </div>
          )}

          {error && <p className="text-xs text-red-500 text-center font-medium bg-red-50 py-2 rounded">{error}</p>}

          <button 
            type="submit" 
            className="w-full py-4 mt-2 rounded-xl bg-gray-900 text-white text-xs font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors"
          >
            {isSetup ? '시작하기' : '접속하기'}
          </button>
        </form>
      </div>
      <div className="mt-8 text-[10px] text-gray-400 font-mono tracking-widest uppercase">
        {APP_VERSION}
      </div>
    </div>
  );
}
