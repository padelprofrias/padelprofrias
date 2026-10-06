/**
 * PadelHub data layer
 * Ligas · Torneos · Noticias · Actividades · Sponsors on Firebase RTDB
 * Fallback: demo seed in localStorage when Firebase is off
 */
const ProcupData = (() => {
  const LS_KEY = "padelhub_procup_v1";

  const DEMO = {
    config: {
      whatsappNumber: "3854413049",
      whatsappMessage: "Hola, quiero información e inscribirme a la competencia en PadelHub",
      adminEmail: "padelprofrias@gmail.com"
    },
    sponsors: [
      {
        id: "sp-1",
        nombre: "Babolat Pádel",
        tipo: "Sponsor Oficial",
        categoria: "Paletas & Pelotas Oficiales",
        logo: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=400&q=80",
        video: "",
        link: "https://babolat.com",
        descripcion: "Pelota oficial del Circuito PadelHub 2026."
      },
      {
        id: "sp-2",
        nombre: "San Miguel Pádel Club",
        tipo: "Sede Central",
        categoria: "Complejo Deportivo",
        logo: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=400&q=80",
        video: "",
        link: "https://maps.google.com",
        descripcion: "Canchas panorámicas techadas con iluminación LED profesional."
      },
      {
        id: "sp-3",
        nombre: "Bullpadel Pro",
        tipo: "Indumentaria Oficial",
        categoria: "Equipamiento Deportivo",
        logo: "https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=400&q=80",
        video: "",
        link: "https://bullpadel.com",
        descripcion: "Premios oficiales para campeones de todas las categorías."
      }
    ],
    torneos: [
      {
        id: "t-san-miguel-2026",
        nombre: "Open San Miguel Pádel 2026",
        subtitulo: "Copa Babolat & Circuito Pro",
        fecha: "24, 25 y 26 de Abril 2026",
        lugar: "San Miguel Pádel Club • Frías",
        badge: "Inscripciones Abiertas",
        estado: "INSCRIPCIONES",
        categorias: ["3ª", "4ª", "5ª", "6ª", "7ª", "Suma Libres", "Damas"],
        bolsa: "$1.500.000",
        cuposTotal: 48,
        cuposConfirmados: 44,
        esDestacado: true,
        imagen: "https://lh3.googleusercontent.com/aida-public/AB6AXuD4Y0VNtbTnWbZcG65rkVyAvhMDaGzd3ZA0aefnZH-2-230LZvi9Dtm1_2nGhCokNc9kX8bIzIBpG2eEquvjLPeqA6gNPnfILF7upHbKjiyl2yvkoCgmBSQ1FiSibVE7HdgAUTcDapP42kNdm7HRGSUEEvobBDYBw-G2Rtii9jg_nVEWLb6glKreBbpRKR4HUMiOxOencgSUP8UZIufZ5tSSVHRb-cr8Gz-wxZuOHs",
        linkWhatsapp: ""
      },
      {
        id: "t-master-series",
        nombre: "Master Series Fin de Semana",
        subtitulo: "San Miguel Pádel Club • Cancha 1",
        fecha: "En juego hoy",
        lugar: "San Miguel Pádel Club • Cancha 1 (Central)",
        badge: "En Juego Ahora",
        estado: "EN_JUEGO",
        categorias: ["5ª Libre Masculina"],
        bolsa: "$600.000",
        faseActual: "SEMIFINAL CENTRAL",
        marcadorVivo: {
          parejaA: "Gómez / Ruiz",
          scoreA: "6 · 4 · 40",
          parejaB: "Navarro / Tapia",
          scoreB: "4 · 6 · 30"
        },
        cuposTotal: 16,
        cuposConfirmados: 16,
        linkWhatsapp: ""
      },
      {
        id: "t-flash-cup",
        nombre: "Torneo Nocturno Relámpago Flash Cup",
        subtitulo: "Viernes 8 de Mayo • 19:00 a 02:00 hs",
        fecha: "8 de Mayo 2026",
        lugar: "PadelHub Central",
        badge: "Inscripciones Abiertas",
        estado: "INSCRIPCIONES",
        categorias: ["Suma 11", "6ª Damas"],
        bolsa: "$400.000 + Asado Post-Torneo",
        cuposTotal: 12,
        cuposConfirmados: 7,
        linkWhatsapp: ""
      },
      {
        id: "t-menores",
        nombre: "Torneo Provincial de Menores Sub-14 & Sub-18",
        subtitulo: "16 y 17 de Mayo 2026 • Clasificatorio FAP",
        fecha: "16 y 17 de Mayo 2026",
        lugar: "PadelHub Arena Central",
        badge: "Inscripciones Abiertas",
        estado: "INSCRIPCIONES",
        categorias: ["Sub-14", "Sub-18"],
        bolsa: "Puntos Oficiales FAP + Equipamiento",
        cuposTotal: 24,
        cuposConfirmados: 18,
        linkWhatsapp: ""
      },
      {
        id: "t-aniversario-frias",
        nombre: "Copa Aniversario Ciudad de Frías 2026",
        subtitulo: "5 al 7 de Junio 2026 • Multi-sede Frías",
        fecha: "5 al 7 de Junio 2026",
        lugar: "Multi-sede Frías",
        badge: "Próximamente - Junio",
        estado: "PROXIMO",
        categorias: ["3ª", "4ª", "5ª", "6ª", "7ª"],
        bolsa: "$2.000.000 en Premios",
        cuposTotal: 64,
        cuposConfirmados: 12,
        linkWhatsapp: ""
      },
      {
        id: "t-apertura-3",
        nombre: "Torneo Apertura Fecha #3",
        subtitulo: "Finalizado el 12 de Abril 2026",
        fecha: "12 de Abril 2026",
        lugar: "San Miguel Pádel Club",
        badge: "Finalizado",
        estado: "FINALIZADO",
        categorias: ["4ª Libre"],
        bolsa: "Trofeos & Efectivo",
        campeones: "López / Martínez (6-4, 7-5 vs Díaz / Pereyra)",
        cuposTotal: 16,
        cuposConfirmados: 16,
        linkWhatsapp: ""
      },
      {
        id: "t-master-campeones",
        nombre: "Master Cup 2026 de Campeones",
        subtitulo: "Noviembre 2026 • Estadio Central PadelHub",
        fecha: "Noviembre 2026",
        lugar: "Estadio Central PadelHub",
        badge: "Evento Anual",
        estado: "PROXIMO",
        categorias: ["Master Final Top 8"],
        bolsa: "Carbon Trophy + Pozo Especial",
        cuposTotal: 8,
        cuposConfirmados: 8,
        linkWhatsapp: ""
      }
    ],
    ligas: [
      {
        id: "liga-5ta-masc-2026",
        slug: "liga-5ta-masculina-2026",
        nombre: "Liga 5ta Categoría - Apertura",
        categoria: "5ª MASCULINA",
        rama: "MASCULINA",
        temporada: "2026 Apertura",
        sede: "San Miguel Pádel Club • Frías",
        ciudad: "Frías",
        estado: "EN_CURSO",
        formato: "Todos contra todos · 2 sets + Super TB",
        inscriptos: 12,
        faseActual: "Fecha 4 / 7",
        progreso: 57,
        lideres: "Coronel / Gómez (15 pts)",
        parejas: [
          { id: "p1", nombre: "Coronel / Gómez", pj: 6, pg: 5, pp: 1, sf: 11, sc: 3, difSets: "+8", difGames: "+24", pts: 15, racha: ["V", "V", "V", "D", "V"], statusMaster: true },
          { id: "p2", nombre: "López / Martínez", pj: 6, pg: 4, pp: 2, sf: 9, sc: 4, difSets: "+5", difGames: "+14", pts: 12, racha: ["V", "D", "V", "V", "D"], statusMaster: true },
          { id: "p3", nombre: "Morales / Díaz", pj: 5, pg: 4, pp: 1, sf: 8, sc: 2, difSets: "+6", difGames: "+18", pts: 12, racha: ["V", "V", "D", "V", "V"], statusPlayoff: true },
          { id: "p4", nombre: "Rossi / Fernández", pj: 6, pg: 3, pp: 3, sf: 6, sc: 6, difSets: "0", difGames: "+2", pts: 9, racha: ["D", "V", "D", "V", "D"] },
          { id: "p5", nombre: "Santini / Vega", pj: 5, pg: 2, pp: 3, sf: 5, sc: 7, difSets: "-2", difGames: "-5", pts: 6, racha: ["V", "D", "D", "V", "D"] },
          { id: "p6", nombre: "Baracat / Laquiz", pj: 6, pg: 1, pp: 5, sf: 3, sc: 10, difSets: "-7", difGames: "-22", pts: 3, racha: ["D", "D", "V", "D", "D"] }
        ],
        fixture: [
          { fecha: 4, parejaA: "Coronel / Gómez", parejaB: "López / Martínez", resultado: "6-4 6-3", cancha: "Cancha 1", hora: "19:00", matchCode: null },
          { fecha: 4, parejaA: "Morales / Díaz", parejaB: "Rossi / Fernández", resultado: "6-2 7-5", cancha: "Cancha 2", hora: "20:15", matchCode: null },
          { fecha: 5, parejaA: "Coronel / Gómez", parejaB: "Santini / Vega", resultado: null, cancha: "Cancha 1", hora: "Sábado 18:30", matchCode: null }
        ]
      },
      {
        id: "liga-8va-fem-2026",
        slug: "liga-8va-femenina-clausura",
        nombre: "Liga 8va Femenina - Clausura",
        categoria: "8ª FEMENINA",
        rama: "FEMENINA",
        temporada: "Inicio Septiembre 2026",
        sede: "San Miguel Pádel • Inicio Septiembre",
        ciudad: "Frías",
        estado: "INSCRIPCIONES",
        formato: "16 parejas · zonas y llave final",
        inscriptos: 10,
        cuposTotal: 16,
        cuposConfirmados: 10,
        faseActual: "Inscripciones abiertas",
        progreso: 62.5,
        lideres: "Inscripciones en curso",
        parejas: [
          { id: "pf1", nombre: "Pérez / Romero", pj: 0, pg: 0, pp: 0, sf: 0, sc: 0, difSets: "0", difGames: "0", pts: 0, racha: [] },
          { id: "pf2", nombre: "Sosa / Benítez", pj: 0, pg: 0, pp: 0, sf: 0, sc: 0, difSets: "0", difGames: "0", pts: 0, racha: [] }
        ],
        fixture: []
      },
      {
        id: "liga-4ta-masc-2026",
        slug: "liga-4ta-masculina-2026",
        nombre: "Liga 4ta Categoría Caballeros",
        categoria: "4ª MASCULINA",
        rama: "MASCULINA",
        temporada: "2026 Apertura",
        sede: "PadelHub Central & San Miguel",
        ciudad: "Frías",
        estado: "EN_CURSO",
        formato: "16 parejas · ida y vuelta",
        inscriptos: 16,
        faseActual: "Fecha 6 / 10",
        progreso: 60,
        lideres: "Tapia / Coello (Local) (24 pts)",
        parejas: [
          { id: "p41", nombre: "Tapia / Coello", pj: 8, pg: 8, pp: 0, sf: 16, sc: 2, difSets: "+14", difGames: "+40", pts: 24, racha: ["V", "V", "V", "V", "V"], statusMaster: true },
          { id: "p42", nombre: "Lebrón / Galán", pj: 8, pg: 6, pp: 2, sf: 13, sc: 5, difSets: "+8", difGames: "+20", pts: 18, racha: ["V", "V", "D", "V", "V"], statusMaster: true },
          { id: "p43", nombre: "Belasteguín / Yanguas", pj: 7, pg: 5, pp: 2, sf: 11, sc: 6, difSets: "+5", difGames: "+12", pts: 15, racha: ["V", "D", "V", "V", "D"], statusPlayoff: true }
        ],
        fixture: []
      },
      {
        id: "liga-6ta-masc-2026",
        slug: "liga-6ta-masculina-2026",
        nombre: "Liga 6ta Categoría Caballeros",
        categoria: "6ª MASCULINA",
        rama: "MASCULINA",
        temporada: "2026 Apertura",
        sede: "San Miguel Pádel Club • Frías",
        ciudad: "Frías",
        estado: "EN_CURSO",
        formato: "14 parejas · zona campeonato",
        inscriptos: 14,
        faseActual: "Próxima Fecha: Sábado 18:30",
        progreso: 50,
        lideres: "Quiroga / Navarro (15 pts)",
        parejas: [
          { id: "p61", nombre: "Quiroga / Navarro", pj: 5, pg: 5, pp: 0, sf: 10, sc: 1, difSets: "+9", difGames: "+25", pts: 15, racha: ["V", "V", "V", "V", "V"], statusMaster: true },
          { id: "p62", nombre: "Gutiérrez / Silva", pj: 5, pg: 4, pp: 1, sf: 8, sc: 3, difSets: "+5", difGames: "+15", pts: 12, racha: ["V", "V", "V", "D", "V"], statusMaster: true }
        ],
        fixture: []
      },
      {
        id: "liga-7ma-princ-2026",
        slug: "liga-7ma-principiantes-2026",
        nombre: "Liga 7ma Principiantes - Promoción",
        categoria: "7ª PRINCIPIANTES",
        rama: "MASCULINA",
        temporada: "2026 Promoción",
        sede: "Formato Fin de Semana Continuo",
        ciudad: "Frías",
        estado: "INSCRIPCIONES",
        formato: "Iniciación y competición con árbitro oficial",
        inscriptos: 8,
        cuposTotal: 12,
        cuposConfirmados: 8,
        faseActual: "Últimos 4 cupos",
        progreso: 66,
        lideres: "Inscripciones abiertas",
        parejas: [],
        fixture: []
      },
      {
        id: "liga-suma-12-mixta",
        slug: "liga-suma-12-mixta-2026",
        nombre: "Liga Suma 12 Mixta - Edición Verano",
        categoria: "SUMA 12 MIXTO",
        rama: "MIXTA",
        temporada: "Edición Verano 2026",
        sede: "San Miguel Pádel Club",
        ciudad: "Frías",
        estado: "FINALIZADA",
        formato: "Fase de grupos y cuadro eliminatorio",
        inscriptos: 12,
        faseActual: "Finalizada",
        progreso: 100,
        lideres: "Sánchez / Di Nenno (Campeones)",
        parejas: [
          { id: "pm1", nombre: "Sánchez / Di Nenno", pj: 7, pg: 7, pp: 0, sf: 14, sc: 2, difSets: "+12", difGames: "+35", pts: 21, racha: ["V", "V", "V", "V", "V"], statusMaster: true },
          { id: "pm2", nombre: "Molina / Castro", pj: 7, pg: 5, pp: 2, sf: 11, sc: 5, difSets: "+6", difGames: "+18", pts: 15, racha: ["V", "V", "D", "V", "D"] }
        ],
        fixture: []
      }
    ],
    noticias: [
      {
        id: "n1",
        titulo: "Finales con sello PadelHub",
        extracto: "Campeones, partidazos y finales cargadas de intensidad en la última jornada de competencia.",
        fecha: "2026-06-22",
        imagen: ""
      },
      {
        id: "n2",
        titulo: "Partido estelar al rojo vivo",
        extracto: "Manzanelli–Alderete y Baracat–Laquiz protagonizaron un duelo intenso en la Fecha 8.",
        fecha: "2026-06-06",
        imagen: ""
      }
    ],
    actividades: [
      {
        id: "a-invierno",
        titulo: "Open San Miguel Pádel 2026",
        fecha: "24 al 26 de Abril",
        lugar: "San Miguel Pádel Club",
        badge: "Inscripciones Abiertas",
        link: "torneos.html"
      },
      {
        id: "a1",
        titulo: "Liga 5ta Categoría - Apertura",
        fecha: "En curso",
        lugar: "San Miguel Pádel Club",
        badge: "En Juego",
        link: "ligas.html?id=liga-5ta-masc-2026"
      }
    ]
  };

  function fbReady() {
    return typeof window.padelhubFirebaseReady === "function" && window.padelhubFirebaseReady() && typeof firebase !== "undefined";
  }

  function getDb() {
    if (!fbReady()) return null;
    try {
      if (!firebase.apps.length) firebase.initializeApp(window.PADELHUB_FIREBASE);
      return firebase.database();
    } catch (e) {
      return null;
    }
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return JSON.parse(JSON.stringify(DEMO));
  }

  function saveLocal(data) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  function ensureSeed() {
    const data = loadLocal();
    if (!data.ligas || !data.ligas.length || !data.sponsors || !data.sponsors.length) {
      const merged = Object.assign({}, DEMO, data);
      if (!merged.sponsors || !merged.sponsors.length) merged.sponsors = DEMO.sponsors;
      if (!merged.torneos || !merged.torneos.length) merged.torneos = DEMO.torneos;
      if (!merged.ligas || !merged.ligas.length) merged.ligas = DEMO.ligas;
      saveLocal(merged);
      return merged;
    }
    return data;
  }

  /** Read all content (Promise) */
  function loadAll() {
    const db = getDb();
    if (!db) {
      return Promise.resolve(ensureSeed());
    }
    const timeout = new Promise(function (resolve) {
      setTimeout(function () {
        resolve(ensureSeed());
      }, 3500);
    });
    const fetchFb = db.ref("procup").once("value").then(function (snap) {
      const val = snap.val();
      if (!val || (!val.ligas && !val.torneos)) {
        // seed once to Firebase
        return db.ref("procup").set(DEMO).then(function () {
          return DEMO;
        });
      }
      // normalize arrays and config
      return {
        config: Object.assign({}, DEMO.config, val.config || {}),
        ligas: toArray(val.ligas),
        torneos: toArray(val.torneos),
        noticias: toArray(val.noticias),
        actividades: toArray(val.actividades),
        sponsors: toArray(val.sponsors || DEMO.sponsors)
      };
    }).catch(function () {
      return ensureSeed();
    });
    return Promise.race([fetchFb, timeout]);
  }

  function toArray(obj) {
    if (!obj) return [];
    if (Array.isArray(obj)) return obj;
    return Object.keys(obj).map(function (k) {
      const item = obj[k];
      if (item && !item.id) item.id = k;
      return item;
    });
  }

  function saveAll(data) {
    saveLocal(data);
    const db = getDb();
    if (!db) return Promise.resolve();
    return db.ref("procup").set(data);
  }

  function getConfig() {
    return loadAll().then(function (data) {
      return data.config || DEMO.config;
    });
  }

  function saveConfig(cfg) {
    return loadAll().then(function (data) {
      data.config = Object.assign({}, data.config || DEMO.config, cfg);
      return saveAll(data).then(function () {
        return data.config;
      });
    });
  }

  function cleanPhone(phone) {
    return String(phone || "").replace(/[^0-9]/g, "");
  }

  function buildWhatsappUrl(phone, msg) {
    const raw = cleanPhone(phone) || cleanPhone(DEMO.config.whatsappNumber);
    const text = encodeURIComponent(msg || DEMO.config.whatsappMessage);
    return "https://wa.me/" + raw + "?text=" + text;
  }

  function getLiga(idOrSlug) {
    return loadAll().then(function (data) {
      return (data.ligas || []).find(function (l) {
        return l.id === idOrSlug || l.slug === idOrSlug;
      }) || null;
    });
  }

  function upsertLiga(liga) {
    return loadAll().then(function (data) {
      const idx = data.ligas.findIndex(function (l) { return l.id === liga.id; });
      if (idx >= 0) data.ligas[idx] = liga;
      else data.ligas.unshift(liga);
      return saveAll(data).then(function () { return liga; });
    });
  }

  return {
    loadAll: loadAll,
    getLiga: getLiga,
    saveAll: saveAll,
    upsertLiga: upsertLiga,
    getConfig: getConfig,
    saveConfig: saveConfig,
    cleanPhone: cleanPhone,
    buildWhatsappUrl: buildWhatsappUrl,
    DEMO: DEMO,
    fbReady: fbReady
  };
})();
