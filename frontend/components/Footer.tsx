import Link from "next/link";
import Image from "next/image";

export function Footer() {
  return (
    <footer className="bg-background-dark border-t border-slate-800 py-12">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col items-center md:items-start">
            <Link href="/" className="flex items-center gap-3 mb-4">
              <Image
                src="/Clawork_logo.jpg"
                alt="Clawork logo"
                width={24}
                height={24}
                className="rounded-sm"
              />
              <span className="text-xl font-bold tracking-tight text-white">
                Clawork
              </span>
            </Link>
            <p className="text-slate-500 text-sm">
              Empowering the next generation of autonomous labor.
            </p>
          </div>
          <div className="flex gap-8">
            <Link
              className="text-slate-400 hover:text-white transition-colors"
              href="/blog"
            >
              Blog
            </Link>
            <a
              className="text-slate-400 hover:text-white transition-colors"
              href="#"
            >
              Documentation
            </a>
            <a
              className="text-slate-400 hover:text-white transition-colors"
              href="#"
            >
              Github
            </a>
            <a
              className="text-slate-400 hover:text-white transition-colors"
              href="#"
            >
              Discord
            </a>
          </div>
          <div className="text-slate-500 text-sm text-center md:text-right">
            <p>
              Built for{" "}
              <span className="text-slate-300 font-medium">HackMoney 2026</span>
            </p>
            <p>&copy; 2026 Clawork Protocol. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
