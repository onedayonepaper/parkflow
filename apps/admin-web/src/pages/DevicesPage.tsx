import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';

interface Lane {
  id: string;
  name: string;
  direction: 'ENTRY' | 'EXIT';
  createdAt: string;
}

interface Device {
  id: string;
  name: string;
  type: 'LPR' | 'BARRIER' | 'KIOSK';
  status: 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
  laneId: string | null;
  laneName: string | null;
  direction: string | null;
  lastSeenAt: string | null;
  connected: boolean;
}

const DIRECTION_LABELS: Record<string, string> = {
  ENTRY: '입차',
  EXIT: '출차',
};

const DEVICE_TYPE_LABELS: Record<string, string> = {
  LPR: 'LPR 카메라',
  BARRIER: '차단기',
  KIOSK: '키오스크',
};

const STATUS_LABELS: Record<string, string> = {
  ONLINE: '온라인',
  OFFLINE: '오프라인',
  UNKNOWN: '알 수 없음',
};

export default function DevicesPage() {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'devices' | 'lanes'>('devices');
  const [devices, setDevices] = useState<Device[]>([]);
  const [lanes, setLanes] = useState<Lane[]>([]);
  const [loading, setLoading] = useState(true);

  // Device modal state
  const [deviceModal, setDeviceModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [deviceForm, setDeviceForm] = useState({
    name: '',
    type: 'LPR' as 'LPR' | 'BARRIER' | 'KIOSK',
    laneId: '',
  });

  // Lane modal state
  const [laneModal, setLaneModal] = useState(false);
  const [editingLane, setEditingLane] = useState<Lane | null>(null);
  const [laneForm, setLaneForm] = useState({
    name: '',
    direction: 'ENTRY' as 'ENTRY' | 'EXIT',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [devicesResult, lanesResult] = await Promise.all([
      api.getDevices(),
      api.getLanes(),
    ]);

    if (devicesResult.ok && devicesResult.data) {
      setDevices(devicesResult.data.devices);
    }
    if (lanesResult.ok && lanesResult.data) {
      setLanes(lanesResult.data.items);
    }
    setLoading(false);
  };

  // Device handlers
  const handleOpenDeviceModal = (device?: Device) => {
    if (device) {
      setEditingDevice(device);
      setDeviceForm({
        name: device.name,
        type: device.type,
        laneId: device.laneId || '',
      });
    } else {
      setEditingDevice(null);
      setDeviceForm({ name: '', type: 'LPR', laneId: '' });
    }
    setDeviceModal(true);
  };

  const handleSaveDevice = async () => {
    if (!deviceForm.name.trim()) {
      addToast({ type: 'error', title: '오류', message: '장비 이름을 입력하세요.' });
      return;
    }

    const data = {
      name: deviceForm.name.trim(),
      type: deviceForm.type,
      laneId: deviceForm.laneId || null,
    };

    let result;
    if (editingDevice) {
      result = await api.updateDevice(editingDevice.id, data);
    } else {
      result = await api.createDevice(data);
    }

    if (result.ok) {
      addToast({
        type: 'success',
        title: editingDevice ? '수정 완료' : '등록 완료',
        message: `장비가 ${editingDevice ? '수정' : '등록'}되었습니다.`,
      });
      setDeviceModal(false);
      loadData();
    } else {
      addToast({
        type: 'error',
        title: '오류',
        message: result.error?.message || '저장에 실패했습니다.',
      });
    }
  };

  const handleDeleteDevice = async (device: Device) => {
    if (!confirm(`'${device.name}' 장비를 삭제하시겠습니까?`)) return;

    const result = await api.deleteDevice(device.id);
    if (result.ok) {
      addToast({ type: 'success', title: '삭제 완료', message: '장비가 삭제되었습니다.' });
      loadData();
    } else {
      addToast({
        type: 'error',
        title: '삭제 실패',
        message: result.error?.message || '삭제에 실패했습니다.',
      });
    }
  };

  // Lane handlers
  const handleOpenLaneModal = (lane?: Lane) => {
    if (lane) {
      setEditingLane(lane);
      setLaneForm({ name: lane.name, direction: lane.direction });
    } else {
      setEditingLane(null);
      setLaneForm({ name: '', direction: 'ENTRY' });
    }
    setLaneModal(true);
  };

  const handleSaveLane = async () => {
    if (!laneForm.name.trim()) {
      addToast({ type: 'error', title: '오류', message: '차로 이름을 입력하세요.' });
      return;
    }

    const data = {
      name: laneForm.name.trim(),
      direction: laneForm.direction,
    };

    let result;
    if (editingLane) {
      result = await api.updateLane(editingLane.id, data);
    } else {
      result = await api.createLane(data);
    }

    if (result.ok) {
      addToast({
        type: 'success',
        title: editingLane ? '수정 완료' : '등록 완료',
        message: `차로가 ${editingLane ? '수정' : '등록'}되었습니다.`,
      });
      setLaneModal(false);
      loadData();
    } else {
      addToast({
        type: 'error',
        title: '오류',
        message: result.error?.message || '저장에 실패했습니다.',
      });
    }
  };

  const handleDeleteLane = async (lane: Lane) => {
    if (!confirm(`'${lane.name}' 차로를 삭제하시겠습니까?\n연결된 장비가 있으면 삭제할 수 없습니다.`)) return;

    const result = await api.deleteLane(lane.id);
    if (result.ok) {
      addToast({ type: 'success', title: '삭제 완료', message: '차로가 삭제되었습니다.' });
      loadData();
    } else {
      addToast({
        type: 'error',
        title: '삭제 실패',
        message: result.error?.message || '삭제에 실패했습니다.',
      });
    }
  };

  const getStatusColor = (status: string, connected: boolean) => {
    if (connected || status === 'ONLINE') return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/50';
    if (status === 'OFFLINE') return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/50';
    return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700';
  };

  const formatDateTime = (iso: string | null) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('ko-KR');
  };

  if (loading) {
    return <div className="text-center py-8 dark:text-gray-300">로딩 중...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">장비 관리</h2>
        <button
          onClick={() => activeTab === 'devices' ? handleOpenDeviceModal() : handleOpenLaneModal()}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          {activeTab === 'devices' ? '장비 등록' : '차로 추가'}
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b dark:border-gray-700">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('devices')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'devices'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            장비 목록 ({devices.length})
          </button>
          <button
            onClick={() => setActiveTab('lanes')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'lanes'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            차로 목록 ({lanes.length})
          </button>
        </div>
      </div>

      {/* Devices Tab */}
      {activeTab === 'devices' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {devices.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <p className="text-lg mb-2">등록된 장비가 없습니다</p>
              <p className="text-sm">장비 등록 버튼을 눌러 LPR 카메라, 차단기, 키오스크를 추가하세요.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr className="text-left text-sm text-gray-600 dark:text-gray-300">
                    <th className="px-4 py-3">장비 이름</th>
                    <th className="px-4 py-3">유형</th>
                    <th className="px-4 py-3">연결 차로</th>
                    <th className="px-4 py-3">상태</th>
                    <th className="px-4 py-3">마지막 연결</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="dark:text-gray-200">
                  {devices.map((device) => (
                    <tr key={device.id} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3">
                        <span className="font-medium">{device.name}</span>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{device.id}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 rounded-full text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                          {DEVICE_TYPE_LABELS[device.type] || device.type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {device.laneName ? (
                          <span>
                            {device.laneName}
                            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                              ({DIRECTION_LABELS[device.direction || ''] || device.direction})
                            </span>
                          </span>
                        ) : (
                          <span className="text-gray-400">미연결</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(device.status, device.connected)}`}>
                          {device.connected ? '온라인' : STATUS_LABELS[device.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {formatDateTime(device.lastSeenAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleOpenDeviceModal(device)}
                          className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 text-sm mr-3"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDeleteDevice(device)}
                          className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-sm"
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
      )}

      {/* Lanes Tab */}
      {activeTab === 'lanes' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {lanes.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <p className="text-lg mb-2">등록된 차로가 없습니다</p>
              <p className="text-sm">차로 추가 버튼을 눌러 입차/출차 차로를 등록하세요.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr className="text-left text-sm text-gray-600 dark:text-gray-300">
                    <th className="px-4 py-3">차로 이름</th>
                    <th className="px-4 py-3">방향</th>
                    <th className="px-4 py-3">연결된 장비</th>
                    <th className="px-4 py-3">생성일</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="dark:text-gray-200">
                  {lanes.map((lane) => {
                    const connectedDevices = devices.filter((d) => d.laneId === lane.id);
                    return (
                      <tr key={lane.id} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-3">
                          <span className="font-medium">{lane.name}</span>
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{lane.id}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              lane.direction === 'ENTRY'
                                ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                                : 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300'
                            }`}
                          >
                            {DIRECTION_LABELS[lane.direction]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {connectedDevices.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {connectedDevices.map((d) => (
                                <span
                                  key={d.id}
                                  className="px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                                >
                                  {d.name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">없음</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                          {formatDateTime(lane.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleOpenLaneModal(lane)}
                            className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 text-sm mr-3"
                          >
                            수정
                          </button>
                          <button
                            onClick={() => handleDeleteLane(lane)}
                            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-sm"
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Device Modal */}
      {deviceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b dark:border-gray-700">
              <h3 className="text-lg font-semibold dark:text-white">
                {editingDevice ? '장비 수정' : '장비 등록'}
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  장비 이름 *
                </label>
                <input
                  type="text"
                  value={deviceForm.name}
                  onChange={(e) => setDeviceForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="예: 입구 LPR 카메라"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  장비 유형 *
                </label>
                <select
                  value={deviceForm.type}
                  onChange={(e) => setDeviceForm((f) => ({ ...f, type: e.target.value as any }))}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  disabled={!!editingDevice}
                >
                  <option value="LPR">LPR 카메라</option>
                  <option value="BARRIER">차단기</option>
                  <option value="KIOSK">키오스크</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  연결 차로
                </label>
                <select
                  value={deviceForm.laneId}
                  onChange={(e) => setDeviceForm((f) => ({ ...f, laneId: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="">선택 안함</option>
                  {lanes.map((lane) => (
                    <option key={lane.id} value={lane.id}>
                      {lane.name} ({DIRECTION_LABELS[lane.direction]})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setDeviceModal(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                취소
              </button>
              <button
                onClick={handleSaveDevice}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                {editingDevice ? '수정' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lane Modal */}
      {laneModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b dark:border-gray-700">
              <h3 className="text-lg font-semibold dark:text-white">
                {editingLane ? '차로 수정' : '차로 추가'}
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  차로 이름 *
                </label>
                <input
                  type="text"
                  value={laneForm.name}
                  onChange={(e) => setLaneForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="예: 1번 입구"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  방향 *
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="direction"
                      value="ENTRY"
                      checked={laneForm.direction === 'ENTRY'}
                      onChange={(e) => setLaneForm((f) => ({ ...f, direction: e.target.value as any }))}
                      className="mr-2"
                    />
                    <span className="dark:text-gray-300">입차</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="direction"
                      value="EXIT"
                      checked={laneForm.direction === 'EXIT'}
                      onChange={(e) => setLaneForm((f) => ({ ...f, direction: e.target.value as any }))}
                      className="mr-2"
                    />
                    <span className="dark:text-gray-300">출차</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setLaneModal(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                취소
              </button>
              <button
                onClick={handleSaveLane}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                {editingLane ? '수정' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
