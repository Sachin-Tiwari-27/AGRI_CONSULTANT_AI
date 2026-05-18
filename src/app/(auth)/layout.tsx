export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/20">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 3c-1.2 5.4-5 8.4-9 9 0 6 4 9.3 9 9 5-.3 9-3 9-9-4-.6-7.8-3.6-9-9z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            AgriAI Platform
          </h1>
          <p className="text-brand-300 text-xs mt-1">
            Agricultural Intelligence, Amplified
          </p>
        </div>

        {/* Card */}
        <div className="bg-card rounded-2xl shadow-2xl border border-white/10 p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
