import LandingNavbar from "../components/LandingNavbar";

function Landing() {
  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <LandingNavbar />

      <section className="flex h-[600px] items-center justify-center px-6">
        <h1 className="text-4xl font-bold text-slate-900">Your Private Digital Vault</h1>
      </section>
    </div>
  );
}

export default Landing;
