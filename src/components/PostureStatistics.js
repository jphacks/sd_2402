import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const COLORS = {
  good: '#10B981',
  catSpine: '#EF4444',
  shallowSitting: '#F59E0B',
  distorting: '#6366F1'
};

const PostureStatistics = ({ sessions = [] }) => {
  const stats = useMemo(() => {
    if (!sessions?.length) return null;

    // 日付処理用のヘルパー関数
    const getDateKey = (date) => {
      const d = date instanceof Date ? date : new Date(date);
      return d.toISOString().split('T')[0];
    };

    // 姿勢データのある日付の集計（過去7日分）
    const dailyStats = sessions.reduce((acc, session) => {
      if (!session?.poseScore || !session.startTime) return acc;
      
      const date = session.startTime?.seconds 
        ? new Date(session.startTime.seconds * 1000)
        : new Date(session.startTime);
      
      // 過去7日間のデータのみを対象とする
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 30);
      
      if (date < weekAgo) return acc;
      
      const dateKey = getDateKey(date);
      
      if (!acc[dateKey]) {
        acc[dateKey] = {
          date: dateKey,
          good: 0,
          catSpine: 0,
          shallowSitting: 0,
          distorting: 0
        };
      }
      
      acc[dateKey].good += session.poseScore.good || 0;
      acc[dateKey].catSpine += session.poseScore.catSpine || 0;
      acc[dateKey].shallowSitting += session.poseScore.shallowSitting || 0;
      acc[dateKey].distorting += session.poseScore.distorting || 0;
      
      return acc;
    }, {});

    // 日別データを配列に変換し、比率を計算
    const dailyArray = Object.entries(dailyStats)
      .map(([date, data]) => {
        const total = data.good + data.catSpine + data.shallowSitting + data.distorting;
        return {
          date,
          goodRatio: total > 0 ? (data.good / total * 100) : 0,
          catSpineRatio: total > 0 ? (data.catSpine / total * 100) : 0,
          shallowSittingRatio: total > 0 ? (data.shallowSitting / total * 100) : 0,
          distortingRatio: total > 0 ? (data.distorting / total * 100) : 0,
          total
        };
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    // 今日の姿勢分布を集計
    const today = getDateKey(new Date());
    const todayStats = sessions.reduce((acc, session) => {
      if (!session?.poseScore || !session.startTime) return acc;
      
      const date = session.startTime?.seconds 
        ? new Date(session.startTime.seconds * 1000)
        : new Date(session.startTime);
      
      if (getDateKey(date) === today) {
        acc.good += session.poseScore.good || 0;
        acc.catSpine += session.poseScore.catSpine || 0;
        acc.shallowSitting += session.poseScore.shallowSitting || 0;
        acc.distorting += session.poseScore.distorting || 0;
      }
      return acc;
    }, { good: 0, catSpine: 0, shallowSitting: 0, distorting: 0 });

    const total = Object.values(todayStats).reduce((sum, val) => sum + val, 0);
    
    const todayDistribution = [
      { name: '良好な姿勢', value: todayStats.good, color: COLORS.good },
      { name: '猫背', value: todayStats.catSpine, color: COLORS.catSpine },
      { name: '浅座り', value: todayStats.shallowSitting, color: COLORS.shallowSitting },
      { name: '体の歪み', value: todayStats.distorting, color: COLORS.distorting }
    ].filter(item => item.value > 0);

    // good以外で最大の問題を特定
    const problems = todayDistribution.filter(item => item.name !== '良好な姿勢');
    const worstProblem = problems.reduce((max, current) => 
      current.value > max.value ? current : max
    , { value: 0 });

    return {
      daily: dailyArray,
      todayDistribution,
      worstProblem
    };
  }, [sessions]);

  if (!stats) return null;

  // 最悪の姿勢問題に対するスタイルを生成
  const getScoreCardStyle = (name) => {
    const isWorst = stats.worstProblem?.name === name;
    const baseClass = "p-4 rounded-lg ";
    switch (name) {
      case '良好な姿勢':
        return baseClass + "bg-green-50";
      case '猫背':
        return baseClass + `bg-red-50 ${isWorst ? 'ring-2 ring-red-500' : ''}`;
      case '浅座り':
        return baseClass + `bg-yellow-50 ${isWorst ? 'ring-2 ring-yellow-500' : ''}`;
      case '体の歪み':
        return baseClass + `bg-indigo-50 ${isWorst ? 'ring-2 ring-indigo-500' : ''}`;
      default:
        return baseClass + "bg-gray-50";
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-6">姿勢分析</h2>
      
      <div className="grid grid-cols-3 gap-8">
        {/* 姿勢推移グラフ - 2/3幅 */}
        <div className="col-span-2 space-y-4">
          <h3 className="text-lg font-semibold text-gray-700">姿勢の推移</h3>
          <div className="h-80">
            <ResponsiveContainer>
              <LineChart data={stats.daily}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date"
                  tickFormatter={(date) => new Date(date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                />
                <YAxis domain={[0, 100]} />
                <Tooltip 
                  formatter={(value) => [`${value.toFixed(1)}%`]}
                  labelFormatter={(date) => new Date(date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                />
                <Legend />
                <Line type="monotone" dataKey="goodRatio" name="良好な姿勢" stroke={COLORS.good} strokeWidth={2} />
                <Line type="monotone" dataKey="catSpineRatio" name="猫背" stroke={COLORS.catSpine} strokeWidth={2} />
                <Line type="monotone" dataKey="shallowSittingRatio" name="浅座り" stroke={COLORS.shallowSitting} strokeWidth={2} />
                <Line type="monotone" dataKey="distortingRatio" name="体の歪み" stroke={COLORS.distorting} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 今日の姿勢割合 - 1/3幅 */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-700">今日の姿勢割合</h3>
          <div className="h-80">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={stats.todayDistribution}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({name, percent}) => `${name} ${(percent * 100).toFixed(1)}%`}
                >
                  {stats.todayDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => {
                  const total = stats.todayDistribution.reduce((sum, item) => sum + item.value, 0);
                  return [`${((value / total) * 100).toFixed(1)}%`, name];
                }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 詳細スコア */}
        <div className="col-span-3">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">姿勢スコアの詳細</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.todayDistribution.map(item => (
              <div key={item.name} className={getScoreCardStyle(item.name)}>
                <p className="text-sm text-gray-600">{item.name}</p>
                <p className="text-2xl font-bold text-gray-700">
                  {((item.value / stats.todayDistribution.reduce((sum, d) => sum + d.value, 0)) * 100).toFixed(1)}%
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostureStatistics;