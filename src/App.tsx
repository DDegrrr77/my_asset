/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { DataProvider, useData } from './store/DataContext';
import { LayoutDashboard, PlusCircle, Wallet, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import DashboardView from './components/DashboardView';
import InputView from './components/InputView';
import AccountsView from './components/AccountsView';
import SettingsView from './components/SettingsView';
import AuthView from './components/AuthView';
import HelpGuide from './components/HelpGuide';

function AppContent() {
  const { data } = useData();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showHeader, setShowHeader] = useState(true);
  const [showNav, setShowNav] = useState(true);
  const [lastScrollTop, setLastScrollTop] = useState(0);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
            <p className="text-[9px] md:text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Asset Manager</p>
            <h1 className="text-xl md:text-2xl font-black text-gray-900 tracking-tighter flex items-center">
              {data.settings.userName ? `${data.settings.userName}님의 자산` : 'Snow Ball'}
            </h1>
          </div>
        </div>
        
        <button 
          onClick={() => setIsHelpModalOpen(true)}
          className="bg-white border border-gray-200 text-gray-500 hover:text-gray-900 rounded-full p-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          title="사용 방법 안내"
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </button>
      </motion.header>

      {isHelpModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
              <h3 className="font-black text-gray-900 text-sm uppercase tracking-tight">사용 방법 안내</h3>
              <button onClick={() => setIsHelpModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-900 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <HelpGuide />
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

