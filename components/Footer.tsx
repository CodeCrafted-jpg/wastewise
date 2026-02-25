import Link from 'next/link'
import { Facebook, Twitter, Instagram, Linkedin, Mail, Phone, MapPin } from 'lucide-react'

export default function Footer() {
    return (
        <footer className="bg-brand-dark text-white pt-24 pb-12">
            <div className="max-w-7xl mx-auto px-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
                {/* About */}
                <div className="space-y-6">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-brand-green flex items-center justify-center rounded-sm">
                            <div className="w-6 h-6 border-2 border-brand-lime rotate-45"></div>
                        </div>
                        <span className="text-2xl font-serif font-bold text-white tracking-tight">Casella</span>
                    </Link>
                    <p className="text-zinc-400 leading-relaxed">
                        WasteWise is leading the way in sustainable waste management. We provide reliable, efficient waste removal services for residential and commercial needs.
                    </p>
                    <div className="flex gap-4">
                        {[Facebook, Twitter, Instagram, Linkedin].map((Icon, i) => (
                            <a key={i} href="#" className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center hover:bg-brand-green transition-colors">
                                <Icon size={18} />
                            </a>
                        ))}
                    </div>
                </div>

                {/* Quick Links */}
                <div>
                    <h4 className="text-xl font-serif font-bold mb-6 text-white">Quick Links</h4>
                    <ul className="space-y-4 text-zinc-400 font-medium">
                        <li><Link href="/" className="hover:text-brand-green transition-colors">Home</Link></li>
                        <li><Link href="/about" className="hover:text-brand-green transition-colors">About Us</Link></li>
                        <li><Link href="/services" className="hover:text-brand-green transition-colors">Services</Link></li>
                        <li><Link href="/contact" className="hover:text-brand-green transition-colors">Contact Us</Link></li>
                    </ul>
                </div>

                {/* Services */}
                <div>
                    <h4 className="text-xl font-serif font-bold mb-6 text-white">Our Services</h4>
                    <ul className="space-y-4 text-zinc-400 font-medium">
                        <li><Link href="#" className="hover:text-brand-green transition-colors">Residential Waste</Link></li>
                        <li><Link href="#" className="hover:text-brand-green transition-colors">Commercial Waste</Link></li>
                        <li><Link href="#" className="hover:text-brand-green transition-colors">Construction Debris</Link></li>
                        <li><Link href="#" className="hover:text-brand-green transition-colors">Bulk Item Removal</Link></li>
                    </ul>
                </div>

                {/* Contact */}
                <div>
                    <h4 className="text-xl font-serif font-bold mb-6 text-white">Contact Info</h4>
                    <ul className="space-y-4 text-zinc-400 font-medium">
                        <li className="flex gap-3">
                            <Phone size={18} className="text-brand-lime shrink-0" />
                            <span>(234) 345-4574</span>
                        </li>
                        <li className="flex gap-3">
                            <Mail size={18} className="text-brand-lime shrink-0" />
                            <span>info@wasteremoval.com</span>
                        </li>
                        <li className="flex gap-3">
                            <MapPin size={18} className="text-brand-lime shrink-0" />
                            <span>3522 West Fork Street, <br />Missoula, MT 59801</span>
                        </li>
                    </ul>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-8 pt-8 border-t border-zinc-800 flex flex-col md:row-span-1 md:flex-row justify-between items-center gap-4 text-sm text-zinc-500">
                <p>© Copyright 2026 - Casella. All Right Reserved</p>
                <div className="flex gap-6">
                    <Link href="#" className="hover:text-white">Privacy & Policy</Link>
                    <Link href="#" className="hover:text-white">Terms & Conditions</Link>
                </div>
            </div>
        </footer>
    )
}
