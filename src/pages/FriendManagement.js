import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useFriends } from '../hooks/useFriends';
import { FRIEND_REQUEST_STATUS } from '../firebase/types';

export function FriendsManagement() {
  const { currentUser } = useAuth();
  const { 
    loading, 
    error: friendError,
    searchUserByUsername,
    sendFriendRequest,
    getReceivedFriendRequests,
    respondToFriendRequest,
    getFriends,
    getFriendTodayPomodoros,
    getFriendWeekPomodoros,
    getPomodoroStats
  } = useFriends();

  const [searchUsername, setSearchUsername] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [friendPomodoros, setFriendPomodoros] = useState({ today: [], week: [] });
  const [pomodoroStats, setPomodoroStats] = useState({ today: null, week: null });
  const [message, setMessage] = useState('');

  // 初期データの読み込み
  useEffect(() => {
    if (currentUser) {
      loadFriendRequests();
      loadFriends();
    }
  }, [currentUser]);

  // フレンドのポモドーロ情報を読み込む
  const loadFriendPomodoros = async (friendId) => {
    try {
      const [todayPomos, weekPomos] = await Promise.all([
        getFriendTodayPomodoros(friendId),
        getFriendWeekPomodoros(friendId)
      ]);

      setFriendPomodoros({
        today: todayPomos,
        week: weekPomos
      });

      setPomodoroStats({
        today: getPomodoroStats(todayPomos),
        week: getPomodoroStats(weekPomos)
      });
    } catch (error) {
      setMessage(error.message);
    }
  };

  const loadFriendRequests = async () => {
    try {
      const requests = await getReceivedFriendRequests(currentUser.uid);
      setFriendRequests(requests);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const loadFriends = async () => {
    try {
      const friendsList = await getFriends(currentUser.uid);
      setFriends(friendsList);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleSearch = async () => {
    if (!searchUsername.trim()) return;
    
    try {
      const results = await searchUserByUsername(searchUsername);
      // 自分自身と既存のフレンドを除外
      const filteredResults = results.filter(user => 
        user.uid !== currentUser.uid && 
        !friends.some(friend => friend.userId === user.uid)
      );
      setSearchResults(filteredResults);
      
      if (filteredResults.length === 0) {
        setMessage('ユーザーが見つかりませんでした');
      }
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleSendRequest = async (toUser) => {
    try {
      const fromUser = {
        uid: currentUser.uid,
        displayName: currentUser.displayName || currentUser.email
      };
      await sendFriendRequest(fromUser, toUser);
      setSearchResults([]);
      setSearchUsername('');
      setMessage('フレンドリクエストを送信しました');
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleRequestResponse = async (requestId, response) => {
    try {
      await respondToFriendRequest(requestId, currentUser.uid, response);
      await loadFriendRequests();
      await loadFriends();
      setMessage(
        response === FRIEND_REQUEST_STATUS.ACCEPTED 
          ? 'フレンドリクエストを承認しました'
          : 'フレンドリクエストを拒否しました'
      );
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleFriendSelect = async (friend) => {
    setSelectedFriend(friend);
    await loadFriendPomodoros(friend.userId);
  };

  // フレンドの詳細情報を表示するコンポーネント
  const FriendDetail = ({ friend, stats, pomodoros }) => {
    if (!stats) return null;

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h4 className="text-lg font-semibold">{friend.username}の活動</h4>
          <div className="space-x-2">
            <button 
              className={`px-3 py-1 rounded-md ${selectedPeriod === 'today' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
              onClick={() => setSelectedPeriod('today')}
            >
              今日
            </button>
            <button 
              className={`px-3 py-1 rounded-md ${selectedPeriod === 'week' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
              onClick={() => setSelectedPeriod('week')}
            >
              今週
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-white shadow rounded-lg">
            <h5 className="font-medium mb-2">基本統計</h5>
            <div className="space-y-2">
              <p>総ポモドーロ数: {stats.totalCount}</p>
              <p>総作業時間: {stats.totalDuration}分</p>
            </div>
          </div>

          <div className="p-4 bg-white shadow rounded-lg">
            <h5 className="font-medium mb-2">姿勢スコア平均</h5>
            <div className="space-y-2">
              <p>良い姿勢: {stats.avgPoseScores.good}%</p>
              <p>猫背: {stats.avgPoseScores.catSpine}%</p>
              <p>浅座り: {stats.avgPoseScores.shallowSitting}%</p>
              <p>歪み: {stats.avgPoseScores.distorting}%</p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-white shadow rounded-lg">
          <h5 className="font-medium mb-2">カテゴリー別タスク数</h5>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {Object.entries(stats.byCategory).map(([category, count]) => (
              <div key={category} className="p-2 bg-gray-50 rounded">
                <p className="font-medium">{category}</p>
                <p className="text-gray-600">{count}回</p>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 bg-white shadow rounded-lg">
          <h5 className="font-medium mb-2">最近のポモドーロ</h5>
          <div className="space-y-2">
            {pomodoros.slice(0, 5).map(pomo => (
              <div key={pomo.id} className="p-2 bg-gray-50 rounded flex justify-between">
                <div>
                  <p className="font-medium">{pomo.taskName}</p>
                  <p className="text-sm text-gray-600">{pomo.categoryName}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm">{pomo.duration}分</p>
                  <p className="text-sm text-gray-600">
                    {new Date(pomo.startTime).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-8">
      <div className="border-b pb-4">
        <h2 className="text-2xl font-bold mb-2">フレンド管理</h2>
        {message && (
          <div className={`p-2 rounded ${friendError ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {message}
          </div>
        )}
      </div>

      {/* ユーザー検索セクション */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">ユーザー検索</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchUsername}
            onChange={(e) => setSearchUsername(e.target.value)}
            placeholder="ユーザー名を入力"
            className="flex-1 p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSearch}
            disabled={loading || !searchUsername.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '検索中...' : '検索'}
          </button>
        </div>

        {/* 検索結果 */}
        {searchResults.length > 0 && (
          <div className="mt-4">
            <h4 className="font-medium mb-2">検索結果</h4>
            <div className="space-y-2">
              {searchResults.map(user => (
                <div key={user.uid} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">{user.displayName}</span>
                  <button
                    onClick={() => handleSendRequest(user)}
                    disabled={loading}
                    className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                  >
                    フレンドリクエスト送信
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* フレンドリクエスト一覧 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">受信したフレンドリクエスト</h3>
        {friendRequests.length === 0 ? (
          <p className="text-gray-500">新しいリクエストはありません</p>
        ) : (
          <div className="space-y-2">
            {friendRequests.map(request => (
              <div key={request.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="font-medium">{request.fromUsername}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRequestResponse(request.id, FRIEND_REQUEST_STATUS.ACCEPTED)}
                    disabled={loading}
                    className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                  >
                    承認
                  </button>
                  <button
                    onClick={() => handleRequestResponse(request.id, FRIEND_REQUEST_STATUS.REJECTED)}
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

      {/* フレンドリスト */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">フレンド一覧</h3>
        {friends.length === 0 ? (
          <p className="text-gray-500">フレンドはいません</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {friends.map(friend => (
              <div 
                key={friend.id} 
                className={`p-4 bg-white shadow rounded-lg cursor-pointer transition-colors
                  ${selectedFriend?.userId === friend.userId ? 'ring-2 ring-blue-500' : 'hover:bg-gray-50'}`}
                onClick={() => handleFriendSelect(friend)}
              >
                <div className="font-medium">{friend.username}</div>
                <div className="text-sm text-gray-500">
                  登録日: {new Date(friend.createdAt?.seconds * 1000).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* フレンド詳細情報 */}
      {selectedFriend && (
        <div className="mt-8">
          <FriendDetail
            friend={selectedFriend}
            stats={pomodoroStats[selectedPeriod]}
            pomodoros={friendPomodoros[selectedPeriod]}
          />
        </div>
      )}
    </div>
  );
}

export default FriendsManagement;
