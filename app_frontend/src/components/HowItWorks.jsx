import { useEffect, useRef, useState } from "react";

function HowItWorks() {
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

  const steps = [
    {
      number: 1,
      title: "Create Account",
      description: "Your identity is securely registered.",
    },
    {
      number: 2,
      title: "Upload & Encrypt",
      description: "Files are encrypted directly in your browser.",
    },
    {
      number: 3,
      title: "Organize Vault",
      description: "Manage secure folders and structured access.",
    },
    {
      number: 4,
      title: "Share Securely",
      description: "Generate encrypted permission-based links.",
    },
  ];

  return (
    <section id="how-it-works" className="scroll-mt-24 bg-white py-32">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <div className="mb-20">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">How It Works</h2>
          <p className="mt-4 text-lg text-gray-600">Secure your documents in four simple steps.</p>
        </div>

        <div ref={sectionRef} className="relative">
          <div
            className={[
              "absolute left-0 right-0 top-7 hidden h-px origin-left bg-gradient-to-r from-transparent via-gray-300 to-transparent transition-transform duration-[800ms] ease-out md:block",
              isVisible ? "scale-x-100" : "scale-x-0",
            ].join(" ")}
          />

          <div className="relative flex flex-col items-center justify-between gap-12 md:flex-row md:items-start md:gap-8">
            {steps.map((step, index) => {
              const circleDelay = `${(index + 1) * 200}ms`;

              return (
                <div
                  key={step.title}
                  className={[
                    "relative z-10 flex w-full max-w-xs transform flex-col items-center transition duration-700 ease-out md:w-1/4",
                    isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
                  ].join(" ")}
                  style={{ transitionDelay: `${index * 120}ms` }}
                >
                  <div
                    className={[
                      "flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-[#1E3A8A] to-[#2563EB] font-semibold text-white shadow-md transition-all duration-500 ease-out hover:scale-105",
                      isVisible ? "scale-100 opacity-100" : "scale-75 opacity-0",
                    ].join(" ")}
                    style={{ transitionDelay: circleDelay }}
                  >
                    {step.number}
                  </div>

                  <h3 className="mt-6 text-xl font-semibold text-slate-900">{step.title}</h3>
                  <p className="mt-3 max-w-[22ch] text-sm leading-relaxed text-gray-600">{step.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export default HowItWorks;
