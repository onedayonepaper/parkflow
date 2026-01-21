import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import { useAuthStore } from '../stores/auth';

interface Site {
  id: string;
  name: string;
  address: string | null;
  timezone: string;
  isActive: boolean;
  createdAt: string;
}

export default function SitesPage() {
  const { addToast } = useToast();
  const currentUser = useAuthStore((s) => s.user);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    timezone: 'Asia/Seoul',
  });

  useEffect(() => {
    loadSites();
  }, []);

  const loadSites = async () => {
    setLoading(true);
    const result = await api.getSites();
    if (result.ok && result.data) {
      setSites(result.data.items);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingSite) {
      const result = await api.updateSite(editingSite.id, {
        name: formData.name,
        address: formData.address || null,
        timezone: formData.timezone,
      });
      if (result.ok) {
        addToast({ type: 'success', title: '수정 완료', message: '주차장이 수정되었습니다.' });
        setShowModal(false);
        loadSites();
      } else {
        addToast({ type: 'error', title: '수정 실패', message: result.error?.message || '오류가 발생했습니다.' });
      }
    } else {
      const result = await api.createSite({
        name: formData.name,
        timezone: formData.timezone,
      });
      if (result.ok) {
        addToast({ type: 'success', title: '생성 완료', message: '주차장이 생성되었습니다.' });
        setShowModal(false);
        loadSites();
      } else {
        addToast({ type: 'error', title: '생성 실패', message: result.error?.message || '오류가 발생했습니다.' });
      }
    }
  };

  const handleDelete = async (site: Site) => {
    if (!confirm(`정말 "${site.name}" 주차장을 삭제하시겠습니까?\n관련된 모든 데이터가 함께 삭제됩니다.`)) return;

    const result = await api.deleteSite(site.id);
    if (result.ok) {
      addToast({ type: 'success', title: '삭제 완료', message: '주차장이 삭제되었습니다.' });
      loadSites();
    } else {
      addToast({ type: 'error', title: '삭제 실패', message: result.error?.message || '오류가 발생했습니다.' });
    }
  };

  const openCreateModal = () => {
    setEditingSite(null);
    setFormData({ name: '', address: '', timezone: 'Asia/Seoul' });
    setShowModal(true);
  };

  const openEditModal = (site: Site) => {
    setEditingSite(site);
    setFormData({
      name: site.name,
      address: site.address || '',
      timezone: site.timezone,
    });
    setShowModal(true);
  };

  if (currentUser?.role !== 'SUPER_ADMIN') {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 text-lg">권한이 없습니다.</p>
        <p className="text-gray-500 dark:text-gray-400 mt-2">최고 관리자만 접근할 수 있습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">주차장 관리</h2>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          + 주차장 추가
        </button>
      </div>

      {/* 주차장 카드 목록 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-8 dark:text-gray-300">로딩 중...</div>
        ) : sites.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-500 dark:text-gray-400">
            등록된 주차장이 없습니다
          </div>
        ) : (
          sites.map((site) => (
            <div
              key={site.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold dark:text-white">{site.name}</h3>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      site.isActive
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                    }`}
                  >
                    {site.isActive ? '운영중' : '중지'}
                  </span>
                </div>
                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-2">
                    <span>📍</span>
                    <span>{site.address || '주소 미등록'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>🕐</span>
                    <span>{site.timezone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>📅</span>
                    <span>등록일: {new Date(site.createdAt).toLocaleDateString('ko-KR')}</span>
                  </div>
                </div>
              </div>
              <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700 border-t dark:border-gray-600 flex justify-end gap-2">
                <button
                  onClick={() => openEditModal(site)}
                  className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
                >
                  수정
                </button>
                <button
                  onClick={() => handleDelete(site)}
                  className="px-3 py-1.5 text-sm text-red-600 hover:text-red-800 dark:text-red-400"
                >
                  삭제
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4 dark:text-white">
              {editingSite ? '주차장 수정' : '주차장 추가'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  주차장 이름 *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                  placeholder="OO주차장"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  주소
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="서울시 강남구 ..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  시간대 *
                </label>
                <select
                  value={formData.timezone}
                  onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="Asia/Seoul">Asia/Seoul (KST, UTC+9)</option>
                  <option value="Asia/Tokyo">Asia/Tokyo (JST, UTC+9)</option>
                  <option value="Asia/Shanghai">Asia/Shanghai (CST, UTC+8)</option>
                  <option value="America/New_York">America/New_York (EST, UTC-5)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (PST, UTC-8)</option>
                  <option value="Europe/London">Europe/London (GMT, UTC+0)</option>
                </select>
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
                  {editingSite ? '수정' : '추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
