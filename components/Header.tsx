import Link from 'next/link'
import { Search, Menu, Phone, Mail } from 'lucide-react'

export default function Header() {
    return (
        <header className="w-full">
            {/* Top Bar */}
            <div className="bg-brand-green py-2 px-4 text-white text-sm hidden md:block">
                <div className="max-w-7xl mx-auto flex justify-between items-center px-4">
                    <div className="flex gap-6">
                        <span className="flex items-center gap-2">
                            <Phone size={14} className="text-brand-lime" />
                            (234) 345-4574
                        </span>
                        <span className="flex items-center gap-2">
                            <Mail size={14} className="text-brand-lime" />
                            wasteremoval@domain.com
                        </span>
                    </div>
                    <div className="flex gap-4">
                        <Link href="/contact" className="hover:text-brand-lime transition-colors">Contact Us</Link>
                    </div>
                </div>
            </div>

            {/* Main Nav */}
            <nav className="bg-white border-b border-zinc-100 py-4 px-4 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto flex justify-between items-center px-4">
                    <div className="flex items-center gap-8">
                        <Link href="/" className="flex items-center gap-2">
                            <div className="w-10 h-10 bg-brand-green flex items-center justify-center rounded-sm">
                                <div className="w-6 h-6 border-2 border-brand-lime rotate-45"></div>
                            </div>
                            <span className="text-2xl font-serif font-bold text-brand-dark tracking-tight">Casella</span>
                        </Link>

                        <ul className="hidden lg:flex items-center gap-6 font-medium text-brand-dark">
                            <li><Link href="/" className="hover:text-brand-green transition-colors">Home</Link></li>
                            <li><Link href="/pages" className="hover:text-brand-green transition-colors">Pages</Link></li>
                            <li><Link href="/services" className="hover:text-brand-green transition-colors">Services</Link></li>
                            <li><Link href="/case-studies" className="hover:text-brand-green transition-colors">Case Studies</Link></li>
                            <li><Link href="/blog" className="hover:text-brand-green transition-colors">Blog</Link></li>
                        </ul>
                    </div>

                    <div className="flex items-center gap-4">
                        <button className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                            <Search size={20} className="text-brand-dark" />
                        </button>
                        <button className="lg:hidden p-2 hover:bg-zinc-100 rounded-full transition-colors">
                            <Menu size={20} className="text-brand-dark" />
                        </button>
                        <button className="hidden sm:block bg-brand-green text-white p-3 rounded-sm hover:bg-opacity-90 transition-all font-bold">
                            <Menu size={20} />
                        </button>
                    </div>
                </div>
            </nav>
        </header>
    )
}
