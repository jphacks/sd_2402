import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { Pose } from '@mediapipe/pose';

// ヘルパー関数

// 特定のサイドのランドマークを取得
function getBodyPoints(landmarks, side) {
  if (side === 'left') {
    const shoulder = landmarks[11];
    const elbow = landmarks[13];
    const wrist = landmarks[15];
    return { shoulder, elbow, wrist };
  } else if (side === 'right') {
    const shoulder = landmarks[12];
    const elbow = landmarks[14];
    const wrist = landmarks[16];
    return { shoulder, elbow, wrist };
  }
}

// 2点間の角度を計算
function calculateAngle(point1, point2) {
  const deltaX = Math.abs(point2.x - point1.x);
  const deltaY = Math.abs(point2.y - point1.y);
  const angleRad = Math.atan2(deltaY, deltaX);
  return Math.abs(angleRad * (180 / Math.PI));
}

// 肩のストレッチを検出
function isStretchingShoulder(landmarks, side = 'right') {
  if (!landmarks) return false;

  const { shoulder: shoulder, wrist: wrist } = getBodyPoints(landmarks, side);
  const oppositeSide = side === 'right' ? 'left' : 'right';
  const { elbow: oppositeElbow, wrist: oppositeWrist } = getBodyPoints(landmarks, oppositeSide);

  // 肩と手首の角度を計算
  if (calculateAngle(shoulder, wrist) > 10.0) {
    return false;
  }

  // 反対側の手首と肘の角度を計算
  if ((90.0 - calculateAngle(oppositeWrist, oppositeElbow)) > 45.0) {
    return false;
  }

  // 手首、肘、肩のx座標の順序を確認
  if (side === 'left') {
    if (!(wrist.x < shoulder.x) || !(oppositeElbow.y > oppositeWrist.y)) {
      return false;
    }
  } else if (side === 'right') {
    if (!(wrist.x > shoulder.x) || !(oppositeElbow.y > oppositeWrist.y)) {
      return false;
    }
  }

  return true;
}

// 位置の日本語表示マッピング（追加）
const positionLabels = {
  right_stretch: '右肩',
  left_stretch: '左肩'
};

// 肩のストレッチシーケンス管理クラス
class ShoulderStretchSequence {
  constructor() {
    this.sequence = ['right_stretch', 'left_stretch', 'right_stretch', 'left_stretch'];
    this.holdTimes = {
      right_stretch: 3000,
      left_stretch: 3000
    };
    this.currentStep = 0;
    this.positionStartTime = null;
    this.currentPosition = null;
    this.loopCount = 0;
    this.maxLoops = 1;
  }

  update(position) {
    const currentTime = Date.now();
    const expectedPosition = this.sequence[this.currentStep];

    if (position === expectedPosition) {
      // 正しいポジションにいる場合
      if (this.positionStartTime === null) {
        this.positionStartTime = currentTime;
      }

      const elapsedTime = currentTime - this.positionStartTime;
      const requiredDuration = this.holdTimes[expectedPosition];

      if (elapsedTime >= requiredDuration) {
        // ステップを進める
        this.currentStep++;
        if (this.currentStep >= this.sequence.length) {
          this.loopCount++;
          if (this.loopCount >= this.maxLoops) {
            return true; // シーケンス完了
          }
          this.currentStep = 0;
        }
        this.positionStartTime = null;
      }
    } else {
      // 正しいポジションでない場合、タイマーをリセット
      this.positionStartTime = null;
    }
    return false;
  }

  getNextPosition() {
    return this.sequence[this.currentStep];
  }

  getRemainingLoops() {
    return this.maxLoops - this.loopCount;
  }

  getRemainingTime() {
    if (this.positionStartTime === null) {
      return Math.ceil(this.holdTimes[this.getNextPosition()] / 1000);
    }
    const elapsedTime = Date.now() - this.positionStartTime;
    const remainingTime = Math.max(0, this.holdTimes[this.getNextPosition()] - elapsedTime);
    return Math.ceil(remainingTime / 1000);
  }
}

// シーケンス表示コンポーネント
function SequenceDisplay({ sequence, currentStep, remainingLoops }) {
  return (
    <div className="w-full px-4 py-2 bg-gray-100 rounded-lg mb-4">
      <p className="text-lg text-gray-700">指示に従って肩をストレッチしてください。</p>
      <div className="mt-4">
        <h3 className="text-lg font-semibold text-blue-600">シーケンス</h3>
        <div className="flex items-center justify-center mt-2">
          {sequence.map((step, idx) => (
            <React.Fragment key={idx}>
              {/* ステップアイコン */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 flex items-center justify-center rounded-full mr-2 mb-1 ${
                    idx < currentStep
                      ? 'bg-green-500 text-white'
                      : idx === currentStep
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {idx < currentStep ? '✔️' : idx + 1}
                </div>
                <span
                  className={`text-sm ${
                    idx === currentStep ? 'text-blue-700 font-semibold' : 'text-gray-600'
                  }`}
                >
                  {positionLabels[step]} {/* 日本語表示に変更 */}
                </span>
              </div>
              {/* ステップ間のライン */}
              {idx < sequence.length - 1 && (
                <div className="flex-1 h-1 bg-gray-300 mx-2"></div>
              )}
            </React.Fragment>
          ))}
        </div>
        <p className="mt-4 text-lg text-yellow-600">
          残りループ数: <strong>{remainingLoops}</strong>
        </p>
      </div>
    </div>
  );
}

function ShoulderStretchModal({ onComplete }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const stretchSeqRef = useRef(null);
  const [nextPosition, setNextPosition] = useState('');
  const [completed, setCompleted] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [remainingLoops, setRemainingLoops] = useState(2);
  const [currentPosition, setCurrentPosition] = useState('center');
  const [isWaiting, setIsWaiting] = useState(false);

  useEffect(() => {
    let pose;
    let stream;
    let animationFrameId;

    stretchSeqRef.current = new ShoulderStretchSequence();

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
        console.error('カメラのセットアップに失敗しました:', error);
        onComplete();
      }
    }

    function onResults(results) {
      const canvasElement = canvasRef.current;
      const ctx = canvasElement.getContext('2d');
      const width = canvasElement.width;
      const height = canvasElement.height;

      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(results.image, 0, 0, width, height);

      if (results.poseLandmarks) {
        const landmarks = results.poseLandmarks;

        // ポーズの判定
        let position = 'center';

        if (isStretchingShoulder(landmarks, 'left')) {
          position = 'left_stretch';
        } else if (isStretchingShoulder(landmarks, 'right')) {
          position = 'right_stretch';
        }

        setCurrentPosition(position);

        // シーケンスの更新
        const sequenceCompleted = stretchSeqRef.current.update(position);

        const expectedPosition = stretchSeqRef.current.getNextPosition();
        const isCorrectPosition = position === expectedPosition;

        // isWaitingの更新
        setIsWaiting(isCorrectPosition && stretchSeqRef.current.positionStartTime !== null);

        setNextPosition(expectedPosition);
        setRemainingLoops(stretchSeqRef.current.getRemainingLoops());
        setCountdown(stretchSeqRef.current.getRemainingTime());

        if (sequenceCompleted) {
          setCompleted(true);
          setTimeout(() => {
            onComplete();
          }, 2000);
          return;
        }

        // ランドマークの描画（必要に応じて）
        ctx.fillStyle = '#00FF00';
        for (const landmark of landmarks) {
          ctx.beginPath();
          ctx.arc(landmark.x * width, landmark.y * height, 5, 0, 2 * Math.PI);
          ctx.fill();
        }
      }

      // ポーズ検出の継続
      animationFrameId = requestAnimationFrame(() => {
        pose.send({ image: videoRef.current });
      });
    }

    async function init() {
      await setupCamera();

      pose = new Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
      });

      pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      pose.onResults(onResults);
      pose.send({ image: videoRef.current });
    }

    init();

    return () => {
      if (pose) pose.close();
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-4 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">肩のストレッチ</h2>
        </div>
        <div className="flex flex-col items-center">
          <video ref={videoRef} className="hidden" />
          <canvas ref={canvasRef} className="w-full rounded-lg mb-4" width="640" height="480" />

          {/* シーケンス表示を追加 */}
          <SequenceDisplay
            sequence={['right_stretch','left_stretch', 'right_stretch','left_stretch']}
            currentStep={stretchSeqRef.current ? stretchSeqRef.current.currentStep : 0}
            remainingLoops={remainingLoops}
          />

          <div className="w-full p-4 bg-gray-100 rounded-lg mb-4">
            {isWaiting ? (
              <p className="text-lg text-green-600">
                動作が認識されました。次のステップまで <strong>{countdown}</strong> 秒残りです。
              </p>
            ) : (
              <>
                <p className="text-lg text-gray-700">指示に従って肩をストレッチしてください。</p>
                {nextPosition != null && (<p className="mt-2 text-lg text-blue-600">
                  次の動作: <strong>{nextPosition.replace('_', ' ')}</strong>
                </p>
              )}
              </>
            )}
          </div>

          {completed && !isWaiting && (
            <p className="text-2xl font-semibold text-green-500">
              ストレッチ完了！お疲れさまでした。
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function startShoulderStretch() {
  return new Promise((resolve) => {
    const shoulderStretchRoot = document.createElement('div');
    shoulderStretchRoot.id = 'shoulder-stretch-root';
    document.body.appendChild(shoulderStretchRoot);

    const onComplete = () => {
      const root = document.getElementById('shoulder-stretch-root');
      if (root) {
        ReactDOM.unmountComponentAtNode(root);
        root.remove();
      }
      resolve();
    };

    ReactDOM.render(
      <ShoulderStretchModal onComplete={onComplete} />,
      shoulderStretchRoot
    );
  });
}

export default ShoulderStretchModal;