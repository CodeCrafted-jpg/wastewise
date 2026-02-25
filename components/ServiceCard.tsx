import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface ServiceCardProps {
    title: string
    image: string
    description: string
    icon: React.ReactNode
}

export default function ServiceCard({ title, image, description, icon }: ServiceCardProps) {
    return (
        <div className="group bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 border border-zinc-100 flex flex-col h-full">
            <div className="relative h-64 overflow-hidden">
                <img
                    src={image}
                    alt={title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute top-4 left-4 bg-brand-green text-white p-4 rounded-xl shadow-lg">
                    {icon}
                </div>
            </div>

            <div className="p-8 flex flex-col flex-grow">
                <h3 className="text-2xl font-serif font-bold text-brand-dark mb-3 group-hover:text-brand-green transition-colors">
                    {title}
                </h3>
                <p className="text-zinc-600 mb-6 flex-grow leading-relaxed">
                    {description}
                </p>
                <Link
                    href={`/services/${title.toLowerCase().replace(/\s+/g, '-')}`}
                    className="flex items-center gap-2 font-bold text-brand-dark group-hover:gap-4 transition-all"
                >
                    <span>Learn More</span>
                    <ArrowRight size={18} className="text-brand-green" />
                </Link>
            </div>
        </div>
    )
}
