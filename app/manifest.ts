import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PokéBinder Dex — Master Set Tracker",
    short_name: "PokéBinder",
    description: "Gestor de Master Sets, precios en vivo y Trade Binder de Pokémon TCG",
    start_url: "/",
    display: "standalone",
    background_color: "#1a1c19",
    theme_color: "#facc15",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}