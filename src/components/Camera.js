import React, { useState, useRef, useEffect, useCallback } from "react";
import Webcam from "react-webcam";
import * as faceapi from 'face-api.js';
import { Holistic } from '@mediapipe/holistic';


function Camera({ mode, waitForWorking, stdUrl, setStdUrl, setPoseScore, onSmileDetected }) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isSmiling, setIsSmiling] = useState(false);
  const [count, setCount] = useState(0);
  const [stdFeatures, setStdFeatures] = useState(null);
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const holisticRef = useRef(null);
  const SHOULDER_THRESHOLD = 0.05
  const FACEAREA_THRESHOLD = 1.1
  const DISTORTION_THRESHOLD = 0.05

  // Helper functions
  const distance = (x1, y1, x2, y2) => {
    return Math.sqrt(Math.pow((x2 - x1), 2) + Math.pow((y2 - y1), 2));
  };

  const getImportantFeatures = useCallback((results) => {
    if (!results.poseLandmarks || !results.faceLandmarks) {
      return stdFeatures;
    }

    const landmarks = results.poseLandmarks;
    const faceLandmarks = results.faceLandmarks;

    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    
    const top = faceLandmarks[10];
    const bottom = faceLandmarks[152];
    const left = faceLandmarks[356];
    const right = faceLandmarks[127];

    const height = distance(top.x, top.y, bottom.x, bottom.y);
    const width = distance(left.x, left.y, right.x, right.y);
    const faceArea = height * width;

    return {
      left_shoulder: leftShoulder,
      right_shoulder: rightShoulder,
      face_area: faceArea,
    };
  }, [stdFeatures]);

  const isBiggerFace = useCallback((curr) => {
    if (!stdFeatures || !curr) return false;
    return curr.face_area / stdFeatures.face_area > FACEAREA_THRESHOLD;
  }, [stdFeatures]);

  const isSmallerFace = useCallback((curr) => {
    if (!stdFeatures || !curr) return false;
    return stdFeatures.face_area / curr.face_area > FACEAREA_THRESHOLD;
  }, [stdFeatures]);

  const isLowerShoulders = useCallback((curr) => {
    if (!stdFeatures || !curr) return false;
    const currentShouldersHeight = (curr.left_shoulder.y + curr.right_shoulder.y) / 2;
    const stdShouldersHeight = (stdFeatures.left_shoulder.y + stdFeatures.right_shoulder.y) / 2;
    return stdShouldersHeight - currentShouldersHeight > SHOULDER_THRESHOLD;
  }, [stdFeatures]);

  const isCatSpain = useCallback((curr) => {
    return isBiggerFace(curr) && isLowerShoulders(curr);
  }, [isBiggerFace, isLowerShoulders]);

  const isShallowSitting = useCallback((curr) => {
    return isSmallerFace(curr) && isLowerShoulders(curr);
  }, [isSmallerFace, isLowerShoulders]);

  const isDistorting = useCallback((curr) => {
    if (!stdFeatures || !curr) return false;
    return Math.abs(curr.left_shoulder.y - curr.right_shoulder.y) > DISTORTION_THRESHOLD;
  }, [stdFeatures]);

  // Holistic setup
  useEffect(() => {
    holisticRef.current = new Holistic({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`
    });

    holisticRef.current.setOptions({
      upperBodyOnly: false,
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    holisticRef.current.onResults((results) => {
      if (!stdFeatures) {
        setStdFeatures(getImportantFeatures(results));
      } else {
        const currentFeatures = getImportantFeatures(results);
        
        if (isCatSpain(currentFeatures)) {
          setPoseScore((prev) => ({
            ...prev,
            catSpain: prev.catSpain + 1
          }));
        } else if (isShallowSitting(currentFeatures)) {
          setPoseScore((prev) => ({
            ...prev,
            shallowSitting: prev.shallowSitting + 1
          }));
        } else if (isDistorting(currentFeatures)) {
          setPoseScore((prev) => ({
            ...prev,
            distorting: prev.distorting + 1
          }));
        } else {
          setPoseScore((prev) => ({
            ...prev,
            good: prev.good + 1
          }));
        }
      }
    });

    return () => {
      if (holisticRef.current) {
        holisticRef.current.close();
      }
    };
  }, [stdFeatures, getImportantFeatures, isCatSpain, isShallowSitting, isDistorting, setPoseScore]);


  // モデルの読み込み
  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceExpressionNet.loadFromUri('/models')
        ]);
        console.log("Face detection models loaded successfully");
        setIsModelLoaded(true);
      } catch (error) {
        console.error("Error loading models:", error);
      }
    };
    loadModels();
  }, []);


  // 表情認識の処理
  const detectExpressions = useCallback(async () => {
    if (webcamRef.current && webcamRef.current.video && webcamRef.current.video.readyState === 4) {
      const video = webcamRef.current.video;
      try {
        const detections = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
          .withFaceExpressions();

        if (detections) {
          const smile = detections.expressions.happy;
          const wasSmiling = isSmiling;  // 前の状態を保存
          // 基準の設定
          if (smile > 0.7) {
            if (waitForWorking && !stdUrl) {
              const imgSrc = webcamRef.current?.getScreenshot();
              setStdUrl(imgSrc);
            }
            setIsSmiling(true)
          }

          // 笑顔を検出し、かつ前回は笑顔でなかった場合のみonSmileDetectedを呼び出す
          if (smile > 0.7 && !wasSmiling && onSmileDetected) {
            setCount(count + 1);
            console.log("Smile detected, confidence:", smile);
            onSmileDetected();
          }

        }
      } catch (error) {
        console.error("Error during expression detection:", error);
      }
    }
  }, [isSmiling, onSmileDetected]);

  // 表情認識の定期実行
  useEffect(() => {
    let detectInterval;

    if (isEnabled && isModelLoaded) {
      console.log("Starting expression detection interval");
      detectInterval = setInterval(detectExpressions, 1000);
    }

    return () => {
      if (detectInterval) {
        console.log("Cleaning up expression detection interval");
        clearInterval(detectInterval);
      }
    };
  }, [isEnabled, isModelLoaded, detectExpressions]);

  // Capture posture
  const capturePosture = useCallback(async () => {
    if (webcamRef.current && webcamRef.current.video && holisticRef.current) {
      const video = webcamRef.current.video;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      const imageData = canvas.toDataURL('image/jpeg');
      
      const img = new Image();
      img.src = imageData;
      img.onload = () => {
        if (holisticRef.current) {
          holisticRef.current.send({ image: img });
        }
      };
    }
  }, []);

  useEffect(() => {
    let interval;
    if (mode === 'work' && isEnabled) {
      interval = setInterval(capturePosture, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [mode, isEnabled, capturePosture]);

  // 基準設定用
  useEffect(() => {
    if (holisticRef.current){
      holisticRef.current.send({image: stdUrl});
    }
  }, [stdUrl]);

  const videoConstraints = {
    width: 640,
    height: 480,
    facingMode: "user"
  };

  const handleCameraToggle = useCallback(() => {
    setIsEnabled(prev => !prev);
    if (!isEnabled) {
      console.log("Camera enabled");
    } else {
      console.log("Camera disabled");
    }
  }, [isEnabled]);

  

  return (
    <div className="relative">
      <div className="mb-4 flex justify-between items-center">
        <button
          onClick={handleCameraToggle}
          className={`px-4 py-2 rounded-md transition-colors duration-200 ${
            isEnabled 
              ? 'bg-red-600 text-white hover:bg-red-700' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {isEnabled ? 'カメラを停止' : 'カメラを開始'}
        </button>
        {isEnabled && isSmiling && (
          <div className="text-green-500 font-medium animate-pulse">
            😊 笑顔を検出しました！{count}
          </div>
        )}
      </div>

      <div className="relative">
        {isEnabled && (
          <>
            <Webcam
              ref={webcamRef}
              audio={false}
              width={640}
              height={480}
              screenshotFormat="image/jpeg"
              videoConstraints={videoConstraints}
              className="rounded-lg shadow-lg w-full"
              mirrored={true}
              onUserMediaError={(error) => {
                console.error("Webcam error:", error);
              }}
            />
            <canvas
              ref={canvasRef}
              className="absolute top-0 left-0 w-full h-full"
            />
          </>
        )}

        {!isEnabled && (
          <div className="bg-gray-100 rounded-lg p-8 text-center">
            <p className="text-gray-600">
              カメラをオンにして笑顔を検出します
            </p>
          </div>
        )}
      </div>

      {isEnabled && !isModelLoaded && (
        <div className="mt-2 text-center text-gray-600 animate-pulse">
          モデルを読み込んでいます...
        </div>
      )}
      
      <div className="mt-4 text-sm text-gray-500 text-center">
        笑顔を検出するとポモドーロが開始されます
      </div>
    </div>
  );
}

export default Camera;
