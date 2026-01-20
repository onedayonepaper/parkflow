import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export default function MembershipsPage() {
  const [memberships, setMemberships] = useState<any[]>([]);
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
      setShowForm(false);
      setForm({ plateNo: '', memberName: '', validFrom: '', validTo: '' });
      loadMemberships();
    } else {
      alert(result.error?.message || '등록 실패');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    const result = await api.deleteMembership(id);
    if (result.ok) {
      loadMemberships();
    } else {
      alert(result.error?.message || '삭제 실패');
    }
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('ko-KR');
  };

  const isExpired = (validTo: string) => {
    return new Date(validTo) < new Date();
  };

  if (loading) {
    return <div className="text-center py-8">로딩 중...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">정기권 관리</h2>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          + 정기권 등록
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">정기권 등록</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">차량번호 *</label>
                <input
                  type="text"
                  value={form.plateNo}
                  onChange={(e) => setForm((f) => ({ ...f, plateNo: e.target.value }))}
                  placeholder="12가3456"
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">회원명</label>
                <input
                  type="text"
                  value={form.memberName}
                  onChange={(e) => setForm((f) => ({ ...f, memberName: e.target.value }))}
                  placeholder="홍길동"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">시작일 *</label>
                <input
                  type="date"
                  value={form.validFrom}
                  onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">종료일 *</label>
                <input
                  type="date"
                  value={form.validTo}
                  onChange={(e) => setForm((f) => ({ ...f, validTo: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
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
                className="px-4 py-2 border rounded-lg hover:bg-gray-100"
              >
                취소
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {memberships.length === 0 ? (
          <div className="text-center py-8 text-gray-500">등록된 정기권이 없습니다</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="text-left text-sm text-gray-600">
                <th className="px-4 py-3">차량번호</th>
                <th className="px-4 py-3">회원명</th>
                <th className="px-4 py-3">시작일</th>
                <th className="px-4 py-3">종료일</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {memberships.map((m) => (
                <tr key={m.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono">{m.plateNo}</td>
                  <td className="px-4 py-3">{m.memberName || '-'}</td>
                  <td className="px-4 py-3 text-sm">{formatDate(m.validFrom)}</td>
                  <td className="px-4 py-3 text-sm">{formatDate(m.validTo)}</td>
                  <td className="px-4 py-3">
                    {isExpired(m.validTo) ? (
                      <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">만료</span>
                    ) : (
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">유효</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
