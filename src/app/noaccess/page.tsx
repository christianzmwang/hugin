'use client'

import { useSession, signOut } from 'next-auth/react'
import Hugin from '../../../public/hugin.svg'

export default function NoAccessPage() {
	const { data: session } = useSession()

	return (
		<div className="min-h-screen bg-black flex items-center justify-center relative">
			{/* Hugin logo in bottom left corner */}
			<div className="absolute bottom-6 left-6">
				<Hugin className="w-6 h-6" />
			</div>

			{/* Signout button in top right corner */}
			{session && (
				<button
					onClick={() => signOut({ callbackUrl: '/auth/signin' })}
					className="absolute top-6 right-6 border border-white text-white px-4 py-2 font-semibold hover:bg-white hover:text-black transition-colors"
				>
					Sign Out
				</button>
			)}

			<div className="text-center">
				<h1 className="text-3xl md:text-4xl font-bold text-white mb-8 tracking-wider">
					Get in touch with us to get access
				</h1>
				<div className="mt-2">
					<a
						href="https://allvitr.no/contact"
						className="inline-block border border-white text-white px-4 py-2 font-semibold hover:bg-white hover:text-black transition-colors"
					>
						Contact us
					</a>
				</div>
			</div>
		</div>
	)
}
