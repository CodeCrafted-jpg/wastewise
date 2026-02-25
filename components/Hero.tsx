import { Phone } from 'lucide-react'

export default function Hero() {
    return (
        <section className="relative w-full h-[600px] flex items-center overflow-hidden">
            {/* Background Image / Placeholder */}
            <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 bg-black/40 z-10"></div>
                <img
                    src="https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?q=80&w=2070&auto=format&fit=crop"
                    alt="Waste removal scene"
                    className="w-full h-full object-cover"
                />
            </div>

            <div className="relative z-20 max-w-7xl mx-auto px-8 w-full">
                <div className="max-w-2xl space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="flex -space-x-2">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="w-10 h-10 rounded-full border-2 border-white bg-zinc-200 overflow-hidden">
                                    <img src={`https://i.pravatar.cc/100?u=${i}`} alt="user" />
                                </div>
                            ))}
                            <div className="w-10 h-10 rounded-full border-2 border-white bg-brand-green flex items-center justify-center text-white text-xs font-bold">
                                +
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <div className="flex text-amber-400">
                                {"★".repeat(5)}
                            </div>
                            <span className="text-white text-xs font-bold font-sans">1k+ Satisfied Reviews</span>
                        </div>
                    </div>

                    <h1 className="text-6xl md:text-7xl font-serif font-bold text-white leading-tight">
                        Removing Waste <br />
                        <span className="italic">The Right Way</span>
                    </h1>

                    <div className="flex flex-col sm:flex-row gap-4 pt-4">
                        <button className="bg-white text-brand-dark px-8 py-4 rounded-sm font-bold hover:bg-brand-muted transition-all active:scale-95">
                            Remove My Waste Today
                        </button>
                        <a href="tel:2343454574" className="flex items-center gap-3 text-white px-8 py-4 font-bold group">
                            <div className="p-3 bg-brand-green rounded-sm transition-transform group-hover:scale-110">
                                <Phone size={20} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs text-zinc-300 font-medium">Call Us Today</span>
                                <span>(234) 345-4574</span>
                            </div>
                        </a>
                    </div>
                </div>
            </div>

            {/* Info Badge */}
            <div className="absolute bottom-12 right-12 hidden lg:block z-20">
                <div className="bg-brand-dark/80 backdrop-blur-md p-6 rounded-xl border border-white/10 max-w-xs shadow-2xl">
                    <img
                        src="https://images.unsplash.com/photo-1550989460-0adf9ea622e2?q=80&w=300&auto=format&fit=crop"
                        className="w-full h-32 object-cover rounded-lg mb-4"
                        alt="Small preview"
                    />
                    <h3 className="text-white font-serif font-bold mb-1">No 1# World Waste Removal</h3>
                    <div className="flex gap-2 h-1">
                        <div className="flex-1 bg-zinc-700 rounded-full overflow-hidden">
                            <div className="w-1/3 h-full bg-brand-green"></div>
                        </div>
                        <div className="flex-1 bg-zinc-700 rounded-full"></div>
                    </div>
                </div>
            </div>
        </section>
    )
}
