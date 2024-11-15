import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { Pose } from '@mediapipe/pose';

// 角度計算関数の改善
function calculateAngle(a, b) {
  // ベクトル: ヒップからショルダーへ
  const vector = [b[0] - a[0], b[1] - a[1]];
  // 垂直上方向のベクトル
  const vertical = [0, -1];
  
  // ベクトルの長さを計算
  const vectorLength = Math.sqrt(vector[0] * vector[0] + vector[1] * vector[1]);
  const verticalLength = 1;  // 垂直ベクトルの長さは1

  // 内積を計算
  const dotProduct = vector[0] * vertical[0] + vector[1] * vertical[1];
  
  // 角度を計算（アークコサインを使用）
  const angle = Math.acos(dotProduct / (vectorLength * verticalLength));
  const angleDegrees = angle * (180 / Math.PI);

  // 左右の向きを判定
  const cross = vector[0] * vertical[1] - vector[1] * vertical[0];
  return cross < 0 ? angleDegrees : -angleDegrees;
}

// ストレッチシーケンス管理クラス
class StretchSequence {
  constructor() {
    this.sequence = ['forward', 'backward', 'forward', 'backward'];
    this.holdTimes = { center: 2000, forward: 2000, backward: 2000 }; // キープ時間を2000ミリ秒に統一
    this.currentStep = 0;
    this.positionStartTime = null;
    this.currentPosition = null;
    this.loopCount = 0;
    this.maxLoops = 1; 
  }

  update(position) {
    const currentTime = Date.now();
    const expectedPosition = this.getNextPosition();

    // 期待するポジションと現在のポジションが一致する場合のみ時間を計測
    if (position === expectedPosition) {
      if (position !== this.currentPosition || this.positionStartTime === null) {
        this.currentPosition = position;
        this.positionStartTime = currentTime;
      }

      const elapsedTime = currentTime - this.positionStartTime;
      const requiredDuration = this.holdTimes[expectedPosition];

      if (elapsedTime >= requiredDuration) {
        console.log(`ステップ '${expectedPosition}' 完了`);
        this.currentStep += 1;
        if (this.currentStep >= this.sequence.length) {
          this.loopCount += 1;
          console.log(`ループ回数: ${this.loopCount}/${this.maxLoops}`);
          if (this.loopCount >= this.maxLoops) {
            console.log('ストレッチシーケンス完了！');
            return true; // シーケンス完了
          }
          this.currentStep = 0;
        }
        this.positionStartTime = null;
        this.currentPosition = null;
      }
    } else {
      // ポジションが一致しない場合はタイマーをリセット
      this.positionStartTime = null;
      this.currentPosition = position;
    }

    return false;
  }

  getNextPosition() {
    return this.sequence[this.currentStep];
  }

  getRemainingLoops() {
    return this.maxLoops - this.loopCount;
  }

  getHoldTime() {
    return this.holdTimes[this.getNextPosition()];
  }

  reset() {
    this.currentStep = 0;
    this.positionStartTime = null;
    this.currentPosition = null;
    this.loopCount = 0;
  }

  getRemainingTime() {
    if (this.positionStartTime === null || this.currentPosition !== this.getNextPosition()) {
      return Math.ceil(this.getHoldTime() / 1000);
    }
    const elapsedTime = Date.now() - this.positionStartTime;
    const remainingTime = Math.max(0, this.getHoldTime() - elapsedTime);
    return Math.ceil(remainingTime / 1000);
  }
}

// ポジション名の変換関数をコンポーネントの外で定義
const getPositionName = (pos) => {
  switch (pos) {
    case 'forward': return '前屈';
    case 'backward': return '後ろ反り';
    case 'center': return '真ん中';
    default: return pos;
  }
};

// SequenceDisplayコンポーネントの修正
function SequenceDisplay({ sequence, currentStep, remainingLoops }) {
  return (
    <div className="w-full h-1/3 px-4 py-2 bg-gray-100 rounded-lg flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <p className="text-lg text-gray-700">立ち上がって右を向き、腰をストレッチしてください。</p>
      </div>
      <div className="flex-1 flex flex-col">
        <h3 className="text-lg font-semibold text-blue-600 mb-2">シーケンス</h3>
        <div className="flex items-center justify-center mb-2">
          {sequence.map((step, idx) => (
            <React.Fragment key={idx}>
              <div className="flex flex-col items-center">
                <div
                  className={`w-14 h-14 flex items-center justify-center rounded-full mr-2 mb-1 text-xl ${
                    idx < currentStep
                      ? 'bg-green-500 text-white'
                      : idx === currentStep
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {idx < currentStep ? '✔️' : idx + 1}
                </div>
                <span className={`text-sm ${idx === currentStep ? 'text-blue-700 font-semibold' : 'text-gray-600'}`}>
                  {getPositionName(step)}
                </span>
              </div>
              {idx < sequence.length - 1 && (
                <div className="flex-1 h-1 bg-gray-300 mx-2 max-w-[80px]"></div>
              )}
            </React.Fragment>
          ))}
        </div>
        <div className="text-center">
          <p className="text-base text-yellow-600 font-semibold">
            残りループ回数: <strong>{remainingLoops}</strong> 回
          </p>
        </div>
      </div>
    </div>
  );
}

// メインモーダルのグリッドレイアウト調整
function WaistStretchModal({ onComplete }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const stretchSeqRef = useRef(null); // StretchSequenceを参照として保持
  const [nextPosition, setNextPosition] = useState('');
  const [completed, setCompleted] = useState(false);
  const [countdown, setCountdown] = useState(0); // カウントダウンタイマー
  const [remainingLoops, setRemainingLoops] = useState(2);
  const [sequence, setSequence] = useState(['forward', 'backward', 'forward', 'backward']);
  const [isWaiting, setIsWaiting] = useState(false); // 待機中かどうか
  const animationFrameIdRef = useRef(null); // animationFrameIdを管理
  const lastPositionRef = useRef('center');
  const [currentDetectedPosition, setCurrentDetectedPosition] = useState('center');
  const [currentAngle, setCurrentAngle] = useState(0);
  const [message, setMessage] = useState('');
  const lastPositionChangeTime = useRef(null);
  const [canvasSize, setCanvasSize] = useState({ width: 640, height: 480 });

  useEffect(() => {
    const updateCanvasSize = () => {
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const maxHeight = vh * 0.65; // カメラビューの最大高さを65%に増加
      const aspectRatio = 640 / 480;
      
      let newHeight = maxHeight;
      let newWidth = newHeight * aspectRatio;
      
      if (newWidth > vw * 0.85) { // 幅の制限を85%に増加
        newWidth = vw * 0.85;
        newHeight = newWidth / aspectRatio;
      }
      
      setCanvasSize({
        width: Math.floor(newWidth),
        height: Math.floor(newHeight)
      });
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

  useEffect(() => {
    let pose;
    let stream;
    let isMounted = true;

    // StretchSequenceのインスタンスを作成し、refに保存
    stretchSeqRef.current = new StretchSequence();
    setNextPosition(stretchSeqRef.current.getNextPosition());
    setRemainingLoops(stretchSeqRef.current.getRemainingLoops());

    async function setupCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoRef.current.srcObject = stream;
        return new Promise((resolve) => {
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play();
            resolve();
          };
        });
      } catch (error) {
        console.error('カメラのアクセスに失敗しました:', error);
        onComplete(); // エラー時にもモーダルを閉じる
      }
    }

    function onResults(results) {
      if (!isMounted) return;

      const canvasElement = canvasRef.current;
      const canvasCtx = canvasElement.getContext('2d');
      const width = canvasElement.width;
      const height = canvasElement.height;

      // キャンバスをクリア
      canvasCtx.clearRect(0, 0, width, height);

      // 画像を描画（ミラーリング）
      canvasCtx.save();
      canvasCtx.scale(-1, 1);
      canvasCtx.translate(-width, 0);
      canvasCtx.drawImage(results.image, 0, 0, width, height);
      canvasCtx.restore();

      if (results.poseLandmarks) {
        const landmarks = results.poseLandmarks;
        const shoulder = landmarks[11]; // 左肩
        const hip = landmarks[23];      // 左腰

        // 必要なランドマークが全て検出されているかチェック
        const allVisible = shoulder.visibility > 0.5 && hip.visibility > 0.5;

        // ランドマークの可視化
        canvasCtx.fillStyle = 'red';
        canvasCtx.strokeStyle = 'white';
        canvasCtx.lineWidth = 2;
        
        // 肩のランドマーク描画
        canvasCtx.beginPath();
        canvasCtx.arc(width - (shoulder.x * width), shoulder.y * height, 8, 0, 2 * Math.PI);
        canvasCtx.fill();
        canvasCtx.stroke();
        
        // 腰のランドマーク描画
        canvasCtx.beginPath();
        canvasCtx.arc(width - (hip.x * width), hip.y * height, 8, 0, 2 * Math.PI);
        canvasCtx.fill();
        canvasCtx.stroke();
        
        // 肩と腰を結ぶ線を描画
        canvasCtx.beginPath();
        canvasCtx.moveTo(width - (shoulder.x * width), shoulder.y * height);
        canvasCtx.lineTo(width - (hip.x * width), hip.y * height);
        canvasCtx.strokeStyle = 'yellow';
        canvasCtx.lineWidth = 4;
        canvasCtx.stroke();

        // 垂直基準線の描画
        canvasCtx.beginPath();
        canvasCtx.moveTo(width - (hip.x * width), hip.y * height);
        canvasCtx.lineTo(width - (hip.x * width), hip.y * height - 100);
        canvasCtx.strokeStyle = 'blue';
        canvasCtx.setLineDash([5, 5]);
        canvasCtx.stroke();
        canvasCtx.setLineDash([]);

        // 角度の計算を復活させ、表示だけをコメントアウト
        const angle = calculateAngle([hip.x * width, hip.y * height], [shoulder.x * width, shoulder.y * height]);
        /* 表示部分のみコメントアウト
        canvasCtx.font = '20px Arial';
        canvasCtx.fillStyle = 'white';
        canvasCtx.fillText(`角度: ${angle.toFixed(1)}°`, 10, 30);
        */
        
        setCurrentAngle(angle);

        // ポジションの判定（固定の閾値を使用）
        let position = lastPositionRef.current || 'center';

        const forwardThreshold = -25;  // 前屈の閾値（角度が負に大きい）
        const backwardThreshold = 25;  // 後屈の閾値（角度が正に大きい）
        const centerThreshold = 10;     // 中心位置の許容範囲

        if (angle <= forwardThreshold) {
          position = 'forward';
        } else if (angle >= backwardThreshold) {
          position = 'backward';
        } else if (Math.abs(angle) <= centerThreshold) {
          position = 'center';
        }

        // ポジション変更の履歴を保持（急激な変更を防ぐ）
        if (position !== lastPositionRef.current) {
          const now = Date.now();
          if (!lastPositionChangeTime.current || 
              now - lastPositionChangeTime.current > 500) { // 500ms以上経過している場合のみ変更
            lastPositionRef.current = position;
            lastPositionChangeTime.current = now;
          } else {
            position = lastPositionRef.current;
          }
        }

        setCurrentDetectedPosition(position);

        // シーケンスを更新
        const sequenceCompleted = stretchSeqRef.current.update(position);

        // メッセージとタイマーの更新
        const expectedPosition = stretchSeqRef.current.getNextPosition();
        setNextPosition(expectedPosition);
        setRemainingLoops(stretchSeqRef.current.getRemainingLoops());

        // 現在のポジションが期待するポジションと一致する場合のみカウントダウンを表示
        const isCorrectPosition = position === expectedPosition;
        if (isCorrectPosition && stretchSeqRef.current.positionStartTime) {
          const remainingTime = stretchSeqRef.current.getRemainingTime();
          setCountdown(remainingTime);
          setIsWaiting(true);
          setMessage(`${getPositionName(expectedPosition)}の姿勢をキープしてください`);
        } else {
          setIsWaiting(false);
          setCountdown(0);
          setMessage(`次のポジション: ${getPositionName(expectedPosition)}`);
        }

        if (sequenceCompleted) {
          setCompleted(true);
          onComplete();
          return;
        }

        setNextPosition(stretchSeqRef.current.getNextPosition());
        setRemainingLoops(stretchSeqRef.current.getRemainingLoops());

        // カウントダウンタイマーの設定
        if (stretchSeqRef.current.positionStartTime) {
          const remainingTime = stretchSeqRef.current.getRemainingTime();
          setCountdown(remainingTime);
          setIsWaiting(true);
        } else {
          setIsWaiting(false);
          setCountdown(0);
        }
      } else {
        setIsWaiting(false);
        setCountdown(0);
        setCurrentDetectedPosition('検出できません');
        setCurrentAngle(null); // ランドマークが検出できない場合はnullにする
        console.log('Landmarks not visible during sequence'); // デバッグ用
      }

      // 次のフレームを処理
      if (isMounted) {
        animationFrameIdRef.current = requestAnimationFrame(() => {
          pose.send({ image: videoRef.current });
        });
      }
    }

    async function init() {
      await setupCamera();

      pose = new Pose({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
        },
      });

      pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      pose.onResults(onResults);

      // 初回のフレームを処理
      pose.send({ image: videoRef.current });
    }

    init();

    return () => {
      isMounted = false; // アンマウント時にフラグを更新
      if (pose) pose.close();
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [onComplete]);

  return ReactDOM.createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-1 w-[95vw] h-[95vh] flex flex-col">
        <div className="flex justify-between items-center px-3 py-1">
          <h2 className="text-3xl font-bold text-gray-800">腰のストレッチ</h2>
        </div>
        
        <div className="flex-1 grid grid-cols-[2fr,1.2fr] gap-1 p-1 h-full">
          {/* 左側: カメラビュー */}
          <div className="flex flex-col items-center justify-center">
            <video ref={videoRef} className="hidden" />
            <canvas
              ref={canvasRef}
              className="border rounded-lg"
              width={canvasSize.width}
              height={canvasSize.height}
              style={{
                width: `${canvasSize.width}px`,
                height: `${canvasSize.height}px`
              }}
            />
          </div>

          {/* 右側: 情報表示 */}
          <div className="flex flex-col gap-1 h-full">
            <SequenceDisplay
              sequence={sequence}
              currentStep={stretchSeqRef.current ? stretchSeqRef.current.currentStep : 0}
              remainingLoops={remainingLoops}
            />

            <div className="h-1/4 bg-gray-100 rounded-lg p-2 flex items-center justify-center">
              <p className="text-2xl font-semibold text-blue-600">{message}</p>
            </div>

            <div className="flex-1 bg-gray-100 rounded-lg p-3 flex flex-col justify-center">
              <div className="pl-2 mb-4">
                <p className="text-xl text-blue-600 mb-4">
                  現在の姿勢: <strong className="text-2xl">{getPositionName(currentDetectedPosition)}</strong>
                </p>
                <p className="text-xl text-gray-700 mb-4">
                  現在の角度: <strong className="text-2xl">{currentAngle !== null ? currentAngle.toFixed(2) : '検出できません'}</strong>
                </p>
                {isWaiting ? (
                  <p className="text-xl text-green-600 font-semibold">
                    キープしてください: <strong className="text-3xl">{countdown}</strong> 秒
                  </p>
                ) : (
                  <p className="text-xl text-blue-600">
                    次の動作: <strong className="text-2xl">{getPositionName(nextPosition)}</strong>
                  </p>
                )}
              </div>
            </div>

            {completed && !isWaiting && (
              <p className="text-2xl font-semibold text-green-500">ストレッチ完了！</p>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ストレッチ開始関数
export function startWaistStretch() {
  return new Promise((resolve, reject) => {
    const onComplete = () => {
      ReactDOM.unmountComponentAtNode(document.getElementById('waist-stretch-root'));
      const existing = document.getElementById('waist-stretch-root');
      if (existing) {
        existing.remove();
      }
      resolve(); // ストレッチ完了時にPromiseを解決
    };

    const waistStretchRoot = document.createElement('div');
    waistStretchRoot.id = 'waist-stretch-root';
    document.body.appendChild(waistStretchRoot);

    ReactDOM.render(<WaistStretchModal onComplete={onComplete} />, waistStretchRoot);
  });
}

export default WaistStretchModal;




