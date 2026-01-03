import { useEffect, useState } from "react";
import splashLogo from "@/assets/splash-logo.png";

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [phase, setPhase] = useState<'visible' | 'shrinking' | 'hidden'>('visible');

  useEffect(() => {
    // Start shrink animation after 1.5 seconds
    const shrinkTimer = setTimeout(() => {
      setPhase('shrinking');
    }, 1500);

    // Complete and hide after animation
    const hideTimer = setTimeout(() => {
      setPhase('hidden');
      onComplete();
    }, 2200);

    return () => {
      clearTimeout(shrinkTimer);
      clearTimeout(hideTimer);
    };
  }, [onComplete]);

  if (phase === 'hidden') return null;

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center bg-[#1a1f4e] transition-opacity duration-500 ${
        phase === 'shrinking' ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div 
        className={`flex flex-col items-center transition-all duration-700 ease-out ${
          phase === 'shrinking' 
            ? 'scale-50 -translate-y-[40vh] opacity-0' 
            : 'scale-100 translate-y-0 opacity-100'
        }`}
      >
        <img 
          src={splashLogo}
          alt="AC Tech Service Hub" 
          className={`w-64 h-auto object-contain ${phase === 'visible' ? 'animate-pulse-gentle' : ''}`}
        />
      </div>
    </div>
  );
};

export default SplashScreen;
