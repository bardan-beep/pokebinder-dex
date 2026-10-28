import { NextResponse } from "next/server";

const EUR_TO_USD = 1.08;

// Rangos de la Pokédex Nacional por Generación para búsquedas masivas sin pérdida
const GEN_DEX_RANGES: Record<string, [number, number]> = {
  "1": [1, 151],
  "2": [152, 251],
  "3": [252, 386],
  "4": [387, 493],
  "5": [494, 649],
  "6": [650, 721],
  "7": [722, 809],
  "8": [810, 905],
  "9": [906, 1025],
};

// Sub-sets de Galerías (Trainer Gallery / Galarian Gallery / Shiny Vault) asociados a sets principales
const SUBSET_COMPANIONS: Record<string, string[]> = {
  swsh9: ["swsh9tg"],
  swsh10: ["swsh10tg"],
  swsh11: ["swsh11tg"],
  swsh12: ["swsh12tg"],
  "swsh12.5": ["swsh12.5gg", "swsh12pt5gg"],
  swsh12pt5: ["swsh12pt5gg", "swsh12.5gg"],
  swsh45: ["swsh45sv"],
  "swsh4.5": ["swsh45sv"],
  sm115: ["sma"],
};

// Cachés en memoria del servidor para máxima velocidad
let cachedSetsList: { id: string; name: string; rank: number; officialCount: number }[] | null = null;
const setRankMap = new Map<string, { id: string; name: string; rank: number; officialCount: number }>();
const setNameRankMap = new Map<string, { id: string; name: string; rank: number; officialCount: number }>();
const queryCardsCache = new Map<string, any[]>();
const cardDetailCache = new Map<string, any>();
const fullCardObjectCache = new Map<string, any>();
const genSpeciesCache = new Map<string, string[]>();

// Helper de fetch con timeout para evitar que una API externa lenta bloquee Vercel
async function fetchWithTimeout(url: string, timeoutMs = 4500, headers?: Record<string, string>) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const finalHeaders: Record<string, string> = {
      Accept: "application/json",
      ...headers,
    };
    if (url.includes("api.pokemontcg.io") && process.env.POKEMON_TCG_API_KEY) {
      finalHeaders["X-Api-Key"] = process.env.POKEMON_TCG_API_KEY;
    }
    const res = await fetch(url, {
      signal: controller.signal,
      headers: finalHeaders,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// Normaliza códigos de sets entre TCGdex (ej: sv03.5) y Pokémon TCG API (ej: sv3pt5)
function tcgdexSetToPtcgIoSet(setId: string): string {
  const clean = setId.toLowerCase().trim();
  const matchSv = clean.match(/^sv0?(\d+)(?:\.(\d+))?$/);
  if (matchSv) {
    return matchSv[2] ? `sv${matchSv[1]}pt${matchSv[2]}` : `sv${matchSv[1]}`;
  }
  const matchSwsh = clean.match(/^swsh0?(\d+)(?:\.(\d+))?$/);
  if (matchSwsh) {
    return matchSwsh[2] ? `swsh${matchSwsh[1]}pt${matchSwsh[2]}` : `swsh${matchSwsh[1]}`;
  }
  return clean.replace(".", "pt");
}

function tcgdexCardIdToPtcgIoId(cardId: string): string {
  const lastDash = cardId.lastIndexOf("-");
  if (lastDash === -1) return cardId;
  const rawSet = cardId.substring(0, lastDash);
  const rawNum = cardId.substring(lastDash + 1);
  const mappedSet = tcgdexSetToPtcgIoSet(rawSet);
  const strippedNum = /^\d+$/.test(rawNum) ? String(parseInt(rawNum, 10)) : rawNum;
  return `${mappedSet}-${strippedNum}`;
}

// 1. Carga y unifica el catálogo oficial de expansiones (TCGdex + Pokémon TCG API)
async function ensureSetsCatalog() {
  if (cachedSetsList && cachedSetsList.length > 0) return cachedSetsList;

  try {
    const [tcgdexRes, ptcgRes] = await Promise.allSettled([
      fetchWithTimeout("https://api.tcgdex.net/v2/en/sets", 5000),
      fetchWithTimeout("https://api.pokemontcg.io/v2/sets?orderBy=releaseDate", 5000),
    ]);

    const mergedSets: { id: string; name: string; rank: number; officialCount: number }[] = [];
    const seenNames = new Set<string>();

    if (tcgdexRes.status === "fulfilled" && tcgdexRes.value.ok) {
      const sets = await tcgdexRes.value.json();
      if (Array.isArray(sets)) {
        sets.forEach((s: any, idx: number) => {
          const officialCount = Number(s.cardCount?.official || s.cardCount?.total || 0);
          const entry = {
            id: s.id,
            name: s.name || s.id.toUpperCase(),
            rank: idx,
            officialCount,
          };
          mergedSets.push(entry);
          setRankMap.set(s.id.toLowerCase(), entry);
          setRankMap.set(tcgdexSetToPtcgIoSet(s.id), entry);
          setNameRankMap.set(entry.name.toLowerCase(), entry);
          seenNames.add(entry.name.toLowerCase());
        });
      }
    }

    if (ptcgRes.status === "fulfilled" && ptcgRes.value.ok) {
      const ptcgJson = await ptcgRes.value.json();
      const ptcgSets = ptcgJson?.data || [];
      if (Array.isArray(ptcgSets)) {
        ptcgSets.forEach((ps: any, idx: number) => {
          const idLower = String(ps.id || "").toLowerCase();
          const nameLower = String(ps.name || "").toLowerCase();
          const officialCount = Number(ps.printedTotal || ps.total || 0);

          if (!setRankMap.has(idLower) && !seenNames.has(nameLower)) {
            const entry = {
              id: ps.id,
              name: ps.name || ps.id.toUpperCase(),
              rank: mergedSets.length + idx,
              officialCount,
            };
            mergedSets.push(entry);
            setRankMap.set(idLower, entry);
            setNameRankMap.set(nameLower, entry);
            seenNames.add(nameLower);
          } else {
            const existing = setRankMap.get(idLower) || setNameRankMap.get(nameLower);
            if (existing) {
              if (!existing.officialCount && officialCount > 0) {
                existing.officialCount = officialCount;
              }
              setRankMap.set(idLower, existing);
            }
          }
        });
      }
    }

    if (mergedSets.length > 0) {
      cachedSetsList = mergedSets;
      return cachedSetsList;
    }
  } catch (err) {
    console.error("Error cargando catálogo unificado de sets:", err);
  }
  return [];
}

// 2. Extrae el código y total de cartas del set desde el ID o nombre
function getSetInfoFromCardId(cardId: string, fallbackSetName?: string) {
  const lastDash = cardId.lastIndexOf("-");
  const setId = (lastDash !== -1 ? cardId.substring(0, lastDash) : cardId).toLowerCase();
  const foundById = setRankMap.get(setId) || setRankMap.get(tcgdexSetToPtcgIoSet(setId));
  if (foundById) return foundById;

  if (fallbackSetName) {
    const foundByName = setNameRankMap.get(fallbackSetName.toLowerCase());
    if (foundByName) return foundByName;
  }

  return { id: setId, name: fallbackSetName || setId.toUpperCase(), rank: 99999, officialCount: 0 };
}

// 3. Convierte el número de carta en un valor numérico para ordenar cronológicamente
function parseCardNumber(localId: string): number {
  if (!localId) return 99999;
  const clean = String(localId).split("/")[0].trim();
  const exactNum = Number(clean);
  if (!isNaN(exactNum)) return exactNum;

  const upper = clean.toUpperCase();
  const digits = upper.match(/\d+/);
  if (digits) {
    const num = parseInt(digits[0], 10);
    if (upper.startsWith("TG") || upper.startsWith("GG")) return 5000 + num;
    if (upper.startsWith("SV") || upper.startsWith("RC")) return 7000 + num;
    return 10000 + num;
  }
  return 99999;
}

// 4. Extrae precios y desglose por variante (TCGplayer + Cardmarket)
function extractPrice(card: any): {
  price: number;
  source: "TCGplayer" | "Cardmarket" | "PriceCharting" | "Sin precio";
  variants: string[];
  variantPrices: Record<string, number>;
} {
  const variants: string[] = [];
  const variantPrices: Record<string, number> = {};

  if (card.variants) {
    if (card.variants.normal) variants.push("Normal");
    if (card.variants.holo) variants.push("Holo");
    if (card.variants.reverse) variants.push("Reverse");
    if (card.variants.firstEdition) variants.push("1st Ed");
  }

  const pickBestPrice = (v: any): number => {
    if (!v || typeof v !== "object") return 0;
    const p =
      v.marketPrice ??
      v.market ??
      v.midPrice ??
      v.mid ??
      v.directLow ??
      v.lowPrice ??
      v.low ??
      v.highPrice ??
      v.high ??
      0;
    return p > 0 ? Number(Number(p).toFixed(2)) : 0;
  };

  // A. Revisar TCGplayer
  const tcgPrices = card.pricing?.tcgplayer || card.tcgplayer?.prices;
  if (tcgPrices && typeof tcgPrices === "object") {
    const normalP = pickBestPrice(tcgPrices.normal || tcgPrices["unlimited"]);
    const holoP = pickBestPrice(
      tcgPrices.holofoil || tcgPrices.holo || tcgPrices["unlimited-holofoil"] || tcgPrices.unlimitedHolofoil
    );
    const revP = pickBestPrice(tcgPrices["reverse-holofoil"] || tcgPrices.reverseHolofoil);
    const firstEdP = pickBestPrice(
      tcgPrices["1st-edition-holofoil"] ||
        tcgPrices["1stEditionHolofoil"] ||
        tcgPrices["1st-edition-normal"] ||
        tcgPrices["1stEditionNormal"] ||
        tcgPrices["1st-edition"]
    );

    if (normalP > 0) variantPrices["Normal"] = normalP;
    if (holoP > 0) variantPrices["Holo"] = holoP;
    if (revP > 0) variantPrices["Reverse"] = revP;
    if (firstEdP > 0) variantPrices["1st Ed"] = firstEdP;

    const primaryPrice = normalP || holoP || revP || firstEdP;
    if (primaryPrice > 0) {
      return {
        price: primaryPrice,
        source: "TCGplayer",
        variants: variants.length > 0 ? variants : Object.keys(variantPrices),
        variantPrices,
      };
    }

    for (const [key, v] of Object.entries(tcgPrices)) {
      if (key !== "updated" && key !== "unit") {
        const p = pickBestPrice(v);
        if (p > 0) {
          variantPrices["Normal"] = p;
          return {
            price: p,
            source: "TCGplayer",
            variants: variants.length > 0 ? variants : ["Estándar"],
            variantPrices,
          };
        }
      }
    }
  }

  // B. Revisar Cardmarket
  const cmPrices = card.pricing?.cardmarket || card.cardmarket?.prices;
  if (cmPrices && typeof cmPrices === "object") {
    const rawNormalEur =
      cmPrices.trend ??
      cmPrices.trendPrice ??
      cmPrices.avg7 ??
      cmPrices.avg30 ??
      cmPrices.avg ??
      cmPrices.averageSellPrice ??
      cmPrices.avg1 ??
      cmPrices.low ??
      cmPrices.lowPrice ??
      0;

    const rawHoloEur =
      cmPrices["trend-holo"] ??
      cmPrices.reverseHoloTrend ??
      cmPrices["avg-holo"] ??
      cmPrices.reverseHoloAvg7 ??
      cmPrices.reverseHoloAvg30 ??
      cmPrices.reverseHoloSell ??
      cmPrices["low-holo"] ??
      cmPrices.reverseHoloLow ??
      0;

    const normalUsd = rawNormalEur > 0 ? Number((Number(rawNormalEur) * EUR_TO_USD).toFixed(2)) : 0;
    const holoUsd = rawHoloEur > 0 ? Number((Number(rawHoloEur) * EUR_TO_USD).toFixed(2)) : 0;

    if (normalUsd > 0) variantPrices["Normal"] = normalUsd;
    if (holoUsd > 0) {
      variantPrices["Holo"] = holoUsd;
      variantPrices["Reverse"] = holoUsd;
    }

    const bestCmUsd = normalUsd || holoUsd;
    if (bestCmUsd > 0) {
      return {
        price: bestCmUsd,
        source: "Cardmarket",
        variants: variants.length > 0 ? variants : ["Estándar"],
        variantPrices,
      };
    }
  }

  return {
    price: 0,
    source: "Sin precio",
    variants: variants.length > 0 ? variants : ["Estándar"],
    variantPrices,
  };
}

// 5. Respaldo en vivo con PriceCharting (CORREGIDO: Toma estrictamente la celda <td ... used_price> Ungraded/Raw)
async function fetchPriceChartingFallback(
  cardName: string,
  cardNumber: string,
  setName?: string
): Promise<{
  price: number;
  variantPrices: Record<string, number>;
} | null> {
  try {
    const cleanNum = String(cardNumber || "").split("/")[0].replace(/^0+/, "").trim();
    const query = `Pokemon ${cardName} ${cleanNum} ${setName || ""}`.trim();
    const url = `https://www.pricecharting.com/search-products?q=${encodeURIComponent(query)}&type=prices`;

    const res = await fetchWithTimeout(url, 3200, {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    });

    if (!res.ok) return null;
    const html = await res.text();

    // Si es una tabla de resultados de búsqueda, aislamos únicamente la primera fila de producto (<tr id="product-...">)
    // para no leer nunca los encabezados <th> ni mezclar filas distintas
    let targetScopeHtml = html;
    const productRowMatch = html.match(/<tr[^>]*id="product-[^"]*"[^>]*>([\s\S]*?)<\/tr>/i);
    if (productRowMatch && productRowMatch[1]) {
      targetScopeHtml = productRowMatch[1];
    }

    // Extrae el valor en USD únicamente dentro de la etiqueta <td> correspondiente (sin saltar jamás a la celda vecina)
    const extractTdCellPrice = (cellKeyRegex: string): number => {
      const tdRegex = new RegExp(
        `<td[^>]*(?:id|class)="[^"]*\\b(?:${cellKeyRegex})\\b[^"]*"[^>]*>([\\s\\S]*?)<\\/td>`,
        "i"
      );
      const tdMatch = targetScopeHtml.match(tdRegex);
      if (!tdMatch || !tdMatch[1]) return 0;

      const dollarMatch = tdMatch[1].match(/\$([0-9,]+\.[0-9]{2})/);
      if (dollarMatch && dollarMatch[1]) {
        const val = parseFloat(dollarMatch[1].replace(/,/g, ""));
        return !isNaN(val) && val > 0 ? Number(val.toFixed(2)) : 0;
      }
      return 0;
    };

    // En PriceCharting: used_price = Ungraded (Raw) | cib_price / complete_price = Grade 9 | new_price / graded_price = PSA 10
    const ungradedUsd = extractTdCellPrice("used_price");
    const grade9Usd = extractTdCellPrice("cib_price|complete_price");
    const psa10Usd = extractTdCellPrice("new_price|graded_price");

    // REGLA ESTRICTA: El precio base de la carta SOLO puede ser el precio Ungraded (Raw).
    // Nunca usamos PSA 9 ni PSA 10 como precio base.
    if (ungradedUsd > 0) {
      const variantPrices: Record<string, number> = {
        Normal: ungradedUsd,
      };
      if (grade9Usd > 0) variantPrices["PSA 9"] = grade9Usd;
      if (psa10Usd > 0) variantPrices["PSA 10"] = psa10Usd;

      return { price: ungradedUsd, variantPrices };
    }
  } catch {
    // Si PriceCharting no responde a tiempo, continuamos sin bloquear
  }
  return null;
}

// 6. Respaldo en vivo con Pokémon TCG API (api.pokemontcg.io/v2)
async function fetchPokemonTcgIoFallback(
  cardId: string,
  cardName?: string,
  localId?: string
): Promise<any | null> {
  const mappedId = tcgdexCardIdToPtcgIoId(cardId);

  try {
    const directRes = await fetchWithTimeout(
      `https://api.pokemontcg.io/v2/cards/${encodeURIComponent(mappedId)}`,
      3800
    );
    if (directRes.ok) {
      const json = await directRes.json();
      if (json?.data) return json.data;
    }

    if (cardName && localId) {
      const cleanNum = String(localId).split("/")[0].replace(/^0+/, "").trim();
      const safeName = cardName.replace(/["\\]/g, "").trim();
      const q = `name:"${safeName}" number:"${cleanNum}"`;
      const searchRes = await fetchWithTimeout(
        `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=3`,
        3800
      );
      if (searchRes.ok) {
        const searchJson = await searchRes.json();
        if (Array.isArray(searchJson?.data) && searchJson.data.length > 0) {
          return searchJson.data[0];
        }
      }
    }
  } catch {}
  return null;
}

// 7. Obtiene una carta individual completa por ID combinando todas las fuentes de datos y precios
async function fetchSingleCardById(cardId: string): Promise<any | null> {
  const cleanId = cardId.trim();
  if (fullCardObjectCache.has(cleanId)) {
    return fullCardObjectCache.get(cleanId);
  }

  let detail: any = null;

  try {
    const res = await fetchWithTimeout(
      `https://api.tcgdex.net/v2/en/cards/${encodeURIComponent(cleanId)}`,
      4000
    );
    if (res.ok) {
      detail = await res.json();
    } else {
      const jaRes = await fetchWithTimeout(
        `https://api.tcgdex.net/v2/ja/cards/${encodeURIComponent(cleanId)}`,
        3500
      );
      if (jaRes.ok) detail = await jaRes.json();
    }
  } catch {}

  let { price, source, variants, variantPrices } = detail
    ? extractPrice(detail)
    : { price: 0, source: "Sin precio" as const, variants: ["Estándar"], variantPrices: {} };

  const setInfo = getSetInfoFromCardId(cleanId, detail?.set?.name);
  let officialTotal = Number(
    detail?.set?.cardCount?.official || detail?.set?.cardCount?.total || setInfo.officialCount || 0
  );
  let image = detail?.image ? `${detail.image}/low.webp` : "";
  let rarity = detail?.rarity || "Estándar";
  let setName = detail?.set?.name || setInfo.name;
  let name = detail?.name || "Carta Pokémon";
  let localId = detail?.localId || cleanId.split("-").pop() || "1";

  // Si falta la carta en TCGdex, o no tiene precio (price === 0), o no tiene imagen, consultar Pokémon TCG API
  if (!detail || price === 0 || !image) {
    const ptcgCard = await fetchPokemonTcgIoFallback(cleanId, detail?.name, localId);
    if (ptcgCard) {
      name = detail?.name || ptcgCard.name || name;
      localId = detail?.localId || ptcgCard.number || localId;
      rarity = rarity !== "Estándar" ? rarity : ptcgCard.rarity || "Estándar";
      setName = detail?.set?.name || ptcgCard.set?.name || setName;
      officialTotal =
        officialTotal || Number(ptcgCard.set?.printedTotal || ptcgCard.set?.total || 0);
      if (!image && (ptcgCard.images?.small || ptcgCard.images?.large)) {
        image = ptcgCard.images.small || ptcgCard.images.large;
      }

      if (price === 0) {
        const ptcgExtracted = extractPrice(ptcgCard);
        if (ptcgExtracted.price > 0) {
          price = ptcgExtracted.price;
          source = ptcgExtracted.source;
          variants = ptcgExtracted.variants;
          variantPrices = { ...variantPrices, ...ptcgExtracted.variantPrices };
        }
      }
    }
  }

  // Si aún sigue sin precio, consultar PriceCharting (solo toma el precio Ungraded/Raw como precio base)
  if (price === 0 && name !== "Carta Pokémon") {
    const pcFallback = await fetchPriceChartingFallback(name, localId, setName);
    if (pcFallback && pcFallback.price > 0) {
      price = pcFallback.price;
      source = "PriceCharting";
      variantPrices = { ...variantPrices, ...pcFallback.variantPrices };
    }
  }

  if (!detail && name === "Carta Pokémon") return null;

  const hydratedDetail = {
    rarity,
    setName,
    setOfficialCount: officialTotal,
    image,
    priceUsd: price,
    priceSource: source,
    variants,
    variantPrices,
    priceLoaded: true,
  };
  cardDetailCache.set(cleanId, hydratedDetail);

  const fullCard = {
    id: detail?.id || cleanId,
    name,
    number: localId,
    setOfficialCount: officialTotal,
    rarity,
    setName,
    setRank: setInfo.rank,
    cardNumOrder: parseCardNumber(localId),
    image,
    priceUsd: price,
    priceSource: source,
    variants,
    variantPrices,
    priceLoaded: true,
  };

  fullCardObjectCache.set(cleanId, fullCard);
  return fullCard;
}

// 8. Hidrata detalles y precios en lotes rápidos
async function hydrateCardDetails(cardIds: string[]) {
  const results: Record<string, any> = {};
  const missingIds = cardIds.filter((id) => !cardDetailCache.has(id));

  const batchSize = 20;
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

// 9. Normaliza los nombres de especies de PokéAPI
function normalizePokeApiSpeciesName(rawName: string): string {
  const lower = String(rawName || "").toLowerCase().trim();
  const exactFixes: Record<string, string> = {
    "nidoran-f": "nidoran",
    "nidoran-m": "nidoran",
    farfetchd: "farfetch'd",
    sirfetchd: "sirfetch'd",
    "mr-mime": "mr. mime",
    "mr-rime": "mr. rime",
    "mime-jr": "mime jr.",
    flabebe: "flabébé",
    "type-null": "type: null",
    "great-tusk": "great tusk",
  };
  if (exactFixes[lower]) return exactFixes[lower];

  return lower
    .replace(/^tapu-/, "tapu ")
    .replace(/^iron-/, "iron ")
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
}

async function getPokemonNamesForGeneration(genNumber: string): Promise<string[]> {
  if (genSpeciesCache.has(genNumber)) {
    return genSpeciesCache.get(genNumber)!;
  }

  try {
    const res = await fetchWithTimeout(
      `https://pokeapi.co/api/v2/generation/${encodeURIComponent(genNumber)}`,
      5000
    );
    if (res.ok) {
      const data = await res.json();
      const speciesList = Array.from(
        new Set<string>(
          (data.pokemon_species || [])
            .map((s: any) => {
              const parts = String(s.url).split("/").filter(Boolean);
              const dexNum = parseInt(parts[parts.length - 1] || "9999", 10);
              return { name: normalizePokeApiSpeciesName(s.name), dexNum };
            })
            .sort((a: any, b: any) => a.dexNum - b.dexNum)
            .map((s: any) => s.name)
        )
      );

      genSpeciesCache.set(genNumber, speciesList);
      return speciesList;
    }
  } catch (err) {
    console.error("Error obteniendo generación:", err);
  }
  return [];
}

// Convierte una carta de Pokémon TCG API al formato de PokéBinder Dex
function formatPtcgIoCardToBinder(ptcgCard: any) {
  const setInfo = getSetInfoFromCardId(ptcgCard.id || "", ptcgCard.set?.name);
  const officialTotal = Number(
    ptcgCard.set?.printedTotal || ptcgCard.set?.total || setInfo.officialCount || 0
  );
  const extracted = extractPrice(ptcgCard);
  const image = ptcgCard.images?.small || ptcgCard.images?.large || "";

  const detailObj = {
    rarity: ptcgCard.rarity || "Estándar",
    setName: ptcgCard.set?.name || setInfo.name,
    setOfficialCount: officialTotal,
    image,
    priceUsd: extracted.price,
    priceSource: extracted.source,
    variants: extracted.variants,
    variantPrices: extracted.variantPrices,
    priceLoaded: extracted.price > 0,
  };

  if (ptcgCard.id && extracted.price > 0) {
    cardDetailCache.set(ptcgCard.id, detailObj);
  }

  return {
    id: ptcgCard.id,
    name: ptcgCard.name || "Carta Pokémon",
    number: ptcgCard.number || "1",
    setOfficialCount: officialTotal,
    rarity: detailObj.rarity,
    setName: detailObj.setName,
    setRank: setInfo.rank,
    cardNumOrder: parseCardNumber(ptcgCard.number || "1"),
    image,
    priceUsd: detailObj.priceUsd,
    priceSource: detailObj.priceSource,
    variants: detailObj.variants,
    variantPrices: detailObj.variantPrices,
    priceLoaded: detailObj.priceLoaded,
  };
}

// Clave canónica (Set + Número + Nombre) para fusionar sin duplicar
function createCanonicalCardKey(card: { name: string; setName: string; number: string; id: string }): string {
  const cleanNum = String(card.number || "")
    .split("/")[0]
    .replace(/^0+/, "")
    .toLowerCase()
    .trim();
  const cleanSet = String(card.setName || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const cleanName = String(card.name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return `${cleanSet}__${cleanNum}__${cleanName}`;
}

// 10. Descarga y fusiona las cartas de un criterio desde múltiples fuentes
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

  const tcgdexRawCards: any[] = [];
  const ptcgIoFormattedCards: any[] = [];

  try {
    if (type === "POKE") {
      const cleanPoke = value.toLowerCase().trim();
      const safePtcgQuery = `name:"*${cleanPoke.replace(/["\\]/g, "")}*"`;

      const [tcgEnRes, ptcgRes] = await Promise.allSettled([
        fetchWithTimeout(
          `https://api.tcgdex.net/v2/en/cards?name=${encodeURIComponent(cleanPoke)}`,
          5000
        ),
        fetchWithTimeout(
          `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(safePtcgQuery)}&pageSize=250`,
          5500
        ),
      ]);

      if (tcgEnRes.status === "fulfilled" && tcgEnRes.value.ok) {
        const list = await tcgEnRes.value.json();
        if (Array.isArray(list)) tcgdexRawCards.push(...list);
      }

      if (ptcgRes.status === "fulfilled" && ptcgRes.value.ok) {
        const ptcgJson = await ptcgRes.value.json();
        if (Array.isArray(ptcgJson?.data)) {
          ptcgIoFormattedCards.push(...ptcgJson.data.map(formatPtcgIoCardToBinder));
        }
      }
    } else if (type === "TYPE") {
      const [tcgRes, ptcgRes] = await Promise.allSettled([
        fetchWithTimeout(
          `https://api.tcgdex.net/v2/en/cards?types=${encodeURIComponent(value)}`,
          5500
        ),
        fetchWithTimeout(
          `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(`types:"${value}"`)}&pageSize=250`,
          5500
        ),
      ]);

      if (tcgRes.status === "fulfilled" && tcgRes.value.ok) {
        const list = await tcgRes.value.json();
        if (Array.isArray(list)) tcgdexRawCards.push(...list);
      }
      if (ptcgRes.status === "fulfilled" && ptcgRes.value.ok) {
        const ptcgJson = await ptcgRes.value.json();
        if (Array.isArray(ptcgJson?.data)) {
          ptcgIoFormattedCards.push(...ptcgJson.data.map(formatPtcgIoCardToBinder));
        }
      }
    } else if (type === "SET") {
      const setId = value.split("|")[0].trim();
      const setIdsToFetch = [setId, ...(SUBSET_COMPANIONS[setId.toLowerCase()] || [])];
      const ptcgSetId = tcgdexSetToPtcgIoSet(setId);

      const setResponses = await Promise.allSettled(
        setIdsToFetch.map((sid) =>
          fetchWithTimeout(`https://api.tcgdex.net/v2/en/sets/${encodeURIComponent(sid)}`, 4500)
        )
      );

      for (const resItem of setResponses) {
        if (resItem.status === "fulfilled" && resItem.value.ok) {
          const setObj = await resItem.value.json();
          const officialSetTotal = Number(
            setObj?.cardCount?.official || setObj?.cardCount?.total || 0
          );
          if (Array.isArray(setObj?.cards)) {
            tcgdexRawCards.push(
              ...setObj.cards.map((c: any) => ({
                ...c,
                setNameOverride: setObj.name,
                setOfficialCountOverride: officialSetTotal,
              }))
            );
          }
        }
      }

      try {
        const ptcgRes = await fetchWithTimeout(
          `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(`set.id:"${ptcgSetId}"`)}&pageSize=250`,
          5500
        );
        if (ptcgRes.ok) {
          const ptcgJson = await ptcgRes.json();
          if (Array.isArray(ptcgJson?.data)) {
            ptcgIoFormattedCards.push(...ptcgJson.data.map(formatPtcgIoCardToBinder));
          }
        }
      } catch {}
    } else if (type === "GEN") {
      const genNum = value.replace(/\D/g, "") || "1";
      const speciesNames = await getPokemonNamesForGeneration(genNum);
      const batchSize = 20;

      for (let i = 0; i < speciesNames.length; i += batchSize) {
        const batch = speciesNames.slice(i, i + batchSize);
        const batchLists = await Promise.all(
          batch.map((pokeName) =>
            fetchWithTimeout(
              `https://api.tcgdex.net/v2/en/cards?name=${encodeURIComponent(pokeName)}`,
              4500
            )
              .then((r) => (r.ok ? r.json() : []))
              .catch(() => [])
          )
        );
        batchLists.forEach((list) => {
          if (Array.isArray(list)) tcgdexRawCards.push(...list);
        });
      }

      const dexRange = GEN_DEX_RANGES[genNum];
      if (dexRange) {
        try {
          const rangeQuery = `nationalPokedexNumbers:[${dexRange[0]} TO ${dexRange[1]}]`;
          const ptcgGenRes = await fetchWithTimeout(
            `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(rangeQuery)}&pageSize=250`,
            5500
          );
          if (ptcgGenRes.ok) {
            const ptcgJson = await ptcgGenRes.json();
            if (Array.isArray(ptcgJson?.data)) {
              ptcgIoFormattedCards.push(...ptcgJson.data.map(formatPtcgIoCardToBinder));
            }
          }
        } catch {}
      }
    }
  } catch (err) {
    console.error(`Error procesando criterio ${criterion}:`, err);
  }

  const formattedTcgdex = tcgdexRawCards.map((c: any) => {
    const setInfo = getSetInfoFromCardId(c.id || "", c.setNameOverride);
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
      variantPrices: cachedDetail?.variantPrices ?? {},
      priceLoaded: Boolean(cachedDetail?.priceLoaded),
    };
  });

  const canonicalMap = new Map<string, any>();
  const finalMergedList: any[] = [];

  for (const card of formattedTcgdex) {
    const key = createCanonicalCardKey(card);
    canonicalMap.set(key, card);
    finalMergedList.push(card);
  }

  for (const ptcgCard of ptcgIoFormattedCards) {
    const key = createCanonicalCardKey(ptcgCard);
    const existing = canonicalMap.get(key);

    if (existing) {
      if (!existing.image && ptcgCard.image) {
        existing.image = ptcgCard.image;
      }
      if (existing.priceUsd === 0 && ptcgCard.priceUsd > 0) {
        existing.priceUsd = ptcgCard.priceUsd;
        existing.priceSource = ptcgCard.priceSource;
        existing.variants = ptcgCard.variants;
        existing.variantPrices = ptcgCard.variantPrices;
        existing.priceLoaded = true;
        cardDetailCache.set(existing.id, {
          rarity: ptcgCard.rarity !== "Estándar" ? ptcgCard.rarity : existing.rarity,
          setName: existing.setName,
          setOfficialCount: existing.setOfficialCount || ptcgCard.setOfficialCount,
          image: existing.image,
          priceUsd: ptcgCard.priceUsd,
          priceSource: ptcgCard.priceSource,
          variants: ptcgCard.variants,
          variantPrices: ptcgCard.variantPrices,
          priceLoaded: true,
        });
      }
      if (existing.rarity === "Estándar" && ptcgCard.rarity !== "Estándar") {
        existing.rarity = ptcgCard.rarity;
      }
    } else {
      canonicalMap.set(key, ptcgCard);
      finalMergedList.push(ptcgCard);
    }
  }

  queryCardsCache.set(normalizedKey, finalMergedList);
  return finalMergedList;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  if (action === "tcgfans") {
    const name = (searchParams.get("name") || "").trim();
    const number = (searchParams.get("number") || "").trim();
    const mode = searchParams.get("mode") || "exact";

    const searchQuery = mode === "nameOnly" ? name : `${name} ${number}`.trim();
    const targetSearchUrl = `https://tcg.fans/pokemon/search?query=${encodeURIComponent(searchQuery)}`;

    return NextResponse.redirect(targetSearchUrl);
  }

  await ensureSetsCatalog();

  if (action === "sets") {
    const sets = cachedSetsList || [];
    return NextResponse.json({ sets: [...sets].reverse() });
  }

  const criteriaParam = searchParams.get("criteria") || searchParams.get("pokemon") || "";
  const criteriaList = criteriaParam
    .split(",")
    .map((s) => s.trim())
    .filter(
      (s) =>
        Boolean(s) &&
        !s.toUpperCase().startsWith("HIST:") &&
        !s.toUpperCase().startsWith("COST:") &&
        !s.toUpperCase().startsWith("TRADE:")
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
    const batchSize = 20;
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
    .slice(0, 45)
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
        variantPrices: cached.variantPrices || c.variantPrices || {},
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