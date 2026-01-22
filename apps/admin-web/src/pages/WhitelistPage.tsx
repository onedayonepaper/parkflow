import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';

interface WhitelistItem {
  id: string;
  plateNo: string;
  name: string | null;
  reason: string | null;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function WhitelistPage() {
  const { addToast } = useToast();
  const [items, setItems] = useState<WhitelistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<WhitelistItem | null>(null);
  const [checkPlate, setCheckPlate] = useState('');
  const [checkResult, setCheckResult] = useState<{ isWhitelisted: boolean; entry?: WhitelistItem } | null>(null);
  const [formData, setFormData] = useState({
    plateNo: '',
    name: '',
    reason: '',
  });

  useEffect(() => {
    loadWhitelist();
  }, []);

  const loadWhitelist = async () => {
    setLoading(true);
    const result = await api.getWhitelist();
    if (result.ok && result.data) {
      setItems(result.data.items);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingItem) {
      const result = await api.updateWhitelist(editingItem.id, {
        plateNo: formData.plateNo,
        name: formData.name || undefined,
        reason: formData.reason || undefined,
      });
      if (result.ok) {
        addToast({ type: 'success', title: '수정 완료', message: 'VIP 차량이 수정되었습니다.' });
        setShowModal(false);
        loadWhitelist();
      } else {
        addToast({ type: 'error', title: '수정 실패', message: result.error?.message || '오류가 발생했습니다.' });
      }
    } else {
      const result = await api.createWhitelist({
        plateNo: formData.plateNo,
        name: formData.name || undefined,
        reason: formData.reason || undefined,
      });
      if (result.ok) {
        addToast({ type: 'success', title: '등록 완료', message: 'VIP 차량이 등록되었습니다.' });
        setShowModal(false);
        loadWhitelist();
      } else {
        addToast({ type: 'error', title: '등록 실패', message: result.error?.message || '오류가 발생했습니다.' });
      }
    }
  };

  const handleDelete = async (item: WhitelistItem) => {
    if (!confirm(`정말 "${item.plateNo}" 차량을 VIP 목록에서 삭제하시겠습니까?`)) return;

    const result = await api.deleteWhitelist(item.id);
    if (result.ok) {
      addToast({ type: 'success', title: '삭제 완료', message: 'VIP 목록에서 삭제되었습니다.' });
      loadWhitelist();
    } else {
      addToast({ type: 'error', title: '삭제 실패', message: result.error?.message || '오류가 발생했습니다.' });
    }
  };

  const handleToggleActive = async (item: WhitelistItem) => {
    const result = await api.updateWhitelist(item.id, { isActive: !item.isActive });
    if (result.ok) {
      addToast({
        type: 'success',
        title: item.isActive ? '비활성화됨' : '활성화됨',
        message: `${item.plateNo} 차량이 ${item.isActive ? '비활성화' : '활성화'}되었습니다.`,
      });
      loadWhitelist();
    }
  };

  const handleCheck = async () => {
    if (!checkPlate.trim()) {
      addToast({ type: 'warning', title: '입력 필요', message: '차량번호를 입력해주세요.' });
      return;
    }
    const result = await api.checkWhitelist(checkPlate.trim());
    if (result.ok && result.data) {
      setCheckResult(result.data);
    }
  };

  const openCreateModal = () => {
    setEditingItem(null);
    setFormData({ plateNo: '', name: '', reason: '' });
    setShowModal(true);
  };

  const openEditModal = (item: WhitelistItem) => {
    setEditingItem(item);
    setFormData({
      plateNo: item.plateNo,
      name: item.name || '',
      reason: item.reason || '',
    });
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">VIP 자동출차</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            등록된 차량은 요금 없이 자동으로 출차됩니다
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          + VIP 등록
        </button>
      </div>

      {/* VIP 조회 */}
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
            placeholder="차량번호 입력 (예: 216고1234)"
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
            checkResult.isWhitelisted
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
          }`}>
            {checkResult.isWhitelisted ? (
              <>
                <span className="font-medium">VIP 등록 차량</span>
                {checkResult.entry?.name && (
                  <p className="text-sm mt-1">이름: {checkResult.entry.name}</p>
                )}
                {checkResult.entry?.reason && (
                  <p className="text-sm">사유: {checkResult.entry.reason}</p>
                )}
              </>
            ) : (
              <span className="font-medium">VIP 미등록 차량</span>
            )}
          </div>
        )}
      </div>

      {/* VIP 목록 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="text-center py-8 dark:text-gray-300">로딩 중...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p className="text-4xl mb-2">👑</p>
            <p>등록된 VIP 차량이 없습니다</p>
            <p className="text-sm mt-1">VIP 차량을 등록하면 자동으로 무료 출차됩니다</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr className="text-left text-sm text-gray-600 dark:text-gray-300">
                <th className="px-6 py-3">차량번호</th>
                <th className="px-6 py-3">이름/설명</th>
                <th className="px-6 py-3">등록 사유</th>
                <th className="px-6 py-3">상태</th>
                <th className="px-6 py-3">등록일</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="dark:text-gray-200">
              {items.map((item) => (
                <tr key={item.id} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 font-mono font-medium">
                    <span className="mr-2">👑</span>
                    {item.plateNo}
                  </td>
                  <td className="px-6 py-4">{item.name || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {item.reason || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggleActive(item)}
                      className={`px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                        item.isActive
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-200'
                      }`}
                    >
                      {item.isActive ? '활성' : '비활성'}
                    </button>
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

      {/* 안내 */}
      <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4">
        <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">VIP 자동출차 안내</h4>
        <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
          <li>• VIP 등록 차량은 입차/출차 시 차단기가 자동으로 열립니다</li>
          <li>• 주차 요금이 부과되지 않고 무료로 출차됩니다</li>
          <li>• 정기권과 별개로 관리되며, 기간 제한이 없습니다</li>
          <li>• 상태를 '비활성'으로 변경하면 일시적으로 VIP 혜택이 중지됩니다</li>
        </ul>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" role="dialog" aria-modal="true">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4 dark:text-white">
              {editingItem ? 'VIP 차량 수정' : 'VIP 차량 등록'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  차량번호 *
                </label>
                <input
                  type="text"
                  value={formData.plateNo}
                  onChange={(e) => setFormData({ ...formData, plateNo: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                  placeholder="216고1234"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  이름/설명 (선택)
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="예: 대표이사, 건물주 등"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  등록 사유 (선택)
                </label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  rows={2}
                  placeholder="VIP 등록 사유를 입력하세요"
                />
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
