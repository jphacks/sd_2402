import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from "../auth/AuthProvider";
import { useState } from 'react';

function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout, updateUsername } = useAuth();
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/signin');
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleUsernameChange = async () => {
    const trimmedUsername = newUsername.trim();
    if (!trimmedUsername) return;

    try {
      setLoading(true);
      setError('');
      
      await updateUsername(trimmedUsername);
      
      setShowUsernameModal(false);
      setNewUsername('');
      
      // 成功メッセージを表示してからリロード
      const message = 'ユーザー名を更新しました';
      alert(message);
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error("Error updating username:", error);
      setError(error.message || 'ユーザー名の更新に失敗しました。もう一度お試しください。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <nav className="bg-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link to="/" className="text-2xl text-red-600 font-bold">
                🐈 KINOKEN
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link
                to="/"
                className={`inline-flex items-center px-1 pt-1 border-b-2 ${
                  location.pathname === '/' 
                    ? 'border-red-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                ホーム
              </Link>
              <Link
                to="/pomo"
                className={`inline-flex items-center px-1 pt-1 border-b-2 ${
                  location.pathname === '/pomo'
                    ? 'border-red-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                タイマー
              </Link>
              <Link
                to="/dashboard"
                className={`inline-flex items-center px-1 pt-1 border-b-2 ${
                  location.pathname === '/dashboard'
                    ? 'border-red-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                統計
              </Link>
              <Link
                to="/friends"
                className={`inline-flex items-center px-1 pt-1 border-b-2 ${
                  location.pathname === '/friends'
                    ? 'border-red-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                フレンド
              </Link>
              <Link
                to="/groups"
                className={`inline-flex items-center px-1 pt-1 border-b-2 ${
                  location.pathname === '/groups'
                    ? 'border-red-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                グループ
              </Link>
              <Link
                to="/rankings"
                className={`inline-flex items-center px-1 pt-1 border-b-2 ${
                  location.pathname === '/rankings'
                    ? 'border-red-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                ランキング
              </Link>
            </div>
          </div>
          <div className="flex items-center">
            {currentUser && (
              <>
                <span className="text-gray-500 mr-4">{currentUser.displayName || currentUser.email}</span>
                <button
                  onClick={() => setShowUsernameModal(true)}
                  className="text-gray-500 hover:text-gray-700 mr-4"
                >
                  ユーザー名変更
                </button>
                <button
                  onClick={handleLogout}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ログアウト
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ユーザー名変更モーダル */}
      {showUsernameModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full relative">
            <h3 className="text-lg font-medium mb-4">ユーザー名を変更</h3>
            {error && (
              <div className="mb-4 text-red-600 text-sm">
                {error}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  新しいユーザー名
                </label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                  placeholder="新しいユーザー名を入力"
                  disabled={loading}
                  maxLength={50}
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowUsernameModal(false);
                    setNewUsername('');
                    setError('');
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  disabled={loading}
                >
                  キャンセル
                </button>
                <button
                  onClick={handleUsernameChange}
                  disabled={!newUsername.trim() || loading}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors duration-200"
                >
                  {loading ? '更新中...' : '変更'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

export default Navigation;