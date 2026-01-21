import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';

interface NotificationTemplate {
  id: string;
  type: 'EMAIL' | 'SMS' | 'PUSH';
  eventType: string;
  subject: string | null;
  bodyTemplate: string;
  isActive: boolean;
  createdAt: string;
}

interface NotificationLog {
  id: string;
  recipient: string;
  type: string;
  subject: string | null;
  body: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  ENTRY: '입차',
  EXIT: '출차',
  PAYMENT: '결제',
  MEMBERSHIP_EXPIRY: '정기권 만료',
  BLACKLIST_ALERT: '블랙리스트 알림',
};

const TYPE_COLORS: Record<string, string> = {
  EMAIL: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  SMS: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  PUSH: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  SENT: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  FAILED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export default function NotificationsPage() {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'templates' | 'logs' | 'send'>('templates');
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);

  // 템플릿 폼
  const [templateForm, setTemplateForm] = useState({
    type: 'EMAIL' as 'EMAIL' | 'SMS' | 'PUSH',
    eventType: 'ENTRY',
    subject: '',
    bodyTemplate: '',
  });

  // 발송 폼
  const [sendForm, setSendForm] = useState({
    type: 'EMAIL' as 'EMAIL' | 'SMS',
    recipient: '',
    subject: '',
    body: '',
  });

  useEffect(() => {
    if (activeTab === 'templates') {
      loadTemplates();
    } else if (activeTab === 'logs') {
      loadLogs();
    }
  }, [activeTab]);

  const loadTemplates = async () => {
    setLoading(true);
    const result = await api.getNotificationTemplates();
    if (result.ok && result.data) {
      setTemplates(result.data.items);
    }
    setLoading(false);
  };

  const loadLogs = async () => {
    setLoading(true);
    const result = await api.getNotificationLogs({ limit: '50' });
    if (result.ok && result.data) {
      setLogs(result.data.items);
    }
    setLoading(false);
  };

  const handleTemplateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingTemplate) {
      const result = await api.updateNotificationTemplate(editingTemplate.id, {
        subject: templateForm.subject || undefined,
        bodyTemplate: templateForm.bodyTemplate,
      });
      if (result.ok) {
        addToast({ type: 'success', title: '수정 완료', message: '템플릿이 수정되었습니다.' });
        setShowModal(false);
        loadTemplates();
      } else {
        addToast({ type: 'error', title: '수정 실패', message: result.error?.message || '오류가 발생했습니다.' });
      }
    } else {
      const result = await api.createNotificationTemplate({
        type: templateForm.type,
        eventType: templateForm.eventType,
        subject: templateForm.subject || undefined,
        bodyTemplate: templateForm.bodyTemplate,
      });
      if (result.ok) {
        addToast({ type: 'success', title: '생성 완료', message: '템플릿이 생성되었습니다.' });
        setShowModal(false);
        loadTemplates();
      } else {
        addToast({ type: 'error', title: '생성 실패', message: result.error?.message || '오류가 발생했습니다.' });
      }
    }
  };

  const handleDeleteTemplate = async (template: NotificationTemplate) => {
    if (!confirm('정말 이 템플릿을 삭제하시겠습니까?')) return;

    const result = await api.deleteNotificationTemplate(template.id);
    if (result.ok) {
      addToast({ type: 'success', title: '삭제 완료', message: '템플릿이 삭제되었습니다.' });
      loadTemplates();
    } else {
      addToast({ type: 'error', title: '삭제 실패', message: result.error?.message || '오류가 발생했습니다.' });
    }
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = await api.sendNotification({
      type: sendForm.type,
      recipient: sendForm.recipient,
      subject: sendForm.subject || undefined,
      body: sendForm.body,
    });
    if (result.ok) {
      addToast({ type: 'success', title: '발송 완료', message: '알림이 발송되었습니다.' });
      setSendForm({ type: 'EMAIL', recipient: '', subject: '', body: '' });
    } else {
      addToast({ type: 'error', title: '발송 실패', message: result.error?.message || '오류가 발생했습니다.' });
    }
  };

  const handleTestNotification = async () => {
    if (!sendForm.recipient) {
      addToast({ type: 'warning', title: '입력 필요', message: '수신자를 입력해주세요.' });
      return;
    }

    const result = await api.testNotification({
      type: sendForm.type,
      recipient: sendForm.recipient,
    });
    if (result.ok) {
      addToast({ type: 'success', title: '테스트 발송', message: '테스트 알림이 발송되었습니다.' });
    } else {
      addToast({ type: 'error', title: '발송 실패', message: result.error?.message || '오류가 발생했습니다.' });
    }
  };

  const openCreateModal = () => {
    setEditingTemplate(null);
    setTemplateForm({ type: 'EMAIL', eventType: 'ENTRY', subject: '', bodyTemplate: '' });
    setShowModal(true);
  };

  const openEditModal = (template: NotificationTemplate) => {
    setEditingTemplate(template);
    setTemplateForm({
      type: template.type,
      eventType: template.eventType,
      subject: template.subject || '',
      bodyTemplate: template.bodyTemplate,
    });
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">알림 관리</h2>
      </div>

      {/* 탭 */}
      <div className="border-b dark:border-gray-700">
        <nav className="flex gap-4">
          {(['templates', 'logs', 'send'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2 px-4 border-b-2 font-medium text-sm ${
                activeTab === tab
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              {tab === 'templates' && '📋 템플릿'}
              {tab === 'logs' && '📜 발송 로그'}
              {tab === 'send' && '📤 직접 발송'}
            </button>
          ))}
        </nav>
      </div>

      {/* 템플릿 탭 */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              + 템플릿 추가
            </button>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            {loading ? (
              <div className="text-center py-8 dark:text-gray-300">로딩 중...</div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">등록된 템플릿이 없습니다</div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr className="text-left text-sm text-gray-600 dark:text-gray-300">
                    <th className="px-6 py-3">타입</th>
                    <th className="px-6 py-3">이벤트</th>
                    <th className="px-6 py-3">제목</th>
                    <th className="px-6 py-3">상태</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="dark:text-gray-200">
                  {templates.map((template) => (
                    <tr key={template.id} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${TYPE_COLORS[template.type]}`}>
                          {template.type}
                        </span>
                      </td>
                      <td className="px-6 py-4">{EVENT_TYPE_LABELS[template.eventType] || template.eventType}</td>
                      <td className="px-6 py-4 text-sm">{template.subject || '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          template.isActive
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                        }`}>
                          {template.isActive ? '활성' : '비활성'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => openEditModal(template)}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 text-sm"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(template)}
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
        </div>
      )}

      {/* 발송 로그 탭 */}
      {activeTab === 'logs' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="text-center py-8 dark:text-gray-300">로딩 중...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">발송 내역이 없습니다</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr className="text-left text-sm text-gray-600 dark:text-gray-300">
                  <th className="px-6 py-3">타입</th>
                  <th className="px-6 py-3">수신자</th>
                  <th className="px-6 py-3">제목</th>
                  <th className="px-6 py-3">상태</th>
                  <th className="px-6 py-3">발송일시</th>
                </tr>
              </thead>
              <tbody className="dark:text-gray-200">
                {logs.map((log) => (
                  <tr key={log.id} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${TYPE_COLORS[log.type] || 'bg-gray-100 text-gray-800'}`}>
                        {log.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">{log.recipient}</td>
                    <td className="px-6 py-4 text-sm">{log.subject || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[log.status]}`}>
                        {log.status === 'SENT' ? '발송완료' : log.status === 'FAILED' ? '실패' : '대기중'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {log.sentAt ? new Date(log.sentAt).toLocaleString('ko-KR') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 직접 발송 탭 */}
      {activeTab === 'send' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 max-w-2xl">
          <form onSubmit={handleSendNotification} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                발송 타입
              </label>
              <div className="flex gap-4">
                {(['EMAIL', 'SMS'] as const).map((type) => (
                  <label key={type} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="type"
                      value={type}
                      checked={sendForm.type === type}
                      onChange={(e) => setSendForm({ ...sendForm, type: e.target.value as any })}
                      className="w-4 h-4 text-primary-600"
                    />
                    <span className="dark:text-gray-300">{type}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                수신자 {sendForm.type === 'EMAIL' ? '(이메일)' : '(전화번호)'}
              </label>
              <input
                type="text"
                value={sendForm.recipient}
                onChange={(e) => setSendForm({ ...sendForm, recipient: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                required
                placeholder={sendForm.type === 'EMAIL' ? 'example@email.com' : '010-1234-5678'}
              />
            </div>
            {sendForm.type === 'EMAIL' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  제목
                </label>
                <input
                  type="text"
                  value={sendForm.subject}
                  onChange={(e) => setSendForm({ ...sendForm, subject: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                  placeholder="알림 제목"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                내용
              </label>
              <textarea
                value={sendForm.body}
                onChange={(e) => setSendForm({ ...sendForm, body: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                required
                rows={5}
                placeholder="알림 내용을 입력하세요"
              />
            </div>
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={handleTestNotification}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white"
              >
                테스트 발송
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                발송하기
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 템플릿 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg p-6">
            <h3 className="text-lg font-semibold mb-4 dark:text-white">
              {editingTemplate ? '템플릿 수정' : '템플릿 추가'}
            </h3>
            <form onSubmit={handleTemplateSubmit} className="space-y-4">
              {!editingTemplate && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      타입
                    </label>
                    <select
                      value={templateForm.type}
                      onChange={(e) => setTemplateForm({ ...templateForm, type: e.target.value as any })}
                      className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                      <option value="EMAIL">이메일</option>
                      <option value="SMS">SMS</option>
                      <option value="PUSH">푸시</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      이벤트 타입
                    </label>
                    <select
                      value={templateForm.eventType}
                      onChange={(e) => setTemplateForm({ ...templateForm, eventType: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                      <option value="ENTRY">입차</option>
                      <option value="EXIT">출차</option>
                      <option value="PAYMENT">결제</option>
                      <option value="MEMBERSHIP_EXPIRY">정기권 만료</option>
                      <option value="BLACKLIST_ALERT">블랙리스트 알림</option>
                    </select>
                  </div>
                </>
              )}
              {(templateForm.type === 'EMAIL' || editingTemplate?.type === 'EMAIL') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    제목
                  </label>
                  <input
                    type="text"
                    value={templateForm.subject}
                    onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    required={templateForm.type === 'EMAIL'}
                    placeholder="[ParkFlow] 알림 제목"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  본문 템플릿
                </label>
                <textarea
                  value={templateForm.bodyTemplate}
                  onChange={(e) => setTemplateForm({ ...templateForm, bodyTemplate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white font-mono text-sm"
                  required
                  rows={5}
                  placeholder="사용 가능 변수: {{plateNo}}, {{amount}}, {{entryAt}}, {{exitAt}}, {{siteName}}"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  변수: {'{{plateNo}}'}, {'{{amount}}'}, {'{{entryAt}}'}, {'{{exitAt}}'}, {'{{siteName}}'}
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
                  {editingTemplate ? '수정' : '추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
