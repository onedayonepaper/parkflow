import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';

interface Membership {
  id: string;
  plateNo: string;
  memberName?: string;
  validFrom: string;
  validTo: string;
}

export default function MembershipsPage() {
  const { addToast } = useToast();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    plateNo: '',
    memberName: '',
    validFrom: '',
    validTo: '',
  });

  useEffect(() => {
    loadMemberships();
  }, []);

  const loadMemberships = async () => {
    setLoading(true);
    const result = await api.getMemberships();
    if (result.ok && result.data) {
      setMemberships(result.data.items);
    }
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await api.createMembership({
      plateNo: form.plateNo,
      memberName: form.memberName || undefined,
      validFrom: new Date(form.validFrom).toISOString(),
      validTo: new Date(form.validTo).toISOString(),
    });
    if (result.ok) {
      addToast({ type: 'success', title: '등록 완료', message: '정기권이 등록되었습니다.' });
      setShowForm(false);
      setForm({ plateNo: '', memberName: '', validFrom: '', validTo: '' });
      loadMemberships();
    } else {
      addToast({ type: 'error', title: '등록 실패', message: result.error?.message || '등록에 실패했습니다.' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    const result = await api.deleteMembership(id);
    if (result.ok) {
      addToast({ type: 'success', title: '삭제 완료', message: '정기권이 삭제되었습니다.' });
      loadMemberships();
    } else {
      addToast({ type: 'error', title: '삭제 실패', message: result.error?.message || '삭제에 실패했습니다.' });
    }
  };

  const handleExport = () => {
    const headers = ['차량번호', '회원명', '시작일', '종료일', '상태'];
    const rows = memberships.map(m => [
      m.plateNo,
      m.memberName || '-',
      formatDate(m.validFrom),
      formatDate(m.validTo),
      isExpired(m.validTo) ? '만료' : '유효',
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `memberships_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();

    addToast({ type: 'success', title: '내보내기 완료', message: 'CSV 파일이 다운로드됩니다.' });
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('ko-KR');
  };

  const isExpired = (validTo: string) => {
    return new Date(validTo) < new Date();
  };

  if (loading) {
    return <div className="text-center py-8 dark:text-gray-300">로딩 중...</div>;
  }

  const activeCount = memberships.filter(m => !isExpired(m.validTo)).length;
  const expiredCount = memberships.filter(m => isExpired(m.validTo)).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">정기권 관리</h2>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
          >
            📥 내보내기
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
          >
            + 정기권 등록
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">전체</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{memberships.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">유효</p>
          <p className="text-2xl font-bold text-green-600">{activeCount}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">만료</p>
          <p className="text-2xl font-bold text-red-600">{expiredCount}</p>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4 dark:text-white">정기권 등록</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">차량번호 *</label>
                <input
                  type="text"
                  value={form.plateNo}
                  onChange={(e) => setForm((f) => ({ ...f, plateNo: e.target.value }))}
                  placeholder="12가3456"
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">회원명</label>
                <input
                  type="text"
                  value={form.memberName}
                  onChange={(e) => setForm((f) => ({ ...f, memberName: e.target.value }))}
                  placeholder="홍길동"
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">시작일 *</label>
                <input
                  type="date"
                  value={form.validFrom}
                  onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">종료일 *</label>
                <input
                  type="date"
                  value={form.validTo}
                  onChange={(e) => setForm((f) => ({ ...f, validTo: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                등록
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                취소
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {memberships.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">등록된 정기권이 없습니다</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr className="text-left text-sm text-gray-600 dark:text-gray-300">
                  <th className="px-4 py-3">차량번호</th>
                  <th className="px-4 py-3">회원명</th>
                  <th className="px-4 py-3">시작일</th>
                  <th className="px-4 py-3">종료일</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="dark:text-gray-200">
                {memberships.map((m) => (
                  <tr key={m.id} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 font-mono">{m.plateNo}</td>
                    <td className="px-4 py-3">{m.memberName || '-'}</td>
                    <td className="px-4 py-3 text-sm">{formatDate(m.validFrom)}</td>
                    <td className="px-4 py-3 text-sm">{formatDate(m.validTo)}</td>
                    <td className="px-4 py-3">
                      {isExpired(m.validTo) ? (
                        <span className="px-2 py-1 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded text-xs">만료</span>
                      ) : (
                        <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded text-xs">유효</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(m.id)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 text-sm"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
