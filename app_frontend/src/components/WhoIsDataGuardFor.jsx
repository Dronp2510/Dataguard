import { Briefcase, Building2, GraduationCap } from "lucide-react";

function WhoIsDataGuardFor() {
  const personas = [
    {
      title: "Students",
      description: "Certificates, IDs, academic records.",
      icon: GraduationCap,
      cardClass:
        "rounded-3xl bg-white p-10 shadow-md transition-all duration-300 hover:-translate-y-2 hover:shadow-xl",
    },
    {
      title: "Professionals",
      description: "Contracts, PAN, Aadhaar, confidential documents.",
      icon: Briefcase,
      cardClass:
        "rounded-3xl border border-blue-100 bg-gradient-to-b from-white to-blue-50 p-12 shadow-xl transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl",
    },
    {
      title: "Organizations",
      description: "Secure document exchange and controlled access.",
      icon: Building2,
      cardClass:
        "rounded-3xl bg-white p-10 shadow-md transition-all duration-300 hover:-translate-y-2 hover:shadow-xl",
    },
  ];

  return (
    <section className="bg-[#F8FAFC] py-32">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <h2 className="mb-20 text-3xl font-bold text-slate-900 md:text-4xl">Who Is DataGuard For?</h2>

        <div className="grid grid-cols-1 items-stretch gap-10 md:grid-cols-3">
          {personas.map((persona) => {
            const Icon = persona.icon;

            return (
              <article key={persona.title} className={persona.cardClass}>
                <Icon className="mx-auto mb-6 h-10 w-10 text-blue-600 transition-transform duration-300 hover:scale-105" />
                <h3 className="text-2xl font-semibold text-slate-900">{persona.title}</h3>
                <p className="mt-4 text-gray-600">{persona.description}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default WhoIsDataGuardFor;
