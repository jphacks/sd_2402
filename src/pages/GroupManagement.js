import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useGroups } from '../hooks/useGroups';
import { useFriends } from '../hooks/useFriends';
import { GROUP_INVITATION_STATUS } from '../firebase/types';

export function GroupManagement() {
  const { currentUser } = useAuth();
  const { getFriends } = useFriends();
  const {
    loading,
    error,
    createGroup,
    inviteToGroup,
    respondToGroupInvitation,
    updateGroupCategories,
    getGroupPomodoroStats,
    getUserGroups,
    getReceivedGroupInvitations,
  } = useGroups();

  const [groups, setGroups] = useState([]);
  const [friends, setFriends] = useState([]);
  const [groupInvitations, setGroupInvitations] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupStats, setGroupStats] = useState(null);
  const [message, setMessage] = useState('');
  const [newGroupData, setNewGroupData] = useState({ name: '', description: '' });
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setHours(0, 0, 0, 0)),
    endDate: new Date(new Date().setHours(23, 59, 59, 999))
  });

  // 初期データの読み込み
  useEffect(() => {
    if (currentUser) {
      loadInitialData();
    }
  }, [currentUser]);

  const loadInitialData = async () => {
    try {
      const [userGroups, friendsList, invitations] = await Promise.all([
        getUserGroups(currentUser.uid),
        getFriends(currentUser.uid),
        getReceivedGroupInvitations(currentUser.uid)
      ]);
      setGroups(userGroups);
      setFriends(friendsList);
      setGroupInvitations(invitations);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleCreateGroup = async () => {
    try {
      await createGroup(currentUser.uid, newGroupData);
      setNewGroupData({ name: '', description: '' });
      await loadInitialData();
      setMessage('グループを作成しました');
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleInviteFriend = async (groupId, friend) => {
    try {
      const fromUser = {
        uid: currentUser.uid,
        displayName: currentUser.displayName || currentUser.email
      };
      const toUser = {
        uid: friend.userId,
        displayName: friend.username
      };
      await inviteToGroup(groupId, fromUser, toUser);
      setMessage(`${friend.username}をグループに招待しました`);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleInvitationResponse = async (invitationId, response) => {
    try {
      await respondToGroupInvitation(invitationId, currentUser.uid, response);
      await loadInitialData();
      setMessage(
        response === GROUP_INVITATION_STATUS.ACCEPTED
          ? 'グループ招待を承認しました'
          : 'グループ招待を拒否しました'
      );
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleCategoryUpdate = async (groupId, categoryId, add) => {
    try {
      await updateGroupCategories(groupId, categoryId, add);
      await loadInitialData();
      if (selectedGroup?.id === groupId) {
        loadGroupStats(groupId);
      }
      setMessage(add ? 'カテゴリーを追加しました' : 'カテゴリーを削除しました');
    } catch (error) {
      setMessage(error.message);
    }
  };

  const loadGroupStats = async (groupId) => {
    try {
      const stats = await getGroupPomodoroStats(groupId, dateRange.startDate, dateRange.endDate);
      setGroupStats(stats);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleGroupSelect = async (group) => {
    setSelectedGroup(group);
    await loadGroupStats(group.id);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-8">
      <div className="border-b pb-4">
        <h2 className="text-2xl font-bold mb-2">グループ管理</h2>
        {message && (
          <div className={`p-2 rounded ${error ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {message}
          </div>
        )}
      </div>

      {/* グループ作成フォーム */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">新規グループ作成</h3>
        <div className="space-y-2">
          <input
            type="text"
            value={newGroupData.name}
            onChange={(e) => setNewGroupData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="グループ名"
            className="w-full p-2 border rounded-md"
          />
          <textarea
            value={newGroupData.description}
            onChange={(e) => setNewGroupData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="グループの説明"
            className="w-full p-2 border rounded-md"
          />
          <button
            onClick={handleCreateGroup}
            disabled={loading || !newGroupData.name.trim()}
            className="w-full p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            グループを作成
          </button>
        </div>
      </div>

      {/* グループ招待一覧 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">受信したグループ招待</h3>
        {groupInvitations.length === 0 ? (
          <p className="text-gray-500">新しい招待はありません</p>
        ) : (
          <div className="space-y-2">
            {groupInvitations.map(invitation => (
              <div key={invitation.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <span className="font-medium">{invitation.groupName}</span>
                  <p className="text-sm text-gray-600">招待者: {invitation.fromUsername}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleInvitationResponse(invitation.id, GROUP_INVITATION_STATUS.ACCEPTED)}
                    disabled={loading}
                    className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                  >
                    承認
                  </button>
                  <button
                    onClick={() => handleInvitationResponse(invitation.id, GROUP_INVITATION_STATUS.REJECTED)}
                    disabled={loading}
                    className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                  >
                    拒否
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* グループ一覧 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">所属グループ</h3>
        {groups.length === 0 ? (
          <p className="text-gray-500">所属しているグループはありません</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groups.map(group => (
              <div
                key={group.id}
                className={`p-4 bg-white shadow rounded-lg cursor-pointer transition-colors
                  ${selectedGroup?.id === group.id ? 'ring-2 ring-blue-500' : 'hover:bg-gray-50'}`}
                onClick={() => handleGroupSelect(group)}
              >
                <div className="font-medium">{group.name}</div>
                <p className="text-sm text-gray-600">{group.description}</p>
                <p className="text-sm text-gray-500">
                  メンバー: {group.memberIds.length}人
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 選択されたグループの詳細情報 */}
      {selectedGroup && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{selectedGroup.name}の詳細</h3>
          
          {/* フレンド招待セクション */}
          <div className="p-4 bg-white shadow rounded-lg">
            <h4 className="font-medium mb-2">フレンドを招待</h4>
            <div className="grid grid-cols-2 gap-2">
              {friends.map(friend => (
                <button
                  key={friend.userId}
                  onClick={() => handleInviteFriend(selectedGroup.id, friend)}
                  disabled={loading || selectedGroup.memberIds.includes(friend.userId)}
                  className="p-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {friend.username}を招待
                </button>
              ))}
            </div>
          </div>
          {/* グループ統計情報 */}
            {groupStats && (
            <div className="space-y-4">
                <div className="p-4 bg-white shadow rounded-lg">
                <h4 className="font-medium mb-4">共通カテゴリーの活動状況</h4>
                {(() => {
                    const memberCount = Object.keys(groupStats.memberStats).length;
                    
                    // メンバーごとのカテゴリー使用状況を集計
                    const categoryUsage = {};
                    // カテゴリー使用状況を集計する部分で、メンバー情報を設定する際に修正
                    Object.entries(groupStats.memberStats).forEach(([memberId, pomodoros]) => {
                        // そのメンバーが使用したカテゴリーを集計
                        pomodoros.forEach(pomo => {
                        if (!categoryUsage[pomo.categoryName]) {
                            categoryUsage[pomo.categoryName] = {
                            members: new Set(),
                            totalDuration: 0,
                            tasks: new Map(),
                            memberDetails: new Map()
                            };
                        }
                        
                        categoryUsage[pomo.categoryName].members.add(memberId);
                        categoryUsage[pomo.categoryName].totalDuration += pomo.duration;
                    
                        // メンバーごとの作業時間を集計
                        const memberStats = categoryUsage[pomo.categoryName].memberDetails.get(memberId) || {
                            // friends配列からユーザー名を検索
                            username: memberId === currentUser.uid 
                                ? currentUser.displayName || currentUser.email 
                                : friends.find(friend => friend.userId === memberId)?.username || 'Unknown User',
                            duration: 0,
                            taskCount: 0
                        };
                        memberStats.duration += pomo.duration;
                        memberStats.taskCount += 1;
                        categoryUsage[pomo.categoryName].memberDetails.set(memberId, memberStats);
                    
                        // 以下、タスクの集計部分は変更なし
                        const taskKey = pomo.taskName;
                        const taskStats = categoryUsage[pomo.categoryName].tasks.get(taskKey) || {
                            name: pomo.taskName,
                            duration: 0,
                            count: 0
                        };
                        taskStats.duration += pomo.duration;
                        taskStats.count += 1;
                        categoryUsage[pomo.categoryName].tasks.set(taskKey, taskStats);
                        });
                    });

                    // 全員が使用している共通カテゴリーのみをフィルタリング
                    const commonCategories = Object.entries(categoryUsage)
                    .filter(([_, info]) => info.members.size === memberCount)
                    .sort((a, b) => b[1].totalDuration - a[1].totalDuration); // 総作業時間で降順ソート

                    if (commonCategories.length === 0) {
                    return (
                        <div className="text-gray-500 text-center py-4">
                        全メンバーに共通するカテゴリーはありません
                        </div>
                    );
                    }

                    return commonCategories.map(([categoryName, categoryInfo]) => (
                    <div key={categoryName} className="mb-6 bg-gray-50 rounded-lg p-4">
                        <div className="border-b border-gray-300 pb-2 mb-4">
                        <h5 className="text-lg font-medium text-blue-600">{categoryName}</h5>
                        <div className="text-sm text-gray-600 flex gap-4">
                            <span>総作業時間: {categoryInfo.totalDuration}分</span>
                            <span>総タスク数: {Array.from(categoryInfo.tasks.values()).reduce((acc, task) => acc + task.count, 0)}</span>
                        </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* メンバー別の活動状況 */}
                        <div className="bg-white rounded p-4">
                            <h6 className="font-medium text-gray-800 mb-3">メンバー別活動状況</h6>
                            <div className="space-y-2">
                            {Array.from(categoryInfo.memberDetails.values())
                                .sort((a, b) => b.duration - a.duration)
                                .map((memberStats, index) => (
                                <div key={index} className="flex justify-between items-center text-sm">
                                    <span className="text-gray-700">{memberStats.username}</span>
                                    <span className="text-gray-600">
                                    {memberStats.duration}分 ({memberStats.taskCount}タスク)
                                    </span>
                                </div>
                                ))}
                            </div>
                        </div>

                        {/* 頻出タスク */}
                        <div className="bg-white rounded p-4">
                            <h6 className="font-medium text-gray-800 mb-3">上位タスク</h6>
                            <div className="space-y-2">
                            {Array.from(categoryInfo.tasks.values())
                                .sort((a, b) => b.duration - a.duration)
                                .slice(0, 5)
                                .map((taskStats, index) => (
                                <div key={index} className="flex justify-between items-center text-sm">
                                    <span className="text-gray-700">{taskStats.name}</span>
                                    <span className="text-gray-600">
                                    {taskStats.duration}分 ({taskStats.count}回)
                                    </span>
                                </div>
                                ))}
                            </div>
                        </div>
                        </div>
                    </div>
                    ));
                })()}
                </div>
            </div>
            )}
        </div>
      )}
    </div>
  );
}

export default GroupManagement;