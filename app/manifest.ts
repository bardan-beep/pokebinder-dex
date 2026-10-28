import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PokéBinder Dex | Master Set Tracker",
    short_name: "PokéBinder",
    description: "Armá y cotizá tus Master Sets de Pokémon TCG en todos los idiomas",
    start_url: "/",
    display: "standalone",
    background_color: "#DC0A2D",
    theme_color: "#DC0A2D",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}