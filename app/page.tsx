"use client";

import { useState, useEffect, useRef } from "react";
import {
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  Layers,
  Save,
  FolderOpen,
  Check,
  Trash2,
  Sparkles,
  Filter,
  Search,
  ArrowUpDown,
  Grid,
  Eye,
  ClipboardList,
  Download,
  Upload,
  Copy,
  Globe,
  ExternalLink,
  ShoppingCart,
  BarChart3,
  LayoutGrid,
  MoveLeft,
  MoveRight,
  DollarSign,
  Award,
  TrendingUp,
  Wallet,
  Share2,
  Scale,
  Repeat,
  Camera,
  WifiOff,
  Smartphone,
} from "lucide-react";
import { supabase } from "./supabase";
import { User } from "@supabase/supabase-js";

interface CardData {
  id: string;
  name: string;
  number: string;
  setOfficialCount?: number;
  rarity: string;
  setName: string;
  setRank: number;
  cardNumOrder: number;
  addedOrder?: number;
  image: string;
  priceUsd: number;
  priceSource: "TCGplayer" | "Cardmarket" | "PriceCharting" | "Sin precio";
  variants: string[];
  variantPrices?: Record<string, number>;
  priceLoaded?: boolean;
}

interface CollectedEntry {
  priceUsd: number;
  language: string;
  variant: string;
}

interface TradeEntry {
  qty: number;
  priceUsd: number;
  language: string;
  variant: string;
}

interface PortfolioSnapshot {
  date: string;
  collectedUsd: number;
  investedUsd: number;
  collectedCount: number;
}

interface SavedBinder {
  id: string;
  name: string;
  pokemons: string[];
  pockets: number;
}

interface SetOption {
  id: string;
  name: string;
  rank: number;
}

interface TradeCalcItem {
  id: string;
  name: string;
  priceUsd: number;
  qty: number;
}

const GENERATIONS = [
  { id: "1", label: "Gen 1 - Kanto (#001-151)" },
  { id: "2", label: "Gen 2 - Johto (#152-251)" },
  { id: "3", label: "Gen 3 - Hoenn (#252-386)" },
  { id: "4", label: "Gen 4 - Sinnoh (#387-493)" },
  { id: "5", label: "Gen 5 - Unova (#494-649)" },
  { id: "6", label: "Gen 6 - Kalos (#650-721)" },
  { id: "7", label: "Gen 7 - Alola (#722-809)" },
  { id: "8", label: "Gen 8 - Galar (#810-905)" },
  { id: "9", label: "Gen 9 - Paldea (#906-1025)" },
];

const ELEMENTAL_TYPES = [
  { id: "Water", label: "Agua (Water)" },
  { id: "Fire", label: "Fuego (Fire)" },
  { id: "Grass", label: "Planta (Grass)" },
  { id: "Lightning", label: "Eléctrico (Lightning)" },
  { id: "Psychic", label: "Psíquico (Psychic)" },
  { id: "Fighting", label: "Lucha (Fighting)" },
  { id: "Darkness", label: "Siniestro (Darkness)" },
  { id: "Metal", label: "Metálico (Metal)" },
  { id: "Dragon", label: "Dragón (Dragon)" },
  { id: "Colorless", label: "Incoloro (Colorless)" },
];

const CARD_LANGUAGES = [
  { id: "en", label: "Inglés (EN)" },
  { id: "ja", label: "Japonés (JP)" },
  { id: "es", label: "Español (ES)" },
  { id: "pt", label: "Portugués (PT)" },
  { id: "de", label: "Alemán (DE)" },
  { id: "fr", label: "Francés (FR)" },
  { id: "it", label: "Italiano (IT)" },
  { id: "ko", label: "Coreano (KO)" },
  { id: "zh", label: "Chino (ZH)" },
];

const CARD_VARIANTS = [
  { id: "Normal", label: "Normal / Non-Holo" },
  { id: "Holo", label: "Holofoil" },
  { id: "Reverse", label: "Reverse Holo" },
  { id: "1st Ed", label: "1st Edition" },
  { id: "Promo", label: "Promo / Stamped" },
  { id: "PokeBall", label: "Poké Ball Foil" },
  { id: "MasterBall", label: "Master Ball Foil" },
];

const CARD_CONDITIONS = [
  { id: "NM", label: "NM (Near Mint - Impecable)" },
  { id: "LP", label: "LP (Lightly Played)" },
  { id: "MP", label: "MP (Moderately Played)" },
  { id: "HP", label: "HP (Heavily Played)" },
  { id: "PSA 10", label: "🏆 PSA 10 (Gem Mint)" },
  { id: "PSA 9", label: "🏆 PSA 9 (Mint)" },
  { id: "BGS 9.5", label: "🏆 BGS 9.5 (Gem Mint)" },
  { id: "CGC 10", label: "🏆 CGC 10 (Pristine)" },
];

function formatCardNumberDisplay(card: CardData): string {
  const raw = String(card.number || "");
  if (raw.includes("/")) return raw;
  if (card.setOfficialCount && card.setOfficialCount > 0 && /^\d+$/.test(raw)) {
    const padded =
      card.setOfficialCount >= 100 && raw.length < 3 ? raw.padStart(3, "0") : raw;
    return `${padded}/${card.setOfficialCount}`;
  }
  return raw;
}

export default function Home() {
  // Usuario y Binders en Supabase
  const [user, setUser] = useState<User | null>(null);
  const [savedBinders, setSavedBinders] = useState<SavedBinder[]>([]);
  const [activeBinderId, setActiveBinderId] = useState<string | null>(null);
  const [binderName, setBinderName] = useState("Masterset 1 Z y A");
  const [savingBinder, setSavingBinder] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Fecha actual diferida en useEffect para compatibilidad total con Next.js 16
  const [todayIso, setTodayIso] = useState<string>("2026-01-01");

  // Estados PWA, Modo Offline y Escáner con Cámara (Fase Final)
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [deferredPwaPrompt, setDeferredPwaPrompt] = useState<any>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [scannerSearchText, setScannerSearchText] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Modo Visitante (Solo Lectura al abrir un link compartido)
  const [isReadOnlyGuest, setIsReadOnlyGuest] = useState(false);

  // Referencias para mantener el Binder y la Hoja al cambiar de pestaña
  const loadedUserIdRef = useRef<string | null>(null);
  const activeBinderIdRef = useRef<string | null>(null);
  const isGuestModeRef = useRef<boolean>(false);

  // Conversor Bimonetario USD ⇄ ARS
  const [currencyMode, setCurrencyMode] = useState<"USD" | "ARS">("USD");
  const [usdToArsRate, setUsdToArsRate] = useState<number>(1200);

  // Modo del Constructor: "bulk" (Reglas completas) vs "picker" (Estilo xBindr carta por carta)
  const [builderMode, setBuilderMode] = useState<"bulk" | "picker">("bulk");

  // Criterios combinables del Binder activo
  const [criteria, setCriteria] = useState<string[]>(["POKE:Articuno", "POKE:Zapdos"]);

  // Historial de Inversión, Mapa de Costos Pagados y Mapa de Repetidas/Trade
  const [portfolioHistory, setPortfolioHistory] = useState<PortfolioSnapshot[]>([]);
  const [paidCostMap, setPaidCostMap] = useState<Record<string, number>>({});
  const [tradeMap, setTradeMap] = useState<Record<string, TradeEntry>>({});

  // Controles del Modo 1 (Reglas Masivas)
  const [inputPokemon, setInputPokemon] = useState("");
  const [selectedGen, setSelectedGen] = useState("1");
  const [selectedType, setSelectedType] = useState("Water");
  const [availableSets, setAvailableSets] = useState<SetOption[]>([]);
  const [selectedSetId, setSelectedSetId] = useState("");
  const [setSearchFilter, setSetSearchFilter] = useState("");

  // Controles del Modo 2 (Explorador Carta por Carta estilo xBindr)
  const [explorerSource, setExplorerSource] = useState<"SET" | "TYPE" | "POKE" | "GEN">("SET");
  const [explorerSetId, setExplorerSetId] = useState("");
  const [explorerSetFilter, setExplorerSetFilter] = useState("");
  const [explorerType, setExplorerType] = useState("Water");
  const [explorerPoke, setExplorerPoke] = useState("");
  const [explorerGen, setExplorerGen] = useState("1");
  const [explorerCards, setExplorerCards] = useState<CardData[]>([]);
  const [explorerLoading, setExplorerLoading] = useState(false);
  const [explorerPage, setExplorerPage] = useState(1);
  const [explorerTextFilter, setExplorerTextFilter] = useState("");

  // Cartas del Binder y Mapa Multi-Versión
  const [cards, setCards] = useState<CardData[]>([]);
  const [collectedMap, setCollectedMap] = useState<Record<string, CollectedEntry[]>>({});
  const [loading, setLoading] = useState(false);
  const [hydratingPrices, setHydratingPrices] = useState(false);

  // Vista de Carpeta (9/12 bolsillos, filtros internos, orden, Modo Vitrina y paginación)
  const [pockets, setPockets] = useState<9 | 12>(9);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewFilter, setViewFilter] = useState<"all" | "collected" | "missing" | "trade">("all");
  const [sortOrder, setSortOrder] = useState<"chronological" | "selection">("chronological");
  const [binderSearchQuery, setBinderSearchQuery] = useState("");
  const [rarityFilter, setRarityFilter] = useState("ALL");
  const [showcaseMode, setShowcaseMode] = useState(false);

  // Modales: Escáner HD, Faltantes, Estadísticas, Portafolio y Centro de Canjes/Compartir
  const [inspectedCard, setInspectedCard] = useState<CardData | null>(null);
  const [modalLanguage, setModalLanguage] = useState("en");
  const [modalVariant, setModalVariant] = useState("Normal");
  const [modalCondition, setModalCondition] = useState("NM");
  const [modalCustomPriceUsd, setModalCustomPriceUsd] = useState<string>("");
  const [modalPaidCostUsd, setModalPaidCostUsd] = useState<string>("");
  const [modalTradeQty, setModalTradeQty] = useState<number>(0);

  const [showWishlistModal, setShowWishlistModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showPortfolioModal, setShowPortfolioModal] = useState(false);
  const [showTradeHubModal, setShowTradeHubModal] = useState(false);
  const [tradeHubTab, setTradeHubTab] = useState<"post" | "calculator" | "share">("post");

  // Estados de la Balanza de Canjes (Trade Calculator)
  const [myTradeOffer, setMyTradeOffer] = useState<TradeCalcItem[]>([]);
  const [theirTradeOffer, setTheirTradeOffer] = useState<TradeCalcItem[]>([]);
  const [selectedMyCardId, setSelectedMyCardId] = useState<string>("");
  const [selectedTheirCardId, setSelectedTheirCardId] = useState<string>("");
  const [customTheirName, setExternalTheirName] = useState<string>("");
  const [customTheirPrice, setExternalTheirPrice] = useState<string>("");

  const hydrationAbortRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Inicializar Fecha, Service Worker Offline y detector de conexión
  useEffect(() => {
    setTodayIso(new Date().toISOString().split("T")[0]);

    if (typeof window !== "undefined") {
      setIsOfflineMode(!navigator.onLine);
      const handleOnline = () => setIsOfflineMode(false);
      const handleOffline = () => setIsOfflineMode(true);
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
      }

      const handleBeforeInstallPrompt = (e: any) => {
        e.preventDefault();
        setDeferredPwaPrompt(e);
      };
      window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
        window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      };
    }
  }, []);

  // Sincronizar la referencia del Binder activo y guardar la página actual en memoria local
  useEffect(() => {
    activeBinderIdRef.current = activeBinderId;
    if (typeof window !== "undefined" && activeBinderId && !isReadOnlyGuest) {
      localStorage.setItem("pokebinder_last_binder_id", activeBinderId);
    }
  }, [activeBinderId, isReadOnlyGuest]);

  useEffect(() => {
    if (typeof window !== "undefined" && activeBinderId && !isReadOnlyGuest) {
      localStorage.setItem(`pokebinder_page_${activeBinderId}`, String(currentPage));
    }
  }, [currentPage, activeBinderId, isReadOnlyGuest]);

  // Guardar copia offline automática de las cartas del Binder cuando se cargan
  useEffect(() => {
    if (typeof window !== "undefined" && cards.length > 0 && !isReadOnlyGuest) {
      try {
        const key = `pokebinder_offline_cards_${activeBinderId || "default"}`;
        localStorage.setItem(key, JSON.stringify(cards.slice(0, 300)));
      } catch {
        // Si el almacenamiento local está lleno, continuamos normalmente
      }
    }
  }, [cards, activeBinderId, isReadOnlyGuest]);

  // Funciones del Escáner con Cámara en Vivo
  const startCameraScanner = async () => {
    setCapturedPhotoUrl(null);
    setShowCameraModal(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      mediaStreamRef.current = stream;
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 150);
    } catch {
      setCameraActive(false);
      showBanner("No se pudo acceder a la cámara. Verificá los permisos del navegador.");
    }
  };

  const stopCameraScanner = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setCameraActive(false);
    setShowCameraModal(false);
  };

  const captureCardFrame = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/webp", 0.85);
      setCapturedPhotoUrl(dataUrl);
      showBanner("📸 Foto capturada. Filtrá por nombre o número abajo para marcarla en 1 clic.");
    }
  };

  const handleInstallPwaApp = async () => {
    if (deferredPwaPrompt) {
      deferredPwaPrompt.prompt();
      await deferredPwaPrompt.userChoice;
      setDeferredPwaPrompt(null);
    } else {
      showBanner(
        "📲 Para instalar la App: en Chrome/Edge tocá el ícono de instalar en la barra de direcciones, o en tu celular elegí 'Agregar a pantalla de inicio'."
      );
    }
  };

  const formatMoney = (usdAmount: number) => {
    if (currencyMode === "ARS") {
      const ars = usdAmount * (usdToArsRate || 1);
      return `$${ars.toLocaleString("es-AR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })} ARS`;
    }
    return `$${usdAmount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} USD`;
  };

  const getCostKey = (cardId: string, lang: string, variantLabel: string) =>
    `${cardId}__${lang}__${variantLabel}`;

  const serializeFinancialMetadata = (
    snaps: PortfolioSnapshot[],
    costs: Record<string, number>,
    trades: Record<string, TradeEntry>
  ): string[] => {
    const histItems = snaps
      .slice(-25)
      .map(
        (s) =>
          `HIST:${s.date}|${s.collectedUsd.toFixed(2)}|${s.investedUsd.toFixed(2)}|${s.collectedCount}`
      );
    const costItems = Object.entries(costs)
      .filter(([, val]) => val >= 0)
      .map(([k, val]) => `COST:${k}|${val.toFixed(2)}`);
    const tradeItems = Object.entries(trades)
      .filter(([, t]) => t.qty > 0)
      .map(
        ([cardId, t]) =>
          `TRADE:${cardId}|${t.qty}|${t.priceUsd.toFixed(2)}|${t.language}|${t.variant}`
      );
    return [...histItems, ...costItems, ...tradeItems];
  };

  const parseBinderStoredArray = (rawItems: string[]) => {
    const cleanCriteria: string[] = [];
    const loadedSnaps: PortfolioSnapshot[] = [];
    const loadedCosts: Record<string, number> = {};
    const loadedTrades: Record<string, TradeEntry> = {};

    (rawItems || []).forEach((item) => {
      if (item.startsWith("HIST:")) {
        const parts = item.substring(5).split("|");
        if (parts.length >= 3) {
          loadedSnaps.push({
            date: parts[0],
            collectedUsd: Number(parts[1] || 0),
            investedUsd: Number(parts[2] || 0),
            collectedCount: Number(parts[3] || 0),
          });
        }
      } else if (item.startsWith("COST:")) {
        const [keyPart, valPart] = item.substring(5).split("|");
        if (keyPart && valPart !== undefined) {
          loadedCosts[keyPart] = Number(valPart);
        }
      } else if (item.startsWith("TRADE:")) {
        const parts = item.substring(6).split("|");
        if (parts.length >= 3 && parts[0]) {
          const qty = parseInt(parts[1] || "0", 10);
          if (qty > 0) {
            loadedTrades[parts[0]] = {
              qty,
              priceUsd: Number(parts[2] || 0),
              language: parts[3] || "en",
              variant: parts[4] || "Normal",
            };
          }
        }
      } else {
        cleanCriteria.push(item.includes(":") ? item : `POKE:${item}`);
      }
    });

    loadedSnaps.sort((a, b) => a.date.localeCompare(b.date));
    return { cleanCriteria, loadedSnaps, loadedCosts, loadedTrades };
  };

  // Detectar si se abrió un Link Público Compartido (?share=...)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const shareParam = params.get("share");
    if (shareParam) {
      try {
        const decodedJson = decodeURIComponent(escape(atob(shareParam)));
        const sharedObj = JSON.parse(decodedJson);
        if (sharedObj && Array.isArray(sharedObj.c)) {
          isGuestModeRef.current = true;
          setIsReadOnlyGuest(true);
          setShowcaseMode(true);
          setBinderName(sharedObj.n || "Binder Compartido");
          setPockets(sharedObj.p === 12 ? 12 : 9);
          setCriteria(sharedObj.c);

          const restoredCollected: Record<string, CollectedEntry[]> = {};
          if (Array.isArray(sharedObj.o)) {
            sharedObj.o.forEach((id: string) => {
              restoredCollected[id] = [{ priceUsd: 0, language: "en", variant: "Normal" }];
            });
          }
          setCollectedMap(restoredCollected);

          const restoredTrades: Record<string, TradeEntry> = {};
          if (Array.isArray(sharedObj.t)) {
            sharedObj.t.forEach((row: string) => {
              const [id, q, pr] = row.split("|");
              if (id && Number(q) > 0) {
                restoredTrades[id] = {
                  qty: Number(q),
                  priceUsd: Number(pr || 0),
                  language: "en",
                  variant: "Normal",
                };
              }
            });
          }
          setTradeMap(restoredTrades);

          fetchMasterSet(sharedObj.c);
          showBanner(`👁 Estás viendo el Binder público "${sharedObj.n || "Compartido"}" en modo Solo Lectura.`);
        }
      } catch (err) {
        console.error("Error decodificando link compartido:", err);
      }
    }
  }, []);

  // 1. Cargar catálogo de expansiones oficiales al iniciar
  useEffect(() => {
    fetch("/api/cards?action=sets")
      .then((r) => r.json())
      .then((res) => {
        if (Array.isArray(res.sets) && res.sets.length > 0) {
          setAvailableSets(res.sets);
          const firstSet = `${res.sets[0].id}|${res.sets[0].name}`;
          setSelectedSetId(firstSet);

          const set151 = res.sets.find(
            (s: SetOption) => s.name.includes("151") || s.id.toLowerCase() === "sv03.5"
          );
          setExplorerSetId(set151 ? `${set151.id}|${set151.name}` : firstSet);
        }
      })
      .catch(() => {});
  }, []);

  // 2. Escuchar sesión de usuario en Supabase SIN reiniciar el Binder al cambiar de pestaña
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (isGuestModeRef.current) return;

      if (currentUser && loadedUserIdRef.current !== currentUser.id) {
        loadedUserIdRef.current = currentUser.id;
        loadUserBinders(currentUser.id);
      } else if (!currentUser) {
        fetchMasterSet(criteria);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (isGuestModeRef.current) return;

      if (currentUser) {
        if (loadedUserIdRef.current !== currentUser.id) {
          loadedUserIdRef.current = currentUser.id;
          loadUserBinders(currentUser.id);
        }
      } else if (event === "SIGNED_OUT") {
        loadedUserIdRef.current = null;
        activeBinderIdRef.current = null;
        setSavedBinders([]);
        setActiveBinderId(null);
        setCollectedMap({});
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserBinders = async (userId: string) => {
    const { data, error } = await supabase
      .from("binders")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setSavedBinders(data);
      if (data.length > 0 && !activeBinderIdRef.current && !isGuestModeRef.current) {
        const lastSavedId =
          typeof window !== "undefined"
            ? localStorage.getItem("pokebinder_last_binder_id")
            : null;
        const targetBinder = data.find((b) => b.id === lastSavedId) || data[0];
        selectSavedBinder(targetBinder, true);
      } else if (data.length === 0 && !isGuestModeRef.current) {
        fetchMasterSet(criteria);
      }
    }
  };

  const loadCollectedCards = async (binderId: string) => {
    const { data, error } = await supabase
      .from("collected_cards")
      .select("card_id, price_usd, language, variant")
      .eq("binder_id", binderId);

    if (!error && data) {
      const map: Record<string, CollectedEntry[]> = {};
      data.forEach((row: any) => {
        if (!map[row.card_id]) {
          map[row.card_id] = [];
        }
        const lang = row.language || "en";
        const variant = row.variant || "Normal";
        const exists = map[row.card_id].some(
          (e) => e.language === lang && e.variant === variant
        );
        if (!exists) {
          map[row.card_id].push({
            priceUsd: Number(row.price_usd || 0),
            language: lang,
            variant,
          });
        }
      });
      setCollectedMap(map);
    }
  };

  const selectSavedBinder = (binder: SavedBinder, restoreSavedPage = false) => {
    isGuestModeRef.current = false;
    setIsReadOnlyGuest(false);
    activeBinderIdRef.current = binder.id;
    setActiveBinderId(binder.id);
    setBinderName(binder.name);
    const { cleanCriteria, loadedSnaps, loadedCosts, loadedTrades } = parseBinderStoredArray(
      binder.pokemons || []
    );
    setCriteria(cleanCriteria);
    setPortfolioHistory(loadedSnaps);
    setPaidCostMap(loadedCosts);
    setTradeMap(loadedTrades);
    setPockets(binder.pockets === 12 ? 12 : 9);

    if (restoreSavedPage && typeof window !== "undefined") {
      const savedPage = parseInt(
        localStorage.getItem(`pokebinder_page_${binder.id}`) || "1",
        10
      );
      setCurrentPage(!isNaN(savedPage) && savedPage > 0 ? savedPage : 1);
    } else {
      setCurrentPage(1);
    }

    setBinderSearchQuery("");
    setRarityFilter("ALL");
    loadCollectedCards(binder.id);
    fetchMasterSet(cleanCriteria, binder.id);
  };

  const handleExitGuestMode = () => {
    isGuestModeRef.current = false;
    setIsReadOnlyGuest(false);
    setShowcaseMode(false);
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (user) {
      loadUserBinders(user.id);
    } else {
      setBinderName("Masterset 1 Z y A");
      const defaultCrit = ["POKE:Articuno", "POKE:Zapdos"];
      setCriteria(defaultCrit);
      setCollectedMap({});
      setTradeMap({});
      fetchMasterSet(defaultCrit);
    }
  };

  const handleNewBinderDraft = () => {
    isGuestModeRef.current = false;
    setIsReadOnlyGuest(false);
    activeBinderIdRef.current = null;
    setActiveBinderId(null);
    setBinderName(`Masterset ${savedBinders.length + 1}`);
    setCriteria([]);
    setCards([]);
    setCollectedMap({});
    setPortfolioHistory([]);
    setPaidCostMap({});
    setTradeMap({});
    setCurrentPage(1);
    setBinderSearchQuery("");
    setRarityFilter("ALL");
    showBanner("Binder en blanco listo: elegí cartas individuales en Modo xBindr o sumá reglas completas y tocá GUARDAR SET.");
  };

  const handleSaveBinder = async () => {
    if (isReadOnlyGuest) {
      showBanner("Estás en Modo Visitante. Tocá 'Clonar este Set en mi cuenta' en el banner superior.");
      return;
    }
    if (!user) {
      showBanner("Iniciá sesión arriba con el botón amarillo LOGIN para guardar tus Master Sets.");
      return;
    }
    if (!binderName.trim()) {
      showBanner("Poné un nombre para tu Master Set antes de guardarlo.");
      return;
    }
    if (criteria.length === 0) {
      showBanner("Agregá al menos una carta o criterio al Binder antes de guardarlo.");
      return;
    }

    setSavingBinder(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const updatedSnaps = [
        ...portfolioHistory.filter((s) => s.date !== today),
        {
          date: today,
          collectedUsd: collectedValueUsd,
          investedUsd: totalInvestedCostUsd,
          collectedCount,
        },
      ].sort((a, b) => a.date.localeCompare(b.date));

      setPortfolioHistory(updatedSnaps);

      const combinedStorageArray = [
        ...criteria,
        ...serializeFinancialMetadata(updatedSnaps, paidCostMap, tradeMap),
      ];

      if (activeBinderId) {
        const { error } = await supabase
          .from("binders")
          .update({
            name: binderName.trim(),
            pokemons: combinedStorageArray,
            pockets,
          })
          .eq("id", activeBinderId);

        if (error) throw error;
        setSavedBinders((prev) =>
          prev.map((b) =>
            b.id === activeBinderId
              ? { ...b, name: binderName.trim(), pokemons: combinedStorageArray, pockets }
              : b
          )
        );
        showBanner(`¡"${binderName.trim()}", tus repetidas y tu historial fueron guardados!`);
      } else {
        const { data, error } = await supabase
          .from("binders")
          .insert({
            user_id: user.id,
            name: binderName.trim(),
            pokemons: combinedStorageArray,
            pockets,
          })
          .select()
          .single();

        if (error) throw error;
        if (data) {
          setSavedBinders((prev) => [...prev, data]);
          activeBinderIdRef.current = data.id;
          setActiveBinderId(data.id);
          showBanner(`¡Nuevo Master Set "${data.name}" creado y guardado!`);
        }
      }
    } catch (err: any) {
      console.error(err);
      showBanner("Error al guardar el Master Set en Supabase.");
    } finally {
      setSavingBinder(false);
    }
  };

  const handleDeleteBinder = async (binderId: string, name: string) => {
    if (!confirm(`¿Seguro que querés eliminar el Master Set "${name}"?`)) return;

    const { error } = await supabase.from("binders").delete().eq("id", binderId);
    if (!error) {
      const remaining = savedBinders.filter((b) => b.id !== binderId);
      setSavedBinders(remaining);
      if (activeBinderId === binderId) {
        if (remaining.length > 0) {
          selectSavedBinder(remaining[0]);
        } else {
          handleNewBinderDraft();
        }
      }
      showBanner(`Master Set "${name}" eliminado.`);
    }
  };

  const handleExportBinderJson = () => {
    const backup = {
      version: "3.0",
      exportedAt: new Date().toISOString(),
      binderName,
      pockets,
      criteria,
      collectedMap,
      portfolioHistory,
      paidCostMap,
      tradeMap,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${binderName.replace(/\s+/g, "_")}_backup.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showBanner(`Backup JSON de "${binderName}" descargado correctamente.`);
  };

  const handleImportBinderJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(String(event.target?.result || "{}"));
        if (Array.isArray(parsed.criteria)) {
          isGuestModeRef.current = false;
          setIsReadOnlyGuest(false);
          activeBinderIdRef.current = null;
          setActiveBinderId(null);
          setBinderName(parsed.binderName ? `${parsed.binderName} (Importado)` : "Set Importado");
          setPockets(parsed.pockets === 12 ? 12 : 9);
          setCriteria(parsed.criteria);
          if (parsed.collectedMap && typeof parsed.collectedMap === "object") {
            setCollectedMap(parsed.collectedMap);
          }
          if (Array.isArray(parsed.portfolioHistory)) {
            setPortfolioHistory(parsed.portfolioHistory);
          }
          if (parsed.paidCostMap && typeof parsed.paidCostMap === "object") {
            setPaidCostMap(parsed.paidCostMap);
          }
          if (parsed.tradeMap && typeof parsed.tradeMap === "object") {
            setTradeMap(parsed.tradeMap);
          }
          setCurrentPage(1);
          fetchMasterSet(parsed.criteria);
          showBanner("¡Binder importado con éxito! Tocá GUARDAR SET para grabarlo en tu cuenta.");
        } else {
          showBanner("El archivo JSON no tiene un formato de Binder válido.");
        }
      } catch {
        showBanner("Error al leer el archivo JSON.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const toggleSpecificCardVersion = async (
    card: CardData,
    lang: string,
    variantName: string,
    customPriceUsd?: number,
    paidCostUsd?: number
  ) => {
    if (isReadOnlyGuest) {
      showBanner("Modo Visitante activo (Solo Lectura).");
      return;
    }

    const currentEntries = collectedMap[card.id] || [];
    const exists = currentEntries.some((e) => e.language === lang && e.variant === variantName);
    const finalPriceUsd =
      customPriceUsd !== undefined && !isNaN(customPriceUsd) && customPriceUsd >= 0
        ? customPriceUsd
        : card.priceUsd || 0;

    const costKey = getCostKey(card.id, lang, variantName);

    if (!exists && paidCostUsd !== undefined && !isNaN(paidCostUsd) && paidCostUsd >= 0) {
      setPaidCostMap((prev) => ({ ...prev, [costKey]: paidCostUsd }));
    } else if (exists) {
      setPaidCostMap((prev) => {
        const next = { ...prev };
        delete next[costKey];
        return next;
      });
    }

    setCollectedMap((prev) => {
      const list = prev[card.id] || [];
      const nextList = exists
        ? list.filter((e) => !(e.language === lang && e.variant === variantName))
        : [...list, { priceUsd: finalPriceUsd, language: lang, variant: variantName }];

      const nextMap = { ...prev };
      if (nextList.length === 0) {
        delete nextMap[card.id];
      } else {
        nextMap[card.id] = nextList;
      }
      return nextMap;
    });

    if (!user) {
      showBanner("Tip: Iniciá sesión y guardá el Set para que tus cartas queden grabadas en la nube.");
      return;
    }

    if (!activeBinderId) {
      showBanner("Tocá el botón 'GUARDAR SET' arriba para grabar estas versiones en este Master Set.");
      return;
    }

    if (exists) {
      await supabase
        .from("collected_cards")
        .delete()
        .eq("binder_id", activeBinderId)
        .eq("card_id", card.id)
        .eq("language", lang)
        .eq("variant", variantName);
    } else {
      await supabase.from("collected_cards").upsert({
        user_id: user.id,
        binder_id: activeBinderId,
        card_id: card.id,
        language: lang,
        variant: variantName,
        price_usd: finalPriceUsd,
      });
    }
  };

  const updateCardTradeQuantity = (
    card: CardData,
    qty: number,
    lang = "en",
    variant = "Normal",
    askingPriceUsd?: number
  ) => {
    if (isReadOnlyGuest) return;
    const cleanQty = Math.max(0, Math.floor(qty));
    const finalPrice =
      askingPriceUsd !== undefined && !isNaN(askingPriceUsd) && askingPriceUsd >= 0
        ? askingPriceUsd
        : card.priceUsd || 0;

    setTradeMap((prev) => {
      const next = { ...prev };
      if (cleanQty === 0) {
        delete next[card.id];
      } else {
        next[card.id] = {
          qty: cleanQty,
          priceUsd: finalPrice,
          language: lang,
          variant,
        };
      }
      return next;
    });

    if (cleanQty > 0) {
      showBanner(
        `🔄 ${card.name} agregada a tu Trade Binder (${cleanQty} disponibles). Tocá ACTUALIZAR SET para guardar en la nube.`
      );
    } else {
      showBanner(`${card.name} quitada de tu lista de canjes.`);
    }
  };

  const handleQuickCardClick = (card: CardData) => {
    if (isReadOnlyGuest) {
      openCardInspector(card);
      return;
    }
    const entries = collectedMap[card.id] || [];
    if (entries.length === 0) {
      toggleSpecificCardVersion(card, "en", "Normal");
    } else if (entries.length === 1 && entries[0].language === "en" && entries[0].variant === "Normal") {
      toggleSpecificCardVersion(card, "en", "Normal");
    } else {
      openCardInspector(card);
    }
  };

  const openCardInspector = (card: CardData, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const existingTrade = tradeMap[card.id];
    setModalLanguage(existingTrade?.language || "en");
    setModalVariant(existingTrade?.variant || "Normal");
    setModalCondition("NM");
    setModalCustomPriceUsd(card.priceUsd > 0 ? String(card.priceUsd) : "");
    const existingCost = paidCostMap[getCostKey(card.id, "en", "Normal")];
    setModalPaidCostUsd(existingCost !== undefined ? String(existingCost) : "");
    setModalTradeQty(existingTrade?.qty || 0);
    setInspectedCard(card);
  };

  const moveCardInBinder = (cardId: string, direction: "left" | "right", e: React.MouseEvent) => {
    e.stopPropagation();
    if (isReadOnlyGuest) return;
    const currentList = [...orderedBinderCards];
    const idx = currentList.findIndex((c) => c.id === cardId);
    if (idx === -1) return;

    const targetIdx = direction === "left" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= currentList.length) return;

    const temp = currentList[idx];
    currentList[idx] = currentList[targetIdx];
    currentList[targetIdx] = temp;

    const updatedWithOrder = currentList.map((c, i) => ({ ...c, addedOrder: i }));
    setCards(updatedWithOrder);
    setSortOrder("selection");

    if (criteria.every((c) => c.startsWith("CARD:"))) {
      setCriteria(updatedWithOrder.map((c) => `CARD:${c.id}`));
    }
  };

  // BÚSQUEDA EXACTA EN TCG.FANS USANDO LA RUTA /pokemon/search?query=
  const openTcgFansArgentina = (
    card: CardData,
    e?: React.MouseEvent,
    mode: "exact" | "nameOnly" = "exact"
  ) => {
    if (e) e.stopPropagation();
    const displayNum = formatCardNumberDisplay(card);
    const rarityLabel =
      card.rarity && card.rarity !== "Estándar" && card.rarity !== "None"
        ? card.rarity
        : "Common";

    const fullFormattedQuery = `${card.name}— ${card.setName} (${displayNum}) [${rarityLabel}]`;
    const searchString = mode === "nameOnly" ? card.name.trim() : fullFormattedQuery;

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(searchString).catch(() => {});
    }

    const targetUrl = `https://tcg.fans/pokemon/search?query=${encodeURIComponent(searchString)}`;
    window.open(targetUrl, "_blank", "noopener,noreferrer");
  };

  const showBanner = (msg: string) => {
    setStatusBanner(msg);
    setTimeout(() => {
      setStatusBanner((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  // 3. Descargar el Master Set combinado (con respaldo automático Offline en localStorage)
  const fetchMasterSet = async (criteriaList: string[], binderIdForOffline?: string | null) => {
    const runId = ++hydrationAbortRef.current;

    if (criteriaList.length === 0) {
      setCards([]);
      setHydratingPrices(false);
      return;
    }

    setLoading(true);

    try {
      const queryParam = criteriaList.join(",");
      const res = await fetch(`/api/cards?criteria=${encodeURIComponent(queryParam)}`);
      if (!res.ok) throw new Error("Network response error");
      const json = await res.json();
      const loadedCards: CardData[] = json.data || [];

      if (hydrationAbortRef.current !== runId) return;
      setCards(loadedCards);
      setLoading(false);

      const pendingIds = loadedCards.filter((c) => !c.priceLoaded).map((c) => c.id);
      if (pendingIds.length > 0) {
        setHydratingPrices(true);
        const batchSize = 50;

        for (let i = 0; i < pendingIds.length; i += batchSize) {
          if (hydrationAbortRef.current !== runId) return;
          const batchIds = pendingIds.slice(i, i + batchSize);

          const priceRes = await fetch("/api/cards", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: batchIds }),
          });

          if (priceRes.ok) {
            const priceJson = await priceRes.json();
            const pricesMap = priceJson.prices || {};

            setCards((prevCards) =>
              prevCards.map((c) => {
                const updated = pricesMap[c.id];
                if (updated) {
                  return {
                    ...c,
                    rarity: updated.rarity || c.rarity,
                    setName: updated.setName || c.setName,
                    setOfficialCount: updated.setOfficialCount || c.setOfficialCount || 0,
                    image: c.image || updated.image || "",
                    priceUsd: updated.priceUsd,
                    priceSource: updated.priceSource,
                    variants: updated.variants,
                    variantPrices: updated.variantPrices || c.variantPrices,
                    priceLoaded: true,
                  };
                }
                return c;
              })
            );
          }
        }
        if (hydrationAbortRef.current === runId) {
          setHydratingPrices(false);
        }
      } else {
        setHydratingPrices(false);
      }
    } catch {
      // Si no hay internet, cargamos la copia guardada en el dispositivo (Modo Offline)
      if (typeof window !== "undefined") {
        const key = `pokebinder_offline_cards_${
          binderIdForOffline ?? activeBinderIdRef.current ?? "default"
        }`;
        const savedOffline = localStorage.getItem(key);
        if (savedOffline) {
          try {
            setCards(JSON.parse(savedOffline));
            setIsOfflineMode(true);
            showBanner("📡 Sin conexión: se cargó la copia Offline guardada en tu dispositivo.");
          } catch {}
        }
      }
      setLoading(false);
      setHydratingPrices(false);
    }
  };

  // 4. Explorador xBindr: Buscar cartas para elegir una por una
  const loadExplorerCatalog = async (customCriterion?: string) => {
    let targetCrit = customCriterion || "";

    if (!targetCrit) {
      if (explorerSource === "SET" && explorerSetId) targetCrit = `SET:${explorerSetId}`;
      else if (explorerSource === "TYPE" && explorerType) targetCrit = `TYPE:${explorerType}`;
      else if (explorerSource === "POKE" && explorerPoke.trim()) targetCrit = `POKE:${explorerPoke.trim()}`;
      else if (explorerSource === "GEN" && explorerGen) targetCrit = `GEN:${explorerGen}`;
    }

    if (!targetCrit) return;

    setExplorerLoading(true);
    setExplorerPage(1);

    try {
      const res = await fetch(`/api/cards?criteria=${encodeURIComponent(targetCrit)}`);
      const json = await res.json();
      setExplorerCards(json.data || []);
    } catch (err) {
      console.error("Error cargando catálogo explorador:", err);
    } finally {
      setExplorerLoading(false);
    }
  };

  useEffect(() => {
    if (builderMode === "picker" && explorerCards.length === 0 && explorerSetId) {
      loadExplorerCatalog(`SET:${explorerSetId}`);
    }
  }, [builderMode, explorerSetId]);

  const toggleSingleCardInBinder = (card: CardData) => {
    if (isReadOnlyGuest) return;
    const critKey = `CARD:${card.id}`;
    const existsInCriteria = criteria.some((c) => c.toLowerCase() === critKey.toLowerCase());

    if (existsInCriteria) {
      const updated = criteria.filter((c) => c.toLowerCase() !== critKey.toLowerCase());
      setCriteria(updated);
      setCards((prev) => prev.filter((c) => c.id !== card.id));
    } else {
      const updated = [...criteria, critKey];
      setCriteria(updated);
      setCards((prev) => {
        if (prev.some((c) => c.id === card.id)) return prev;
        return [...prev, { ...card, addedOrder: prev.length }];
      });

      if (!card.priceLoaded) {
        fetch("/api/cards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: [card.id] }),
        })
          .then((r) => r.json())
          .then((res) => {
            const p = res.prices?.[card.id];
            if (p) {
              setCards((prev) =>
                prev.map((c) =>
                  c.id === card.id
                    ? {
                        ...c,
                        rarity: p.rarity || c.rarity,
                        setName: p.setName || c.setName,
                        setOfficialCount: p.setOfficialCount || c.setOfficialCount || 0,
                        image: c.image || p.image || "",
                        priceUsd: p.priceUsd,
                        priceSource: p.priceSource,
                        priceLoaded: true,
                      }
                    : c
                )
              );
            }
          })
          .catch(() => {});
      }
    }
  };

  const addCriterion = (newCrit: string) => {
    if (isReadOnlyGuest) return;
    if (criteria.some((c) => c.toLowerCase() === newCrit.toLowerCase())) return;
    const updated = [...criteria, newCrit];
    setCriteria(updated);
    setCurrentPage(1);
    fetchMasterSet(updated);
  };

  const removeCriterion = (critToRemove: string) => {
    if (isReadOnlyGuest) return;
    const updated = criteria.filter((c) => c !== critToRemove);
    setCriteria(updated);
    fetchMasterSet(updated);
  };

  const handleAddPokemon = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputPokemon.trim();
    if (!clean) return;
    addCriterion(`POKE:${clean}`);
    setInputPokemon("");
  };

  const formatCriterionLabel = (crit: string) => {
    if (crit.startsWith("POKE:")) return `POKÉMON: ${crit.replace("POKE:", "").toUpperCase()}`;
    if (crit.startsWith("GEN:")) return `GEN ${crit.replace("GEN:", "")}`;
    if (crit.startsWith("TYPE:")) {
      const t = ELEMENTAL_TYPES.find((x) => x.id === crit.replace("TYPE:", ""));
      return `TIPO: ${t ? t.label.toUpperCase() : crit.replace("TYPE:", "").toUpperCase()}`;
    }
    if (crit.startsWith("SET:")) {
      const parts = crit.replace("SET:", "").split("|");
      return `SET: ${(parts[1] || parts[0]).toUpperCase()}`;
    }
    return crit.toUpperCase();
  };

  const bulkCriteriaList = criteria.filter((c) => !c.startsWith("CARD:"));
  const singlePickedIds = new Set(
    criteria.filter((c) => c.startsWith("CARD:")).map((c) => c.replace("CARD:", ""))
  );
  const allBinderCardIds = new Set(cards.map((c) => c.id));

  const availableRarities = Array.from(new Set(cards.map((c) => c.rarity || "Estándar"))).sort();

  const orderedBinderCards = [...cards].sort((a, b) => {
    if (sortOrder === "selection") {
      if (a.addedOrder !== undefined && b.addedOrder !== undefined && a.addedOrder !== b.addedOrder) {
        return a.addedOrder - b.addedOrder;
      }
      const indexA = criteria.findIndex((c) => c.toLowerCase() === `card:${a.id.toLowerCase()}`);
      const indexB = criteria.findIndex((c) => c.toLowerCase() === `card:${b.id.toLowerCase()}`);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      return 0;
    }
    if (a.setRank !== b.setRank) return a.setRank - b.setRank;
    return a.cardNumOrder - b.cardNumOrder;
  });

  const isCardOwned = (cardId: string) => (collectedMap[cardId]?.length || 0) > 0;
  const isCardInTrade = (cardId: string) => (tradeMap[cardId]?.qty || 0) > 0;

  const filteredCards = orderedBinderCards.filter((c) => {
    if (viewFilter === "collected" && !isCardOwned(c.id)) return false;
    if (viewFilter === "missing" && isCardOwned(c.id)) return false;
    if (viewFilter === "trade" && !isCardInTrade(c.id)) return false;
    if (rarityFilter !== "ALL" && c.rarity !== rarityFilter) return false;
    if (binderSearchQuery.trim()) {
      const q = binderSearchQuery.toLowerCase();
      const matchName = c.name.toLowerCase().includes(q);
      const matchSet = c.setName.toLowerCase().includes(q);
      const matchNum = formatCardNumberDisplay(c).toLowerCase().includes(q);
      if (!matchName && !matchSet && !matchNum) return false;
    }
    return true;
  });

  // Cálculos matemáticos en vivo del Master Set + Trade Binder + ROI
  const totalCardsCount = cards.length;
  const collectedCount = cards.filter((c) => isCardOwned(c.id)).length;
  const totalPhysicalCopiesOwned = cards.reduce(
    (acc, c) => acc + (collectedMap[c.id]?.length || 0),
    0
  );
  const missingCardsList = orderedBinderCards.filter((c) => !isCardOwned(c.id));
  const missingCount = missingCardsList.length;

  const tradeCardsList = orderedBinderCards.filter((c) => isCardInTrade(c.id));
  const tradeTotalUnits = tradeCardsList.reduce((acc, c) => acc + (tradeMap[c.id]?.qty || 0), 0);
  const tradeTotalValueUsd = tradeCardsList.reduce((acc, c) => {
    const t = tradeMap[c.id];
    const unitVal = t && t.priceUsd > 0 ? t.priceUsd : c.priceUsd || 0;
    return acc + (t?.qty || 0) * unitVal;
  }, 0);

  const progressPercent =
    totalCardsCount > 0 ? ((collectedCount / totalCardsCount) * 100).toFixed(1) : "0.0";

  const totalSetValueUsd = cards.reduce((acc, c) => acc + (c.priceUsd || 0), 0);
  const collectedValueUsd = cards.reduce((acc, c) => {
    const entries = collectedMap[c.id] || [];
    const cardSum = entries.reduce(
      (sum, entry) => sum + (entry.priceUsd > 0 ? entry.priceUsd : c.priceUsd || 0),
      0
    );
    return acc + cardSum;
  }, 0);
  const missingValueUsd = missingCardsList.reduce((acc, c) => acc + (c.priceUsd || 0), 0);

  const totalInvestedCostUsd = cards.reduce((acc, c) => {
    const entries = collectedMap[c.id] || [];
    const entryCosts = entries.reduce((sum, entry) => {
      const key = getCostKey(c.id, entry.language, entry.variant);
      const explicitPaid = paidCostMap[key];
      const fallbackCost = entry.priceUsd > 0 ? entry.priceUsd : c.priceUsd || 0;
      return sum + (explicitPaid !== undefined ? explicitPaid : fallbackCost);
    }, 0);
    return acc + entryCosts;
  }, 0);

  const netProfitUsd = collectedValueUsd - totalInvestedCostUsd;
  const roiPercentage =
    totalInvestedCostUsd > 0
      ? ((netProfitUsd / totalInvestedCostUsd) * 100).toFixed(1)
      : "0.0";

  const topRoiGainers = cards
    .flatMap((c) => {
      const entries = collectedMap[c.id] || [];
      return entries.map((entry) => {
        const key = getCostKey(c.id, entry.language, entry.variant);
        const currentVal = entry.priceUsd > 0 ? entry.priceUsd : c.priceUsd || 0;
        const paidVal = paidCostMap[key] !== undefined ? paidCostMap[key] : currentVal;
        const profit = currentVal - paidVal;
        const pct = paidVal > 0 ? (profit / paidVal) * 100 : 0;
        return {
          card: c,
          entry,
          paidVal,
          currentVal,
          profit,
          pct,
        };
      });
    })
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 6);

  const chartDataPoints: PortfolioSnapshot[] = [
    ...portfolioHistory.filter((s) => s.date !== todayIso),
    {
      date: todayIso,
      collectedUsd: collectedValueUsd,
      investedUsd: totalInvestedCostUsd,
      collectedCount,
    },
  ].sort((a, b) => a.date.localeCompare(b.date));

  const handleSimulateHistoricalCurve = () => {
    const baseVal = Math.max(25, collectedValueUsd || totalSetValueUsd * 0.35 || 120);
    const baseInv = Math.max(20, totalInvestedCostUsd || baseVal * 0.8);
    const now = new Date();
    const factors = [0.62, 0.68, 0.74, 0.79, 0.88, 0.94];
    const generated: PortfolioSnapshot[] = factors.map((f, idx) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (factors.length - idx) * 15);
      return {
        date: d.toISOString().split("T")[0],
        collectedUsd: Number((baseVal * f).toFixed(2)),
        investedUsd: Number((baseInv * Math.min(1, f + 0.05)).toFixed(2)),
        collectedCount: Math.max(1, Math.round(collectedCount * f)),
      };
    });
    setPortfolioHistory(generated);
    showBanner("Curva histórica generada. Tocá ACTUALIZAR SET arriba si querés dejarla guardada.");
  };

  const generatePublicShareUrl = (): string => {
    if (typeof window === "undefined") return "";
    const payload = {
      n: binderName,
      p: pockets,
      c: criteria.slice(0, 80),
      o: Object.keys(collectedMap).slice(0, 250),
      t: Object.entries(tradeMap)
        .filter(([, v]) => v.qty > 0)
        .map(([id, v]) => `${id}|${v.qty}|${v.priceUsd}`),
    };
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    return `${window.location.origin}${window.location.pathname}?share=${encodeURIComponent(encoded)}`;
  };

  const generateTradePostText = (): string => {
    const lines: string[] = [];
    lines.push(`⚡ POKÉMON TCG ARGENTINA — CANJE / VENTA (${binderName.toUpperCase()}) ⚡`);
    lines.push(`📊 Progreso de mi Master Set: ${collectedCount}/${totalCardsCount} (${progressPercent}%)`);
    lines.push("");

    lines.push(`🔄 OFREZCO PARA CANJE / VENTA (${tradeTotalUnits} cartas):`);
    if (tradeCardsList.length === 0) {
      lines.push("• (Sin repetidas cargadas por el momento)");
    } else {
      tradeCardsList.forEach((c) => {
        const t = tradeMap[c.id];
        const unitPrice = t && t.priceUsd > 0 ? t.priceUsd : c.priceUsd || 0;
        lines.push(
          `• ${t.qty}x ${c.name} — ${c.setName} (${formatCardNumberDisplay(c)}) [${t.language.toUpperCase()} • ${t.variant}] -> ${
            unitPrice > 0 ? formatMoney(unitPrice) : "A convenir"
          }`
        );
      });
    }

    lines.push("");
    lines.push(`🔍 BUSCO PARA MI MASTER SET (${missingCount} faltantes - Top prioridades):`);
    if (missingCardsList.length === 0) {
      lines.push("• ¡Master Set 100% completado!");
    } else {
      missingCardsList.slice(0, 15).forEach((c) => {
        lines.push(
          `• ${c.name} — ${c.setName} (${formatCardNumberDisplay(c)}) [${c.rarity}] ${
            c.priceUsd > 0 ? `(Ref: ${formatMoney(c.priceUsd)})` : ""
          }`
        );
      });
      if (missingCardsList.length > 15) {
        lines.push(`...y ${missingCardsList.length - 15} cartas más.`);
      }
    }

    return lines.join("\n");
  };

  const addCardToMyOffer = (cardId: string) => {
    const found = cards.find((c) => c.id === cardId);
    if (!found) return;
    const tPrice = tradeMap[cardId]?.priceUsd || found.priceUsd || 0;
    setMyTradeOffer((prev) => {
      const existing = prev.find((x) => x.id === found.id);
      if (existing) {
        return prev.map((x) => (x.id === found.id ? { ...x, qty: x.qty + 1 } : x));
      }
      return [
        ...prev,
        {
          id: found.id,
          name: `${found.name} (${formatCardNumberDisplay(found)})`,
          priceUsd: tPrice,
          qty: 1,
        },
      ];
    });
  };

  const addCardToTheirOffer = (cardId: string) => {
    const found = cards.find((c) => c.id === cardId);
    if (!found) return;
    setTheirTradeOffer((prev) => {
      const existing = prev.find((x) => x.id === found.id);
      if (existing) {
        return prev.map((x) => (x.id === found.id ? { ...x, qty: x.qty + 1 } : x));
      }
      return [
        ...prev,
        {
          id: found.id,
          name: `${found.name} (${formatCardNumberDisplay(found)})`,
          priceUsd: found.priceUsd || 0,
          qty: 1,
        },
      ];
    });
  };

  const addCustomCardToTheirOffer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTheirName.trim()) return;
    const p = parseFloat(customTheirPrice) || 0;
    setTheirTradeOffer((prev) => [
      ...prev,
      {
        id: `custom-${prev.length + 1}-${customTheirName.trim()}`,
        name: customTheirName.trim(),
        priceUsd: p,
        qty: 1,
      },
    ]);
    setExternalTheirName("");
    setExternalTheirPrice("");
  };

  const myOfferTotalUsd = myTradeOffer.reduce((acc, item) => acc + item.priceUsd * item.qty, 0);
  const theirOfferTotalUsd = theirTradeOffer.reduce(
    (acc, item) => acc + item.priceUsd * item.qty,
    0
  );
  const tradeDiffUsd = theirOfferTotalUsd - myOfferTotalUsd;

  const totalPages = Math.max(1, Math.ceil(filteredCards.length / pockets));
  const paginatedCards = filteredCards.slice((currentPage - 1) * pockets, currentPage * pockets);

  const topValuableCards = [...cards]
    .filter((c) => c.priceUsd > 0)
    .sort((a, b) => b.priceUsd - a.priceUsd)
    .slice(0, 6);

  const languageBreakdown: Record<string, number> = {};
  cards.forEach((c) => {
    (collectedMap[c.id] || []).forEach((entry) => {
      languageBreakdown[entry.language] = (languageBreakdown[entry.language] || 0) + 1;
    });
  });

  const setBreakdownMap = new Map<string, { total: number; owned: number; valueUsd: number }>();
  orderedBinderCards.forEach((c) => {
    const current = setBreakdownMap.get(c.setName) || { total: 0, owned: 0, valueUsd: 0 };
    current.total += 1;
    if (isCardOwned(c.id)) current.owned += 1;
    current.valueUsd += c.priceUsd || 0;
    setBreakdownMap.set(c.setName, current);
  });
  const setBreakdownList = Array.from(setBreakdownMap.entries());

  const copyWishlistToClipboard = () => {
    const header = `📋 LISTA DE FALTANTES - ${binderName.toUpperCase()}\nFaltan: ${missingCount} cartas | Valor estimado: ${formatMoney(
      missingValueUsd
    )}\n----------------------------------------\n`;
    const lines = missingCardsList.map(
      (c, idx) =>
        `${idx + 1}. ${c.name}— ${c.setName} (${formatCardNumberDisplay(c)}) [${c.rarity}] -> ${
          c.priceUsd > 0 ? formatMoney(c.priceUsd) : "S/P"
        }`
    );
    navigator.clipboard.writeText(header + lines.join("\n"));
    showBanner("¡Lista de cartas faltantes copiada al portapapeles!");
  };

  const downloadWishlistCsv = () => {
    const headers = [
      "Numero_Orden",
      "Pokemon",
      "Expansion_Set",
      "Numero_Carta",
      "Rareza",
      "Precio_USD",
      "Precio_ARS",
      "Fuente",
      "Link_Busqueda_TCGfans",
    ];
    const rows = missingCardsList.map((c, idx) => {
      const displayNum = formatCardNumberDisplay(c);
      const rarityLabel =
        c.rarity && c.rarity !== "Estándar" && c.rarity !== "None" ? c.rarity : "Common";
      const exactQuery = `${c.name}— ${c.setName} (${displayNum}) [${rarityLabel}]`;
      const searchUrl = `https://tcg.fans/pokemon/search?query=${encodeURIComponent(exactQuery)}`;
      return [
        idx + 1,
        `"${c.name.replace(/"/g, '""')}"`,
        `"${c.setName.replace(/"/g, '""')}"`,
        `"${displayNum}"`,
        `"${c.rarity}"`,
        c.priceUsd > 0 ? c.priceUsd.toFixed(2) : "0.00",
        c.priceUsd > 0 ? Math.round(c.priceUsd * usdToArsRate) : "0",
        c.priceSource,
        `"${searchUrl}"`,
      ];
    });
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${binderName.replace(/\s+/g, "_")}_faltantes.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredSetOptions = availableSets.filter(
    (s) =>
      s.name.toLowerCase().includes(setSearchFilter.toLowerCase()) ||
      s.id.toLowerCase().includes(setSearchFilter.toLowerCase())
  );

  const filteredExplorerSets = availableSets.filter(
    (s) =>
      s.name.toLowerCase().includes(explorerSetFilter.toLowerCase()) ||
      s.id.toLowerCase().includes(explorerSetFilter.toLowerCase())
  );

  const filteredExplorerCards = explorerCards.filter((c) => {
    if (!explorerTextFilter.trim()) return true;
    const q = explorerTextFilter.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      formatCardNumberDisplay(c).toLowerCase().includes(q) ||
      c.setName.toLowerCase().includes(q)
    );
  });
  const explorerPerPage = 18;
  const explorerTotalPages = Math.max(1, Math.ceil(filteredExplorerCards.length / explorerPerPage));
  const paginatedExplorerCards = filteredExplorerCards.slice(
    (explorerPage - 1) * explorerPerPage,
    explorerPage * explorerPerPage
  );

  // Coincidencias rápidas en el Escáner de Cámara
  const scannerMatchedCards = orderedBinderCards
    .filter((c) => {
      if (!scannerSearchText.trim()) return true;
      const q = scannerSearchText.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        formatCardNumberDisplay(c).toLowerCase().includes(q) ||
        c.setName.toLowerCase().includes(q)
      );
    })
    .slice(0, 6);

  const buildCombinedVariantLabel = () => {
    return modalCondition === "NM" ? modalVariant : `${modalVariant} [${modalCondition}]`;
  };

  const chartWidth = 680;
  const chartHeight = 210;
  const padX = 42;
  const padY = 24;
  const maxChartVal = Math.max(
    10,
    ...chartDataPoints.map((d) => Math.max(d.collectedUsd, d.investedUsd))
  );

  const getPointCoords = (idx: number, val: number) => {
    const total = chartDataPoints.length;
    const x =
      total <= 1
        ? chartWidth / 2
        : padX + (idx / (total - 1)) * (chartWidth - padX * 2);
    const y =
      chartHeight -
      padY -
      (Math.max(0, val) / maxChartVal) * (chartHeight - padY * 2);
    return { x, y };
  };

  const marketPolyline = chartDataPoints
    .map((pt, i) => {
      const { x, y } = getPointCoords(i, pt.collectedUsd);
      return `${x},${y}`;
    })
    .join(" ");

  const investedPolyline = chartDataPoints
    .map((pt, i) => {
      const { x, y } = getPointCoords(i, pt.investedUsd);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="space-y-6">
      {/* INDICADOR DE MODO OFFLINE ACTIVO */}
      {isOfflineMode && (
        <div className="bg-amber-400 text-black border-4 border-black px-4 py-2.5 rounded font-bold text-xs flex items-center justify-between shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <span className="flex items-center gap-2">
            <WifiOff className="w-4 h-4" /> MODO OFFLINE ACTIVO: Mostrando tu Binder desde la memoria local del dispositivo.
          </span>
        </div>
      )}

      {/* BANNER ESPECIAL: MODO VISITANTE (LINK PÚBLICO DE SOLO LECTURA) */}
      {isReadOnlyGuest && (
        <div className="bg-purple-400 text-black border-4 border-black p-3.5 rounded flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="text-xs font-bold">
            👁 MODO VISITANTE (SOLO LECTURA): Estás explorando el Master Set compartido{" "}
            <span className="underline">&quot;{binderName}&quot;</span>.
          </div>
          <div className="flex flex-wrap gap-2">
            {user && (
              <button
                type="button"
                onClick={() => {
                  isGuestModeRef.current = false;
                  setIsReadOnlyGuest(false);
                  setShowcaseMode(false);
                  activeBinderIdRef.current = null;
                  setActiveBinderId(null);
                  setBinderName(`${binderName} (Copia)`);
                  showBanner("¡Copia habilitada! Tocá GUARDAR SET para grabarla en tu cuenta.");
                }}
                className="bg-green-500 hover:bg-green-400 text-black text-[11px] font-bold px-3 py-1.5 rounded border-2 border-black cursor-pointer"
              >
                + Clonar este Set en mi cuenta
              </button>
            )}
            <button
              type="button"
              onClick={handleExitGuestMode}
              className="bg-black text-white text-[11px] font-bold px-3 py-1.5 rounded border-2 border-black cursor-pointer"
            >
              Volver a mis Binders
            </button>
          </div>
        </div>
      )}

      {/* AVISO FLOTANTE DE ESTADO */}
      {statusBanner && (
        <div className="bg-yellow-400 text-black border-4 border-black px-4 py-3 rounded font-bold text-xs flex justify-between items-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <span>▸ {statusBanner}</span>
          <button onClick={() => setStatusBanner(null)} className="font-bold text-sm cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* 1. SECCIÓN: MIS MASTER SETS GUARDADOS + CÁMARA + CANJES + PORTAFOLIO */}
      <div className="bg-[#262b25] border-2 border-[#588157] p-4 rounded space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-[#588157]/50 pb-3">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-yellow-400" />
            <h2 style={{ fontFamily: "var(--font-retro)" }} className="text-xs sm:text-sm text-yellow-400">
              MIS MASTER SETS / BINDERS
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <input
              type="text"
              value={binderName}
              disabled={isReadOnlyGuest}
              onChange={(e) => setBinderName(e.target.value)}
              placeholder="Nombre del Master Set..."
              className="bg-[#1a1c19] border-2 border-[#588157] px-3 py-1.5 text-xs text-white focus:border-yellow-400 outline-none rounded flex-1 md:w-40 font-bold disabled:opacity-50"
            />
            {!isReadOnlyGuest && (
              <>
                <button
                  onClick={handleSaveBinder}
                  disabled={savingBinder}
                  style={{ fontFamily: "var(--font-retro)" }}
                  className="bg-green-500 hover:bg-green-400 text-black text-[10px] px-3 py-2 border-2 border-black flex items-center gap-1.5 cursor-pointer font-bold"
                >
                  <Save className="w-3.5 h-3.5" />
                  {savingBinder ? "GUARDANDO..." : activeBinderId ? "ACTUALIZAR SET" : "GUARDAR SET"}
                </button>
                <button
                  onClick={handleNewBinderDraft}
                  style={{ fontFamily: "var(--font-retro)" }}
                  className="bg-yellow-400 hover:bg-yellow-300 text-black text-[10px] px-3 py-2 border-2 border-black flex items-center gap-1 cursor-pointer font-bold"
                >
                  <Plus className="w-3.5 h-3.5" /> NUEVO SET
                </button>
                <button
                  onClick={startCameraScanner}
                  style={{ fontFamily: "var(--font-retro)" }}
                  className="bg-rose-400 hover:bg-rose-300 text-black text-[10px] px-3 py-2 border-2 border-black flex items-center gap-1.5 cursor-pointer font-bold"
                  title="Abrir cámara para escanear y marcar cartas físicas"
                >
                  <Camera className="w-3.5 h-3.5" /> ESCÁNER CÁMARA
                </button>
              </>
            )}

            <button
              onClick={() => setShowTradeHubModal(true)}
              style={{ fontFamily: "var(--font-retro)" }}
              className="bg-purple-400 hover:bg-purple-300 text-black text-[10px] px-3 py-2 border-2 border-black flex items-center gap-1.5 cursor-pointer font-bold"
            >
              <Share2 className="w-3.5 h-3.5" /> CANJES ({tradeTotalUnits})
            </button>

            <button
              onClick={() => setShowPortfolioModal(true)}
              style={{ fontFamily: "var(--font-retro)" }}
              className="bg-emerald-400 hover:bg-emerald-300 text-black text-[10px] px-3 py-2 border-2 border-black flex items-center gap-1.5 cursor-pointer font-bold"
            >
              <TrendingUp className="w-3.5 h-3.5" /> PORTAFOLIO
            </button>
            <button
              onClick={() => setShowStatsModal(true)}
              style={{ fontFamily: "var(--font-retro)" }}
              className="bg-amber-400 hover:bg-amber-300 text-black text-[10px] px-3 py-2 border-2 border-black flex items-center gap-1.5 cursor-pointer font-bold"
            >
              <BarChart3 className="w-3.5 h-3.5" /> ESTADÍSTICAS
            </button>
            <button
              onClick={() => setShowWishlistModal(true)}
              style={{ fontFamily: "var(--font-retro)" }}
              className="bg-[#28AAFD] hover:bg-sky-300 text-black text-[10px] px-3 py-2 border-2 border-black flex items-center gap-1.5 cursor-pointer font-bold"
            >
              <ClipboardList className="w-3.5 h-3.5" /> FALTANTES ({missingCount})
            </button>
          </div>
        </div>

        {/* Lista de Binders + Controles de Moneda, Instalar App PWA y Backup JSON */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {!user ? (
              <p className="text-xs text-[#84a98c]">
                Iniciá sesión con el botón <strong className="text-yellow-400">LOGIN</strong> arriba a la derecha para guardar múltiples Master Sets en la nube.
              </p>
            ) : savedBinders.length === 0 ? (
              <p className="text-xs text-[#84a98c]">
                Todavía no guardaste ningún Master Set. Elegí tus cartas abajo y tocá <strong className="text-green-400">GUARDAR SET</strong>.
              </p>
            ) : (
              savedBinders.map((b) => {
                const isSelected = b.id === activeBinderId && !isReadOnlyGuest;
                const ruleCount = (b.pokemons || []).filter(
                  (x) =>
                    !x.startsWith("HIST:") &&
                    !x.startsWith("COST:") &&
                    !x.startsWith("TRADE:")
                ).length;
                return (
                  <div
                    key={b.id}
                    className={`flex items-center rounded border-2 transition-all ${
                      isSelected
                        ? "bg-yellow-400 text-black border-black font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                        : "bg-[#1a1c19] text-[#e0f8cf] border-[#588157] hover:border-yellow-400"
                    }`}
                  >
                    <button
                      onClick={() => selectSavedBinder(b, false)}
                      className="px-3 py-1.5 text-xs cursor-pointer flex items-center gap-2"
                    >
                      <span>📁 {b.name}</span>
                      <span className="text-[10px] opacity-75">({ruleCount} ítems)</span>
                    </button>
                    <button
                      onClick={() => handleDeleteBinder(b.id, b.name)}
                      className={`px-2 py-1.5 border-l cursor-pointer hover:text-red-500 ${
                        isSelected ? "border-black/30" : "border-[#588157]/40"
                      }`}
                      title="Eliminar Master Set"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 self-end lg:self-center">
            <div className="flex items-center bg-[#1a1c19] border border-[#588157] rounded px-2 py-1 gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-green-400" />
              <button
                type="button"
                onClick={() => setCurrencyMode((m) => (m === "USD" ? "ARS" : "USD"))}
                className="text-[11px] font-bold text-yellow-400 hover:underline cursor-pointer"
              >
                Moneda: {currencyMode === "USD" ? "USD ($)" : "ARS (🇦🇷 $)"}
              </button>
              {currencyMode === "ARS" && (
                <div className="flex items-center gap-1 border-l border-[#588157]/50 pl-1.5">
                  <span className="text-[10px] text-[#84a98c]">1 USD =</span>
                  <input
                    type="number"
                    value={usdToArsRate}
                    onChange={(e) => setUsdToArsRate(Math.max(1, Number(e.target.value) || 1))}
                    className="w-16 bg-[#262b25] border border-[#588157] px-1.5 py-0.5 text-[11px] text-white font-bold rounded outline-none"
                  />
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleInstallPwaApp}
              className="bg-[#1a1c19] hover:bg-[#28AAFD] hover:text-black text-[#28AAFD] text-[11px] font-bold px-2.5 py-1 rounded border border-[#28AAFD] flex items-center gap-1 cursor-pointer"
              title="Instalar PokéBinder como aplicación nativa en tu celular o PC"
            >
              <Smartphone className="w-3 h-3" /> Instalar App
            </button>

            <button
              type="button"
              onClick={handleExportBinderJson}
              className="bg-[#1a1c19] hover:bg-yellow-400 hover:text-black text-[#e0f8cf] text-[11px] font-bold px-2.5 py-1 rounded border border-[#588157] flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3 h-3" /> Backup JSON
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportBinderJson}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="bg-[#1a1c19] hover:bg-yellow-400 hover:text-black text-[#e0f8cf] text-[11px] font-bold px-2.5 py-1 rounded border border-[#588157] flex items-center gap-1 cursor-pointer"
            >
              <Upload className="w-3 h-3" /> Importar JSON
            </button>
          </div>
        </div>
      </div>

      {/* 2. CONSTRUCTOR DEL BINDER: MODO AUTOMÁTICO VS MODO xBINDR */}
      {!showcaseMode && !isReadOnlyGuest && (
        <div className="bg-[#262b25] border-2 border-[#588157] p-4 rounded space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b-2 border-[#588157] pb-3">
            <div>
              <h2 style={{ fontFamily: "var(--font-retro)" }} className="text-xs sm:text-sm text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-yellow-400" /> ARMADOR DE BINDER
              </h2>
              <p className="text-xs text-[#84a98c] mt-1">
                Elegí si querés sumar colecciones completas de una vez o elegir tus cartas favoritas una por una:
              </p>
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setBuilderMode("bulk")}
                className={`flex-1 sm:flex-initial px-3 py-2 text-xs font-bold rounded border-2 cursor-pointer transition-all ${
                  builderMode === "bulk"
                    ? "bg-yellow-400 text-black border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                    : "bg-[#1a1c19] text-[#84a98c] border-[#588157] hover:text-white"
                }`}
              >
                ⚡ MODO REGLAS COMPLETAS
              </button>
              <button
                type="button"
                onClick={() => setBuilderMode("picker")}
                className={`flex-1 sm:flex-initial px-3 py-2 text-xs font-bold rounded border-2 cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                  builderMode === "picker"
                    ? "bg-[#28AAFD] text-black border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                    : "bg-[#1a1c19] text-[#84a98c] border-[#588157] hover:text-white"
                }`}
              >
                <Grid className="w-3.5 h-3.5" /> MODO xBINDR (CARTA POR CARTA)
              </button>
            </div>
          </div>

          {builderMode === "bulk" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <form onSubmit={handleAddPokemon} className="bg-[#1a1c19] p-3 rounded border border-[#588157] space-y-2">
                <label className="block text-[11px] text-yellow-400 font-bold uppercase">1. Todas las de un Pokémon</label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={inputPokemon}
                    onChange={(e) => setInputPokemon(e.target.value)}
                    placeholder="Ej: Kyogre, Pikachu..."
                    className="bg-[#262b25] border border-[#588157] px-2.5 py-1.5 text-xs text-white focus:border-yellow-400 outline-none flex-1 rounded min-w-0"
                  />
                  <button
                    type="submit"
                    className="bg-yellow-400 hover:bg-yellow-300 text-black text-xs px-2.5 py-1.5 font-bold rounded cursor-pointer shrink-0"
                  >
                    +
                  </button>
                </div>
              </form>

              <div className="bg-[#1a1c19] p-3 rounded border border-[#588157] space-y-2">
                <label className="block text-[11px] text-yellow-400 font-bold uppercase">2. Toda una Generación</label>
                <div className="flex gap-1.5">
                  <select
                    value={selectedGen}
                    onChange={(e) => setSelectedGen(e.target.value)}
                    className="bg-[#262b25] border border-[#588157] px-2 py-1.5 text-xs text-white focus:border-yellow-400 outline-none flex-1 rounded min-w-0"
                  >
                    {GENERATIONS.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => addCriterion(`GEN:${selectedGen}`)}
                    className="bg-yellow-400 hover:bg-yellow-300 text-black text-xs px-2.5 py-1.5 font-bold rounded cursor-pointer shrink-0"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="bg-[#1a1c19] p-3 rounded border border-[#588157] space-y-2">
                <label className="block text-[11px] text-yellow-400 font-bold uppercase">3. Todo un Tipo Elemental</label>
                <div className="flex gap-1.5">
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="bg-[#262b25] border border-[#588157] px-2 py-1.5 text-xs text-white focus:border-yellow-400 outline-none flex-1 rounded min-w-0"
                  >
                    {ELEMENTAL_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => addCriterion(`TYPE:${selectedType}`)}
                    className="bg-yellow-400 hover:bg-yellow-300 text-black text-xs px-2.5 py-1.5 font-bold rounded cursor-pointer shrink-0"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="bg-[#1a1c19] p-3 rounded border border-[#588157] space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-[11px] text-yellow-400 font-bold uppercase">4. Todo un Set TCG</label>
                  <input
                    type="text"
                    value={setSearchFilter}
                    onChange={(e) => setSetSearchFilter(e.target.value)}
                    placeholder="Filtrar set..."
                    className="bg-[#262b25] border border-[#588157]/60 px-1.5 py-0.5 text-[10px] text-white outline-none rounded w-24"
                  />
                </div>
                <div className="flex gap-1.5">
                  <select
                    value={selectedSetId}
                    onChange={(e) => setSelectedSetId(e.target.value)}
                    className="bg-[#262b25] border border-[#588157] px-2 py-1.5 text-xs text-white focus:border-yellow-400 outline-none flex-1 rounded min-w-0"
                  >
                    {filteredSetOptions.map((s) => (
                      <option key={s.id} value={`${s.id}|${s.name}`}>
                        {s.name} ({s.id.toUpperCase()})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => selectedSetId && addCriterion(`SET:${selectedSetId}`)}
                    className="bg-yellow-400 hover:bg-yellow-300 text-black text-xs px-2.5 py-1.5 font-bold rounded cursor-pointer shrink-0"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* EXPLORADOR CARTA POR CARTA (xBINDR) */
            <div className="bg-[#1a1c19] border-2 border-[#28AAFD] rounded p-4 space-y-4">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 border-b border-[#588157]/50 pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-[#28AAFD] uppercase mr-1">1. Explorar por:</span>
                  {(
                    [
                      { id: "SET", label: "Set TCG (Ej: 151)" },
                      { id: "TYPE", label: "Tipo (Agua, Fuego...)" },
                      { id: "POKE", label: "Pokémon" },
                      { id: "GEN", label: "Generación" },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setExplorerSource(tab.id)}
                      className={`px-2.5 py-1 text-xs rounded border cursor-pointer font-bold ${
                        explorerSource === tab.id
                          ? "bg-[#28AAFD] text-black border-black"
                          : "bg-[#262b25] text-[#e0f8cf] border-[#588157]"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                  {explorerSource === "SET" && (
                    <>
                      <input
                        type="text"
                        value={explorerSetFilter}
                        onChange={(e) => setExplorerSetFilter(e.target.value)}
                        placeholder="Buscar set (ej: 151)..."
                        className="bg-[#262b25] border border-[#588157] px-2.5 py-1.5 text-xs text-white rounded w-36 outline-none focus:border-[#28AAFD]"
                      />
                      <select
                        value={explorerSetId}
                        onChange={(e) => {
                          setExplorerSetId(e.target.value);
                          loadExplorerCatalog(`SET:${e.target.value}`);
                        }}
                        className="bg-[#262b25] border border-[#588157] px-2.5 py-1.5 text-xs text-white rounded flex-1 lg:w-64 outline-none focus:border-[#28AAFD]"
                      >
                        {filteredExplorerSets.map((s) => (
                          <option key={s.id} value={`${s.id}|${s.name}`}>
                            {s.name} ({s.id.toUpperCase()})
                          </option>
                        ))}
                      </select>
                    </>
                  )}

                  {explorerSource === "TYPE" && (
                    <select
                      value={explorerType}
                      onChange={(e) => {
                        setExplorerType(e.target.value);
                        loadExplorerCatalog(`TYPE:${e.target.value}`);
                      }}
                      className="bg-[#262b25] border border-[#588157] px-3 py-1.5 text-xs text-white rounded flex-1 lg:w-60 outline-none focus:border-[#28AAFD]"
                    >
                      {ELEMENTAL_TYPES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  )}

                  {explorerSource === "POKE" && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (explorerPoke.trim()) loadExplorerCatalog(`POKE:${explorerPoke.trim()}`);
                      }}
                      className="flex gap-1.5 w-full sm:w-auto"
                    >
                      <input
                        type="text"
                        value={explorerPoke}
                        onChange={(e) => setExplorerPoke(e.target.value)}
                        placeholder="Nombre del Pokémon..."
                        className="bg-[#262b25] border border-[#588157] px-3 py-1.5 text-xs text-white rounded flex-1 sm:w-52 outline-none focus:border-[#28AAFD]"
                      />
                      <button
                        type="submit"
                        className="bg-[#28AAFD] text-black font-bold text-xs px-3 py-1.5 rounded border border-black cursor-pointer"
                      >
                        VER CARTAS
                      </button>
                    </form>
                  )}

                  {explorerSource === "GEN" && (
                    <select
                      value={explorerGen}
                      onChange={(e) => {
                        setExplorerGen(e.target.value);
                        loadExplorerCatalog(`GEN:${e.target.value}`);
                      }}
                      className="bg-[#262b25] border border-[#588157] px-3 py-1.5 text-xs text-white rounded flex-1 lg:w-60 outline-none focus:border-[#28AAFD]"
                    >
                      {GENERATIONS.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.label}
                        </option>
                      ))}
                    </select>
                  )}

                  <button
                    type="button"
                    onClick={() => loadExplorerCatalog()}
                    className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-xs px-3 py-1.5 rounded border border-black cursor-pointer flex items-center gap-1"
                  >
                    <Search className="w-3.5 h-3.5" /> CARGAR CATÁLOGO
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <p className="text-xs text-[#84a98c]">
                  Hacé clic en las cartas que más te gusten para sumarlas o quitarlas de <strong className="text-white">{binderName}</strong>:
                </p>
                <input
                  type="text"
                  value={explorerTextFilter}
                  onChange={(e) => {
                    setExplorerTextFilter(e.target.value);
                    setExplorerPage(1);
                  }}
                  placeholder="Filtrar por nombre o # dentro de esta vista..."
                  className="bg-[#262b25] border border-[#588157] px-3 py-1 text-xs text-white rounded w-full sm:w-72 outline-none focus:border-yellow-400"
                />
              </div>

              {explorerLoading ? (
                <div className="py-12 text-center space-y-3">
                  <div className="w-8 h-8 border-4 border-[#28AAFD] border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-[#28AAFD] font-bold">Abriendo catálogo de cartas...</p>
                </div>
              ) : paginatedExplorerCards.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#84a98c]">
                  No hay cartas cargadas en esta vista. Elegí un Set, Tipo o Pokémon arriba y tocá <strong>CARGAR CATÁLOGO</strong>.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                    {paginatedExplorerCards.map((c) => {
                      const isPickedIndividually = singlePickedIds.has(c.id);
                      const isAlreadyInBinder = allBinderCardIds.has(c.id);

                      return (
                        <div
                          key={`exp-${c.id}`}
                          onClick={() => toggleSingleCardInBinder(c)}
                          className={`p-2 rounded border-2 cursor-pointer transition-all flex flex-col justify-between select-none ${
                            isPickedIndividually
                              ? "bg-[#1f2e3d] border-[#28AAFD] ring-2 ring-[#28AAFD]/40"
                              : isAlreadyInBinder
                              ? "bg-[#1f2921] border-green-500/70"
                              : "bg-[#262b25] border-[#588157]/60 hover:border-yellow-400"
                          }`}
                        >
                          <div className="relative aspect-[63/88] w-full bg-black/40 rounded overflow-hidden flex items-center justify-center mb-1.5">
                            {c.image ? (
                              <img
                                src={c.image}
                                alt={c.name}
                                loading="lazy"
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <span className="text-[10px] text-center px-1 text-white font-bold">
                                {c.name} #{formatCardNumberDisplay(c)}
                              </span>
                            )}
                          </div>

                          <div>
                            <p className="text-[11px] font-bold text-white truncate" title={c.name}>
                              {c.name}
                            </p>
                            <p className="text-[10px] text-[#84a98c] truncate">
                              {c.setName} ({formatCardNumberDisplay(c)})
                            </p>
                            <button
                              type="button"
                              className={`w-full mt-1.5 py-1 text-[10px] font-bold rounded border cursor-pointer ${
                                isPickedIndividually
                                  ? "bg-[#28AAFD] text-black border-black"
                                  : isAlreadyInBinder
                                  ? "bg-green-500/30 text-green-300 border-green-500"
                                  : "bg-[#1a1c19] text-yellow-400 border-[#588157] hover:bg-yellow-400 hover:text-black"
                              }`}
                            >
                              {isPickedIndividually
                                ? "✓ ELEGIDA (QUITAR)"
                                : isAlreadyInBinder
                                ? "✓ YA EN EL BINDER"
                                : "+ SUMAR AL BINDER"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-[#588157]/40">
                    <button
                      type="button"
                      onClick={() => setExplorerPage((p) => Math.max(1, p - 1))}
                      disabled={explorerPage === 1}
                      className="bg-[#262b25] hover:bg-[#28AAFD] hover:text-black text-white text-xs px-3 py-1 rounded border border-[#588157] disabled:opacity-30 cursor-pointer font-bold"
                    >
                      ◀ Anterior
                    </button>
                    <span className="text-xs text-[#84a98c]">
                      Catálogo: Página <strong>{explorerPage}</strong> de <strong>{explorerTotalPages}</strong> ({filteredExplorerCards.length} cartas)
                    </span>
                    <button
                      type="button"
                      onClick={() => setExplorerPage((p) => Math.min(explorerTotalPages, p + 1))}
                      disabled={explorerPage === explorerTotalPages}
                      className="bg-[#262b25] hover:bg-[#28AAFD] hover:text-black text-white text-xs px-3 py-1 rounded border border-[#588157] disabled:opacity-30 cursor-pointer font-bold"
                    >
                      Siguiente ▶
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Etiquetas (Chips) de reglas y contador de cartas individuales */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#588157]/40">
            <span className="text-xs text-[#84a98c] mr-1">Contenido configurado en este Binder:</span>
            {criteria.length === 0 && (
              <span className="text-xs text-red-400 italic">
                Binder vacío. Sumá reglas completas o elegí cartas individuales en el Modo xBindr.
              </span>
            )}

            {bulkCriteriaList.map((crit) => (
              <span
                key={crit}
                className="bg-[#1a1c19] border-2 border-yellow-400 text-yellow-400 text-xs px-3 py-1 rounded flex items-center gap-2 font-bold"
              >
                {formatCriterionLabel(crit)}
                <button
                  onClick={() => removeCriterion(crit)}
                  className="hover:text-red-400 cursor-pointer"
                  title="Quitar regla"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}

            {singlePickedIds.size > 0 && (
              <span className="bg-[#1f2e3d] border-2 border-[#28AAFD] text-[#28AAFD] text-xs px-3 py-1 rounded flex items-center gap-2 font-bold">
                🎯 {singlePickedIds.size} CARTAS ELEGIDAS A MANO (xBINDR)
                <button
                  onClick={() => {
                    const onlyBulk = criteria.filter((c) => !c.startsWith("CARD:"));
                    setCriteria(onlyBulk);
                    fetchMasterSet(onlyBulk);
                  }}
                  className="hover:text-red-400 cursor-pointer ml-1"
                  title="Quitar todas las cartas individuales"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            )}
          </div>
        </div>
      )}

      {/* 3. PANELES DE PROGRESO, VALOR DE MERCADO Y RENDIMIENTO (ROI) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#262b25] border-2 border-[#588157] p-4 rounded">
          <p className="text-xs text-[#84a98c] uppercase">Master Set Activo</p>
          <p className="text-base font-bold text-white mt-1 truncate">{binderName || "Sin nombre"}</p>
          <p className="text-[11px] text-[#a3b18a] mt-1">
            {tradeTotalUnits > 0
              ? `🔄 ${tradeTotalUnits} cartas listas para canje (${formatMoney(tradeTotalValueUsd)})`
              : totalPhysicalCopiesOwned > collectedCount
              ? `${collectedCount} slots (${totalPhysicalCopiesOwned} cartas físicas)`
              : "1 slot por carta (Soporte Offline & PWA activo)"}
          </p>
        </div>

        <div className="bg-[#262b25] border-2 border-[#588157] p-4 rounded space-y-1.5">
          <div className="flex justify-between text-xs text-[#84a98c] uppercase">
            <span>Progreso del Set</span>
            <span className="text-yellow-400 font-bold">{progressPercent}%</span>
          </div>
          <p className="text-base font-bold text-yellow-400">
            {loading ? "Escaneando..." : `${collectedCount} / ${totalCardsCount} Cartas`}
          </p>
          <div className="w-full bg-[#1a1c19] h-2.5 rounded overflow-hidden border border-[#588157]">
            <div
              className="bg-yellow-400 h-full transition-all duration-300"
              style={{ width: `${Math.min(100, Number(progressPercent))}%` }}
            />
          </div>
          <p className="text-[11px] text-[#a3b18a]">
            Faltan: <strong className="text-white">{missingCount}</strong> cartas para completar
          </p>
        </div>

        <div className="bg-[#262b25] border-2 border-[#588157] p-4 rounded">
          <p className="text-xs text-[#84a98c] uppercase">Valor de Mi Colección (Obtenido)</p>
          <p className="text-lg font-bold text-green-400 mt-1">{formatMoney(collectedValueUsd)}</p>
          <p className="text-[11px] text-[#a3b18a] mt-1">
            Invertido: <strong className="text-white">{formatMoney(totalInvestedCostUsd)}</strong> (
            <span className={netProfitUsd >= 0 ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
              {netProfitUsd >= 0 ? `+${roiPercentage}%` : `${roiPercentage}%`}
            </span>
            )
          </p>
        </div>

        <div className="bg-[#262b25] border-2 border-[#588157] p-4 rounded">
          <div className="flex justify-between items-center">
            <p className="text-xs text-[#84a98c] uppercase">Valor Base / Faltante</p>
            {hydratingPrices && (
              <span className="text-[10px] text-yellow-400 animate-pulse font-bold">Cotizando...</span>
            )}
          </div>
          <p className="text-base font-bold text-white mt-1">Set Base: {formatMoney(totalSetValueUsd)}</p>
          <p className="text-xs font-bold text-red-400 mt-1">Faltan: {formatMoney(missingValueUsd)}</p>
        </div>
      </div>

      {/* 4. ÁREA VISUAL DEL BINDER (9 o 12 BOLSILLOS + FILTRO DE CANJE + MODO VITRINA) */}
      <div className="bg-[#262b25] border-2 border-[#588157] rounded p-4 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row justify-between items-center border-b border-[#588157]/60 pb-4 gap-4">
          <div className="flex items-center gap-3">
            <Layers className="w-5 h-5 text-yellow-400" />
            <h2 style={{ fontFamily: "var(--font-retro)" }} className="text-xs sm:text-sm text-white">
              HOJA {currentPage} DE {totalPages}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-[#84a98c] flex items-center gap-1 mr-1">
              <Filter className="w-3.5 h-3.5" /> Mostrar:
            </span>
            <button
              onClick={() => {
                setViewFilter("all");
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 text-xs rounded border cursor-pointer ${
                viewFilter === "all"
                  ? "bg-yellow-400 text-black border-black font-bold"
                  : "bg-[#1a1c19] text-[#84a98c] border-[#588157]"
              }`}
            >
              Todas ({totalCardsCount})
            </button>
            <button
              onClick={() => {
                setViewFilter("collected");
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 text-xs rounded border cursor-pointer ${
                viewFilter === "collected"
                  ? "bg-green-400 text-black border-black font-bold"
                  : "bg-[#1a1c19] text-[#84a98c] border-[#588157]"
              }`}
            >
              ✓ Obtenidas ({collectedCount})
            </button>
            <button
              onClick={() => {
                setViewFilter("missing");
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 text-xs rounded border cursor-pointer ${
                viewFilter === "missing"
                  ? "bg-red-400 text-black border-black font-bold"
                  : "bg-[#1a1c19] text-[#84a98c] border-[#588157]"
              }`}
            >
              Faltantes ({missingCount})
            </button>

            <button
              onClick={() => {
                setViewFilter("trade");
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 text-xs rounded border cursor-pointer ${
                viewFilter === "trade"
                  ? "bg-purple-400 text-black border-black font-bold"
                  : "bg-[#1a1c19] text-purple-300 border-[#588157]"
              }`}
            >
              🔄 Para Canje ({tradeCardsList.length})
            </button>

            <button
              onClick={() =>
                setSortOrder((prev) => (prev === "chronological" ? "selection" : "chronological"))
              }
              className="px-2.5 py-1 text-xs rounded border border-[#28AAFD] bg-[#1a1c19] text-[#28AAFD] hover:bg-[#28AAFD] hover:text-black font-bold cursor-pointer flex items-center gap-1 ml-1"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              {sortOrder === "chronological" ? "Orden: Cronológico" : "Orden: Personalizado"}
            </button>

            <button
              onClick={() => setShowcaseMode((prev) => !prev)}
              className={`px-2.5 py-1 text-xs rounded border font-bold cursor-pointer flex items-center gap-1 ${
                showcaseMode
                  ? "bg-purple-400 text-black border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  : "bg-[#1a1c19] text-purple-300 border-purple-400/60 hover:bg-purple-400 hover:text-black"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              {showcaseMode ? "✓ MODO VITRINA ACTIVO" : "MODO VITRINA"}
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setPockets(9);
                setCurrentPage(1);
              }}
              className={`px-3 py-2 text-xs border-2 cursor-pointer ${
                pockets === 9
                  ? "bg-yellow-400 text-black border-yellow-400"
                  : "bg-[#1a1c19] text-[#84a98c] border-[#588157]"
              } hover:bg-yellow-300 hover:text-black transition-colors`}
              style={{ fontFamily: "var(--font-retro)" }}
            >
              9 SLOTS
            </button>
            <button
              onClick={() => {
                setPockets(12);
                setCurrentPage(1);
              }}
              className={`px-3 py-2 text-xs border-2 cursor-pointer ${
                pockets === 12
                  ? "bg-yellow-400 text-black border-yellow-400"
                  : "bg-[#1a1c19] text-[#84a98c] border-[#588157]"
              } hover:bg-yellow-300 hover:text-black transition-colors`}
              style={{ fontFamily: "var(--font-retro)" }}
            >
              12 SLOTS
            </button>
          </div>
        </div>

        {/* Fila 2 de Controles: Buscador interno, Filtro de Rareza y Salto de Hoja */}
        {!showcaseMode && (
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-[#1a1c19] p-3 rounded border border-[#588157]">
            <div className="flex items-center gap-2 flex-1">
              <Search className="w-4 h-4 text-[#84a98c] shrink-0" />
              <input
                type="text"
                value={binderSearchQuery}
                onChange={(e) => {
                  setBinderSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Buscar carta, expansión o # (ej: 37/40) dentro de este Binder..."
                className="bg-transparent text-xs text-white outline-none w-full"
              />
              {binderSearchQuery && (
                <button
                  onClick={() => {
                    setBinderSearchQuery("");
                    setCurrentPage(1);
                  }}
                  className="text-xs text-red-400 font-bold cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={rarityFilter}
                onChange={(e) => {
                  setRarityFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-[#262b25] border border-[#588157] px-2.5 py-1 text-xs text-white rounded outline-none focus:border-yellow-400"
              >
                <option value="ALL">Todas las Rarezas ({availableRarities.length})</option>
                {availableRarities.map((r) => (
                  <option key={r} value={r}>
                    Rareza: {r}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1 text-xs text-[#84a98c]">
                <span>Ir a hoja:</span>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={currentPage}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) {
                      setCurrentPage(Math.min(totalPages, Math.max(1, val)));
                    }
                  }}
                  className="bg-[#262b25] border border-[#588157] w-14 px-2 py-1 text-center text-white font-bold rounded outline-none focus:border-yellow-400"
                />
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-20 text-center space-y-4">
            <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto" />
            <p style={{ fontFamily: "var(--font-retro)" }} className="text-xs text-yellow-400">
              CARGANDO TU BINDER...
            </p>
          </div>
        ) : (
          <div
            className={`grid gap-4 mx-auto ${
              pockets === 9
                ? "grid-cols-2 sm:grid-cols-3 max-w-3xl"
                : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 max-w-5xl"
            }`}
          >
            {Array.from({ length: pockets }).map((_, index) => {
              const card = paginatedCards[index];
              const globalCardNumber = (currentPage - 1) * pockets + index + 1;

              if (!card) {
                return (
                  <div
                    key={`empty-${index}`}
                    className="aspect-[63/88] border-2 border-dashed border-[#588157]/40 rounded-lg bg-[#1a1c19]/30 flex flex-col items-center justify-center text-[#588157]/50"
                  >
                    <span className="text-xs font-bold">VACÍO</span>
                  </div>
                );
              }

              const ownedEntries = collectedMap[card.id] || [];
              const isCollected = ownedEntries.length > 0;
              const tradeInfo = tradeMap[card.id];
              const isHandPicked = singlePickedIds.has(card.id);
              const displayCardNum = formatCardNumberDisplay(card);
              const customOwnedSumUsd = ownedEntries.reduce(
                (acc, e) => acc + (e.priceUsd > 0 ? e.priceUsd : card.priceUsd || 0),
                0
              );
              const effectivePriceUsd =
                isCollected && customOwnedSumUsd > 0 ? customOwnedSumUsd : card.priceUsd;

              return (
                <div
                  key={card.id}
                  onClick={() => handleQuickCardClick(card)}
                  className={`bg-[#1a1c19] border-2 rounded-lg p-2 flex flex-col justify-between transition-all group shadow-md cursor-pointer select-none ${
                    isCollected
                      ? "border-green-400 ring-2 ring-green-400/30 bg-[#1f2921]"
                      : "border-[#588157] hover:border-yellow-400"
                  }`}
                >
                  {/* Encabezado del bolsillo */}
                  <div className="flex justify-between items-center text-[11px] text-[#84a98c] mb-1.5 px-1">
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-yellow-400">#{globalCardNumber}</span>
                      {!showcaseMode && !isReadOnlyGuest && (
                        <div className="flex items-center gap-0.5 ml-1">
                          <button
                            type="button"
                            onClick={(e) => moveCardInBinder(card.id, "left", e)}
                            className="hover:text-yellow-400 p-0.5 rounded bg-black/40 cursor-pointer"
                            title="Mover un bolsillo a la izquierda"
                          >
                            <MoveLeft className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => moveCardInBinder(card.id, "right", e)}
                            className="hover:text-yellow-400 p-0.5 rounded bg-black/40 cursor-pointer"
                            title="Mover un bolsillo a la derecha"
                          >
                            <MoveRight className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="truncate max-w-[75px]" title={card.rarity}>
                        {card.rarity}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => openCardInspector(card, e)}
                        className="text-[#28AAFD] hover:text-yellow-400 p-1 rounded bg-black/50 cursor-pointer"
                        title="Elegir Idioma, Estado/PSA, Repetidas para Canje y Valor"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {isHandPicked && !showcaseMode && !isReadOnlyGuest && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSingleCardInBinder(card);
                          }}
                          className="text-red-400 hover:text-red-300 font-bold px-1 rounded bg-black/40 cursor-pointer"
                          title="Quitar esta carta individual del Binder"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Imagen de la Carta */}
                  <div className="relative aspect-[63/88] w-full bg-black/40 rounded overflow-hidden flex items-center justify-center">
                    {card.image ? (
                      <img
                        src={card.image}
                        alt={card.name}
                        loading="lazy"
                        className={`w-full h-full object-contain group-hover:scale-105 transition-all duration-200 ${
                          showcaseMode && !isCollected
                            ? "grayscale opacity-35"
                            : !isCollected
                            ? "opacity-90"
                            : ""
                        }`}
                      />
                    ) : (
                      <div
                        className={`p-3 text-center space-y-2 ${
                          showcaseMode && !isCollected ? "opacity-35" : ""
                        }`}
                      >
                        <div className="w-10 h-10 rounded-full border-2 border-yellow-400 mx-auto flex items-center justify-center text-yellow-400 font-bold text-xs">
                          TCG
                        </div>
                        <p className="text-xs font-bold text-white">{card.name}</p>
                        <p className="text-[10px] text-[#84a98c]">
                          {card.setName} #{displayCardNum}
                        </p>
                      </div>
                    )}

                    {isCollected && (
                      <div className="absolute top-1.5 right-1.5 left-1.5 flex flex-wrap justify-end gap-1 pointer-events-none">
                        {ownedEntries.map((entry, idx) => (
                          <span
                            key={`${entry.language}-${entry.variant}-${idx}`}
                            className="bg-green-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded border border-black shadow flex items-center gap-0.5"
                          >
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                            {entry.language.toUpperCase()}•{entry.variant.toUpperCase()}
                          </span>
                        ))}
                      </div>
                    )}

                    {tradeInfo && tradeInfo.qty > 0 && (
                      <div className="absolute bottom-1.5 left-1.5 bg-purple-400 text-black text-[9px] font-bold px-1.5 py-0.5 rounded border border-black shadow pointer-events-none">
                        🔄 CANJE x{tradeInfo.qty}
                      </div>
                    )}
                  </div>

                  {/* Pie del Bolsillo */}
                  <div className="mt-2 pt-2 border-t border-[#262b25] space-y-1.5">
                    <p className="text-xs font-bold text-white truncate" title={card.name}>
                      {card.name}
                    </p>
                    <p className="text-[11px] text-[#84a98c] truncate" title={card.setName}>
                      {card.setName} ({displayCardNum})
                    </p>

                    <div className="flex items-center justify-between pt-0.5">
                      <span className="text-[10px] bg-[#262b25] text-[#a3b18a] px-1.5 py-0.5 rounded border border-[#588157]/50">
                        {isCollected && customOwnedSumUsd !== card.priceUsd && customOwnedSumUsd > 0
                          ? "Mi Valuación"
                          : card.priceSource}
                      </span>
                      <span className="text-xs font-bold text-green-400">
                        {effectivePriceUsd > 0
                          ? formatMoney(effectivePriceUsd)
                          : !card.priceLoaded
                          ? "..."
                          : "N/A"}
                      </span>
                    </div>

                    {!showcaseMode && !isReadOnlyGuest && (
                      <>
                        <div className="grid grid-cols-2 gap-1 pt-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSpecificCardVersion(card, "en", "Normal");
                            }}
                            className={`py-1 px-1 text-[9px] font-bold rounded border transition-colors cursor-pointer truncate ${
                              ownedEntries.some((e) => e.language === "en" && e.variant === "Normal")
                                ? "bg-green-500 text-black border-black"
                                : "bg-[#262b25] text-[#e0f8cf] border-[#588157] hover:bg-yellow-400 hover:text-black hover:border-black"
                            }`}
                          >
                            {ownedEntries.some((e) => e.language === "en" && e.variant === "Normal")
                              ? "✓ EN (NORMAL)"
                              : "+ MARCAR (EN)"}
                          </button>

                          <button
                            type="button"
                            onClick={(e) => openCardInspector(card, e)}
                            className={`py-1 px-1 text-[9px] font-bold rounded border transition-colors cursor-pointer truncate ${
                              ownedEntries.length > 0 || (tradeInfo && tradeInfo.qty > 0)
                                ? "bg-yellow-400 text-black border-black"
                                : "bg-[#1a1c19] text-yellow-400 border-yellow-400/60 hover:bg-yellow-400 hover:text-black"
                            }`}
                          >
                            🌐 OPCIONES ({ownedEntries.length})
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => openTcgFansArgentina(card, e, "exact")}
                          className="w-full py-1 px-2 text-[9px] font-bold rounded border border-[#28AAFD]/80 bg-[#162430] hover:bg-[#28AAFD] text-[#7CC6FE] hover:text-black transition-colors cursor-pointer flex items-center justify-center gap-1"
                        >
                          <ShoppingCart className="w-3 h-3 shrink-0" />
                          <span>🇦🇷 BUSCAR EN ARG (TCG.FANS)</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Controles de Paginación */}
        {!loading && filteredCards.length > 0 && (
          <div className="flex justify-between items-center pt-4 border-t-2 border-[#588157]">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{ fontFamily: "var(--font-retro)" }}
              className="bg-[#1a1c19] hover:bg-yellow-400 hover:text-black text-white text-xs px-3 py-2 border-2 border-[#588157] disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1 cursor-pointer transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> ANTERIOR
            </button>

            <span className="text-xs text-[#84a98c] font-bold">
              Página {currentPage} de {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={{ fontFamily: "var(--font-retro)" }}
              className="bg-[#1a1c19] hover:bg-yellow-400 hover:text-black text-white text-xs px-3 py-2 border-2 border-[#588157] disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1 cursor-pointer transition-colors"
            >
              SIGUIENTE <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* MODAL 1: ESCÁNER POKéDEX HD + MULTI-IDIOMA + ESTADO/PSA + STOCK DE REPETIDAS PARA CANJE */}
      {inspectedCard && (
        <div
          className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 overflow-y-auto"
          onClick={() => setInspectedCard(null)}
        >
          <div
            className="bg-[#DEDEDE] p-4 rounded-lg border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-3xl w-full my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#1a1c19] text-[#e0f8cf] border-4 border-black p-5 space-y-5">
              <div className="flex justify-between items-center border-b-2 border-[#588157] pb-3">
                <h3 style={{ fontFamily: "var(--font-retro)" }} className="text-xs sm:text-sm text-yellow-400">
                  ESCÁNER POKéDEX & GESTOR DE VERSIONES
                </h3>
                <button
                  onClick={() => setInspectedCard(null)}
                  className="text-red-400 hover:text-red-300 font-bold text-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                <div className="md:col-span-5 space-y-2.5">
                  <div className="aspect-[63/88] bg-black/60 rounded-lg border-2 border-[#588157] p-2 flex items-center justify-center">
                    {inspectedCard.image ? (
                      <img
                        src={inspectedCard.image.replace("/low.webp", "/high.webp")}
                        alt={inspectedCard.name}
                        className="w-full h-full object-contain rounded"
                      />
                    ) : (
                      <div className="text-center p-4">
                        <p className="text-sm font-bold text-yellow-400">{inspectedCard.name}</p>
                        <p className="text-xs text-[#84a98c] mt-1">
                          {inspectedCard.setName} #{formatCardNumberDisplay(inspectedCard)}
                        </p>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={(e) => openTcgFansArgentina(inspectedCard, e, "exact")}
                    style={{ fontFamily: "var(--font-retro)" }}
                    className="w-full bg-[#28AAFD] hover:bg-sky-300 text-black text-[10px] py-2.5 px-3 border-2 border-black font-bold cursor-pointer flex items-center justify-center gap-1.5 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                  >
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    <span>🇦🇷 BUSCAR CARTA EN TCG.FANS</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => openTcgFansArgentina(inspectedCard, e, "nameOnly")}
                    className="w-full bg-[#262b25] hover:bg-[#588157] text-[#e0f8cf] text-[10px] py-1.5 px-2 border border-[#588157] rounded font-bold cursor-pointer"
                  >
                    🔍 Buscar solo por nombre &quot;{inspectedCard.name}&quot;
                  </button>
                </div>

                <div className="md:col-span-7 space-y-4">
                  <div className="flex justify-between items-start gap-2 border-b border-[#262b25] pb-3">
                    <div>
                      <h4 className="text-lg font-bold text-white">{inspectedCard.name}</h4>
                      <p className="text-xs text-[#84a98c]">
                        Expansión: <strong className="text-white">{inspectedCard.setName}</strong> (
                        {formatCardNumberDisplay(inspectedCard)})
                      </p>
                      <p className="text-xs text-[#84a98c]">
                        Rareza: <strong className="text-yellow-400">{inspectedCard.rarity}</strong>
                      </p>
                    </div>
                    <div className="bg-[#262b25] border border-[#588157] px-3 py-1.5 rounded text-right">
                      <p className="text-[10px] text-[#84a98c] uppercase">{inspectedCard.priceSource}</p>
                      <p className="text-base font-bold text-green-400">
                        {inspectedCard.priceUsd > 0 ? formatMoney(inspectedCard.priceUsd) : "S/P"}
                      </p>
                    </div>
                  </div>

                  {/* 1. Versiones acumuladas en este bolsillo */}
                  <div className="bg-[#262b25] border-2 border-[#588157] p-3 rounded space-y-2">
                    <p className="text-xs font-bold text-yellow-400 uppercase">
                      1. Versiones en tu colección ({(collectedMap[inspectedCard.id] || []).length}):
                    </p>
                    {(collectedMap[inspectedCard.id] || []).length === 0 ? (
                      <p className="text-xs text-[#84a98c] italic">
                        Todavía no marcaste ninguna versión de esta carta.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {(collectedMap[inspectedCard.id] || []).map((entry, idx) => {
                          const langObj = CARD_LANGUAGES.find((l) => l.id === entry.language);
                          const costPaid =
                            paidCostMap[getCostKey(inspectedCard.id, entry.language, entry.variant)];
                          return (
                            <div
                              key={`${entry.language}-${entry.variant}-${idx}`}
                              className="bg-green-500 text-black text-xs font-bold px-2.5 py-1 rounded border-2 border-black flex items-center gap-2"
                            >
                              <span>
                                ✓ {langObj ? langObj.label : entry.language.toUpperCase()} — {entry.variant}
                                {entry.priceUsd > 0 ? ` (Val: $${entry.priceUsd.toFixed(2)}` : ""}
                                {costPaid !== undefined ? ` | Pagado: $${costPaid.toFixed(2)})` : entry.priceUsd > 0 ? ")" : ""}
                              </span>
                              {!isReadOnlyGuest && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleSpecificCardVersion(inspectedCard, entry.language, entry.variant)
                                  }
                                  className="hover:text-red-700 font-extrabold cursor-pointer"
                                  title="Quitar esta versión"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {!isReadOnlyGuest && (
                    <>
                      {/* 2. Marcado rápido de 1 clic por idioma */}
                      <div className="bg-[#262b25] border border-[#588157] p-3 rounded space-y-2">
                        <p className="text-xs font-bold text-[#28AAFD] uppercase">
                          2. Marcado Rápido Multi-Idioma (1 Clic):
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                          {[
                            { lang: "en", label: "Inglés (EN)" },
                            { lang: "ja", label: "Japonés (JP)" },
                            { lang: "es", label: "Español (ES)" },
                            { lang: "pt", label: "Portugués (PT)" },
                          ].map((item) => {
                            const hasNormal = (collectedMap[inspectedCard.id] || []).some(
                              (e) => e.language === item.lang && e.variant === "Normal"
                            );
                            return (
                              <button
                                key={item.lang}
                                type="button"
                                onClick={() =>
                                  toggleSpecificCardVersion(inspectedCard, item.lang, "Normal")
                                }
                                className={`py-2 px-2 text-xs font-bold rounded border-2 cursor-pointer transition-all ${
                                  hasNormal
                                    ? "bg-green-500 text-black border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                                    : "bg-[#1a1c19] text-[#e0f8cf] border-[#588157] hover:border-yellow-400"
                                }`}
                              >
                                {hasNormal ? `✓ ${item.label}` : `+ ${item.label}`}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 3. Selector Avanzado + Costo de Compra */}
                      <div className="bg-[#262b25] border border-[#588157] p-3 rounded space-y-3">
                        <p className="text-xs font-bold text-white uppercase flex items-center gap-1">
                          <Award className="w-3.5 h-3.5 text-yellow-400" /> 3. Sumar versión con Estado/PSA, Valor y Costo de Compra:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <select
                            value={modalLanguage}
                            onChange={(e) => setModalLanguage(e.target.value)}
                            className="bg-[#1a1c19] border-2 border-[#588157] px-2.5 py-2 text-xs text-white rounded outline-none focus:border-yellow-400"
                          >
                            {CARD_LANGUAGES.map((l) => (
                              <option key={l.id} value={l.id}>
                                Idioma: {l.label}
                              </option>
                            ))}
                          </select>

                          <select
                            value={modalVariant}
                            onChange={(e) => setModalVariant(e.target.value)}
                            className="bg-[#1a1c19] border-2 border-[#588157] px-2.5 py-2 text-xs text-white rounded outline-none focus:border-yellow-400"
                          >
                            {CARD_VARIANTS.map((v) => (
                              <option key={v.id} value={v.id}>
                                Variante: {v.label}
                              </option>
                            ))}
                          </select>

                          <select
                            value={modalCondition}
                            onChange={(e) => setModalCondition(e.target.value)}
                            className="bg-[#1a1c19] border-2 border-[#588157] px-2.5 py-2 text-xs text-white rounded outline-none focus:border-yellow-400 sm:col-span-2"
                          >
                            {CARD_CONDITIONS.map((cond) => (
                              <option key={cond.id} value={cond.id}>
                                Estado / Graduación: {cond.label}
                              </option>
                            ))}
                          </select>

                          <div className="flex items-center bg-[#1a1c19] border-2 border-[#588157] px-2.5 py-1.5 rounded focus-within:border-yellow-400">
                            <span className="text-[11px] text-[#84a98c] mr-1.5 font-bold shrink-0">
                              Valor USD $
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={modalCustomPriceUsd}
                              onChange={(e) => setModalCustomPriceUsd(e.target.value)}
                              placeholder="Valor mercado"
                              className="bg-transparent text-xs text-white outline-none w-full font-bold"
                            />
                          </div>

                          <div className="flex items-center bg-[#1a1c19] border-2 border-[#588157] px-2.5 py-1.5 rounded focus-within:border-emerald-400">
                            <span className="text-[11px] text-emerald-400 mr-1.5 font-bold shrink-0">
                              Pagado USD $
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={modalPaidCostUsd}
                              onChange={(e) => setModalPaidCostUsd(e.target.value)}
                              placeholder="Costo compra (ROI)"
                              className="bg-transparent text-xs text-white outline-none w-full font-bold"
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const finalVariantLabel = buildCombinedVariantLabel();
                            const parsedCustom =
                              modalCustomPriceUsd.trim() !== ""
                                ? parseFloat(modalCustomPriceUsd)
                                : undefined;
                            const parsedPaid =
                              modalPaidCostUsd.trim() !== ""
                                ? parseFloat(modalPaidCostUsd)
                                : undefined;

                            if (
                              parsedCustom !== undefined &&
                              !isNaN(parsedCustom) &&
                              parsedCustom > 0 &&
                              inspectedCard.priceUsd === 0
                            ) {
                              setCards((prev) =>
                                prev.map((c) =>
                                  c.id === inspectedCard.id ? { ...c, priceUsd: parsedCustom } : c
                                )
                              );
                            }

                            toggleSpecificCardVersion(
                              inspectedCard,
                              modalLanguage,
                              finalVariantLabel,
                              parsedCustom,
                              parsedPaid
                            );
                          }}
                          style={{ fontFamily: "var(--font-retro)" }}
                          className="w-full bg-yellow-400 hover:bg-yellow-300 text-black text-xs py-2.5 border-2 border-black font-bold cursor-pointer"
                        >
                          {(collectedMap[inspectedCard.id] || []).some(
                            (e) =>
                              e.language === modalLanguage &&
                              e.variant === buildCombinedVariantLabel()
                          )
                            ? `QUITAR VERSIÓN [${modalLanguage.toUpperCase()} • ${buildCombinedVariantLabel().toUpperCase()}]`
                            : `+ GUARDAR VERSIÓN [${modalLanguage.toUpperCase()} • ${buildCombinedVariantLabel().toUpperCase()}]`}
                        </button>
                      </div>

                      {/* 4. Marcar Copias Repetidas para Canje / Trade Binder */}
                      <div className="bg-[#241b2b] border-2 border-purple-400 p-3 rounded space-y-2.5">
                        <p className="text-xs font-bold text-purple-300 uppercase flex items-center gap-1.5">
                          <Repeat className="w-3.5 h-3.5" /> 4. Stock de Repetidas para Canje / Venta (Trade Binder):
                        </p>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-[#e0f8cf]">Cantidad disponible:</span>
                            <input
                              type="number"
                              min="0"
                              max="99"
                              value={modalTradeQty}
                              onChange={(e) =>
                                setModalTradeQty(Math.max(0, parseInt(e.target.value || "0", 10)))
                              }
                              className="w-16 bg-[#1a1c19] border-2 border-purple-400 px-2 py-1 text-center text-xs text-white font-bold rounded outline-none"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const parsedCustom =
                                modalCustomPriceUsd.trim() !== ""
                                  ? parseFloat(modalCustomPriceUsd)
                                  : undefined;
                              updateCardTradeQuantity(
                                inspectedCard,
                                modalTradeQty,
                                modalLanguage,
                                buildCombinedVariantLabel(),
                                parsedCustom
                              );
                            }}
                            style={{ fontFamily: "var(--font-retro)" }}
                            className="bg-purple-400 hover:bg-purple-300 text-black text-[10px] px-3 py-2 border-2 border-black font-bold cursor-pointer"
                          >
                            🔄 GUARDAR EN TRADE BINDER
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: LISTA DE FALTANTES / WISHLIST */}
      {showWishlistModal && (
        <div
          className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50"
          onClick={() => setShowWishlistModal(false)}
        >
          <div
            className="bg-[#DEDEDE] p-4 rounded-lg border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-3xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#1a1c19] text-[#e0f8cf] border-4 border-black p-5 space-y-4">
              <div className="flex justify-between items-center border-b-2 border-[#588157] pb-3">
                <div>
                  <h3 style={{ fontFamily: "var(--font-retro)" }} className="text-xs sm:text-sm text-[#28AAFD]">
                    LISTA DE FALTANTES ({missingCount} CARTAS)
                  </h3>
                  <p className="text-xs text-[#84a98c] mt-1">
                    Master Set: <strong className="text-white">{binderName}</strong> | Costo estimado restante:{" "}
                    <strong className="text-green-400">{formatMoney(missingValueUsd)}</strong>
                  </p>
                </div>
                <button
                  onClick={() => setShowWishlistModal(false)}
                  className="text-red-400 hover:text-red-300 font-bold text-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={copyWishlistToClipboard}
                  style={{ fontFamily: "var(--font-retro)" }}
                  className="bg-yellow-400 hover:bg-yellow-300 text-black text-[10px] px-3 py-2.5 border-2 border-black font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" /> COPIAR TEXTO (WHATSAPP / NOTAS)
                </button>
                <button
                  type="button"
                  onClick={downloadWishlistCsv}
                  style={{ fontFamily: "var(--font-retro)" }}
                  className="bg-green-500 hover:bg-green-400 text-black text-[10px] px-3 py-2.5 border-2 border-black font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> DESCARGAR EXCEL (.CSV)
                </button>
              </div>

              <div className="max-h-80 overflow-y-auto bg-[#262b25] border-2 border-[#588157] rounded p-3 space-y-1.5">
                {missingCardsList.length === 0 ? (
                  <p className="text-center py-8 text-sm text-green-400 font-bold">
                    🎉 ¡Felicitaciones! No te falta ninguna carta en este Master Set.
                  </p>
                ) : (
                  missingCardsList.map((c, i) => (
                    <div
                      key={`wish-${c.id}`}
                      className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 text-xs bg-[#1a1c19] px-3 py-2 rounded border border-[#588157]/40"
                    >
                      <div className="truncate pr-2">
                        <span className="text-yellow-400 font-bold mr-2">#{i + 1}</span>
                        <span className="font-bold text-white">{c.name}</span>
                        <span className="text-[#84a98c] ml-2">
                          — {c.setName} ({formatCardNumberDisplay(c)}) [{c.rarity}]
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                        <span className="font-bold text-green-400">
                          {c.priceUsd > 0 ? formatMoney(c.priceUsd) : "N/A"}
                        </span>
                        <button
                          type="button"
                          onClick={() => openTcgFansArgentina(c)}
                          className="bg-[#28AAFD] hover:bg-sky-300 text-black font-bold text-[10px] px-2.5 py-1 rounded border border-black cursor-pointer flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" /> 🇦🇷 Buscar en TCG.fans
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: DASHBOARD DE ESTADÍSTICAS DEL COLECCIONISTA */}
      {showStatsModal && (
        <div
          className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 overflow-y-auto"
          onClick={() => setShowStatsModal(false)}
        >
          <div
            className="bg-[#DEDEDE] p-4 rounded-lg border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-4xl w-full my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#1a1c19] text-[#e0f8cf] border-4 border-black p-5 space-y-5">
              <div className="flex justify-between items-center border-b-2 border-[#588157] pb-3">
                <div>
                  <h3 style={{ fontFamily: "var(--font-retro)" }} className="text-xs sm:text-sm text-yellow-400">
                    📊 ESTADÍSTICAS DEL MASTER SET: {binderName.toUpperCase()}
                  </h3>
                  <p className="text-xs text-[#84a98c] mt-1">
                    Análisis de cotizaciones ({currencyMode}), idiomas en tu colección y progreso por expansión
                  </p>
                </div>
                <button
                  onClick={() => setShowStatsModal(false)}
                  className="text-red-400 hover:text-red-300 font-bold text-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-yellow-400 uppercase">
                  🏆 Top 6 Cartas Más Valiosas en este Binder:
                </h4>
                {topValuableCards.length === 0 ? (
                  <p className="text-xs text-[#84a98c]">Aún no hay cartas con precio cotizado en este set.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {topValuableCards.map((c, idx) => {
                      const owned = isCardOwned(c.id);
                      return (
                        <div
                          key={`top-${c.id}`}
                          className={`p-2.5 rounded border-2 flex items-center gap-3 ${
                            owned
                              ? "bg-[#1f2921] border-green-400"
                              : "bg-[#262b25] border-[#588157]"
                          }`}
                        >
                          <span className="text-sm font-bold text-yellow-400">#{idx + 1}</span>
                          {c.image && (
                            <img
                              src={c.image}
                              alt={c.name}
                              className="w-11 h-16 object-contain rounded bg-black/40 shrink-0"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-white truncate">{c.name}</p>
                            <p className="text-[10px] text-[#84a98c] truncate">
                              {c.setName} ({formatCardNumberDisplay(c)})
                            </p>
                            <p className="text-sm font-bold text-green-400 mt-0.5">
                              {formatMoney(c.priceUsd)}
                            </p>
                            <div className="flex items-center justify-between mt-1">
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                  owned ? "bg-green-500 text-black" : "bg-red-500/30 text-red-300"
                                }`}
                              >
                                {owned ? "✓ EN COLECCIÓN" : "FALTA"}
                              </span>
                              <button
                                type="button"
                                onClick={() => openTcgFansArgentina(c)}
                                className="text-[10px] text-[#28AAFD] hover:underline font-bold cursor-pointer"
                              >
                                🇦🇷 TCG.fans
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#262b25] border border-[#588157] p-3 rounded space-y-2">
                  <h4 className="text-xs font-bold text-[#28AAFD] uppercase">
                    🌐 Distribución de tu Colección por Idioma:
                  </h4>
                  {Object.keys(languageBreakdown).length === 0 ? (
                    <p className="text-xs text-[#84a98c]">
                      Todavía no marcaste cartas como obtenidas en este Binder.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {Object.entries(languageBreakdown).map(([langCode, count]) => {
                        const langObj = CARD_LANGUAGES.find((l) => l.id === langCode);
                        return (
                          <div
                            key={langCode}
                            className="flex justify-between items-center text-xs bg-[#1a1c19] px-3 py-1.5 rounded"
                          >
                            <span className="font-bold text-white">
                              {langObj ? langObj.label : langCode.toUpperCase()}
                            </span>
                            <span className="text-yellow-400 font-bold">{count} cartas</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="bg-[#262b25] border border-[#588157] p-3 rounded space-y-2">
                  <h4 className="text-xs font-bold text-green-400 uppercase">
                    📦 Progreso por Expansión ({setBreakdownList.length} sets):
                  </h4>
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                    {setBreakdownList.map(([setName, info]) => {
                      const pct = info.total > 0 ? Math.round((info.owned / info.total) * 100) : 0;
                      return (
                        <div key={setName} className="bg-[#1a1c19] p-2 rounded space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="font-bold text-white truncate max-w-[180px]">
                              {setName}
                            </span>
                            <span className="text-yellow-400 font-bold">
                              {info.owned}/{info.total} ({pct}%)
                            </span>
                          </div>
                          <div className="w-full bg-[#262b25] h-1.5 rounded overflow-hidden">
                            <div
                              className="bg-green-400 h-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: PORTFOLIO TRACKER & GRÁFICO HISTÓRICO ESTILO TRADINGVIEW */}
      {showPortfolioModal && (
        <div
          className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 overflow-y-auto"
          onClick={() => setShowPortfolioModal(false)}
        >
          <div
            className="bg-[#DEDEDE] p-4 rounded-lg border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-4xl w-full my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#1a1c19] text-[#e0f8cf] border-4 border-black p-5 space-y-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b-2 border-[#588157] pb-3">
                <div>
                  <h3 style={{ fontFamily: "var(--font-retro)" }} className="text-xs sm:text-sm text-emerald-400 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" /> PORTFOLIO TRACKER: {binderName.toUpperCase()}
                  </h3>
                  <p className="text-xs text-[#84a98c] mt-1">
                    Evolución histórica de valor, capital invertido y retorno de inversión (ROI)
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSimulateHistoricalCurve}
                    className="bg-[#262b25] hover:bg-yellow-400 hover:text-black text-yellow-400 text-[10px] font-bold px-2.5 py-1.5 rounded border border-yellow-400/60 cursor-pointer"
                  >
                    ⚡ Proyectar Curva 90D
                  </button>
                  <button
                    onClick={() => setShowPortfolioModal(false)}
                    className="text-red-400 hover:text-red-300 font-bold text-lg cursor-pointer ml-2"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-[#262b25] border-2 border-[#588157] p-3.5 rounded">
                  <p className="text-[11px] text-[#84a98c] uppercase flex items-center gap-1">
                    <Wallet className="w-3.5 h-3.5 text-[#28AAFD]" /> Capital Total Invertido
                  </p>
                  <p className="text-lg font-bold text-white mt-1">
                    {formatMoney(totalInvestedCostUsd)}
                  </p>
                  <p className="text-[10px] text-[#a3b18a] mt-0.5">
                    Suma de costos pagados en tus {totalPhysicalCopiesOwned} cartas
                  </p>
                </div>

                <div className="bg-[#262b25] border-2 border-[#588157] p-3.5 rounded">
                  <p className="text-[11px] text-[#84a98c] uppercase">Valor de Mercado Actual</p>
                  <p className="text-lg font-bold text-emerald-400 mt-1">
                    {formatMoney(collectedValueUsd)}
                  </p>
                  <p className="text-[10px] text-[#a3b18a] mt-0.5">
                    Cotización viva (TCGplayer / Cardmarket / Manual)
                  </p>
                </div>

                <div className="bg-[#262b25] border-2 border-[#588157] p-3.5 rounded">
                  <p className="text-[11px] text-[#84a98c] uppercase">Ganancia / Pérdida Neta (ROI)</p>
                  <p
                    className={`text-lg font-bold mt-1 ${
                      netProfitUsd >= 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {netProfitUsd >= 0 ? "+" : ""}
                    {formatMoney(netProfitUsd)} ({netProfitUsd >= 0 ? `+${roiPercentage}%` : `${roiPercentage}%`})
                  </p>
                  <p className="text-[10px] text-[#a3b18a] mt-0.5">
                    Podés editar el costo pagado de cada carta en su lupa 👁
                  </p>
                </div>
              </div>

              <div className="bg-[#121512] border-2 border-[#588157] rounded p-4 space-y-3">
                <div className="flex flex-wrap justify-between items-center gap-2 text-xs">
                  <span className="font-bold text-white uppercase">
                    📈 Curva de Evolución del Portafolio ({chartDataPoints.length} registros)
                  </span>
                  <div className="flex items-center gap-4 text-[11px]">
                    <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                      <span className="w-3 h-0.5 bg-emerald-400 inline-block" /> Valor de Mercado
                    </span>
                    <span className="flex items-center gap-1.5 text-[#28AAFD] font-bold">
                      <span className="w-3 h-0.5 bg-[#28AAFD] inline-block" /> Capital Invertido
                    </span>
                  </div>
                </div>

                <div className="w-full overflow-x-auto">
                  <svg
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    className="w-full h-52 bg-[#161a16] rounded border border-[#588157]/40"
                  >
                    {[0.25, 0.5, 0.75].map((ratio, idx) => {
                      const y = chartHeight - padY - ratio * (chartHeight - padY * 2);
                      const labelVal = maxChartVal * ratio;
                      return (
                        <g key={idx}>
                          <line
                            x1={padX}
                            y1={y}
                            x2={chartWidth - padX}
                            y2={y}
                            stroke="#262b25"
                            strokeDasharray="4 4"
                            strokeWidth="1"
                          />
                          <text x={6} y={y + 3} fill="#84a98c" fontSize="9">
                            ${labelVal.toFixed(0)}
                          </text>
                        </g>
                      );
                    })}

                    {chartDataPoints.length > 1 && (
                      <polyline
                        fill="none"
                        stroke="#28AAFD"
                        strokeWidth="2"
                        strokeDasharray="5 4"
                        points={investedPolyline}
                      />
                    )}

                    {chartDataPoints.length > 1 && (
                      <polyline
                        fill="none"
                        stroke="#34d399"
                        strokeWidth="3"
                        points={marketPolyline}
                      />
                    )}

                    {chartDataPoints.map((pt, i) => {
                      const mCoord = getPointCoords(i, pt.collectedUsd);
                      const invCoord = getPointCoords(i, pt.investedUsd);
                      return (
                        <g key={pt.date}>
                          <circle cx={invCoord.x} cy={invCoord.y} r="3.5" fill="#28AAFD" />
                          <circle
                            cx={mCoord.x}
                            cy={mCoord.y}
                            r="4.5"
                            fill="#34d399"
                            stroke="#000"
                            strokeWidth="1.5"
                          />
                          <text
                            x={mCoord.x}
                            y={mCoord.y - 8}
                            textAnchor="middle"
                            fill="#e0f8cf"
                            fontSize="9"
                            fontWeight="bold"
                          >
                            ${pt.collectedUsd.toFixed(0)}
                          </text>
                          <text
                            x={mCoord.x}
                            y={chartHeight - 6}
                            textAnchor="middle"
                            fill="#84a98c"
                            fontSize="9"
                          >
                            {pt.date.slice(5)}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-yellow-400 uppercase">
                  🚀 Tus Mejores Inversiones (Mayor Ganancia frente al Costo de Compra):
                </h4>
                {topRoiGainers.length === 0 ? (
                  <p className="text-xs text-[#84a98c]">
                    Marcá cartas como obtenidas e ingresá cuánto las pagaste en su lupa (👁) para ver cuáles subieron más de precio.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {topRoiGainers.map((item, idx) => (
                      <div
                        key={`roi-${item.card.id}-${idx}`}
                        className="bg-[#262b25] border border-[#588157] p-2.5 rounded flex justify-between items-center text-xs"
                      >
                        <div className="truncate pr-2">
                          <p className="font-bold text-white truncate">
                            {item.card.name} ({item.entry.language.toUpperCase()} • {item.entry.variant})
                          </p>
                          <p className="text-[10px] text-[#84a98c]">
                            Pagado: ${item.paidVal.toFixed(2)} ➔ Hoy: ${item.currentVal.toFixed(2)}
                          </p>
                        </div>
                        <span
                          className={`font-bold px-2 py-0.5 rounded text-[10px] shrink-0 ${
                            item.profit >= 0
                              ? "bg-green-500/20 text-green-400 border border-green-500/40"
                              : "bg-red-500/20 text-red-400 border border-red-500/40"
                          }`}
                        >
                          {item.profit >= 0 ? "+" : ""}${item.profit.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: CENTRO DE CANJES (TRADE BINDER), BALANZA DE INTERCAMBIOS Y LINK PÚBLICO */}
      {showTradeHubModal && (
        <div
          className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 overflow-y-auto"
          onClick={() => setShowTradeHubModal(false)}
        >
          <div
            className="bg-[#DEDEDE] p-4 rounded-lg border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-4xl w-full my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#1a1c19] text-[#e0f8cf] border-4 border-black p-5 space-y-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b-2 border-[#588157] pb-3">
                <div>
                  <h3 style={{ fontFamily: "var(--font-retro)" }} className="text-xs sm:text-sm text-purple-300 flex items-center gap-2">
                    <Share2 className="w-4 h-4" /> CENTRO DE CANJES & PERFIL PÚBLICO
                  </h3>
                  <p className="text-xs text-[#84a98c] mt-1">
                    Gestioná tu Trade Binder de repetidas, calculá si un canje es parejo y compartí tu carpeta en modo Solo Lectura
                  </p>
                </div>
                <button
                  onClick={() => setShowTradeHubModal(false)}
                  className="text-red-400 hover:text-red-300 font-bold text-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="flex flex-wrap gap-2 border-b border-[#588157]/40 pb-3">
                <button
                  type="button"
                  onClick={() => setTradeHubTab("post")}
                  className={`px-3 py-2 text-xs font-bold rounded border-2 cursor-pointer flex items-center gap-1.5 ${
                    tradeHubTab === "post"
                      ? "bg-purple-400 text-black border-black"
                      : "bg-[#262b25] text-[#e0f8cf] border-[#588157]"
                  }`}
                >
                  <Repeat className="w-3.5 h-3.5" /> 1. Mi Trade Binder & Anuncio (Ofrezco vs. Busco)
                </button>
                <button
                  type="button"
                  onClick={() => setTradeHubTab("calculator")}
                  className={`px-3 py-2 text-xs font-bold rounded border-2 cursor-pointer flex items-center gap-1.5 ${
                    tradeHubTab === "calculator"
                      ? "bg-yellow-400 text-black border-black"
                      : "bg-[#262b25] text-[#e0f8cf] border-[#588157]"
                  }`}
                >
                  <Scale className="w-3.5 h-3.5" /> 2. Balanza de Canje (Calculadora de Trade)
                </button>
                <button
                  type="button"
                  onClick={() => setTradeHubTab("share")}
                  className={`px-3 py-2 text-xs font-bold rounded border-2 cursor-pointer flex items-center gap-1.5 ${
                    tradeHubTab === "share"
                      ? "bg-[#28AAFD] text-black border-black"
                      : "bg-[#262b25] text-[#e0f8cf] border-[#588157]"
                  }`}
                >
                  <Share2 className="w-3.5 h-3.5" /> 3. Link Público (Solo Lectura)
                </button>
              </div>

              {tradeHubTab === "post" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[#262b25] border border-[#588157] p-3.5 rounded space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-bold text-purple-300 uppercase">
                        🔄 Tus Cartas para Canje / Venta ({tradeTotalUnits} u.)
                      </h4>
                      <span className="text-xs font-bold text-green-400">
                        Total: {formatMoney(tradeTotalValueUsd)}
                      </span>
                    </div>

                    {tradeCardsList.length === 0 ? (
                      <p className="text-xs text-[#84a98c] py-6 text-center">
                        Todavía no marcaste repetidas en este Binder. Abrí cualquier carta con la lupa (👁) y cargá cuántas tenés en el bloque 4 (&quot;Stock de Repetidas para Canje&quot;).
                      </p>
                    ) : (
                      <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                        {tradeCardsList.map((c) => {
                          const t = tradeMap[c.id];
                          const unitVal = t && t.priceUsd > 0 ? t.priceUsd : c.priceUsd || 0;
                          return (
                            <div
                              key={`tr-${c.id}`}
                              className="bg-[#1a1c19] p-2 rounded border border-purple-400/50 flex justify-between items-center text-xs"
                            >
                              <div className="truncate pr-2">
                                <p className="font-bold text-white truncate">
                                  {t.qty}x {c.name} ({formatCardNumberDisplay(c)})
                                </p>
                                <p className="text-[10px] text-[#84a98c]">
                                  {c.setName} • {t.language.toUpperCase()} ({t.variant})
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-bold text-green-400">
                                  {formatMoney(unitVal * t.qty)}
                                </span>
                                {!isReadOnlyGuest && (
                                  <button
                                    type="button"
                                    onClick={() => updateCardTradeQuantity(c, 0)}
                                    className="text-red-400 hover:text-red-300 font-bold px-1.5 cursor-pointer"
                                    title="Quitar de repetidas"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="bg-[#262b25] border border-[#588157] p-3.5 rounded space-y-3 flex flex-col justify-between">
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-yellow-400 uppercase">
                        📢 Anuncio Automático &quot;Ofrezco vs. Busco&quot;:
                      </h4>
                      <p className="text-[11px] text-[#84a98c]">
                        Listo para copiar y pegar en grupos de WhatsApp, Facebook o Discord de Pokémon TCG Argentina:
                      </p>
                      <textarea
                        readOnly
                        value={generateTradePostText()}
                        className="w-full h-48 bg-[#1a1c19] border border-[#588157] rounded p-2.5 text-[11px] text-[#e0f8cf] font-mono outline-none resize-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(generateTradePostText());
                        showBanner("¡Anuncio de Canje / Venta copiado al portapapeles!");
                      }}
                      style={{ fontFamily: "var(--font-retro)" }}
                      className="w-full bg-yellow-400 hover:bg-yellow-300 text-black text-[10px] py-3 border-2 border-black font-bold cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Copy className="w-3.5 h-3.5" /> COPIAR ANUNCIO PARA WHATSAPP / FACEBOOK
                    </button>
                  </div>
                </div>
              )}

              {tradeHubTab === "calculator" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-[#262b25] border-2 border-purple-400 p-3.5 rounded space-y-3">
                      <div className="flex justify-between items-center">
                        <h4 className="text-xs font-bold text-purple-300 uppercase">
                          📤 Lado A: Cartas que vos entregás
                        </h4>
                        <span className="text-sm font-bold text-white">
                          {formatMoney(myOfferTotalUsd)}
                        </span>
                      </div>

                      <div className="flex gap-1.5">
                        <select
                          value={selectedMyCardId}
                          onChange={(e) => setSelectedMyCardId(e.target.value)}
                          className="bg-[#1a1c19] border border-[#588157] px-2 py-1.5 text-xs text-white rounded flex-1 min-w-0 outline-none"
                        >
                          <option value="">Elegir carta de mi Binder...</option>
                          {orderedBinderCards.map((c) => (
                            <option key={`my-opt-${c.id}`} value={c.id}>
                              {c.name} ({formatCardNumberDisplay(c)}) — ${c.priceUsd.toFixed(2)} USD
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => selectedMyCardId && addCardToMyOffer(selectedMyCardId)}
                          className="bg-purple-400 text-black font-bold text-xs px-3 py-1.5 rounded border border-black cursor-pointer shrink-0"
                        >
                          + Sumar
                        </button>
                      </div>

                      <div className="max-h-44 overflow-y-auto space-y-1.5">
                        {myTradeOffer.length === 0 ? (
                          <p className="text-xs text-[#84a98c] italic py-4 text-center">
                            Agregá las cartas que vas a dar en el canje.
                          </p>
                        ) : (
                          myTradeOffer.map((item) => (
                            <div
                              key={item.id}
                              className="bg-[#1a1c19] px-2.5 py-1.5 rounded flex justify-between items-center text-xs"
                            >
                              <span className="truncate pr-2 font-bold text-white">
                                {item.qty}x {item.name}
                              </span>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-green-400 font-bold">
                                  {formatMoney(item.priceUsd * item.qty)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setMyTradeOffer((prev) => prev.filter((x) => x.id !== item.id))
                                  }
                                  className="text-red-400 font-bold cursor-pointer"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="bg-[#262b25] border-2 border-[#28AAFD] p-3.5 rounded space-y-3">
                      <div className="flex justify-between items-center">
                        <h4 className="text-xs font-bold text-[#28AAFD] uppercase">
                          📥 Lado B: Cartas que recibís
                        </h4>
                        <span className="text-sm font-bold text-white">
                          {formatMoney(theirOfferTotalUsd)}
                        </span>
                      </div>

                      <div className="flex gap-1.5">
                        <select
                          value={selectedTheirCardId}
                          onChange={(e) => setSelectedTheirCardId(e.target.value)}
                          className="bg-[#1a1c19] border border-[#588157] px-2 py-1.5 text-xs text-white rounded flex-1 min-w-0 outline-none"
                        >
                          <option value="">Elegir de mis Faltantes / Binder...</option>
                          {orderedBinderCards.map((c) => (
                            <option key={`their-opt-${c.id}`} value={c.id}>
                              {c.name} ({formatCardNumberDisplay(c)}) — ${c.priceUsd.toFixed(2)} USD
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            selectedTheirCardId && addCardToTheirOffer(selectedTheirCardId)
                          }
                          className="bg-[#28AAFD] text-black font-bold text-xs px-3 py-1.5 rounded border border-black cursor-pointer shrink-0"
                        >
                          + Sumar
                        </button>
                      </div>

                      <form onSubmit={addCustomCardToTheirOffer} className="flex gap-1.5">
                        <input
                          type="text"
                          value={customTheirName}
                          onChange={(e) => setExternalTheirName(e.target.value)}
                          placeholder="Otra carta externa..."
                          className="bg-[#1a1c19] border border-[#588157] px-2 py-1 text-xs text-white rounded flex-1 min-w-0 outline-none"
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={customTheirPrice}
                          onChange={(e) => setExternalTheirPrice(e.target.value)}
                          placeholder="USD $"
                          className="bg-[#1a1c19] border border-[#588157] px-2 py-1 text-xs text-white rounded w-20 outline-none"
                        />
                        <button
                          type="submit"
                          className="bg-yellow-400 text-black font-bold text-xs px-2.5 py-1 rounded border border-black cursor-pointer"
                        >
                          +
                        </button>
                      </form>

                      <div className="max-h-36 overflow-y-auto space-y-1.5">
                        {theirTradeOffer.length === 0 ? (
                          <p className="text-xs text-[#84a98c] italic py-4 text-center">
                            Agregá las cartas que te ofrecen a cambio.
                          </p>
                        ) : (
                          theirTradeOffer.map((item) => (
                            <div
                              key={item.id}
                              className="bg-[#1a1c19] px-2.5 py-1.5 rounded flex justify-between items-center text-xs"
                            >
                              <span className="truncate pr-2 font-bold text-white">
                                {item.qty}x {item.name}
                              </span>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-green-400 font-bold">
                                  {formatMoney(item.priceUsd * item.qty)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setTheirTradeOffer((prev) =>
                                      prev.filter((x) => x.id !== item.id)
                                    )
                                  }
                                  className="text-red-400 font-bold cursor-pointer"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#121512] border-2 border-[#588157] p-4 rounded text-center space-y-1">
                    <p className="text-xs text-[#84a98c] uppercase font-bold">
                      Veredicto de la Balanza de Canje
                    </p>
                    {Math.abs(tradeDiffUsd) < 0.5 ? (
                      <p className="text-base font-bold text-green-400">
                        ⚖️ ¡CANJE EQUILIBRADO! Ambos lados valen prácticamente lo mismo.
                      </p>
                    ) : tradeDiffUsd > 0 ? (
                      <p className="text-base font-bold text-emerald-400">
                        ✅ Diferencia a tu favor de {formatMoney(tradeDiffUsd)} (Recibís más valor del que entregás).
                      </p>
                    ) : (
                      <p className="text-base font-bold text-amber-400">
                        ⚠️ Estás entregando {formatMoney(Math.abs(tradeDiffUsd))} de más (El otro coleccionista debería compensar esa diferencia).
                      </p>
                    )}
                  </div>
                </div>
              )}

              {tradeHubTab === "share" && (
                <div className="bg-[#262b25] border border-[#588157] p-4 rounded space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-[#28AAFD] uppercase">
                      🌐 Enlace Público de Solo Lectura para compartir tu Binder:
                    </h4>
                    <p className="text-xs text-[#84a98c] mt-1">
                      Mandale este link a cualquier amigo o comprador por WhatsApp. Podrán recorrer las hojas de tu carpeta, ver qué cartas ya tenés y cuáles ofrecés para canje, pero en <strong>Modo Visitante (sin permiso de edición)</strong>:
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatePublicShareUrl()}
                      className="bg-[#1a1c19] border-2 border-[#588157] px-3 py-2 text-xs text-white rounded flex-1 outline-none font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(generatePublicShareUrl());
                        showBanner("¡Link público de Solo Lectura copiado al portapapeles!");
                      }}
                      style={{ fontFamily: "var(--font-retro)" }}
                      className="bg-[#28AAFD] hover:bg-sky-300 text-black text-[10px] px-4 py-2.5 border-2 border-black font-bold cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                    >
                      <Copy className="w-3.5 h-3.5" /> COPIAR LINK PÚBLICO
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6 (FASE FINAL): ESCÁNER ÓPTICO CON CÁMARA EN VIVO */}
      {showCameraModal && (
        <div
          className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 overflow-y-auto"
          onClick={stopCameraScanner}
        >
          <div
            className="bg-[#DEDEDE] p-4 rounded-lg border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-3xl w-full my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#1a1c19] text-[#e0f8cf] border-4 border-black p-5 space-y-4">
              <div className="flex justify-between items-center border-b-2 border-[#588157] pb-3">
                <h3 style={{ fontFamily: "var(--font-retro)" }} className="text-xs sm:text-sm text-rose-400 flex items-center gap-2">
                  <Camera className="w-4 h-4" /> ESCÁNER CON CÁMARA EN VIVO
                </h3>
                <button
                  onClick={stopCameraScanner}
                  className="text-red-400 hover:text-red-300 font-bold text-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                {/* Visor de Cámara con Marco Guía de Carta Pokémon */}
                <div className="space-y-2">
                  <div className="relative aspect-[4/3] bg-black rounded border-2 border-[#588157] overflow-hidden flex items-center justify-center">
                    {cameraActive ? (
                      <>
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-4 border-2 border-dashed border-yellow-400/80 rounded-lg pointer-events-none flex items-end justify-center pb-2">
                          <span className="bg-black/70 text-yellow-400 text-[10px] px-2 py-0.5 rounded font-bold">
                            Encuadrá la carta aquí
                          </span>
                        </div>
                      </>
                    ) : capturedPhotoUrl ? (
                      <img
                        src={capturedPhotoUrl}
                        alt="Carta capturada"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <p className="text-xs text-[#84a98c] p-4 text-center">
                        Cámara en espera o sin permisos habilitados.
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={captureCardFrame}
                      disabled={!cameraActive}
                      style={{ fontFamily: "var(--font-retro)" }}
                      className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-black text-[10px] py-2.5 border-2 border-black font-bold cursor-pointer disabled:opacity-40"
                    >
                      📸 CAPTURAR FOTO
                    </button>
                    <button
                      type="button"
                      onClick={startCameraScanner}
                      className="bg-[#262b25] hover:bg-[#588157] text-white text-xs px-3 py-2 rounded border border-[#588157] font-bold cursor-pointer"
                    >
                      Reiniciar Cámara
                    </button>
                  </div>
                </div>

                {/* Panel de Identificación Rápida y Marcado en 1 Clic */}
                <div className="bg-[#262b25] border border-[#588157] p-3.5 rounded space-y-3">
                  <p className="text-xs font-bold text-yellow-400 uppercase">
                    🎯 Identificación Rápida en tu Binder:
                  </p>
                  <input
                    type="text"
                    value={scannerSearchText}
                    onChange={(e) => setScannerSearchText(e.target.value)}
                    placeholder="Escribí el # (ej: 098, H32) o nombre de la carta enfocada..."
                    className="w-full bg-[#1a1c19] border-2 border-[#588157] px-3 py-2 text-xs text-white rounded outline-none focus:border-yellow-400"
                  />

                  <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                    {scannerMatchedCards.map((c) => {
                      const owned = isCardOwned(c.id);
                      return (
                        <div
                          key={`scan-${c.id}`}
                          className="bg-[#1a1c19] p-2 rounded border border-[#588157]/60 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {c.image && (
                              <img
                                src={c.image}
                                alt={c.name}
                                className="w-8 h-11 object-contain rounded bg-black/40 shrink-0"
                              />
                            )}
                            <div className="truncate">
                              <p className="font-bold text-white truncate">{c.name}</p>
                              <p className="text-[10px] text-[#84a98c] truncate">
                                {c.setName} ({formatCardNumberDisplay(c)})
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleSpecificCardVersion(c, "en", "Normal")}
                            className={`px-2.5 py-1.5 text-[10px] font-bold rounded border cursor-pointer shrink-0 ${
                              owned
                                ? "bg-green-500 text-black border-black"
                                : "bg-yellow-400 text-black border-black"
                            }`}
                          >
                            {owned ? "✓ TENGO" : "+ MARCAR"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}