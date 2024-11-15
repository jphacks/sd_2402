import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { FaceMesh } from '@mediapipe/face_mesh';

// 顔のヨー角を計算する関数
function calculateHeadYaw(landmarks, imageWidth, imageHeight) {
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  const noseTip = landmarks[1];

  const leftEyePos = [leftEye.x * imageWidth, leftEye.y * imageHeight];
  const rightEyePos = [rightEye.x * imageWidth, rightEye.y * imageHeight];
  const noseTipPos = [noseTip.x * imageWidth, noseTip.y * imageHeight];

  const eyeCenter = [
    (leftEyePos[0] + rightEyePos[0]) / 2,
    (leftEyePos[1] + rightEyePos[1]) / 2,
  ];

  const vector = [
    noseTipPos[0] - eyeCenter[0],
    noseTipPos[1] - eyeCenter[1],
  ];

  const angleRad = Math.atan2(vector[0], vector[1]);
  const angleDeg = angleRad * (180 / Math.PI);

  return -angleDeg; // ヨー角を反転
}

// 位置の日本語表示マッピング（追加）
const positionLabels = {
  left: '左',
  right: '右',
  center: '中央'
};

// ストレッチシーケンス管理クラス
class StretchSequence {
  constructor(requiredDuration = 2000, maxLoops = 1) { // ミリ秒単位、最大ループ数
    this.sequence = ['left', 'right', 'left', 'right']; // シーケンスを変更
    this.currentStep = 0;
    this.requiredDuration = requiredDuration;
    this.positionStartTime = null;
    this.currentPosition = null;
    this.loopCount = 0;
    this.maxLoops = maxLoops;
  }

  update(position) {
    const currentTime = Date.now();

    if (position !== this.currentPosition) {
      // 位置が変わった場合、タイマーをリセット
      this.currentPosition = position;
      this.positionStartTime = currentTime;
      return false;
    }

    if (this.positionStartTime === null) {
      this.positionStartTime = currentTime;
    }

    const elapsedTime = currentTime - this.positionStartTime;
    if (elapsedTime >= this.requiredDuration) {
      const expected = this.sequence[this.currentStep];
      if (position === expected) {
        console.log(`ステップ '${expected}' 完了`);
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
        this.positionStartTime = currentTime;
      }
    }

    return false;
  }

  getNextPosition() {
    return this.sequence[this.currentStep];
  }

  getRemainingLoops() {
    return this.maxLoops - this.loopCount;
  }

  reset() {
    this.currentStep = 0;
    this.positionStartTime = null;
    this.currentPosition = null;
    this.loopCount = 0;
  }
}

// シーケンス表示コンポーネント（修正後）
function SequenceDisplay({ sequence, currentStep, remainingLoops }) {
  return (
    <div className="w-full px-4 py-2 bg-gray-100 rounded-lg mb-4">
      <p className="text-lg text-gray-700">指示に従って首をストレッチしてください。</p>
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

// ストレッチモーダルコンポーネント
function NeckStretchModal({ onComplete }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const stretchSeqRef = useRef(null); // StretchSequenceを参照として保持
  const [nextPosition, setNextPosition] = useState('');
  const [completed, setCompleted] = useState(false);
  const [countdown, setCountdown] = useState(0); // カウントダウンタイマー
  const [remainingLoops, setRemainingLoops] = useState(1);
  const [sequence, setSequence] = useState(['left', 'right', 'left', 'right']); // 初期シーケンスを変更
  const [isWaiting, setIsWaiting] = useState(false); // 2秒間待機中かどうか

  useEffect(() => {
    let animationFrameId;
    let faceMesh;
    let stream;
    let countdownInterval;

    // StretchSequenceのインスタンスを作成し、refに保存
    stretchSeqRef.current = new StretchSequence(2000, 1); // 2秒間、3ループ
    setNextPosition(stretchSeqRef.current.getNextPosition());
    setRemainingLoops(stretchSeqRef.current.getRemainingLoops());

    // カメラのセットアップ
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
        onComplete(); // エラー時にもモーダルを閉じる
      }
    }

    // フレーム処理
    function onResults(results) {
      const canvasElement = canvasRef.current;
      const ctx = canvasElement.getContext('2d');
      const width = canvasElement.width;
      const height = canvasElement.height;

      // キャンバスを水平反転
      ctx.save();
      ctx.scale(-1, 1);
      ctx.translate(-width, 0);

      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(results.image, 0, 0, width, height);

      if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];
        const yaw = calculateHeadYaw(landmarks, width, height);

        // ヨー角に基づいて位置を判定
        let position = 'center';
        if (yaw > 25) {
          position = 'left';
        } else if (yaw < -25) {
          position = 'right';
        }

        // シーケンスを更新
        const sequenceCompleted = stretchSeqRef.current.update(position);
        if (sequenceCompleted) {
          setIsWaiting(true); // 待機状態に移行
          setCompleted(true);

          // カウントダウンを開始
          let remainingSeconds = 2; // 2秒間待機
          setCountdown(remainingSeconds);

          countdownInterval = setInterval(() => {
            remainingSeconds -= 1;
            if (remainingSeconds >= 0) {
              setCountdown(remainingSeconds);
            }
            if (remainingSeconds <= 0) {
              clearInterval(countdownInterval);
              setIsWaiting(false);
              // ループが残っている場合は次のステップを設定
              if (stretchSeqRef.current.getRemainingLoops() > 0) {
                setNextPosition(stretchSeqRef.current.getNextPosition());
                setRemainingLoops(stretchSeqRef.current.getRemainingLoops());
              } else {
                // ループが完了した場合はモーダルを閉じる
                onComplete();
              }
            }
          }, 1000);

          return;
        }

        setNextPosition(stretchSeqRef.current.getNextPosition());
        setRemainingLoops(stretchSeqRef.current.getRemainingLoops());

        // ガイドラインを表示（鏡像対応）
        displayGuideline(
          ctx,
          stretchSeqRef.current.getNextPosition(),
          [width / 2, height / 2 - 20],
          { width: width * 0.2, height: height * 0.3 }, // 相対的なサイズ
          width * 0.25, // シフト距離をキャンバス幅の約 46.875% に設定
          width
        );

        // カウントダウンタイマーの設定
        if (stretchSeqRef.current.positionStartTime) {
          const elapsed = Date.now() - stretchSeqRef.current.positionStartTime;
          const remaining = Math.max(0, Math.ceil((stretchSeqRef.current.requiredDuration - elapsed) / 1000));
          setCountdown(remaining);

          if (remaining > 0) {
            setIsWaiting(true);
          } else {
            setIsWaiting(false);
          }
        }
      }

      // キャンバスの反転を解除
      ctx.restore();

      // シーケンスの表示を描画（反転なし）
      displaySequence(ctx, stretchSeqRef.current, width);

      animationFrameId = requestAnimationFrame(() => {
        faceMesh.send({ image: videoRef.current });
      });
    }

    // シーケンス表示関数（キャンバス上での描画を削除）
    function displaySequence(ctx, seqObj, canvasWidth) {
      // 既にシーケンス表示はTailwind CSSで実装されているため、ここでは何もしません。
      // 必要に応じて追加の描画処理があれば実装します。
    }

    // ガイドライン表示関数（修正後）
    function displayGuideline(ctx, expectedPosition, centerPoint, ellipseSize, shiftDistance, canvasWidth) {
      let angle = 0;
      let shiftedCenter = centerPoint;

      if (expectedPosition === 'left') {
        angle = 20; // 左に傾けるため正の角度
        shiftedCenter = [centerPoint[0] - shiftDistance, centerPoint[1]];
      } else if (expectedPosition === 'right') {
        angle = -20; // 右に傾けるため負の角度
        shiftedCenter = [centerPoint[0] + shiftDistance, centerPoint[1]];
      }

      // x座標を反転
      const mirroredX = canvasWidth - shiftedCenter[0];

      ctx.beginPath();
      ctx.ellipse(
        mirroredX,
        shiftedCenter[1],
        ellipseSize.width,
        ellipseSize.height,
        (angle * Math.PI) / 180,
        0,
        2 * Math.PI
      );
      ctx.strokeStyle = '#FFC107';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // 初期化処理
    async function init() {
      await setupCamera();

      faceMesh = new FaceMesh({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
        },
      });

      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      faceMesh.onResults(onResults);

      // 最初のフレームを送信
      faceMesh.send({ image: videoRef.current });
    }

    init();

    // クリーンアップ
    return () => {
      if (faceMesh) faceMesh.close();
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      cancelAnimationFrame(animationFrameId);
      if (countdownInterval) clearInterval(countdownInterval);
    };
  }, [onComplete]);

  return ReactDOM.createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-4 w-full max-w-md relative">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-2xl font-bold text-gray-800">首のストレッチ</h2>
          {/* 閉じるボタン 削除
          <button
            onClick={() => {
              ReactDOM.unmountComponentAtNode(document.getElementById('neck-stretch-root'));
              const existing = document.getElementById('neck-stretch-root');
              if (existing) {
                existing.remove();
              }
              onComplete(); // モーダルを閉じた際にも Promise を解決
            }}
            className="text-gray-500 hover:text-gray-700 focus:outline-none"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          */}
        </div>
        <div className="flex flex-col items-center">
          <video ref={videoRef} className="hidden"></video>
          <canvas ref={canvasRef} className="border rounded-lg mb-4" width="320" height="240"></canvas>
          
          {/* 修正後のシーケンス表示 */}
          <SequenceDisplay
            sequence={sequence}
            currentStep={stretchSeqRef.current ? stretchSeqRef.current.currentStep : 0}
            remainingLoops={remainingLoops}
          />

          <div className="w-full px-4 py-2 bg-gray-100 rounded-lg mb-4">
            {isWaiting ? (
              <p className="text-lg text-green-600">
                動作が認識されました。次のステップまで <strong>{countdown}</strong> 秒残りです。
              </p>
            ) : (
              <>
                <p className="text-lg text-gray-700">指示に従って首をストレッチしてください。</p>
                <p className="mt-2 text-lg text-blue-600">
                  次の動作: <strong>{positionLabels[nextPosition]}</strong> {/* 日本語表示に変更 */}
                </p>
              </>
            )}
            <div className="flex justify-between mt-4">
              {!isWaiting && (
                <p className="text-lg text-red-600">
                  残り時間: <strong>{countdown}</strong> 秒
                </p>
              )}
              {/*<p className="text-lg text-yellow-600">
                残りループ数: <strong>{remainingLoops}</strong>
              </p>*/}
            </div>
          </div>
          {completed && !isWaiting && (
            <p className="text-2xl font-semibold text-green-500">
              ストレッチ完了！
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ストレッチ開始関数
export function startNeckStretch() {
  return new Promise((resolve, reject) => {
    const onComplete = () => {
      ReactDOM.unmountComponentAtNode(document.getElementById('neck-stretch-root'));
      const existing = document.getElementById('neck-stretch-root');
      if (existing) {
        existing.remove();
      }
      resolve(); // Promise を解決
    };

    const neckStretchRoot = document.createElement('div');
    neckStretchRoot.id = 'neck-stretch-root';
    document.body.appendChild(neckStretchRoot);

    ReactDOM.render(<NeckStretchModal onComplete={onComplete} />, neckStretchRoot);
  });
}

export default NeckStretchModal;












