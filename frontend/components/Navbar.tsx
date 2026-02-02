import { ClaworkLogo } from "./icons/ClaworkLogo";

export function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-slate-800 glass-nav">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="text-primary">
              <ClaworkLogo size={32} />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">
              Clawork
            </span>
          </div>
          <div className="hidden md:flex items-center space-x-8">
            <a
              className="text-sm font-medium hover:text-primary transition-colors"
              href="#"
            >
              Docs
            </a>
            <a
              className="text-sm font-medium hover:text-primary transition-colors"
              href="#"
            >
              Twitter
            </a>
            <button className="bg-primary text-background-dark px-5 py-2 rounded-lg font-bold text-sm hover:opacity-90 transition-opacity">
              Launch App
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
