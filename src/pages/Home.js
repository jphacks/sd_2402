// Home.js
import { Link } from "react-router-dom";

function Home() {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
        <h1 className="text-5xl font-extrabold text-gray-900 sm:text-6xl md:text-6xl">
          <span className="text-red-600">Kinoken </span>
          Is All You Need.
        </h1>
        <h3 className="text-2xl font-medium text-gray-700 sm:text-3xl md:text-4xl mt-6">
          Keep your Health,
          Find your Pace.
        </h3>
          <div className="mt-5 max-w-md mx-auto sm:flex sm:justify-center md:mt-8">
            <div className="rounded-md shadow">
              <Link
                to="/pomo"
                className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-red-600 hover:bg-red-700 md:py-4 md:text-lg md:px-10"
              >
                タイマーを開始
              </Link>
            </div>
            <div className="mt-3 sm:mt-0 sm:ml-3">
              <Link
                to="/dashboard"
                className="w-full flex items-center justify-center px-8 py-3 border border-red-600 text-base font-medium rounded-md text-red-600 bg-white hover:bg-red-50 md:py-4 md:text-lg md:px-10"
              >
                統計を見る
              </Link>
            </div>
          </div>
        </div>
  
        <div className="mt-20 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-red-600 to-red-500 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative p-6 bg-white ring-1 ring-gray-900/5 rounded-lg leading-none flex items-top justify-start space-x-6">
              <div className="space-y-4">
                <div className="text-red-600 text-2xl">⏱️</div>
                <h3 className="text-lg font-semibold text-gray-900">集中タイマー</h3>
                <p className="text-gray-600">
                  25分の作業セッションと5分の休憩で、効率的に作業を進めましょう
                </p>
              </div>
            </div>
          </div>
  
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-red-600 to-red-500 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative p-6 bg-white ring-1 ring-gray-900/5 rounded-lg leading-none flex items-top justify-start space-x-6">
              <div className="space-y-4">
                <div className="text-red-600 text-2xl">📸</div>
                <h3 className="text-lg font-semibold text-gray-900">姿勢検知</h3>
                <p className="text-gray-600">
                  作業中の姿勢を検知し、良好な姿勢を保つようにサポートします
                </p>
              </div>
            </div>
          </div>

          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-red-600 to-red-500 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative p-6 bg-white ring-1 ring-gray-900/5 rounded-lg leading-none flex items-top justify-start space-x-6">
              <div className="space-y-4">
                <div className="text-red-600 text-2xl">🧘</div>
                <h3 className="text-lg font-semibold text-gray-900">ストレッチ</h3>
                <p className="text-gray-600">
                  作業後に疲れをリセットするストレッチを提案します
                </p>
              </div>
            </div>
          </div>
  
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-red-600 to-red-500 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative p-6 bg-white ring-1 ring-gray-900/5 rounded-lg leading-none flex items-top justify-start space-x-6">
              <div className="space-y-4">
                <div className="text-red-600 text-2xl">📈</div>
                <h3 className="text-lg font-semibold text-gray-900">統計情報</h3>
                <p className="text-gray-600">
                  作業の記録や姿勢の推移をグラフで確認し、自己成長を促進します
                </p>
              </div>
            </div>
          </div>

          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-red-600 to-red-500 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative p-6 bg-white ring-1 ring-gray-900/5 rounded-lg leading-none flex items-top justify-start space-x-6">
              <div className="space-y-4">
                <div className="text-red-600 text-2xl">🫱‍🫲</div>
                <h3 className="text-lg font-semibold text-gray-900">フレンド機能</h3>
                <p className="text-gray-600">
                  フレンドと情報を共有し、お互いの成長をサポートします
                </p>
              </div>
            </div>
          </div>

          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-red-600 to-red-500 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative p-6 bg-white ring-1 ring-gray-900/5 rounded-lg leading-none flex items-top justify-start space-x-6">
              <div className="space-y-4">
                <div className="text-red-600 text-2xl">📊</div>
                <h3 className="text-lg font-semibold text-gray-900">グループ機能</h3>
                <p className="text-gray-600">
                  グループ内でタスクを共有し、作業効率を向上させます
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  export default Home;