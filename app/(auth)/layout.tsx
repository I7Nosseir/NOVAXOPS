export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #060a0a 0%, #0a1515 40%, #0D3535 100%)' }}
    >
      {/* Ambient orbs */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute rounded-full"
          style={{
            width: 600, height: 600, top: '-10%', left: '-10%',
            background: 'radial-gradient(circle, rgba(91,180,174,0.12) 0%, transparent 70%)',
            animation: 'login-orb-drift 18s ease-in-out infinite',
          }}/>
        <div className="absolute rounded-full"
          style={{
            width: 500, height: 500, bottom: '-15%', right: '-8%',
            background: 'radial-gradient(circle, rgba(91,180,174,0.08) 0%, transparent 70%)',
            animation: 'login-orb-drift2 22s ease-in-out infinite',
          }}/>
        {/* Dot grid */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="login-dots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="white"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#login-dots)"/>
        </svg>
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {children}
      </div>
    </div>
  )
}
