import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';

interface BlacklistItem {
  id: string;
  plateNo: string;
  reason: string;
  isActive: boolean;
  blockedUntil: string | null;
  createdAt: string;
}

export default function BlacklistPage() {
  const { addToast } = useToast();
  const [items, setItems] = useState<BlacklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<BlacklistItem | null>(null);
  const [checkPlate, setCheckPlate] = useState('');
  const [checkResult, setCheckResult] = useState<{ isBlacklisted: boolean; reason: string | null } | null>(null);
  const [formData, setFormData] = useState({
    plateNo: '',
    reason: '',
    blockedUntil: '',
  });

  useEffect(() => {
    loadBlacklist();
  }, []);

  const loadBlacklist = async () => {
    setLoading(true);
    const result = await api.getBlacklist();
    if (result.ok && result.data) {
      setItems(result.data.items);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingItem) {
      const result = await api.updateBlacklist(editingItem.id, {
        plateNo: formData.plateNo,
        reason: formData.reason,
        blockedUntil: formData.blockedUntil || null,
      });
      if (result.ok) {
        addToast({ type: 'success', title: '수정 완료', message: '블랙리스트가 수정되었습니다.' });
        setShowModal(false);
        loadBlacklist();
      } else {
        addToast({ type: 'error', title: '수정 실패', message: result.error?.message || '오류가 발생했습니다.' });
      }
    } else {
      const result = await api.createBlacklist({
        plateNo: formData.plateNo,
        reason: formData.reason,
        blockedUntil: formData.blockedUntil || undefined,
      });
      if (result.ok) {
        addToast({ type: 'success', title: '등록 완료', message: '블랙리스트에 등록되었습니다.' });
        setShowModal(false);
        loadBlacklist();
      } else {
        addToast({ type: 'error', title: '등록 실패', message: result.error?.message || '오류가 발생했습니다.' });
      }
    }
  };

  const handleDelete = async (item: BlacklistItem) => {
    if (!confirm(`정말 "${item.plateNo}" 차량을 블랙리스트에서 삭제하시겠습니까?`)) return;

    const result = await api.deleteBlacklist(item.id);
    if (result.ok) {
      addToast({ type: 'success', title: '삭제 완료', message: '블랙리스트에서 삭제되었습니다.' });
      loadBlacklist();
    } else {
      addToast({ type: 'error', title: '삭제 실패', message: result.error?.message || '오류가 발생했습니다.' });
    }
  };

  const handleCheck = async () => {
    if (!checkPlate.trim()) {
      addToast({ type: 'warning', title: '입력 필요', message: '차량번호를 입력해주세요.' });
      return;
    }
    const result = await api.checkBlacklist(checkPlate.trim());
    if (result.ok && result.data) {
      setCheckResult(result.data);
    }
  };

  const openCreateModal = () => {
    setEditingItem(null);
    setFormData({ plateNo: '', reason: '', blockedUntil: '' });
    setShowModal(true);
  };

  const openEditModal = (item: BlacklistItem) => {
    setEditingItem(item);
    setFormData({
      plateNo: item.plateNo,
      reason: item.reason,
      blockedUntil: item.blockedUntil?.split('T')[0] || '',
    });
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">차량 블랙리스트</h2>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          + 블랙리스트 등록
        </button>
      </div>

      {/* 블랙리스트 조회 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold mb-3 dark:text-white">차량번호 조회</h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={checkPlate}
            onChange={(e) => {
              setCheckPlate(e.target.value);
              setCheckResult(null);
            }}
            placeholder="차량번호 입력 (예: 12가3456)"
            className="flex-1 px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
          <button
            onClick={handleCheck}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            조회
          </button>
        </div>
        {checkResult && (
          <div className={`mt-3 p-3 rounded-lg ${
            checkResult.isBlacklisted
              ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
              : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
          }`}>
            {checkResult.isBlacklisted ? (
              <>
                <span className="font-medium">⛔ 블랙리스트 등록 차량</span>
                <p className="text-sm mt-1">사유: {checkResult.reason}</p>
              </>
            ) : (
              <span className="font-medium">✅ 블랙리스트 미등록 차량</span>
            )}
          </div>
        )}
      </div>

      {/* 블랙리스트 목록 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="text-center py-8 dark:text-gray-300">로딩 중...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">등록된 블랙리스트가 없습니다</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr className="text-left text-sm text-gray-600 dark:text-gray-300">
                <th className="px-6 py-3">차량번호</th>
                <th className="px-6 py-3">사유</th>
                <th className="px-6 py-3">차단 기한</th>
                <th className="px-6 py-3">상태</th>
                <th className="px-6 py-3">등록일</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="dark:text-gray-200">
              {items.map((item) => (
                <tr key={item.id} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 font-mono font-medium">{item.plateNo}</td>
                  <td className="px-6 py-4">{item.reason}</td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {item.blockedUntil ? new Date(item.blockedUntil).toLocaleDateString('ko-KR') : '영구'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      item.isActive
                        ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                    }`}>
                      {item.isActive ? '차단중' : '해제됨'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {new Date(item.createdAt).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button
                      onClick={() => openEditModal(item)}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 text-sm"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      className="text-red-600 hover:text-red-800 dark:text-red-400 text-sm"
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4 dark:text-white">
              {editingItem ? '블랙리스트 수정' : '블랙리스트 등록'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  차량번호
                </label>
                <input
                  type="text"
                  value={formData.plateNo}
                  onChange={(e) => setFormData({ ...formData, plateNo: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                  placeholder="12가3456"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  차단 사유
                </label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                  rows={3}
                  placeholder="차단 사유를 입력하세요"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  차단 기한 (선택)
                </label>
                <input
                  type="date"
                  value={formData.blockedUntil}
                  onChange={(e) => setFormData({ ...formData, blockedUntil: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  비워두면 영구 차단됩니다
                </p>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  {editingItem ? '수정' : '등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
