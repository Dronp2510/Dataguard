import { useEffect, useRef, useState } from "react";
import { Key, Lock, ShieldCheck } from "lucide-react";

function ZeroKnowledgeSection() {
  const sectionRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const sectionNode = sectionRef.current;
    if (!sectionNode) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(sectionNode);

    return () => observer.disconnect();
  }, []);

  const items = [
    {
      icon: Key,
      text: "Master key derived from your password.",
    },
    {
      icon: ShieldCheck,
      text: "Server never sees decrypted data.",
    },
    {
      icon: Lock,
      text: "Encrypted file keys stored separately.",
    },
  ];

  return (
    <section
      ref={sectionRef}
      className="w-full bg-gradient-to-br from-[#1E3A8A] via-[#1B2A6B] to-[#0F1E4F] py-24 text-white">
      <div className="mx-auto max-w-5xl px-6 text-center">
        <h2
          className={[
            "text-3xl font-bold tracking-wide transition-all duration-700 ease-out md:text-4xl",
            isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
          ].join(" ")}
        >
          Zero-Knowledge by Design
        </h2>

        <div
          className={[
            "mx-auto mt-6 h-px w-24 origin-center bg-gradient-to-r from-transparent via-blue-500 to-transparent transition-transform duration-700 ease-out",
            isVisible ? "scale-x-100" : "scale-x-0",
          ].join(" ")}
          style={{ transitionDelay: "120ms" }}
        />

        <div className="mt-12 space-y-6">
          {items.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={item.text}
                className={[
                  "flex items-center justify-center gap-3 text-gray-300 transition-all duration-700 ease-out",
                  isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
                ].join(" ")}
                style={{ transitionDelay: `${220 + index * 140}ms` }}
              >
                <Icon className="h-5 w-5 text-blue-400" />
                <p>{item.text}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default ZeroKnowledgeSection;
