import acTechLogo from "@/assets/S_S_Marketing-2.png";

interface SplashScreenProps {
  isAnimating: boolean;
  onAnimationComplete: () => void;
}

const SplashScreen = ({ isAnimating, onAnimationComplete }: SplashScreenProps) => {
  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center bg-[#1a1f4e] transition-opacity duration-500 ${
        isAnimating ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      onTransitionEnd={() => {
        if (isAnimating) {
          onAnimationComplete();
        }
      }}
    >
      <div 
        className={`transition-all duration-700 ease-out ${
          isAnimating 
            ? 'scale-[0.4] -translate-y-[calc(50vh-80px)] opacity-0' 
            : 'scale-100 translate-y-0 opacity-100'
        }`}
      >
        <img 
          src={acTechLogo}
          alt="AC Tech Repair" 
          className="h-32 w-32 object-contain rounded-2xl shadow-2xl"
        />
      </div>
    </div>
  );
};

export default SplashScreen;
