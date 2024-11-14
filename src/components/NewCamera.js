import React, { useState, useRef, useEffect, useCallback } from "react";
import Webcam from "react-webcam";
import * as faceapi from 'face-api.js';
import { Holistic } from '@mediapipe/holistic';

function Camera({ mode, setMode, waitForWorking, stdUrl, setStdUrl, setPoseScore, onSmileDetected }) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isSmiling, setIsSmiling] = useState(false);
  const [stdFeatures, setStdFeatures] = useState(null);
  const [isHolisticReady, setIsHolisticReady] = useState(false);
  
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const holisticRef = useRef(null);
  const isProcessingRef = useRef(false);
  const isMountedRef = useRef(true);
  const captureIntervalRef = useRef(null);
  const isDeletedRef = useRef(false);
  const smileDetectionIntervalRef = useRef(null);
  
  const DEBUG = true;

  const SHOULDER_THRESHOLD = 0.02;
  const FACEAREA_THRESHOLD = 1.05;
  const DISTORTION_THRESHOLD = 0.05;
  const CAPTURE_INTERVAL = 5000; // 5秒間隔

  // Helper functions
  const distance = (x1, y1, x2, y2) => {
    return Math.sqrt(Math.pow((x2 - x1), 2) + Math.pow((y2 - y1), 2));
  };

  const isVideoReady = useCallback(() => {
    const video = webcamRef.current?.video;
    return (
      video &&
      video.readyState === 4 &&
      video.videoWidth > 0 &&
      video.videoHeight > 0 &&
      !video.paused &&
      !video.ended
    );
  }, []);

  const cleanupHolistic = useCallback(() => {
    if (holisticRef.current && !isDeletedRef.current) {
      try {
        isDeletedRef.current = true;
        holisticRef.current.close();
        holisticRef.current = null;
      } catch (error) {
        console.log('Cleanup error (safe to ignore):', error);
      }
    }
  }, []);

  const getImportantFeatures = useCallback((results) => {
    if (!results.poseLandmarks || !results.faceLandmarks) {
      if (DEBUG) {
        console.log('Missing landmarks:', {
          hasPose: !!results.poseLandmarks,
          hasFace: !!results.faceLandmarks
        });
      }
      return null;
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

    if (DEBUG) {
      console.log('Extracted features:', {
        faceArea,
        leftShoulderY: leftShoulder.y,
        rightShoulderY: rightShoulder.y
      });
    }

    return {
      left_shoulder: leftShoulder,
      right_shoulder: rightShoulder,
      face_area: faceArea,
    };
  }, []);

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

  const isCatSpine = useCallback((curr) => {
    return isBiggerFace(curr) && isLowerShoulders(curr);
  }, [isBiggerFace, isLowerShoulders]);

  const isShallowSitting = useCallback((curr) => {
    return isSmallerFace(curr) && isLowerShoulders(curr);
  }, [isSmallerFace, isLowerShoulders]);

  const isDistorting = useCallback((curr) => {
    if (!stdFeatures || !curr) return false;
    return Math.abs(curr.left_shoulder.y - curr.right_shoulder.y) > DISTORTION_THRESHOLD;
  }, [stdFeatures]);

  const calculatePoseScores = useCallback((currentFeatures) => {
    const scores = {
      good: 0,
      catSpine: 0,
      shallowSitting: 0,
      distorting: 0
    };

    if (isCatSpine(currentFeatures)) {
      scores.catSpine = 1;
      if (DEBUG) console.log('Cat spine detected');
    } else if (isShallowSitting(currentFeatures)) {
      scores.shallowSitting = 1;
      if (DEBUG) console.log('Shallow sitting detected');
    } else if (isDistorting(currentFeatures)) {
      scores.distorting = 1;
      if (DEBUG) console.log('Distortion detected');
    } else {
      scores.good = 1;
      if (DEBUG) console.log('Good posture detected');
    }

    return scores;
  }, [isCatSpine, isShallowSitting, isDistorting]);

  // Face detection model loading
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

  // Smile detection
  const detectExpressions = useCallback(async () => {
    if (!isMountedRef.current) return;
    if (!webcamRef.current?.video || webcamRef.current.video.readyState !== 4) return;

    try {
      const video = webcamRef.current.video;
      const detections = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceExpressions();

      if (!isMountedRef.current) return;

      if (detections) {
        const smile = detections.expressions.happy;
        const wasSmiling = isSmiling;

        if (smile > 0.7) {
          if (waitForWorking && !stdUrl) {
            const imgSrc = webcamRef.current?.getScreenshot();
            setStdUrl(imgSrc);
          }
          if (mode === 'waitForWorking') {
            setMode('work');
          }
          setIsSmiling(true);

          if (!wasSmiling && onSmileDetected) {
            console.log("Smile detected, confidence:", smile);
            onSmileDetected();
          }
        } else {
          setIsSmiling(false);
        }
      }
    } catch (error) {
      if (isMountedRef.current) {
        console.error("Error during expression detection:", error);
      }
    }
  }, [isSmiling, onSmileDetected, waitForWorking, stdUrl, setStdUrl, mode, setMode]);

  // Holistic setup
  useEffect(() => {
    let holistic = null;

    const initializeHolistic = async () => {
      if (!isEnabled || !isMountedRef.current || isDeletedRef.current) return;

      try {
        if (holisticRef.current && !isDeletedRef.current) {
          console.log('Reusing existing Holistic instance');
          return;
        }

        isDeletedRef.current = false;

        holistic = new Holistic({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`
        });

        holistic.onResults((results) => {
          if (!isMountedRef.current || !holistic || isDeletedRef.current) return;
          
          if (DEBUG) {
            console.log('Holistic results received:', {
              timestamp: new Date().toISOString(),
              hasResults: !!results
            });
          }

          const features = getImportantFeatures(results);
          
          if (!features) return;

          if (!stdFeatures) {
            console.log('Setting standard features');
            setStdFeatures(features);
          } else if (mode === 'work') {
            const scores = calculatePoseScores(features);
            setPoseScore(prev => ({
              good: (prev?.good || 0) + scores.good,
              catSpine: (prev?.catSpine || 0) + scores.catSpine,
              shallowSitting: (prev?.shallowSitting || 0) + scores.shallowSitting,
              distorting: (prev?.distorting || 0) + scores.distorting
            }));
          }
        });

        await holistic.initialize();

        if (isMountedRef.current) {
          holistic.setOptions({
            upperBodyOnly: true,
            smoothLandmarks: true,
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.7
          });
          
          holisticRef.current = holistic;
          setIsHolisticReady(true);
          console.log('Holistic setup completed');
        } else {
          holistic.close();
        }
      } catch (error) {
        console.error('Error initializing Holistic:', error);
        if (holistic) {
          holistic.close();
        }
        setIsHolisticReady(false);
      }
    };

    if (isEnabled) {
      initializeHolistic();
    }

    return () => {
      if (isDeletedRef.current || !isEnabled) {
        cleanupHolistic();
        setIsHolisticReady(false);
      }
    };
  }, [isEnabled, cleanupHolistic, getImportantFeatures, calculatePoseScores, mode, stdFeatures, setPoseScore]);

  // Capture posture
  const capturePosture = useCallback(async () => {
    if (
      isProcessingRef.current || 
      !holisticRef.current || 
      !webcamRef.current?.video ||
      isDeletedRef.current ||
      !isHolisticReady
    ) {
      if (DEBUG) {
        console.log('Capture skipped:', {
          isProcessing: isProcessingRef.current,
          hasHolistic: !!holisticRef.current,
          hasVideo: !!webcamRef.current?.video,
          isDeleted: isDeletedRef.current,
          isHolisticReady
        });
      }
      return;
    }

    try {
      isProcessingRef.current = true;
      const video = webcamRef.current.video;

      if (!video.videoWidth || !video.videoHeight || video.readyState !== 4) {
        console.log('Video not ready for capture');
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);

      if (holisticRef.current && isMountedRef.current && !isDeletedRef.current) {
        if (DEBUG) console.log('Sending image to Holistic');
        await holisticRef.current.send({ image: canvas });
      }
    } catch (error) {
      console.error('Error capturing posture:', error);
    } finally {
      isProcessingRef.current = false;
    }
  }, [isHolisticReady]);

  // Face detection interval
  useEffect(() => {
    let isActive = true;

    const startDetection = async () => {
      if (!isEnabled || !isModelLoaded || !isActive || !isMountedRef.current) return;

      await detectExpressions();

      if (isActive && isMountedRef.current) {
        smileDetectionIntervalRef.current = setTimeout(startDetection, 1000);
      }
    };

    if (isEnabled && isModelLoaded) {
      startDetection();
    }

    return () => {
      isActive = false;
      if (smileDetectionIntervalRef.current) {
        clearTimeout(smileDetectionIntervalRef.current);
        smileDetectionIntervalRef.current = null;
      }
    };
  }, [isEnabled, isModelLoaded, detectExpressions]);

  // Posture capture interval - 5秒間隔に変更
  useEffect(() => {
    let isActive = true;

    const startPoseCapture = async () => {
      if (!isEnabled || mode !== 'work' || !isActive || !isMountedRef.current) return;

      await capturePosture();

      if (isActive && isMountedRef.current) {
        captureIntervalRef.current = setTimeout(startPoseCapture, CAPTURE_INTERVAL);
      }
    };

    if (isEnabled && mode === 'work') {
      startPoseCapture();
    }

    return () => {
      isActive = false;
      if (captureIntervalRef.current) {
        clearTimeout(captureIntervalRef.current);
        captureIntervalRef.current = null;
      }
    };
  }, [isEnabled, mode, capturePosture]);

  // コンポーネントのマウント/アンマウント管理
  useEffect(() => {
    isMountedRef.current = true;
    isDeletedRef.current = false;

    return () => {
      isMountedRef.current = false;
      cleanupHolistic();
      
      if (smileDetectionIntervalRef.current) {
        clearTimeout(smileDetectionIntervalRef.current);
      }
      if (captureIntervalRef.current) {
        clearTimeout(captureIntervalRef.current);
      }
    };
  }, [cleanupHolistic]);

  const handleCameraToggle = useCallback(() => {
    setIsEnabled(prev => {
      if (!prev) {
        isDeletedRef.current = false;
        setStdFeatures(null);
        setPoseScore({
          good: 0,
          catSpine: 0,
          shallowSitting: 0,
          distorting: 0
        });
      } else {
        cleanupHolistic();
        if (captureIntervalRef.current) {
          clearTimeout(captureIntervalRef.current);
          captureIntervalRef.current = null;
        }
        if (smileDetectionIntervalRef.current) {
          clearTimeout(smileDetectionIntervalRef.current);
          smileDetectionIntervalRef.current = null;
        }
      }
      return !prev;
    });
  }, [cleanupHolistic, setPoseScore]);

  const videoConstraints = {
    width: 640,
    height: 480,
    facingMode: "user"
  };

  const renderDebugInfo = () => {
    if (!DEBUG) return null;

    return (
      <div className="mt-2 text-xs text-gray-500">
        <div>Mode: {mode}</div>
        <div>Has Standard Features: {stdFeatures ? 'Yes' : 'No'}</div>
        <div>Processing: {isProcessingRef.current ? 'Yes' : 'No'}</div>
        <div>Holistic Ready: {isHolisticReady ? 'Yes' : 'No'}</div>
        <div>Video Ready: {isVideoReady() ? 'Yes' : 'No'}</div>
        <div>Next Capture: {captureIntervalRef.current ? 'Scheduled' : 'Not Scheduled'}</div>
      </div>
    );
  };

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
            😊 笑顔を検出しました！
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
      
      {renderDebugInfo()}
      
      <div className="mt-4 text-sm text-gray-500 text-center">
        笑顔を検出するとポモドーロが開始されます
        <div className="text-xs text-gray-400">
          姿勢検出は5秒ごとに行われます
        </div>
      </div>
    </div>
  );
}

export default Camera;
