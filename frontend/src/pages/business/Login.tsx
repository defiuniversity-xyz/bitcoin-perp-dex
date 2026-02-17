import { StrikeConnectBtn } from '../../components/business/StrikeConnectBtn';

export function Login() {
    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600 rounded-full blur-3xl mix-blend-screen animate-pulse"></div>
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600 rounded-full blur-3xl mix-blend-screen animate-pulse delay-1000"></div>
            </div>

            <div className="z-10 text-center space-y-8 max-w-md">
                <div className="w-20 h-20 bg-white rounded-2xl mx-auto flex items-center justify-center shadow-2xl shadow-white/20">
                    <svg className="w-12 h-12 text-black" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" /></svg>
                </div>

                <h1 className="text-5xl font-extrabold tracking-tight">
                    Bitcoin Bank<br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">Business</span>
                </h1>

                <p className="text-gray-400 text-lg">
                    The instant, low-fee way to accept Bitcoin payments at your business. Powered by Strike.
                </p>

                <div className="pt-4">
                    <StrikeConnectBtn />
                </div>

                <p className="text-xs text-gray-600 pt-8">
                    By connecting, you agree to our Terms of Service and Privacy Policy.
                </p>
            </div>
        </div>
    );
}
