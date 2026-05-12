import { useEffect } from 'react'
import confetti from 'canvas-confetti'
import { Trophy, AlertCircle, RefreshCw } from 'lucide-react'
import { playSuccess } from '../utils/sounds'

export default function Results({ score, totalQuestions, onRestart }) {
  const isPass = score >= 27;

  useEffect(() => {
    if (isPass) {
      playSuccess();
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

      const randomInRange = (min, max) => Math.random() * (max - min) + min;

      const interval = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
        confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
      }, 250);

      return () => clearInterval(interval);
    }
  }, [isPass]);

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center h-full">
      <div className="glass-card p-10 max-w-lg w-full flex flex-col items-center gap-6">
        {isPass ? (
          <>
            <div className="p-4 bg-yellow-500/20 rounded-full">
              <Trophy className="w-20 h-20 text-yellow-400" />
            </div>
            <h1 className="text-4xl font-bold text-emerald-400">עברת בהצלחה!</h1>
            <p className="text-xl text-slate-200">
              כל הכבוד! הציון שלך הוא {score} מתוך {totalQuestions}.
            </p>
          </>
        ) : (
          <>
            <div className="p-4 bg-red-500/20 rounded-full">
              <AlertCircle className="w-20 h-20 text-red-400" />
            </div>
            <h1 className="text-4xl font-bold text-red-400">לא נורא!</h1>
            <p className="text-xl text-slate-200">
              כל טעות היא צעד לרישיון! בוא נעבור על מה שכדאי לחזק.
            </p>
            <p className="text-lg font-semibold mt-2">
              הציון שלך: {score} מתוך {totalQuestions}
            </p>
          </>
        )}

        <button 
          onClick={onRestart}
          className="mt-8 flex items-center justify-center gap-2 w-full py-4 glass-button font-bold text-lg rounded-xl text-emerald-400 hover:text-emerald-300"
        >
          <RefreshCw className="w-5 h-5" />
          לנסות שוב
        </button>
      </div>
    </div>
  )
}
