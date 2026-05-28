import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 금액 및 비율 포맷팅 유틸
export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('ko-KR').format(Math.round(value)) + '원';
};

export const formatKoreanCurrency = (value: number) => {
  if (value === undefined || value === null || isNaN(value)) return '0원';
  const absValue = Math.abs(value);
  if (absValue >= 100000000) {
    const eok = Math.floor(absValue / 100000000);
    const man = Math.round((absValue % 100000000) / 10000);
    if (man === 0) return `${value < 0 ? '-' : ''}${eok}억 원`;
    return `${value < 0 ? '-' : ''}${eok}억 ${man.toLocaleString('ko-KR')}만 원`;
  }
  if (absValue >= 10000) {
    const man = Math.round(absValue / 10000);
    return `${value < 0 ? '-' : ''}${man.toLocaleString('ko-KR')}만 원`;
  }
  return new Intl.NumberFormat('ko-KR').format(Math.round(value)) + '원';
};

export const formatCompactCurrency = (value: number) => {
  if (value === undefined || value === null || isNaN(value)) return '0';
  const absValue = Math.abs(value);
  if (absValue >= 100000000) {
    const eok = Math.floor(absValue / 100000000);
    const man = Math.round((absValue % 100000000) / 10000);
    if (man === 0) return `${value < 0 ? '-' : ''}${eok}억`;
    // For smaller axis, just showing major unit is better or 1.2억
    return `${value < 0 ? '-' : ''}${eok}.${Math.floor(man/1000)}억`;
  }
  if (absValue >= 10000) {
    const man = Math.round(absValue / 10000);
    return `${value < 0 ? '-' : ''}${man.toLocaleString('ko-KR')}만`;
  }
  return new Intl.NumberFormat('ko-KR').format(Math.round(value));
};

export const formatPercent = (value: number) => {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
};

// 한국 금융권 색상 로직 (수익: 빨강, 손실: 파랑)
export const getProfitColorClass = (value: number) => {
  if (value > 0) return 'text-red-500';
  if (value < 0) return 'text-blue-600';
  return 'text-gray-500';
};
