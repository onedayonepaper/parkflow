/**
 * 차량번호 정규화
 * - 공백 제거
 * - 대문자 변환
 * - 특수문자 제거 (한글, 영문, 숫자만 유지)
 */
export function normalizePlateNo(raw: string): string {
  return raw
    .replace(/\s+/g, '')
    .toUpperCase()
    .replace(/[^가-힣A-Z0-9]/g, '');
}

/**
 * 한국 차량번호 패턴 검증
 * - 일반: 12가3456
 * - 신형: 123가4567
 * - 영업용: 서울12가3456
 */
export function isValidKoreanPlate(plate: string): boolean {
  const normalized = normalizePlateNo(plate);

  // 일반 패턴: 2자리숫자 + 한글 + 4자리숫자
  const pattern1 = /^\d{2}[가-힣]\d{4}$/;
  // 신형 패턴: 3자리숫자 + 한글 + 4자리숫자
  const pattern2 = /^\d{3}[가-힣]\d{4}$/;
  // 영업용 패턴: 지역명 + 2자리숫자 + 한글 + 4자리숫자
  const pattern3 = /^[가-힣]{2}\d{2}[가-힣]\d{4}$/;

  return pattern1.test(normalized) || pattern2.test(normalized) || pattern3.test(normalized);
}

/**
 * 랜덤 차량번호 생성 (테스트용)
 */
export function generateRandomPlate(): string {
  const regions = ['서울', '경기', '인천', '부산', '대구', '광주', '대전'];
  const chars = '가나다라마바사아자차카타파하거너더러머버서어저처커터퍼허';

  const num1 = Math.floor(Math.random() * 90 + 10); // 10-99
  const char = chars[Math.floor(Math.random() * chars.length)];
  const num2 = Math.floor(Math.random() * 9000 + 1000); // 1000-9999

  // 30% 확률로 신형 번호판
  if (Math.random() < 0.3) {
    const num3 = Math.floor(Math.random() * 900 + 100); // 100-999
    return `${num3}${char}${num2}`;
  }

  // 10% 확률로 영업용
  if (Math.random() < 0.1) {
    const region = regions[Math.floor(Math.random() * regions.length)];
    return `${region}${num1}${char}${num2}`;
  }

  return `${num1}${char}${num2}`;
}
