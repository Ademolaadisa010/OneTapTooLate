"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Wallet, Trophy, Zap, AlertCircle, ExternalLink, Cloud, Smartphone } from "lucide-react";

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
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletError, setWalletError] = useState<string>("");
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [totalPoints, setTotalPoints] = useState(0);
  const [sessionPoints, setSessionPoints] = useState(0);
  const [pointsBreakdown, setPointsBreakdown] = useState({
    perfectHits: 0,
    comboBonus: 0,
    speedBonus: 0,
  });
  const [isSyncing, setIsSyncing] = useState(false);

  const animationRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number>(0);
  const canTapRef = useRef(true);
  const instructionTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const TARGET_WIDTH = 14;
  const INDICATOR_WIDTH = 2.5;
  const NEAR_MISS_THRESHOLD = 6;
  const POINTS_PER_HIT = 10;
  const COMBO_MULTIPLIER = 5;
  const SPEED_BONUS_THRESHOLD = 1.5;

  useEffect(() => {
    const stored = localStorage.getItem("onetaptoolate_highscore");
    if (stored) setHighScore(parseInt(stored));
    checkWalletConnection();
    instructionTimerRef.current = setTimeout(() => setShowInstructions(false), 4000);
    return () => {
      if (instructionTimerRef.current) clearTimeout(instructionTimerRef.current);
    };
  }, []);

  const checkWalletConnection = async () => {
    try {
      const { solana } = window as any;
      if (solana && solana.isPhantom) {
        const response = await solana.connect({ onlyIfTrusted: true });
        if (response.publicKey) {
          const address = response.publicKey.toString();
          setWalletAddress(address);
          await loadWalletPointsFromCloud(address);
        }
      }
    } catch (error) {}
  };

  const loadWalletPointsFromCloud = async (address: string) => {
    setIsSyncing(true);
    try {
      const key = `wallet_${address}`;
      const result = await window.storage.get(key);
      if (result && result.value) {
        const data = JSON.parse(result.value);
        setTotalPoints(data.total || 0);
        setPointsBreakdown(data.breakdown || { perfectHits: 0, comboBonus: 0, speedBonus: 0 });
      }
    } catch (error) {
      console.log("New wallet, no points yet");
    } finally {
      setIsSyncing(false);
    }
  };

  const saveWalletPointsToCloud = async (address: string, points: number, breakdown: any) => {
    try {
      const key = `wallet_${address}`;
      const data = {
        total: points,
        breakdown: breakdown,
        lastUpdated: new Date().toISOString(),
        walletAddress: address
      };
      await window.storage.set(key, JSON.stringify(data));
    } catch (error) {
      console.error("Cloud save error:", error);
    }
  };

  const connectPhantom = async () => {
    setIsConnecting(true);
    setWalletError("");
    try {
      const { solana } = window as any;
      if (!solana) {
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile) {
          setWalletError("Opening Phantom app...");
          const currentUrl = window.location.href;
          window.location.href = `https://phantom.app/ul/browse/${encodeURIComponent(currentUrl)}`;
          return;
        } else {
          setWalletError("Phantom not found! Install the extension.");
          setIsConnecting(false);
          return;
        }
      }
      const response = await solana.connect();
      const address = response.publicKey.toString();
      setWalletAddress(address);
      await loadWalletPointsFromCloud(address);
      setShowWalletModal(false);
    } catch (error: any) {
      setWalletError(error.message || "Failed to connect");
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = async () => {
    try {
      const { solana } = window as any;
      if (solana && solana.isPhantom) await solana.disconnect();
    } catch (error) {}
    setWalletAddress("");
    setTotalPoints(0);
    setSessionPoints(0);
    setPointsBreakdown({ perfectHits: 0, comboBonus: 0, speedBonus: 0 });
  };

  const shortenAddress = (address: string) => `${address.slice(0, 4)}...${address.slice(-4)}`;

  const calculatePoints = (currentCombo: number, currentSpeed: number) => {
    let points = POINTS_PER_HIT;
    let breakdown = { ...pointsBreakdown };
    breakdown.perfectHits += POINTS_PER_HIT;
    if (currentCombo >= 3) {
      const comboBonus = Math.floor(currentCombo / 3) * COMBO_MULTIPLIER;
      points += comboBonus;
      breakdown.comboBonus += comboBonus;
    }
    if (currentSpeed >= SPEED_BONUS_THRESHOLD) {
      const speedBonus = Math.floor((currentSpeed - SPEED_BONUS_THRESHOLD) * 10);
      points += speedBonus;
      breakdown.speedBonus += speedBonus;
    }
    return { points, breakdown };
  };

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
    const overlap = (indicatorPosition >= targetStart && indicatorPosition <= targetEnd) ||
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
        const newScore = s + 1;
        if (newScore > highScore) {
          setHighScore(newScore);
          localStorage.setItem("onetaptoolate_highscore", newScore.toString());
        }
        if (walletAddress) {
          const { points, breakdown } = calculatePoints(newCombo, speed);
          setSessionPoints(prev => prev + points);
          setPointsBreakdown(breakdown);
          const newTotal = totalPoints + points;
          setTotalPoints(newTotal);
          saveWalletPointsToCloud(walletAddress, newTotal, breakdown);
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
      setTimeout(() => canTapRef.current = true, 80);
    } else {
      const isTooEarly = indicatorPosition < targetStart;
      const distanceToTarget = isTooEarly ? targetStart - indicatorEnd : indicatorPosition - targetEnd;
      const isNearMiss = Math.abs(distanceToTarget) < NEAR_MISS_THRESHOLD;
      setFeedback(isNearMiss ? (isTooEarly ? "SO CLOSE!" : "ALMOST!") : (isTooEarly ? "TOO EARLY" : "TOO LATE"));
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
    setSessionPoints(0);
    generateNewTarget();
    setGameState("playing");
    setFeedback("");
    canTapRef.current = true;
    setShowInstructions(false);
  };

  return (
    <div onClick={gameState === "playing" ? handleTap : undefined} className={`w-screen h-screen bg-gradient-to-br from-[#0a0a1f] via-[#0f0f23] to-[#1a1a3e] flex flex-col items-center justify-center overflow-hidden relative select-none touch-none ${gameState === "playing" ? "cursor-pointer" : "cursor-default"} ${shake ? "animate-shake" : ""}`}>
      <style jsx>{`
        @keyframes shake { 0%, 100% { transform: translateX(0); } 10%, 30%, 50%, 70%, 90% { transform: translateX(-12px); } 20%, 40%, 60%, 80% { transform: translateX(12px); } }
        @keyframes glow { 0% { transform: scale(1); filter: brightness(1); } 50% { transform: scale(1.1); filter: brightness(1.5); } 100% { transform: scale(1); filter: brightness(1); } }
        @keyframes pulse { 0%, 100% { opacity: 1; transform: translateY(0) scale(1); } 50% { opacity: 0.7; transform: translateY(-5px) scale(1.02); } }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.6) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes comboScale { 0% { transform: scale(0.5); opacity: 0; } 50% { transform: scale(1.2); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
        .animate-shake { animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97); }
        .animate-glow { animation: glow 0.35s ease-out; }
        .animate-pulse { animation: pulse 2.5s ease-in-out infinite; }
        .animate-fadeIn { animation: fadeIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .animate-combo { animation: comboScale 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55); }
        .animate-float { animation: float 3s ease-in-out infinite; }
      `}</style>

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/10 via-transparent to-transparent pointer-events-none" />

      <div className="absolute top-4 right-4 z-10">
        {!walletAddress ? (
          <button onClick={(e) => { e.stopPropagation(); setShowWalletModal(true); }} className="px-4 md:px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all flex items-center gap-2 text-sm md:text-base">
            <Wallet size={18} /><span className="hidden sm:inline">Connect Wallet</span><span className="sm:hidden">Connect</span>
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="px-3 md:px-6 py-2 md:py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-lg shadow-lg flex items-center gap-2 text-xs md:text-base">
              <Wallet size={16} />{shortenAddress(walletAddress)}{isSyncing && <Cloud className="animate-spin" size={14} />}
            </div>
            <button onClick={(e) => { e.stopPropagation(); disconnectWallet(); }} className="px-3 md:px-4 py-1.5 md:py-2 bg-red-600/80 text-white text-xs md:text-sm font-bold rounded-lg hover:bg-red-600 transition-all">Disconnect</button>
          </div>
        )}
      </div>

      {showWalletModal && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={(e) => { e.stopPropagation(); setShowWalletModal(false); }}>
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 md:p-8 max-w-md w-full border-2 border-purple-500/30 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl md:text-3xl font-black text-white mb-4 md:mb-6">Connect Wallet</h2>
            <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <div className="flex items-center gap-2 text-blue-300 text-sm font-bold mb-1"><Cloud size={16} />Cloud Sync Enabled</div>
              <p className="text-blue-200 text-xs">Points sync across all devices!</p>
            </div>
            {walletError && (
              <div className="mb-4 p-3 md:p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-start gap-3">
                <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
                <div><p className="text-red-300 font-bold mb-1 text-sm">Status</p><p className="text-red-200 text-xs">{walletError}</p></div>
              </div>
            )}
            <div className="space-y-3 mb-4 md:mb-6">
              <button onClick={connectPhantom} disabled={isConnecting} className="w-full px-4 md:px-6 py-3 md:py-4 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white font-bold rounded-xl transition-all flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base">
                <span className="flex items-center gap-3"><div className="w-7 h-7 md:w-8 md:h-8 bg-white rounded-full flex items-center justify-center"><span className="text-purple-600 font-black text-sm md:text-base">P</span></div>Phantom</span>
                <div className="flex items-center gap-2"><Smartphone size={14} className="text-purple-200" /><span className="text-xs text-purple-200">Mobile OK</span></div>
              </button>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 md:p-4 mb-4">
              <p className="text-blue-300 text-xs md:text-sm font-bold mb-2 flex items-center gap-2"><AlertCircle size={16} />Don't have a wallet?</p>
              <a href="https://phantom.app/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-xs md:text-sm flex items-center gap-1 underline" onClick={(e) => e.stopPropagation()}>Download Phantom<ExternalLink size={12} /></a>
            </div>
            <button onClick={() => setShowWalletModal(false)} className="w-full px-4 py-2 md:py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg transition-all text-sm md:text-base">Cancel</button>
          </div>
        </div>
      )}

      {walletAddress && (
        <div className="absolute top-4 left-4 z-10 bg-black/40 backdrop-blur-sm rounded-lg p-3 md:p-4 border border-white/10 max-w-[180px] md:max-w-none">
          <div className="flex items-center gap-2 mb-2"><Zap className="text-yellow-400" size={18} /><span className="text-white font-bold text-sm md:text-base">Points</span><Cloud className="text-green-400" size={14} /></div>
          <div className="text-2xl md:text-3xl font-black text-yellow-400 mb-1">{totalPoints.toLocaleString()}</div>
          {sessionPoints > 0 && <div className="text-xs md:text-sm text-green-400 font-bold">+{sessionPoints} session</div>}
          <div className="mt-3 space-y-1 text-[10px] md:text-xs text-white/60">
            <div className="flex justify-between gap-2 md:gap-4"><span>Perfect:</span><span className="text-white/80 font-bold">{pointsBreakdown.perfectHits}</span></div>
            <div className="flex justify-between gap-2 md:gap-4"><span>Combo:</span><span className="text-yellow-400 font-bold">{pointsBreakdown.comboBonus}</span></div>
            <div className="flex justify-between gap-2 md:gap-4"><span>Speed:</span><span className="text-blue-400 font-bold">{pointsBreakdown.speedBonus}</span></div>
          </div>
        </div>
      )}

      <div className="absolute top-[8%] text-6xl md:text-8xl lg:text-9xl font-black text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.7)] tracking-tighter">{score}</div>

      {combo >= 3 && showCombo && <div className="absolute top-[17%] text-2xl md:text-3xl lg:text-4xl font-black text-yellow-400 drop-shadow-[0_0_20px_rgba(250,204,21,0.8)] animate-combo">{combo}× COMBO!</div>}

      <div className="absolute top-[23%] md:top-[30%] flex items-center gap-2 md:gap-3"><Trophy className="text-white/40" size={14} /><span className="text-[10px] md:text-xs text-white/40 font-bold tracking-wider uppercase">Best</span><h1 className="text-base md:text-lg text-white/60 font-black tracking-wide">{highScore}</h1></div>

      {showInstructions && gameState === "playing" && <div className="absolute top-[32%] text-base md:text-xl lg:text-2xl text-white/85 font-black text-center px-6 md:px-10 animate-pulse">TAP WHEN WHITE HITS GREEN</div>}

      <div className={`w-[88%] max-w-[520px] h-20 md:h-24 lg:h-28 bg-gradient-to-b from-white/5 to-white/[0.02] rounded-2xl relative overflow-hidden border-[3px] border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.4)] ${perfect ? "animate-glow" : ""}`}>
        <div className="absolute top-0 h-full bg-gradient-to-r from-[#00ff88] via-[#00dd77] to-[#00cc66] shadow-[0_0_30px_rgba(0,255,136,0.8),inset_0_2px_8px_rgba(255,255,255,0.3)] transition-all duration-150 rounded-sm" style={{ left: `${targetPosition}%`, width: `${TARGET_WIDTH}%` }} />
        <div className="absolute top-0 h-full bg-gradient-to-b from-white via-white to-gray-100 shadow-[0_0_25px_rgba(255,255,255,1),0_0_10px_rgba(255,255,255,0.8)] transition-all duration-50 rounded-sm" style={{ left: `${indicatorPosition}%`, width: `${INDICATOR_WIDTH}%` }} />
      </div>

      {feedback && (
        <div className={`absolute top-[58%] font-black animate-fadeIn leading-none ${feedback === "PERFECT!" ? "text-5xl md:text-7xl lg:text-8xl text-[#00ff88] drop-shadow-[0_0_50px_rgba(0,255,136,1)]" : feedback.includes("CLOSE") || feedback.includes("ALMOST") ? "text-4xl md:text-6xl lg:text-7xl text-[#ffaa00] drop-shadow-[0_0_40px_rgba(255,170,0,1)]" : "text-4xl md:text-6xl lg:text-7xl text-[#ff3355] drop-shadow-[0_0_40px_rgba(255,51,85,1)]"}`}>{feedback}</div>
      )}

      {gameState === "gameover" && (
        <div className="absolute bottom-[12%] flex flex-col items-center gap-4 md:gap-6 animate-fadeIn px-4">
          <div className="flex flex-col items-center gap-2 mb-2">
            <div className="text-3xl md:text-4xl lg:text-5xl font-black text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">Score: {score}</div>
            {walletAddress && sessionPoints > 0 && <div className="text-xl md:text-2xl font-black text-yellow-400 drop-shadow-[0_0_20px_rgba(250,204,21,0.8)] flex items-center gap-2">+{sessionPoints} Points<Cloud size={18} className="text-green-400" /></div>}
            {score > 0 && <div className="text-xs md:text-sm text-white/50 font-bold tracking-wide">{combo > 0 ? `${combo}× streak` : "Keep trying!"}</div>}
          </div>
          <button onClick={(e) => { e.stopPropagation(); restart(); }} className="px-16 md:px-24 py-5 md:py-7 text-2xl md:text-3xl lg:text-4xl font-black text-[#0a0a1f] bg-gradient-to-br from-[#00ff88] via-[#00dd77] to-[#00cc66] rounded-full shadow-[0_12px_48px_rgba(0,255,136,0.6),inset_0_2px_12px_rgba(255,255,255,0.4)] transition-all duration-100 active:scale-[0.96] active:shadow-[0_6px_24px_rgba(0,255,136,0.7)] uppercase tracking-wider animate-float">RETRY</button>
        </div>
      )}

      <div className="absolute bottom-4 text-[10px] text-white/20 font-semibold tracking-widest uppercase">One Tap Too Late - Cloud Sync</div>
    </div>
  );
}