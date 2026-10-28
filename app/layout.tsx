import type { Metadata } from "next";
import { Press_Start_2P, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import AuthButton from "./AuthButton";

const pressStart = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-retro",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "PokéBinder Dex | Master Set Tracker",
  description: "Armá y cotizá tus Master Sets de Pokémon TCG en todos los idiomas",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${pressStart.variable} ${jetbrainsMono.variable} font-mono bg-neutral-900 text-neutral-100 min-h-screen selection:bg-yellow-400 selection:text-black`}
      >
        <div className="min-h-screen bg-[#DC0A2D] p-3 sm:p-6 md:p-8 flex flex-col border-b-8 border-r-8 border-[#8B0000]">
          
          <header className="flex items-center justify-between pb-4 mb-4 border-b-4 border-black/80">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white p-1.5 border-4 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                <div className="w-full h-full rounded-full bg-[#28AAFD] border-2 border-black relative overflow-hidden">
                  <div className="w-4 h-4 rounded-full bg-white/70 absolute top-2 left-2" />
                </div>
              </div>

              <div className="flex gap-2 self-start mt-1">
                <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]" />
                <div className="w-4 h-4 rounded-full bg-yellow-400 border-2 border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]" />
                <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]" />
              </div>

              <h1 
                style={{ fontFamily: "var(--font-retro)" }} 
                className="hidden md:block text-white text-lg lg:text-xl tracking-wider ml-4 drop-shadow-[3px_3px_0px_rgba(0,0,0,1)]"
              >
                POKéBINDER DEX
              </h1>
            </div>

            <div>
              <AuthButton />
            </div>
          </header>

          <main className="flex-1 bg-[#DEDEDE] p-3 sm:p-6 rounded-lg border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col">
            <div className="flex-1 bg-[#1a1c19] text-[#e0f8cf] rounded border-4 border-black p-4 sm:p-6 shadow-inner">
              {children}
            </div>
          </main>

        </div>
        
        {/* Vercel Analytics Tracker */}
        <Analytics />
      </body>
    </html>
  );
}