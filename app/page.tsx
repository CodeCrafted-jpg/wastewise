import Header from "@/components/Header";
import Hero from "@/components/Hero";
import ServiceCard from "@/components/ServiceCard";
import Footer from "@/components/Footer";
import { Trash2, Recycle, Building2, Truck, Quote } from "lucide-react";

export default function Home() {
  const services = [
    {
      title: "Residential Waste Removal",
      image: "https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?q=80&w=2070&auto=format&fit=crop",
      description: "Regular trash and recycling collection for your home with reliable schedules.",
      icon: <Trash2 size={24} />
    },
    {
      title: "Commercial Waste Removal",
      image: "https://images.unsplash.com/photo-1614032139045-385038ecbe6e?q=80&w=2070&auto=format&fit=crop",
      description: "Tailored waste management solutions for businesses of all sizes and industries.",
      icon: <Building2 size={24} />
    },
    {
      title: "Construction Debris Removal",
      image: "https://images.unsplash.com/photo-1541888941259-79273ce46c2e?q=80&w=2070&auto=format&fit=crop",
      description: "Fast and dependable cleanup for renovation and construction site debris.",
      icon: <Truck size={24} />
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main>
        {/* Banner Section */}
        <div className="bg-brand-green py-3 px-4 text-white text-center font-bold text-sm">
          Are you Ready to Free Waste Removal Today? <a href="#" className="underline ml-2">Contact Us</a>
        </div>

        <Hero />

        {/* Intro Section */}
        <section className="py-24 max-w-7xl mx-auto px-8 flex flex-col items-center text-center">
          <div className="flex items-center gap-2 mb-6 text-brand-green font-bold text-sm tracking-wider uppercase">
            <div className="w-8 h-0.5 bg-brand-green"></div>
            <span>About Us</span>
            <div className="w-2 h-2 rounded-full bg-brand-green"></div>
          </div>
          <h2 className="text-4xl md:text-5xl font-serif font-bold text-brand-dark max-w-3xl leading-snug mb-8">
            We provide reliable, efficient waste removal services for residential, commercial, & construction needs.
          </h2>
          <p className="text-zinc-500 max-w-2xl text-lg leading-relaxed">
            Our team is committed to timely pickups, fair pricing, and responsible disposal practices. We handle the heavy lifting so you can enjoy a clean, clutter-free space.
          </p>
        </section>

        {/* Services Section */}
        <section className="py-24 bg-brand-muted">
          <div className="max-w-7xl mx-auto px-8">
            <div className="flex flex-col items-center text-center mb-16">
              <div className="flex items-center gap-2 mb-4 text-brand-green font-bold text-sm tracking-wider uppercase">
                <div className="w-8 h-0.5 bg-brand-green"></div>
                <span>Our Services</span>
                <div className="w-2 h-2 rounded-full bg-brand-green"></div>
              </div>
              <h2 className="text-4xl md:text-5xl font-serif font-bold text-brand-dark">
                Complete Waste Removal Services
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {services.map((service, index) => (
                <ServiceCard key={index} {...service} />
              ))}
            </div>

            <div className="mt-16 flex justify-center">
              <button className="bg-brand-green text-white px-10 py-4 rounded-sm font-bold hover:bg-opacity-90 transition-all flex items-center gap-2">
                View More Services
              </button>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-24 max-w-7xl mx-auto px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {[
              { name: "Alex Buckmaster", role: "Homeowner", text: "I couldn't believe how fast and easy the team made the cleanup. They showed up on time, handled all the heavy lifting, and left my home spotless." },
              { name: "Stephanie Nicol", role: "Business Owner", text: "Our office renovation left a lot of debris, and this team handled everything perfectly. Professional, efficient, and reliable." },
              { name: "James Wilson", role: "Contractor", text: "As a contractor, I need waste removed quickly to stay on schedule. These guys are always on time and get the job done right." }
            ].map((t, i) => (
              <div key={i} className="bg-white p-10 rounded-2xl border border-zinc-100 shadow-sm space-y-6 relative overflow-hidden group hover:border-brand-green transition-colors">
                <div className="text-amber-400 text-xl">{"★".repeat(5)}</div>
                <p className="text-zinc-600 italic leading-relaxed relative z-10">"{t.text}"</p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-zinc-100 overflow-hidden">
                    <img src={`https://i.pravatar.cc/100?u=${i + 10}`} alt={t.name} />
                  </div>
                  <div>
                    <h4 className="font-serif font-bold text-brand-dark">{t.name}</h4>
                    <span className="text-xs text-zinc-400 uppercase font-bold tracking-widest">{t.role}</span>
                  </div>
                </div>
                <Quote className="absolute -bottom-4 -right-4 text-zinc-100 group-hover:text-brand-muted transition-colors w-24 h-24 rotate-12" />
              </div>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
