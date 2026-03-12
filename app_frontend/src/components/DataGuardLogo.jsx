import { EyeClosed, Shield } from "lucide-react";

function DataGuardLogo({
  className = "",
  iconColor = "#0F172A",
  shieldSize = 36,
  eyeSize = 18,
  shieldStrokeWidth = 2,
  eyeStrokeWidth = 1.75,
}) {
  return (
    <div className={`flex items-center justify-center ${className}`.trim()}>
      <div className="relative flex h-9 w-9 items-center justify-center">
        <Shield size={shieldSize} color={iconColor} strokeWidth={shieldStrokeWidth} fill="none" />
        <EyeClosed
          size={eyeSize}
          color={iconColor}
          strokeWidth={eyeStrokeWidth}
          fill="none"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        />
      </div>
    </div>
  );
}

export default DataGuardLogo;
