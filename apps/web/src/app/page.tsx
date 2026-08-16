export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="max-w-xl space-y-6">
        <h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
          ChatSpin
        </h1>
        <p className="text-lg text-slate-300">
          Instant anonymous video chat. Meet strangers worldwide or connect with friends.
        </p>

        <div className="pt-4 flex flex-col sm:flex-row gap-4 justify-center">
          <button className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-white transition-all shadow-lg shadow-indigo-500/25">
            Start Chatting Anonymously
          </button>
          <button className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold text-slate-200 border border-slate-700 transition-all">
            Sign in with Google
          </button>
        </div>

        <p className="text-xs text-slate-500 pt-8">
          By starting a chat, you confirm that you are at least 18 years old and agree to our Terms & Community Guidelines.
        </p>
      </div>
    </main>
  );
}
