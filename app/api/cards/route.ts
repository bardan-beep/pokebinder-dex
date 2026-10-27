import { NextResponse } from "next/server";

const EUR_TO_USD = 1.08;

// Cachés en memoria del servidor para máxima velocidad
let cachedSetsList: { id: string; name: string; rank: number; officialCount: number }[] | null = null;
const setRankMap = new Map<string, { name: string; rank: number; officialCount: number }>();
const queryCardsCache = new Map<string, any[]>();
const cardDetailCache = new Map<string, any>();
const fullCardObjectCache = new Map<string, any>();
const genSpeciesCache = new Map<string, string[]>();

// 1. Carga el catálogo oficial de expansiones con su cantidad oficial de cartas
async function ensureSetsCatalog() {
  if (cachedSetsList && cachedSetsList.length > 0) return cachedSetsList;

  try {
    const res = await fetch("https://api.tcgdex.net/v2/en/sets");
    if (res.ok) {
      const sets = await res.json();
      if (Array.isArray(sets)) {
        cachedSetsList = sets.map((s: any, idx: number) => {
          const officialCount = Number(s.cardCount?.official || s.cardCount?.total || 0);
          const entry = {
            id: s.id,
            name: s.name || s.id.toUpperCase(),
            rank: idx,
            officialCount,
          };
          setRankMap.set(s.id.toLowerCase(), entry);
          return entry;
        });
        return cachedSetsList;
      }
    }
  } catch (err) {
    console.error("Error cargando catálogo de sets:", err);
  }
  return [];
}

// 2. Extrae el código y total de cartas del set desde el ID de la carta
function getSetInfoFromCardId(cardId: string) {
  const lastDash = cardId.lastIndexOf("-");
  const setId = (lastDash !== -1 ? cardId.substring(0, lastDash) : cardId).toLowerCase();
  const found = setRankMap.get(setId);
  if (found) return found;

  return { name: setId.toUpperCase(), rank: 99999, officialCount: 0 };
}

// 3. Convierte el número de carta en un valor numérico para ordenar cronológicamente
function parseCardNumber(localId: string): number {
  if (!localId) return 99999;
  const clean = String(localId).split("/")[0].trim();
  const exactNum = Number(clean);
  if (!isNaN(exactNum)) return exactNum;

  const digits = clean.match(/\d+/);
  if (digits) {
    return 10000 + parseInt(digits[0], 10);
  }
  return 99999;
}

// 4. Extrae el precio en USD priorizando TCGplayer y usando Cardmarket como respaldo
function extractPrice(card: any): {
  price: number;
  source: "TCGplayer" | "Cardmarket" | "Sin precio";
  variants: string[];
} {
  const variants: string[] = [];

  if (card.variants) {
    if (card.variants.normal) variants.push("Normal");
    if (card.variants.holo) variants.push("Holo");
    if (card.variants.reverse) variants.push("Reverse");
    if (card.variants.firstEdition) variants.push("1st Ed");
  }

  const tcgPrices = card.pricing?.tcgplayer || card.tcgplayer?.prices;
  if (tcgPrices && typeof tcgPrices === "object") {
    const variantOrder = [
      "normal",
      "holofoil",
      "holo",
      "reverse-holofoil",
      "reverseHolofoil",
      "1st-edition-holofoil",
      "1stEditionHolofoil",
      "1st-edition-normal",
      "1stEditionNormal",
      "unlimited-holofoil",
      "unlimitedHolofoil",
    ];

    for (const key of variantOrder) {
      const v = tcgPrices[key];
      if (v && typeof v === "object") {
        const p = v.marketPrice ?? v.market ?? v.midPrice ?? v.mid ?? v.lowPrice ?? v.low ?? 0;
        if (p > 0) {
          return {
            price: Number(Number(p).toFixed(2)),
            source: "TCGplayer",
            variants: variants.length > 0 ? variants : ["Estándar"],
          };
        }
      }
    }

    for (const [key, v] of Object.entries(tcgPrices)) {
      if (v && typeof v === "object" && key !== "updated" && key !== "unit") {
        const valObj = v as any;
        const p =
          valObj.marketPrice ??
          valObj.market ??
          valObj.midPrice ??
          valObj.mid ??
          valObj.lowPrice ??
          valObj.low ??
          0;
        if (p > 0) {
          return {
            price: Number(Number(p).toFixed(2)),
            source: "TCGplayer",
            variants: variants.length > 0 ? variants : ["Estándar"],
          };
        }
      }
    }
  }

  const cmPrices = card.pricing?.cardmarket || card.cardmarket?.prices;
  if (cmPrices && typeof cmPrices === "object") {
    const eurPrice =
      cmPrices.trend ??
      cmPrices.trendPrice ??
      cmPrices["trend-holo"] ??
      cmPrices.avg ??
      cmPrices.averageSellPrice ??
      cmPrices["avg-holo"] ??
      cmPrices.avg30 ??
      cmPrices.avg7 ??
      cmPrices.low ??
      cmPrices.lowPrice ??
      cmPrices["low-holo"] ??
      0;

    if (eurPrice > 0) {
      return {
        price: Number((Number(eurPrice) * EUR_TO_USD).toFixed(2)),
        source: "Cardmarket",
        variants: variants.length > 0 ? variants : ["Estándar"],
      };
    }
  }

  return {
    price: 0,
    source: "Sin precio",
    variants: variants.length > 0 ? variants : ["Estándar"],
  };
}

// 5. Obtiene una carta individual completa por ID
async function fetchSingleCardById(cardId: string): Promise<any | null> {
  const cleanId = cardId.trim();
  if (fullCardObjectCache.has(cleanId)) {
    return fullCardObjectCache.get(cleanId);
  }

  try {
    const res = await fetch(`https://api.tcgdex.net/v2/en/cards/${encodeURIComponent(cleanId)}`);
    if (res.ok) {
      const detail = await res.json();
      const { price, source, variants } = extractPrice(detail);
      const setInfo = getSetInfoFromCardId(cleanId);
      const officialTotal = Number(
        detail.set?.cardCount?.official || detail.set?.cardCount?.total || setInfo.officialCount || 0
      );

      const hydratedDetail = {
        rarity: detail.rarity || "Estándar",
        setName: detail.set?.name || setInfo.name,
        setOfficialCount: officialTotal,
        image: detail.image ? `${detail.image}/low.webp` : "",
        priceUsd: price,
        priceSource: source,
        variants,
        priceLoaded: true,
      };
      cardDetailCache.set(cleanId, hydratedDetail);

      const fullCard = {
        id: detail.id || cleanId,
        name: detail.name || "Carta Pokémon",
        number: detail.localId || "1",
        setOfficialCount: officialTotal,
        rarity: hydratedDetail.rarity,
        setName: hydratedDetail.setName,
        setRank: setInfo.rank,
        cardNumOrder: parseCardNumber(detail.localId || "1"),
        image: hydratedDetail.image,
        priceUsd: hydratedDetail.priceUsd,
        priceSource: hydratedDetail.priceSource,
        variants: hydratedDetail.variants,
        priceLoaded: true,
      };

      fullCardObjectCache.set(cleanId, fullCard);
      return fullCard;
    }
  } catch (err) {
    console.error(`Error cargando carta individual ${cleanId}:`, err);
  }
  return null;
}

// 6. Obtiene los detalles y precios de un lote de cartas por ID
async function hydrateCardDetails(cardIds: string[]) {
  const results: Record<string, any> = {};
  const missingIds = cardIds.filter((id) => !cardDetailCache.has(id));

  const batchSize = 30;
  for (let i = 0; i < missingIds.length; i += batchSize) {
    const batch = missingIds.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (id) => {
        await fetchSingleCardById(id);
      })
    );
  }

  for (const id of cardIds) {
    if (cardDetailCache.has(id)) {
      results[id] = cardDetailCache.get(id);
    }
  }
  return results;
}

// 7. Obtiene los nombres de todos los Pokémon de una Generación (Gen 1 a Gen 9)
async function getPokemonNamesForGeneration(genNumber: string): Promise<string[]> {
  if (genSpeciesCache.has(genNumber)) {
    return genSpeciesCache.get(genNumber)!;
  }

  try {
    const res = await fetch(`https://pokeapi.co/api/v2/generation/${encodeURIComponent(genNumber)}`);
    if (res.ok) {
      const data = await res.json();
      const speciesList = (data.pokemon_species || [])
        .map((s: any) => {
          const parts = String(s.url).split("/").filter(Boolean);
          const dexNum = parseInt(parts[parts.length - 1] || "9999", 10);
          let cleanName = String(s.name)
            .replace("-f", "")
            .replace("-m", "")
            .replace("mr-mime", "mr. mime")
            .replace("mime-jr", "mime jr.")
            .replace("type-null", "type: null")
            .replace("tapu-", "tapu ")
            .replace("iron-", "iron ")
            .replace("great-tusk", "great tusk")
            .replace("scream-tail", "scream tail")
            .replace("brute-bonnet", "brute bonnet")
            .replace("flutter-mane", "flutter mane")
            .replace("slither-wing", "slither wing")
            .replace("sandy-shocks", "sandy shocks")
            .replace("roaring-moon", "roaring moon")
            .replace("walking-wake", "walking wake")
            .replace("gouging-fire", "gouging fire")
            .replace("raging-bolt", "raging bolt");
          return { name: cleanName, dexNum };
        })
        .sort((a: any, b: any) => a.dexNum - b.dexNum)
        .map((s: any) => s.name);

      genSpeciesCache.set(genNumber, speciesList);
      return speciesList;
    }
  } catch (err) {
    console.error("Error obteniendo generación:", err);
  }
  return [];
}

// 8. Descarga las cartas de un criterio (POKE, TYPE, SET, GEN, CARD)
async function fetchCardsForCriterion(criterion: string): Promise<any[]> {
  const normalizedKey = criterion.trim();
  if (queryCardsCache.has(normalizedKey)) {
    return queryCardsCache.get(normalizedKey)!;
  }

  let type = "POKE";
  let value = normalizedKey;

  if (normalizedKey.includes(":")) {
    const idx = normalizedKey.indexOf(":");
    type = normalizedKey.substring(0, idx).toUpperCase();
    value = normalizedKey.substring(idx + 1).trim();
  }

  if (type === "CARD") {
    const single = await fetchSingleCardById(value);
    return single ? [single] : [];
  }

  const rawCards: any[] = [];

  try {
    if (type === "POKE") {
      const url = `https://api.tcgdex.net/v2/en/cards?name=${encodeURIComponent(value.toLowerCase())}`;
      const res = await fetch(url);
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list)) rawCards.push(...list);
      }
    } else if (type === "TYPE") {
      const url = `https://api.tcgdex.net/v2/en/cards?types=${encodeURIComponent(value)}`;
      const res = await fetch(url);
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list)) rawCards.push(...list);
      }
    } else if (type === "SET") {
      const setId = value.split("|")[0].trim();
      const url = `https://api.tcgdex.net/v2/en/sets/${encodeURIComponent(setId)}`;
      const res = await fetch(url);
      if (res.ok) {
        const setObj = await res.json();
        const officialSetTotal = Number(
          setObj?.cardCount?.official || setObj?.cardCount?.total || 0
        );
        if (Array.isArray(setObj?.cards)) {
          rawCards.push(
            ...setObj.cards.map((c: any) => ({
              ...c,
              setNameOverride: setObj.name,
              setOfficialCountOverride: officialSetTotal,
            }))
          );
        }
      }
    } else if (type === "GEN") {
      const genNum = value.replace(/\D/g, "") || "1";
      const speciesNames = await getPokemonNamesForGeneration(genNum);
      const batchSize = 25;

      for (let i = 0; i < speciesNames.length; i += batchSize) {
        const batch = speciesNames.slice(i, i + batchSize);
        const batchLists = await Promise.all(
          batch.map((pokeName) =>
            fetch(`https://api.tcgdex.net/v2/en/cards?name=${encodeURIComponent(pokeName)}`)
              .then((r) => (r.ok ? r.json() : []))
              .catch(() => [])
          )
        );
        batchLists.forEach((list) => {
          if (Array.isArray(list)) rawCards.push(...list);
        });
      }
    }
  } catch (err) {
    console.error(`Error procesando criterio ${criterion}:`, err);
  }

  const formatted = rawCards.map((c: any) => {
    const setInfo = getSetInfoFromCardId(c.id || "");
    const cachedDetail = cardDetailCache.get(c.id);

    return {
      id: c.id,
      name: c.name || "Carta Pokémon",
      number: c.localId || "1",
      setOfficialCount:
        c.setOfficialCountOverride || cachedDetail?.setOfficialCount || setInfo.officialCount || 0,
      rarity: cachedDetail?.rarity || "Estándar",
      setName: c.setNameOverride || cachedDetail?.setName || setInfo.name,
      setRank: setInfo.rank,
      cardNumOrder: parseCardNumber(c.localId || "1"),
      image: c.image ? `${c.image}/low.webp` : cachedDetail?.image || "",
      priceUsd: cachedDetail?.priceUsd ?? 0,
      priceSource: cachedDetail?.priceSource ?? "Sin precio",
      variants: cachedDetail?.variants ?? ["Estándar"],
      priceLoaded: Boolean(cachedDetail?.priceLoaded),
    };
  });

  queryCardsCache.set(normalizedKey, formatted);
  return formatted;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  // OPCIÓN B: BÚSQUEDA PRECISA EN TCG.FANS (100% ESTABLE, CERO ERRORES 404)
  if (action === "tcgfans") {
    const name = (searchParams.get("name") || "").trim();
    const number = (searchParams.get("number") || "").trim();
    const mode = searchParams.get("mode") || "exact";

    const searchQuery = mode === "nameOnly" ? name : `${name} ${number}`.trim();
    const targetSearchUrl = `https://tcg.fans/pokemon?search=${encodeURIComponent(searchQuery)}`;

    return NextResponse.redirect(targetSearchUrl);
  }

  await ensureSetsCatalog();

  if (action === "sets") {
    const sets = cachedSetsList || [];
    return NextResponse.json({ sets: [...sets].reverse() });
  }

  const criteriaParam = searchParams.get("criteria") || searchParams.get("pokemon") || "";
  // Ignoramos metadatos financieros (HIST: y COST:) al buscar cartas
  const criteriaList = criteriaParam
    .split(",")
    .map((s) => s.trim())
    .filter(
      (s) =>
        Boolean(s) &&
        !s.toUpperCase().startsWith("HIST:") &&
        !s.toUpperCase().startsWith("COST:")
    );

  if (criteriaList.length === 0) {
    return NextResponse.json({ data: [] });
  }

  const bulkCriteria = criteriaList.filter((c) => !c.toUpperCase().startsWith("CARD:"));
  const singleCardCriteria = criteriaList
    .filter((c) => c.toUpperCase().startsWith("CARD:"))
    .map((c) => c.substring(5).trim())
    .filter(Boolean);

  const allResults: any[] = [];

  for (const crit of bulkCriteria) {
    const cards = await fetchCardsForCriterion(crit);
    allResults.push(...cards);
  }

  if (singleCardCriteria.length > 0) {
    const batchSize = 25;
    for (let i = 0; i < singleCardCriteria.length; i += batchSize) {
      const batch = singleCardCriteria.slice(i, i + batchSize);
      const fetchedSingles = await Promise.all(batch.map((id) => fetchSingleCardById(id)));
      fetchedSingles.forEach((card) => {
        if (card) allResults.push(card);
      });
    }
  }

  const uniqueMap = new Map<string, any>();
  allResults.forEach((card, idx) => {
    if (card?.id && !uniqueMap.has(card.id)) {
      uniqueMap.set(card.id, { ...card, addedOrder: idx });
    }
  });

  const sortedCards = Array.from(uniqueMap.values()).sort((a, b) => {
    if (a.setRank !== b.setRank) {
      return a.setRank - b.setRank;
    }
    return a.cardNumOrder - b.cardNumOrder;
  });

  const initialIdsToHydrate = sortedCards
    .slice(0, 90)
    .filter((c) => !c.priceLoaded)
    .map((c) => c.id);

  if (initialIdsToHydrate.length > 0) {
    await hydrateCardDetails(initialIdsToHydrate);
  }

  const finalCards = sortedCards.map((c) => {
    const cached = cardDetailCache.get(c.id);
    if (cached) {
      return {
        ...c,
        rarity: cached.rarity || c.rarity,
        setName: cached.setName || c.setName,
        setOfficialCount: cached.setOfficialCount || c.setOfficialCount || 0,
        image: c.image || cached.image || "",
        priceUsd: cached.priceUsd,
        priceSource: cached.priceSource,
        variants: cached.variants,
        priceLoaded: true,
      };
    }
    return c;
  });

  return NextResponse.json({ data: finalCards });
}

export async function POST(request: Request) {
  try {
    await ensureSetsCatalog();
    const body = await request.json();
    const ids: string[] = Array.isArray(body?.ids) ? body.ids.slice(0, 60) : [];

    if (ids.length === 0) {
      return NextResponse.json({ prices: {} });
    }

    const hydrated = await hydrateCardDetails(ids);
    return NextResponse.json({ prices: hydrated });
  } catch (err) {
    console.error("Error hidratando precios:", err);
    return NextResponse.json({ prices: {} });
  }
}