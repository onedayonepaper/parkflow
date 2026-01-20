/**
 * 현재 시간 ISO 문자열 (Asia/Seoul)
 */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * 두 시간 사이의 분 차이 계산
 */
export function diffMinutes(start: string | Date, end: string | Date): number {
  const startDate = typeof start === 'string' ? new Date(start) : start;
  const endDate = typeof end === 'string' ? new Date(end) : end;

  return Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60));
}

/**
 * 분을 시:분 포맷으로 변환
 */
export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) {
    return `${mins}분`;
  }
  return `${hours}시간 ${mins}분`;
}

/**
 * 금액 포맷 (천단위 콤마)
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
  }).format(amount);
}

/**
 * ISO 문자열을 한국 시간으로 포맷
 */
export function formatKoreanDateTime(iso: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(iso));
}

/**
 * 날짜만 포맷 (YYYY-MM-DD)
 */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso)).replace(/\. /g, '-').replace('.', '');
}
