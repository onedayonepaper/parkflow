/** API 응답 공통 형식 */
export interface ApiResponse<T = unknown> {
  ok: boolean;
  data: T | null;
  error: ApiError | null;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/** 페이지네이션 */
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** 기간 필터 */
export interface DateRangeFilter {
  from?: string; // ISO 8601
  to?: string;   // ISO 8601
}

/** 정렬 */
export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
