import Link from 'next/link'
import { Search, Menu, Phone, Mail } from 'lucide-react'
import { UserButton } from '@clerk/nextjs'

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
                            <span className="text-2xl font-serif font-bold text-brand-dark tracking-tight">Waste Wise</span>
                        </Link>

                        <ul className="hidden lg:flex items-center gap-6 font-medium text-brand-dark">
                            <li><Link href="/" className="hover:text-brand-green transition-colors">Home</Link></li>
                            <li><Link href="/dashboard" className="hover:text-brand-green transition-colors text-brand-green font-bold">Dashboard</Link></li>
                            <li><Link href="/heatmap" className="hover:text-brand-green transition-colors text-brand-green font-bold">Predictions</Link></li>
                            <li><Link href="/officer/routes" className="hover:text-brand-green transition-colors text-brand-green font-bold">Routes</Link></li>
                            <li><Link href="/admin/analytics" className="hover:text-brand-green transition-colors text-brand-green font-bold">Analytics</Link></li>
                            <li><Link href="/admin/alerts" className="hover:text-brand-green transition-colors text-brand-green font-bold">Alerts</Link></li>
                            <li><Link href="/upload" className="hover:text-brand-green transition-colors">Upload Report</Link></li>
                            <li><Link href="/services" className="hover:text-brand-green transition-colors">Services</Link></li>
                        </ul>
                    </div>

                    <div className="flex items-center gap-4">
                        <button className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                            <Search size={20} className="text-brand-dark" />
                        </button>
                        <button className="lg:hidden p-2 hover:bg-zinc-100 rounded-full transition-colors">
                            <Menu size={20} className="text-brand-dark" />
                        </button>
                        <div className="hidden sm:block">
                            <UserButton afterSignOutUrl="/" />
                        </div>
                    </div>
                </div>
            </nav>
        </header>
    )
}

