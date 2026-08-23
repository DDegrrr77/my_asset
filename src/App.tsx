/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { DataProvider, useData } from './store/DataContext';
import { LayoutDashboard, PlusCircle, Wallet, Settings, User, LogOut, Key } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import DashboardView from './components/DashboardView';
import InputView from './components/InputView';
import AccountsView from './components/AccountsView';
import SettingsView from './components/SettingsView';
import AuthView from './components/AuthView';
import HelpGuide from './components/HelpGuide';

function AppContent() {
  const { data, storageSource, updateSettings } = useData();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showHeader, setShowHeader] = useState(true);
  const [showNav, setShowNav] = useState(true);
  const [lastScrollTop, setLastScrollTop] = useState(0);
  
  // Profile settings & guide modal states
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'profile' | 'guide'>('profile');
  const [userNameInput, setUserNameInput] = useState(data.settings.userName || '');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUserNameInput(data.settings.userName || '');
  }, [data.settings.userName]);

  const handleProfileSave = () => {
    let finalPin = data.settings.pin;
    
    if (newPin) {
      if (currentPin !== data.settings.pin) {
        setPinError('현재 PIN 번호가 일치하지 않습니다.');
        setSuccessMessage('');
        return;
      }
      if (newPin.length < 4) {
        setPinError('새 PIN 번호는 4자리 이상이어야 합니다.');
        setSuccessMessage('');
        return;
      }
      finalPin = newPin;
    }

    updateSettings({ ...data.settings, userName: userNameInput.trim(), pin: finalPin });
    setPinError('');
    setSuccessMessage('성공적으로 저장되었습니다!');
    setCurrentPin('');
    setNewPin('');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleLogout = () => {
    if (window.confirm('보안을 위해 로그아웃하시겠습니까? 다시 진입하려면 PIN 입력이 필요합니다.')) {
      sessionStorage.removeItem('is_authenticated');
      window.location.reload();
    }
  };

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const currentScrollTop = scrollRef.current.scrollTop;
    
    // Threshold to prevent flickering
    if (Math.abs(currentScrollTop - lastScrollTop) < 10) return;

    if (currentScrollTop > lastScrollTop) {
      // Scrolling DOWN
      setShowHeader(false);
      setShowNav(true);
    } else {
      // Scrolling UP
      setShowHeader(true);
      setShowNav(false);
    }
    
    // Always show both if near edges
    if (currentScrollTop < 50) {
      setShowHeader(true);
      setShowNav(true);
    }
    
    setLastScrollTop(currentScrollTop);
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-gray-50 text-gray-900 relative overflow-hidden">
      <motion.header 
        initial={{ y: 0 }}
        animate={{ y: showHeader ? 0 : -100 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 px-4 py-3 md:px-8 md:py-4 flex justify-between items-center z-50 shadow-sm"
      >
        <div className="flex items-center gap-3 md:gap-4">
          <img src="/icon.svg?v=6" alt="Snow Ball Logo" className="w-10 h-10 md:w-12 md:h-12 rounded-2xl shadow-sm object-cover" />
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-1.5 mb-0.5">
              <p className="text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-wider">Asset Manager</p>
              <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border scale-90 origin-left flex items-center gap-1 ${
                storageSource === 'Gist' 
                  ? 'bg-green-50/70 text-green-700 border-green-200/50' 
                  : 'bg-orange-50/70 text-orange-700 border-orange-200/50'
              }`}>
                <span className={`w-1 h-1 rounded-full ${storageSource === 'Gist' ? 'bg-green-500 animate-pulse' : 'bg-orange-400'}`} />
                {storageSource === 'Gist' ? 'Gist Cloud' : 'Local Only'}
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-black text-gray-900 tracking-tighter flex items-center">
              {data.settings.userName ? `${data.settings.userName}님의 자산` : 'Snow Ball'}
            </h1>
          </div>
        </div>
        
        <button 
          onClick={() => setIsProfileModalOpen(true)}
          className="bg-white border border-gray-200 text-gray-500 hover:text-gray-900 rounded-full p-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors flex items-center justify-center"
          title="사용자 정보 및 설정"
        >
          <User className="w-5 h-5 flex-shrink-0" />
        </button>
      </motion.header>

      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                  <User size={18} strokeWidth={2.5} />
                </div>
                <div className="flex flex-col">
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-0.5">My Account</p>
                  <h3 className="font-black text-gray-900 text-sm tracking-tight leading-none">사용자 정보 및 설정</h3>
                </div>
              </div>
              <button 
                onClick={() => { setIsProfileModalOpen(false); setPinError(''); setSuccessMessage(''); setCurrentPin(''); setNewPin(''); }} 
                className="p-2 text-gray-400 hover:text-gray-900 rounded-full hover:bg-gray-100 transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-gray-100 px-6 shrink-0 bg-white gap-4">
              <button 
                onClick={() => setModalTab('profile')}
                className={`py-3.5 font-black text-[12px] tracking-wider uppercase border-b-2 transition-all ${modalTab === 'profile' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
              >
                개인 정보 및 보안
              </button>
              <button 
                onClick={() => setModalTab('guide')}
                className={`py-3.5 font-black text-[12px] tracking-wider uppercase border-b-2 transition-all ${modalTab === 'guide' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
              >
                사용 안내서
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {modalTab === 'profile' ? (
                <div className="space-y-6">
                  {/* Edit Name Section */}
                  <div className="space-y-2">
                    <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest">사용자 이름</label>
                    <input 
                      type="text" 
                      value={userNameInput} 
                      onChange={e => setUserNameInput(e.target.value)} 
                      placeholder="이름을 입력해 주세요" 
                      className="w-full bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white rounded-xl px-4 py-3 text-sm font-bold text-gray-800 outline-none transition-all"
                    />
                  </div>

                  {/* Change PIN Section */}
                  <div className="p-4 bg-gray-50/50 rounded-2xl border border-gray-100 space-y-4">
                    <div className="flex items-center gap-1.5 text-blue-600">
                      <Key size={14} strokeWidth={2.5} />
                      <span className="text-[11px] font-black uppercase tracking-wider">PIN 비밀번호 변경 (선택)</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-gray-400">현재 PIN 번호</label>
                        <input 
                          type="password" 
                          maxLength={4}
                          pattern="[0-9]*"
                          inputMode="numeric"
                          value={currentPin} 
                          onChange={e => setCurrentPin(e.target.value.replace(/[^0-9]/g, ''))} 
                          placeholder="현재 4자리 PIN" 
                          className="w-full bg-white border border-gray-200 focus:border-blue-500 rounded-xl px-3 py-2.5 text-xs font-mono font-bold outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-gray-400">새 PIN 번호</label>
                        <input 
                          type="password" 
                          maxLength={4}
                          pattern="[0-9]*"
                          inputMode="numeric"
                          value={newPin} 
                          onChange={e => setNewPin(e.target.value.replace(/[^0-9]/g, ''))} 
                          placeholder="새 4자리 PIN" 
                          className="w-full bg-white border border-gray-200 focus:border-blue-500 rounded-xl px-3 py-2.5 text-xs font-mono font-bold outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Message displays */}
                  {pinError && (
                    <p className="text-xs font-bold text-red-500 flex items-center gap-1 bg-red-50 px-3 py-2.5 rounded-xl border border-red-100">⚠️ {pinError}</p>
                  )}
                  {successMessage && (
                    <p className="text-xs font-bold text-green-600 flex items-center gap-1 bg-green-50 px-3 py-2.5 rounded-xl border border-green-100">✓ {successMessage}</p>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button 
                      onClick={handleProfileSave}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white py-3.5 rounded-2xl text-xs font-black tracking-wider transition-all shadow-md shadow-blue-600/10"
                    >
                      정보 저장하기
                    </button>
                    
                    <button 
                      onClick={handleLogout}
                      className="px-5 bg-red-50 hover:bg-red-100 active:scale-[0.98] text-red-600 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 transition-all border border-red-100"
                      title="안전 로그아웃"
                    >
                      <LogOut size={14} strokeWidth={2.5} />
                      로그아웃
                    </button>
                  </div>
                </div>
              ) : (
                <HelpGuide />
              )}
            </div>
          </div>
        </div>
      )}

      <main 
        ref={scrollRef} 
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto w-full relative pt-[72px] md:pt-[100px] pb-[80px] md:pb-[100px]"
      >
        <div className="p-4 md:p-8 max-w-[1024px] mx-auto pb-8">
          {activeTab === 'dashboard' && <DashboardView />}
          {activeTab === 'input' && <InputView />}
          {activeTab === 'accounts' && <AccountsView />}
          {activeTab === 'settings' && <SettingsView />}
        </div>
      </main>

      <motion.nav 
        initial={{ y: 0 }}
        animate={{ y: showNav ? 0 : 100 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 w-full z-50 pb-safe shadow-[0_-4px_12px_rgba(0,0,0,0.05)]"
      >
        <div className="flex justify-around items-center h-16 md:h-20 max-w-[1024px] mx-auto px-4">
          <button 
            onClick={() => setActiveTab('dashboard')} 
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${activeTab === 'dashboard' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <LayoutDashboard size={24} strokeWidth={1.5} />
            <span className="text-[10px] font-bold mt-1 uppercase tracking-widest">대시보드</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('input')} 
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${activeTab === 'input' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <PlusCircle size={24} strokeWidth={1.5} />
            <span className="text-[10px] font-bold mt-1 uppercase tracking-widest">기록하기</span>
          </button>

          <button 
            onClick={() => setActiveTab('accounts')} 
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${activeTab === 'accounts' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <Wallet size={24} strokeWidth={1.5} />
            <span className="text-[10px] font-bold mt-1 uppercase tracking-widest">계좌&절세</span>
          </button>

          <button 
            onClick={() => setActiveTab('settings')} 
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${activeTab === 'settings' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <Settings size={24} strokeWidth={1.5} />
            <span className="text-[10px] font-bold mt-1 uppercase tracking-widest">설정</span>
          </button>
        </div>
      </motion.nav>
    </div>
  );
}

function MainApp() {
  const { data } = useData();
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('is_authenticated') === 'true';
  });

  const handleAuthenticated = () => {
    setIsAuthenticated(true);
    sessionStorage.setItem('is_authenticated', 'true');
  };

  if (!data.settings?.pin) {
    return <AuthView isSetup={true} onComplete={handleAuthenticated} />;
  }

  if (!isAuthenticated) {
    return <AuthView isSetup={false} onComplete={handleAuthenticated} />;
  }

  return <AppContent />;
}

export default function App() {
  return (
    <DataProvider>
      <MainApp />
    </DataProvider>
  );
}

