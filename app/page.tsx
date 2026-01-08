"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export default function OneTapTooLate() {
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameState, setGameState] = useState<"playing" | "gameover">("playing");
  const [feedback, setFeedback] = useState<string>("");
  const [showInstructions, setShowInstructions] = useState(true);
  const [indicatorPosition, setIndicatorPosition] = useState(0);
  const [targetPosition, setTargetPosition] = useState(30);
  const [speed, setSpeed] = useState(0.7);
  const [shake, setShake] = useState(false);
  const [perfect, setPerfect] = useState(false);
  const [combo, setCombo] = useState(0);
  const [showCombo, setShowCombo] = useState(false);

  const animationRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number>(0);
  const canTapRef = useRef(true);
  const instructionTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const TARGET_WIDTH = 14;
  const INDICATOR_WIDTH = 2.5;
  const NEAR_MISS_THRESHOLD = 6;

  useEffect(() => {
    const stored = localStorage.getItem("onetaptoolate_highscore");
    if (stored) setHighScore(parseInt(stored));

    instructionTimerRef.current = setTimeout(() => {
      setShowInstructions(false);
    }, 4000);

    return () => {
      if (instructionTimerRef.current) clearTimeout(instructionTimerRef.current);
    };
  }, []);

  const generateNewTarget = useCallback(() => {
    const minDistance = 25;
    let newPos;
    do {
      newPos = Math.random() * (85 - TARGET_WIDTH);
    } while (Math.abs(newPos - targetPosition) < minDistance);
    setTargetPosition(newPos);
  }, [targetPosition]);

  const animate = useCallback((timestamp: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = timestamp;
    const delta = timestamp - lastTimeRef.current;
    lastTimeRef.current = timestamp;

    setIndicatorPosition((prev) => {
      const newPos = prev + speed * delta * 0.065;
      return newPos > 100 ? newPos - 100 : newPos;
    });

    animationRef.current = requestAnimationFrame(animate);
  }, [speed]);

  useEffect(() => {
    if (gameState === "playing") {
      lastTimeRef.current = 0;
      animationRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [gameState, animate]);

  const handleTap = () => {
    if (!canTapRef.current || gameState !== "playing") return;
    canTapRef.current = false;

    if (showInstructions) {
      setShowInstructions(false);
      if (instructionTimerRef.current) clearTimeout(instructionTimerRef.current);
    }

    const indicatorEnd = indicatorPosition + INDICATOR_WIDTH;
    const targetStart = targetPosition;
    const targetEnd = targetPosition + TARGET_WIDTH;

    const overlap =
      (indicatorPosition >= targetStart && indicatorPosition <= targetEnd) ||
      (indicatorEnd >= targetStart && indicatorEnd <= targetEnd) ||
      (indicatorPosition <= targetStart && indicatorEnd >= targetEnd);

    if (overlap) {
      const newCombo = combo + 1;
      setCombo(newCombo);
      
      if (newCombo >= 3) {
        setShowCombo(true);
        setTimeout(() => setShowCombo(false), 600);
      }

      setFeedback("PERFECT!");
      setPerfect(true);
      setScore((s) => {
        const bonusPoints = newCombo >= 5 ? 2 : 1;
        const newScore = s + bonusPoints;
        if (newScore > highScore) {
          setHighScore(newScore);
          localStorage.setItem("onetaptoolate_highscore", newScore.toString());
        }
        return newScore;
      });
      
      const speedIncrease = Math.min(0.06, 0.05 + score * 0.002);
      setSpeed((s) => s + speedIncrease);
      generateNewTarget();

      setTimeout(() => {
        setFeedback("");
        setPerfect(false);
      }, 350);
      setTimeout(() => {
        canTapRef.current = true;
      }, 80);
    } else {
      const isTooEarly = indicatorPosition < targetStart;
      const distanceToTarget = isTooEarly
        ? targetStart - indicatorEnd
        : indicatorPosition - targetEnd;

      const isNearMiss = Math.abs(distanceToTarget) < NEAR_MISS_THRESHOLD;

      if (isNearMiss) {
        setFeedback(isTooEarly ? "SO CLOSE!" : "ALMOST!");
      } else {
        setFeedback(isTooEarly ? "TOO EARLY" : "TOO LATE");
      }

      setCombo(0);
      setGameState("gameover");
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  const restart = () => {
    setScore(0);
    setCombo(0);
    setSpeed(0.7);
    setIndicatorPosition(0);
    generateNewTarget();
    setGameState("playing");
    setFeedback("");
    canTapRef.current = true;
    setShowInstructions(false);
  };

  return (
    <div
      onClick={gameState === "playing" ? handleTap : undefined}
      className={`w-screen h-screen bg-gradient-to-br from-[#0a0a1f] via-[#0f0f23] to-[#1a1a3e] flex flex-col items-center justify-center overflow-hidden relative select-none touch-none ${
        gameState === "playing" ? "cursor-pointer" : "cursor-default"
      } ${shake ? "animate-shake" : ""}`}
    >
      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-12px); }
          20%, 40%, 60%, 80% { transform: translateX(12px); }
        }
        @keyframes glow {
          0% { transform: scale(1); filter: brightness(1); }
          50% { transform: scale(1.1); filter: brightness(1.5); }
          100% { transform: scale(1); filter: brightness(1); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: translateY(0) scale(1); }
          50% { opacity: 0.7; transform: translateY(-5px) scale(1.02); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.6) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes comboScale {
          0% { transform: scale(0.5); opacity: 0; }
          50% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        .animate-shake {
          animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97);
        }
        .animate-glow {
          animation: glow 0.35s ease-out;
        }
        .animate-pulse {
          animation: pulse 2.5s ease-in-out infinite;
        }
        .animate-fadeIn {
          animation: fadeIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .animate-fadeOut {
          animation: fadeOut 0.5s ease-out forwards;
        }
        .animate-combo {
          animation: comboScale 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/10 via-transparent to-transparent pointer-events-none" />

      <div className="absolute top-[8%] text-8xl md:text-9xl font-black text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.7)] tracking-tighter">
        {score}
      </div>

      {combo >= 3 && showCombo && (
        <div className="absolute top-[17%] text-3xl md:text-4xl font-black text-yellow-400 drop-shadow-[0_0_20px_rgba(250,204,21,0.8)] animate-combo">
          {combo}× COMBO!
        </div>
      )}

      <div className="absolute top-[21%] flex items-center gap-3">
        <span className="text-xs text-white/40 font-bold tracking-wider uppercase">Best</span>
        <h1 className="text-lg text-white/60 font-black tracking-wide">{highScore}</h1>
      </div>

      {showInstructions && gameState === "playing" && (
        <div className="absolute top-[32%] text-xl md:text-2xl text-white/85 font-black text-center px-10 animate-pulse">
          TAP WHEN WHITE HITS GREEN
        </div>
      )}

      <div
        className={`w-[88%] max-w-[520px] h-24 md:h-28 bg-gradient-to-b from-white/5 to-white/[0.02] rounded-2xl relative overflow-hidden border-[3px] border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.4)] ${
          perfect ? "animate-glow" : ""
        }`}
      >
        <div
          className="absolute top-0 h-full bg-gradient-to-r from-[#00ff88] via-[#00dd77] to-[#00cc66] shadow-[0_0_30px_rgba(0,255,136,0.8),inset_0_2px_8px_rgba(255,255,255,0.3)] transition-all duration-150 rounded-sm"
          style={{
            left: `${targetPosition}%`,
            width: `${TARGET_WIDTH}%`,
          }}
        />

        <div
          className="absolute top-0 h-full bg-gradient-to-b from-white via-white to-gray-100 shadow-[0_0_25px_rgba(255,255,255,1),0_0_10px_rgba(255,255,255,0.8)] transition-all duration-50 rounded-sm"
          style={{
            left: `${indicatorPosition}%`,
            width: `${INDICATOR_WIDTH}%`,
          }}
        />
      </div>

      {feedback && (
        <div
          className={`absolute top-[58%] font-black animate-fadeIn leading-none ${
            feedback === "PERFECT!"
              ? "text-7xl md:text-8xl text-[#00ff88] drop-shadow-[0_0_50px_rgba(0,255,136,1)]"
              : feedback.includes("CLOSE") || feedback.includes("ALMOST")
              ? "text-6xl md:text-7xl text-[#ffaa00] drop-shadow-[0_0_40px_rgba(255,170,0,1)]"
              : "text-6xl md:text-7xl text-[#ff3355] drop-shadow-[0_0_40px_rgba(255,51,85,1)]"
          }`}
        >
          {feedback}
        </div>
      )}

      {gameState === "gameover" && (
        <div className="absolute bottom-[12%] flex flex-col items-center gap-6 animate-fadeIn">
          <div className="flex flex-col items-center gap-2 mb-2">
            <div className="text-4xl md:text-5xl font-black text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
              {score}
            </div>
            {score > 0 && (
              <div className="text-sm text-white/50 font-bold tracking-wide">
                {combo > 0 ? `${combo}× streak` : "Keep trying!"}
              </div>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              restart();
            }}
            className="px-24 py-7 text-3xl md:text-4xl font-black text-[#0a0a1f] bg-gradient-to-br from-[#00ff88] via-[#00dd77] to-[#00cc66] rounded-full shadow-[0_12px_48px_rgba(0,255,136,0.6),inset_0_2px_12px_rgba(255,255,255,0.4)] transition-all duration-100 active:scale-[0.96] active:shadow-[0_6px_24px_rgba(0,255,136,0.7)] uppercase tracking-wider animate-float"
          >
            RETRY
          </button>
        </div>
      )}

      <div className="absolute bottom-4 text-[10px] text-white/20 font-semibold tracking-widest uppercase">
        One Tap Too Late
      </div>
    </div>
  );
}