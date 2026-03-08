import { EyeClosed, Shield } from "lucide-react";

function DataGuardLogo({ className = "" }) {
  return (
    <div className={`flex items-center justify-center ${className}`.trim()}>
      <div className="relative flex h-9 w-9 items-center justify-center">
        <Shield size={36} color="#0F172A" strokeWidth={2} fill="none" />
        <EyeClosed
          size={18}
          color="#0F172A"
          strokeWidth={1.75}
          fill="none"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        />
      </div>
    </div>
  );
}

export default DataGuardLogo;
