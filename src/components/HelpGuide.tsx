import React from 'react';

export default function HelpGuide() {
  return (
    <div className="space-y-6 text-left">
      <div className="flex gap-4 items-start">
        <div className="bg-purple-100 text-purple-600 p-3 rounded-xl shrink-0">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
        </div>
        <div>
          <h3 className="font-bold text-gray-900 mb-1">대시보드</h3>
          <p className="text-xs text-gray-500 leading-relaxed">데이터가 쌓이면 이 화면에서 자산 평가액 추이(라인 차트), 원금 및 배당금 현황(바 차트), 그리고 각 계좌별/종목별 비중(도넛 차트)을 월별로 한눈에 파악할 수 있게 됩니다.</p>
        </div>
      </div>

      <div className="flex gap-4 items-start">
        <div className="bg-yellow-100 text-yellow-600 p-3 rounded-xl shrink-0">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <div>
          <h3 className="font-bold text-gray-900 mb-1">기록하기</h3>
          <p className="text-xs text-gray-500 leading-relaxed">자산 평가액을 매월 기록하는 곳입니다. 각 계정의 <span className="font-semibold text-gray-700 bg-gray-100 px-1 py-0.5 rounded">종목 추가</span>, 관리 및 수정이 가능합니다. <span className="font-semibold text-gray-700 bg-gray-100 px-1 py-0.5 rounded">현재가 입력</span> 버튼으로 모든 종목의 평가액과 배당금을 일괄 업데이트할 수 있습니다.</p>
        </div>
      </div>

      <div className="flex gap-4 items-start">
        <div className="bg-blue-100 text-blue-600 p-3 rounded-xl shrink-0">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
        </div>
        <div>
          <h3 className="font-bold text-gray-900 mb-1">계좌 & 절세</h3>
          <p className="text-xs text-gray-500 leading-relaxed">자산 포트폴리오의 목표 달성율을 확인하고, ISA, 연금저축펀드, IRP 등 계좌별 절세 한도와 투자 현황을 손쉽게 관리할 수 있습니다.</p>
        </div>
      </div>

      <div className="flex gap-4 items-start">
        <div className="bg-green-100 text-green-600 p-3 rounded-xl shrink-0">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
        </div>
        <div>
          <h3 className="font-bold text-gray-900 mb-1">설정</h3>
          <p className="text-xs text-gray-500 leading-relaxed">이름 변경 및 PIN 번호(앱 잠금) 설정, 자산 데이터의 백업 파일 저장 및 복원, 엑셀 템플릿 파일 다운로드와 업로드 기능을 지원합니다.</p>
        </div>
      </div>
    </div>
  );
}
