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
import { startShoulderStretch } from "../components/StretchShoulder";
//import { set } from "firebase/database";
//import { startWaistStretch } from "../components/StretchWaist";

const WORK_MIN = 0
const BREAK_MIN = 0
const LONG_BREAK_MIN = 0

const WORK_SEC = 25
const BREAK_SEC = 5
const LONG_BREAK_SEC = 15

function Pomo() {
  const { currentUser } = useAuth();
  // 時間設定
  const [timerSettings, setTimerSettings] = useState({
    workMinutes: 25,
    workSeconds: 0,
    breakMinutes: 5,
    breakSeconds: 0,
    longBreakMinutes: 15,
    longBreakSeconds: 0
  });
  const [minutes, setMinutes] = useState(timerSettings.workMinutes);
  const [seconds, setSeconds] = useState(timerSettings.workSeconds);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState('waitForWorking');
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [taskName, setTaskName] = useState('');
  const [showTaskModal, setShowTaskModal] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
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

  // デバッグ用のログを追加
  const playNotificationSound = useCallback((mode) => {
    try {
      const soundUrl = mode === 'work' 
        ? '/sounds/level-up-47165.mp3' 
        : '/sounds/break-end.mp3';
      console.log('Loading sound from:', soundUrl); // URLを確認
      
      const audio = new Audio(soundUrl);
      audio.volume = 0.5;
      
      // 読み込みの状態を確認
      audio.addEventListener('loadstart', () => console.log('Loading started'));
      audio.addEventListener('loadeddata', () => console.log('Data loaded'));
      audio.addEventListener('error', (e) => console.log('Loading error:', e));
      
      audio.play()
        .catch(error => {
          console.error('Play failed:', error);
        });
    } catch (error) {
      console.error('Init failed:', error);
    }
  }, []);

  const sendNotification = useCallback((title, options, mode) => {
    // モードに応じた通知音を再生
    playNotificationSound(mode);
  
    // ウィンドウがフォーカスされていない場合は通知も送る
    if (!window.document.hasFocus() && Notification.permission === 'granted') {
      try {
        const notification = new Notification(title, options);
        notification.onclick = function() {
          window.focus();
          notification.close();
        };
      } catch (error) {
        console.error('Error sending notification:', error);
      }
    }
  }, [playNotificationSound]);

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
          duration: minutes + seconds / 60,
          mode: mode,
          completed: true,
          poseScore: poseScore,
        };
        
        await addDoc(pomodoroRef, pomodoroData);
        console.log(`Work session completed and saved: 猫背=${poseScore.catSpine}`);


        if (Notification.permission === 'granted') {
          sendNotification('作業完了！', {
            body: '笑顔で休憩を開始しましょう！'
          }, 'work'); //modeを追加
        }
        //await startWaistStretch(); // 腰のストレッチを開始（追加）
        await startNeckStretch(); // 首のストレッチを開始（追加）
        // await startShoulderStretch(); // 肩のストレッチを開始（追加）

        setIsActive(false);
        setMode('wait');
        setStdImageUrl(null);
        setWaitingForSmile(true);
        
      } else {
        if (Notification.permission === 'granted') {
          const newSessionCount = sessionCount + 1;
          setSessionCount(newSessionCount);
          sendNotification('休憩終了！', {
            body: '次のタスクを開始しましょう。'
          }, 'break');
        }
        setWaitingForWorking(true);
        setPoseScore({
          good: 0,
          catSpine: 0,
          shallowSitting: 0,
          distorting: 0
        });
        setMinutes(timerSettings.workMinutes);
        setSeconds(timerSettings.workSeconds);
        setMode('waitForWorking');
        setIsActive(false);
      }
    } catch (error) {
      console.error("Error completing pomodoro:", error);
    } finally {
      setLoading(false);
    }
  }, [currentUser.uid, selectedCategory, categories, taskName, mode, timerSettings.workMinutes, timerSettings.workSeconds]);

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
    setMinutes(timerSettings.workMinutes);
    setSeconds(timerSettings.workSeconds);
    setWaitingForSmile(false);
    setSessionCount(1);
    console.log("Timer reset");
  }, [timerSettings.workMinutes, timerSettings.workSeconds]);

  // 笑顔検出時の処理
  const handleSmileDetected = useCallback(() => {
    if (waitingForSmile) {
      //休憩開始時
      if (sessionCount == 4) {
        setMinutes(timerSettings.longBreakMinutes);
        setSeconds(timerSettings.longBreakSeconds);
        setSessionCount(0);
      } else {
        setMinutes(timerSettings.breakMinutes);
        setSeconds(timerSettings.breakSeconds);
      }
      setMode('break');
      setIsActive(true);
      setWaitingForSmile(false);
      console.log("Break started due to smile detection");
    } else if (!isActive && taskName && selectedCategory) {
      console.log("Starting timer due to smile detection");
      startTimer();
    }
  }, [isActive, taskName, selectedCategory, startTimer, waitingForSmile, sessionCount, timerSettings.breakMinutes, timerSettings.breakSeconds, timerSettings.longBreakMinutes, timerSettings.longBreakSeconds]);

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

            <div className="mt-4">
              <button
                onClick={() => setShowSettingsModal(true)}
                className="text-gray-600 hover:text-gray-800 text-sm"
              >
                ⚙️ タイマー設定
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

      {/* タイマー設定モーダル（新規追加） */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full relative">
            <h3 className="text-lg font-medium mb-4">タイマー設定</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  作業時間（分）
                </label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={timerSettings.workMinutes}
                  onChange={(e) => setTimerSettings(prev => ({
                    ...prev,
                    workMinutes: parseInt(e.target.value) || 0
                  }))}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                />
              </div>

              {/* 作業時間の秒設定 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  作業時間（秒）
                </label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={timerSettings.workSeconds}
                  onChange={(e) => setTimerSettings(prev => ({
                    ...prev,
                    workSeconds: parseInt(e.target.value) || 0
                  }))}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  休憩時間（分）
                </label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={timerSettings.breakMinutes}
                  onChange={(e) => setTimerSettings(prev => ({
                    ...prev,
                    breakMinutes: parseInt(e.target.value) || 0
                  }))}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                />
              </div>

              {/* 休憩時間の秒設定 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  休憩時間（秒）
                </label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={timerSettings.breakSeconds}
                  onChange={(e) => setTimerSettings(prev => ({
                    ...prev,
                    breakSeconds: parseInt(e.target.value) || 0
                  }))}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  長い休憩時間（分）
                </label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={timerSettings.longBreakMinutes}
                  onChange={(e) => setTimerSettings(prev => ({
                    ...prev,
                    longBreakMinutes: parseInt(e.target.value) || 0
                  }))}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                />
              </div>

              {/* 長い休憩時間の秒設定 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  長い休憩時間（秒）
                </label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={timerSettings.longBreakSeconds}
                  onChange={(e) => setTimerSettings(prev => ({
                    ...prev,
                    longBreakSeconds: parseInt(e.target.value) || 0
                  }))}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  キャンセル
                </button>
                <button
                  onClick={() => {
                    // 分と秒が両方0の場合は保存しない
                    if (timerSettings.workMinutes === 0 && timerSettings.workSeconds === 0) {
                      alert('作業時間は0分0秒には設定できません');
                      return;
                    }
                    if (timerSettings.breakMinutes === 0 && timerSettings.breakSeconds === 0) {
                      alert('休憩時間は0分0秒には設定できません');
                      return;
                    }
                    if (timerSettings.longBreakMinutes === 0 && timerSettings.longBreakSeconds === 0) {
                      alert('長い休憩時間は0分0秒には設定できません');
                      return;
                    }
                    
                    setMinutes(timerSettings.workMinutes);
                    setSeconds(timerSettings.workSeconds);
                    setShowSettingsModal(false);
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors duration-200"
                >
                  保存
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
