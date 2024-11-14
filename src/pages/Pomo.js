import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../auth/AuthProvider";
import { db } from "../firebase/config";
import { 
  collection,
  addDoc,
  query,
  getDocs,
  orderBy,
  serverTimestamp
} from "firebase/firestore";
import Camera from "../components/NewCamera";
import { startNeckStretch } from "../components/StretchNeck";
import { updateProfile } from "firebase/auth";
//import { set } from "firebase/database";
//import { startWaistStretch } from "../components/StretchWaist";

function Pomo() {
  const { currentUser } = useAuth();
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(25);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState('work');
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [taskName, setTaskName] = useState('');
  const [showTaskModal, setShowTaskModal] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [waitingForSmile, setWaitingForSmile] = useState(false);
  const [poseScore, setPoseScore] = useState({
    good: 0,
    catSpine: 0,
    shallowSitting: 0,
    distorting: 0
  });
  const [stdImageUrl, setStdImageUrl] = useState(null);
  const [waitForWorking, setWaitingForWorking] = useState(true);
  const [sessionCount, setSessionCount] = useState(1);

  // カテゴリーの取得
  const fetchCategories = useCallback(async () => {
    try {
      const categoriesRef = collection(db, `users/${currentUser.uid}/categories`);
      const q = query(categoriesRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const categoriesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCategories(categoriesList);
      console.log("Categories loaded:", categoriesList);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  }, [currentUser.uid]);

  // Pomodoro完了時の処理
  // poseScoreを使ってfirebaseに記録
  // poseScoreを使って結果を表示
  const handlePomodoroComplete = useCallback(async () => {
    try {
      setLoading(true);
      if (mode === 'work') {
        const pomodoroRef = collection(db, `users/${currentUser.uid}/pomodoros`);
        const pomodoroData = {
          startTime: serverTimestamp(),
          endTime: serverTimestamp(),
          categoryId: selectedCategory,
          categoryName: categories.find(c => c.id === selectedCategory)?.name,
          taskName: taskName,
          duration: 0.5,
          mode: mode,
          completed: true,
          poseScore: poseScore,
        };
        
        await addDoc(pomodoroRef, pomodoroData);
        console.log("Work session completed and saved");


        if (Notification.permission === 'granted') {
          new Notification('作業完了！', {
            body: '笑顔で休憩を開始しましょう！'
          });
        }
        //await startWaistStretch(); // 腰のストレッチを開始（追加）
        await startNeckStretch(); // 首のストレッチを開始(変更点)

        setIsActive(false);
        setMode('wait');
        setStdImageUrl(null);
        setWaitingForSmile(true);
        
      } else {
        if (Notification.permission === 'granted') {
          const newSessionCount = sessionCount + 1;
          setSessionCount(newSessionCount);
          new Notification('休憩終了！', {
            body: '次のタスクを開始しましょう。'
          });
        }
        setWaitingForWorking(true);
        setPoseScore({
          good: 0,
          catSpine: 0,
          shallowSitting: 0,
          distorting: 0
        });
        setMinutes(0);
        setSeconds(30);
        setMode('waitForWorking');
        setIsActive(false);
      }
    } catch (error) {
      console.error("Error completing pomodoro:", error);
    } finally {
      setLoading(false);
    }
  }, [currentUser.uid, selectedCategory, categories, taskName, mode]);

  // カテゴリーの追加
  const handleAddCategory = useCallback(async () => {
    if (!newCategory.trim()) return;
    
    try {
      setLoading(true);
      const categoriesRef = collection(db, `users/${currentUser.uid}/categories`);
      const docRef = await addDoc(categoriesRef, {
        name: newCategory.trim(),
        createdAt: serverTimestamp()
      });
      
      const newCategoryObj = {
        id: docRef.id,
        name: newCategory.trim(),
        createdAt: new Date()
      };
      
      setCategories(prev => [newCategoryObj, ...prev]);
      setSelectedCategory(docRef.id);
      setNewCategory('');
      setShowNewCategoryInput(false);
      console.log("New category added:", newCategoryObj);
    } catch (error) {
      console.error("Error adding category:", error);
    } finally {
      setLoading(false);
    }
  }, [currentUser.uid, newCategory]);

  // タイマーの開始
  const startTimer = useCallback(() => {
    if (!taskName || !selectedCategory) {
      setShowTaskModal(true);
      return;
    }
    console.log("Starting timer with task:", taskName, "category:", selectedCategory);
    setIsActive(true);
    setWaitingForWorking(false);
  }, [taskName, selectedCategory]);

  // タイマーのリセット
  const resetTimer = useCallback(() => {
    setIsActive(false);
    setShowTaskModal(true);
    setMode('waitForWorking');
    setPoseScore({
      good: 0,
      catSpine: 0,
      distorting: 0,
      shallowSitting: 0
    });
    setMinutes(0);
    setSeconds(25);
    setWaitingForSmile(false);
    setSessionCount(1);
    console.log("Timer reset");
  }, []);

  // 笑顔検出時の処理
  const handleSmileDetected = useCallback(() => {
    if (waitingForSmile) {
      //休憩開始時
      if (sessionCount == 4) {
        setMinutes(0);
        setSeconds(30);
        setSessionCount(0);
      } else {
        setMinutes(0);
        setSeconds(15);
      }
      setMode('break');
      setIsActive(true);
      setWaitingForSmile(false);
      console.log("Break started due to smile detection");
    } else if (!isActive && taskName && selectedCategory) {
      console.log("Starting timer due to smile detection");
      startTimer();
    }
  }, [isActive, taskName, selectedCategory, startTimer, waitingForSmile, sessionCount]);

  // カテゴリーの初期読み込み
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // タイマーの制御
  // PoseDetect処理
  useEffect(() => {
    let interval;
    if (isActive) {
      interval = setInterval(() => {
        if (seconds === 0) {
          if (minutes === 0) {
            clearInterval(interval);
            handlePomodoroComplete();
          } else {
            setMinutes(minutes - 1);
            setSeconds(59);
          }
        } else {
          setSeconds(seconds - 1);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive, minutes, seconds, handlePomodoroComplete]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 flex flex-col">
      <div className="flex-1 max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* 左側: タイマーと設定 */}
        <div className="space-y-8">
          {/* タイマー表示 */}
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="mb-2">
              <p className="text-sm text-gray-600">
                セッション: {sessionCount == 0 ? 4 : sessionCount} / 4
              </p>
            </div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {waitingForSmile ? '笑顔で休憩開始' : (mode === 'work' || mode === 'waitForWorking') ? '作業時間' : sessionCount === 4 ? '長い休憩時間' : '休憩時間'}
              </h2>
              {taskName && (
                <div className="mt-2 space-y-1">
                  <p className="text-gray-600">
                    カテゴリー: {categories.find(c => c.id === selectedCategory)?.name}
                  </p>
                  <p className="text-gray-600">
                    タスク: {taskName}
                  </p>
                </div>
              )}
            </div>
            
            <div className="text-6xl font-bold text-red-600 mb-8">
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </div>

            <div className="space-x-4">
              <button
                onClick={() => isActive ? setIsActive(false) : startTimer()}
                disabled={!taskName || !selectedCategory || waitingForSmile}
                className={`${
                  !taskName || !selectedCategory || waitingForSmile
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700'
                } text-white px-6 py-2 rounded-md transition-colors duration-200`}
              >
                {isActive ? '一時停止' : 'スタート'}
              </button>
              <button
                onClick={resetTimer}
                className="border border-red-600 text-red-600 px-6 py-2 rounded-md hover:bg-red-50 transition-colors duration-200"
              >
                リセット
              </button>
            </div>

            {(!taskName || !selectedCategory) && (
              <div className="mt-4 text-sm text-gray-500">
                タスクを設定してください
              </div>
            )}

            {waitingForSmile && (
              <div className="mt-4 text-sm text-red-600">
                笑顔を見せて休憩を開始してください
              </div>
            )}

            {loading && (
              <div className="mt-4 text-sm text-gray-600">
                データを保存中...
              </div>
            )}
          </div>

          {/* タスク設定ボタン */}
          {(mode === 'break' || !isActive) && (
            <button
              onClick={() => setShowTaskModal(true)}
              className="w-full bg-white rounded-lg shadow-lg p-4 text-gray-600 hover:bg-gray-50 transition-colors duration-200"
            >
              タスクを設定/変更
            </button>
          )}
        </div>

        {/* 右側: カメラ表示 */}
        <div className="bg-white rounded-lg shadow-lg p-4">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            笑顔検出
          </h2>
          <Camera mode={mode} setMode={setMode} waitForWorking={waitForWorking} stdUrl={stdImageUrl} setStdUrl={setStdImageUrl} setPoseScore={setPoseScore} onSmileDetected={handleSmileDetected} />
        </div>
        {waitForWorking && (
          <h2>
            今はワーク待ちだよ
          </h2>
        )}
        {stdImageUrl && (
          <h2>
            基準を獲得できました！
          </h2>
        )}
        {poseScore && (
          <ul>
          {Object.entries(poseScore).map(([key, value]) => (
            <li key={key}>
              {key}: {value}
            </li>
          ))}
        </ul>
        )}
      </div>

      {/* タスク設定モーダル */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full relative">
            <h3 className="text-lg font-medium mb-4">タスクを設定</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  カテゴリー
                </label>
                <div className="flex gap-2">
                  {!showNewCategoryInput ? (
                    <>
                      <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                      >
                        <option value="">カテゴリーを選択</option>
                        {categories.map(category => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowNewCategoryInput(true)}
                        className="px-3 py-2 text-sm text-red-600 hover:text-red-700"
                      >
                        +新規
                      </button>
                    </>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                        placeholder="新しいカテゴリー名"
                      />
                      <button
                        onClick={handleAddCategory}
                        disabled={!newCategory.trim() || loading}
                        className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                      >
                        追加
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowNewCategoryInput(false)}
                        className="px-3 py-2 text-gray-600 hover:text-gray-700"
                      >
                        ×
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  タスク名
                </label>
                <input
                  type="text"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                  placeholder="タスクを入力"
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowTaskModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  キャンセル
                </button>
                <button
                  onClick={() => {
                    if (taskName && selectedCategory) {
                      setShowTaskModal(false);
                    }
                  }}
                  disabled={!taskName || !selectedCategory}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors duration-200"
                >
                  設定
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Pomo;
