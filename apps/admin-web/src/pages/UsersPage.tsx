import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import { useAuthStore } from '../stores/auth';

interface User {
  id: string;
  username: string;
  role: 'SUPER_ADMIN' | 'OPERATOR' | 'AUDITOR';
  isActive: boolean;
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: '최고 관리자',
  OPERATOR: '운영자',
  AUDITOR: '감사자',
};

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  OPERATOR: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  AUDITOR: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
};

export default function UsersPage() {
  const { addToast } = useToast();
  const currentUser = useAuthStore((s) => s.user);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<{
    username: string;
    password: string;
    role: 'SUPER_ADMIN' | 'OPERATOR' | 'AUDITOR';
  }>({
    username: '',
    password: '',
    role: 'OPERATOR',
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    const result = await api.getUsers();
    if (result.ok && result.data) {
      setUsers(result.data.items);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingUser) {
      const updateData: any = { role: formData.role };
      if (formData.username !== editingUser.username) {
        updateData.username = formData.username;
      }
      if (formData.password) {
        updateData.password = formData.password;
      }

      const result = await api.updateUser(editingUser.id, updateData);
      if (result.ok) {
        addToast({ type: 'success', title: '수정 완료', message: '사용자가 수정되었습니다.' });
        setShowModal(false);
        loadUsers();
      } else {
        addToast({ type: 'error', title: '수정 실패', message: result.error?.message || '오류가 발생했습니다.' });
      }
    } else {
      const result = await api.createUser({
        username: formData.username,
        password: formData.password,
        role: formData.role,
      });
      if (result.ok) {
        addToast({ type: 'success', title: '생성 완료', message: '사용자가 생성되었습니다.' });
        setShowModal(false);
        loadUsers();
      } else {
        addToast({ type: 'error', title: '생성 실패', message: result.error?.message || '오류가 발생했습니다.' });
      }
    }
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`정말 "${user.username}" 사용자를 삭제하시겠습니까?`)) return;

    const result = await api.deleteUser(user.id);
    if (result.ok) {
      addToast({ type: 'success', title: '삭제 완료', message: '사용자가 삭제되었습니다.' });
      loadUsers();
    } else {
      addToast({ type: 'error', title: '삭제 실패', message: result.error?.message || '오류가 발생했습니다.' });
    }
  };

  const handleToggleActive = async (user: User) => {
    const result = await api.updateUser(user.id, { isActive: !user.isActive });
    if (result.ok) {
      addToast({
        type: 'success',
        title: user.isActive ? '비활성화' : '활성화',
        message: `사용자가 ${user.isActive ? '비활성화' : '활성화'}되었습니다.`,
      });
      loadUsers();
    }
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({ username: '', password: '', role: 'OPERATOR' });
    setShowModal(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({ username: user.username, password: '', role: user.role });
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
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">사용자 관리</h2>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          + 사용자 추가
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="text-center py-8 dark:text-gray-300">로딩 중...</div>
        ) : users.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">사용자가 없습니다</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr className="text-left text-sm text-gray-600 dark:text-gray-300">
                <th className="px-6 py-3">사용자명</th>
                <th className="px-6 py-3">역할</th>
                <th className="px-6 py-3">상태</th>
                <th className="px-6 py-3">생성일</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="dark:text-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4">
                    <span className="font-medium">{user.username}</span>
                    {user.id === currentUser?.id && (
                      <span className="ml-2 text-xs text-primary-600">(나)</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${ROLE_COLORS[user.role]}`}>
                      {ROLE_LABELS[user.role]}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggleActive(user)}
                      disabled={user.id === currentUser?.id}
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        user.isActive
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      } ${user.id === currentUser?.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'}`}
                    >
                      {user.isActive ? '활성' : '비활성'}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {new Date(user.createdAt).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button
                      onClick={() => openEditModal(user)}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 text-sm"
                    >
                      수정
                    </button>
                    {user.id !== currentUser?.id && (
                      <button
                        onClick={() => handleDelete(user)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 text-sm"
                      >
                        삭제
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" role="dialog" aria-modal="true">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4 dark:text-white">
              {editingUser ? '사용자 수정' : '사용자 추가'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  사용자명
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                  minLength={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  비밀번호 {editingUser && '(변경시에만 입력)'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required={!editingUser}
                  minLength={4}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  역할
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="OPERATOR">운영자</option>
                  <option value="AUDITOR">감사자</option>
                  <option value="SUPER_ADMIN">최고 관리자</option>
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
                  {editingUser ? '수정' : '추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
