// src/pages/Dashboard.js
import React from "react";
import { useAuth } from "../auth/AuthProvider";
import { Link } from "react-router-dom";
import { useFirestoreData } from '../hooks/useFirestoreData';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts';
import PostureStatistics from "../components/PostureStatistics";

const COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899'];

function Dashboard() {
  const { currentUser } = useAuth();
  const {
    categoryStats,
    recentPomodoros,
    loading,
    todayTotal,
    weekTotal,
    dailyStats,
    error
  } = useFirestoreData(currentUser?.uid);

  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateShort = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('ja-JP', {
      month: 'numeric',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">データを読み込んでいます...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-500">
          エラーが発生しました: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ヘッダー部分 */}
        <div className="md:flex md:items-center md:justify-between mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">統計情報</h1>
          <Link
            to="/pomo"
            className="mt-4 md:mt-0 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
          >
            新しいポモドーロを開始
          </Link>
        </div>

        {/* サマリーカード */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="text-red-600 text-2xl">🍅</span>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      今日の完了数
                    </dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {todayTotal} 回
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="text-red-600 text-2xl">📅</span>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      週間完了数
                    </dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {weekTotal} 回
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* グラフセクション */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* 日別推移グラフ */}
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              ポモドーロ完了数の推移
            </h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={dailyStats}
                  margin={{
                    top: 5,
                    right: 30,
                    left: 20,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatDateShort}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={formatDateShort}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#EF4444"
                    name="完了数"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* カテゴリー分布の円グラフ */}
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              カテゴリー別分布
            </h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryStats}
                    dataKey="totalPomodoros"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({name, percent}) => 
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {categoryStats.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={COLORS[index % COLORS.length]} 
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* カテゴリー別統計 */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="px-4 py-5 sm:p-6">
            <h2 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              カテゴリー別作業時間
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categoryStats.map((category, index) => (
                <div 
                  key={category.id}
                  className="bg-gray-50 rounded-lg p-4 border-l-4"
                  style={{ borderLeftColor: COLORS[index % COLORS.length] }}
                >
                  <h3 className="font-medium text-gray-900">{category.name}</h3>
                  <dl className="mt-2 grid grid-cols-2 gap-4">
                    <div>
                      <dt className="text-sm text-gray-500">総計</dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {category.totalPomodoros}回
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">今日</dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {category.todayPomodoros}回
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-2">
                    <dt className="text-sm text-gray-500">総作業時間</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {category.totalMinutes.toFixed(1)}分
                    </dd>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 最近の記録 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h2 className="text-lg leading-6 font-medium text-gray-900">
              最近の記録
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    日時
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    カテゴリー
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    タスク
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    作業時間
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentPomodoros.map((pomo) => (
                  <tr key={pomo.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(pomo.startTime)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {pomo.categoryName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {pomo.taskName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {Math.ceil(pomo.duration)}分
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
          
        {/* 姿勢分析 */}
        <div className="mt-8">
          <PostureStatistics sessions = {recentPomodoros} />
        </div>

      </div>
    </div>
  );
}

export default Dashboard;