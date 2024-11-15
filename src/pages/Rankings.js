import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useRankings } from '../hooks/useRankings';

export function Rankings() {
  const { currentUser } = useAuth();
  const { loading, error, getPomodoroRanking, getPostureRanking } = useRankings();
  
  const [selectedPeriod, setSelectedPeriod] = useState('daily');
  const [pomodoroRankings, setPomodoroRankings] = useState([]);
  const [postureRankings, setPostureRankings] = useState([]);
  const [activeTab, setActiveTab] = useState('pomodoro');
  const [loadingState, setLoadingState] = useState('');

  useEffect(() => {
    if (currentUser?.uid) {
      loadRankings();
    }
  }, [selectedPeriod, activeTab, currentUser]);

  const loadRankings = async () => {
    try {
      setLoadingState('loading');
      const [pomoRankings, postRankings] = await Promise.all([
        getPomodoroRanking(selectedPeriod, 10, currentUser.uid),
        getPostureRanking(selectedPeriod, 10, currentUser.uid)
      ]);
      
      console.log('Loaded pomo rankings:', pomoRankings);
      console.log('Loaded posture rankings:', postRankings);
      
      setPomodoroRankings(pomoRankings);
      setPostureRankings(postRankings);
      setLoadingState('success');
    } catch (error) {
      console.error('Loading rankings error:', error);
      setLoadingState('error');
    }
  };

  const periodLabels = {
    daily: '今日',
    weekly: '今週',
    monthly: '今月'
  };

  const getNoDataMessage = () => {
    const period = periodLabels[selectedPeriod];
    const type = activeTab === 'pomodoro' ? 'ポモドーロ' : '姿勢スコア';
    return `${period}のフレンドの${type}データはまだありません`;
  };

  const RankingCard = ({ rank, data, type }) => {
    const isCurrentUser = data.userId === currentUser?.uid;
    const isTopThree = rank <= 3;

    const getMedalColor = (rank) => {
      switch (rank) {
        case 1: return 'text-yellow-500';
        case 2: return 'text-gray-400';
        case 3: return 'text-yellow-700';
        default: return 'text-gray-600';
      }
    };

    const getMedalEmoji = (rank) => {
      switch (rank) {
        case 1: return '🥇';
        case 2: return '🥈';
        case 3: return '🥉';
        default: return '';
      }
    };

    return (
      <div className={`
        p-4 rounded-lg shadow transition-transform duration-200
        ${isCurrentUser ? 'bg-blue-50 ring-2 ring-blue-500' : 'bg-white hover:bg-gray-50'}
        ${isTopThree ? 'transform hover:scale-102' : ''}
      `}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className={`text-2xl font-bold ${getMedalColor(rank)}`}>
              {rank} {getMedalEmoji(rank)}
            </span>
            <div>
              <p className="font-medium">{data.username}</p>
              {type === 'pomodoro' ? (
                <div className="text-sm text-gray-600">
                  <p>総ポモドーロ: {data.count}回</p>
                  <p>総作業時間: {Math.round(data.totalDuration)}分</p>
                </div>
              ) : (
                <div className="text-sm text-gray-600">
                  <p>姿勢スコア: {data.goodPosture.toFixed(1)}%</p>
                  <p>総セッション: {data.count}回</p>
                </div>
              )}
            </div>
          </div>
          {isCurrentUser && (
            <span className="px-2 py-1 text-sm bg-blue-100 text-blue-800 rounded-full">
              あなた
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* ヘッダー部分 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold">フレンドランキング</h2>
          <span className="text-sm text-gray-500">
            (フレンドと自分のみ表示)
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(periodLabels).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSelectedPeriod(key)}
              className={`px-4 py-2 rounded-md transition-colors duration-200 ${
                selectedPeriod === key 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* タブ切り替え */}
      <div className="flex space-x-4 border-b">
        <button
          onClick={() => setActiveTab('pomodoro')}
          className={`py-2 px-4 border-b-2 transition-colors duration-200 ${
            activeTab === 'pomodoro'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          ポモドーロ数
        </button>
        <button
          onClick={() => setActiveTab('posture')}
          className={`py-2 px-4 border-b-2 transition-colors duration-200 ${
            activeTab === 'posture'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          姿勢スコア
        </button>
      </div>

      {/* ランキング表示部分 */}
      <div className="min-h-[400px]">
        {!currentUser ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-600">ランキングを表示するにはログインが必要です</p>
          </div>
        ) : loadingState === 'loading' ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-gray-600">ランキングを読み込み中...</p>
            </div>
          </div>
        ) : loadingState === 'error' ? (
          <div className="text-center py-8 text-red-600">
            <p>ランキングの読み込みに失敗しました</p>
            <button
              onClick={loadRankings}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              再読み込み
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {(activeTab === 'pomodoro' ? pomodoroRankings : postureRankings).map((data, index) => (
              <RankingCard
                key={data.userId}
                rank={index + 1}
                data={data}
                type={activeTab}
              />
            ))}
            {(activeTab === 'pomodoro' ? pomodoroRankings : postureRankings).length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">{getNoDataMessage()}</p>
                <p className="text-sm text-gray-400 mt-2">
                  {activeTab === 'pomodoro' 
                    ? 'ポモドーロを完了すると、ランキングに反映されます'
                    : '姿勢チェック機能を使用すると、ランキングに反映されます'
                  }
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Rankings;