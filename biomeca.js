/* Bizon Training — moteur de mesure du geste de tir.
   Module autonome : aucune dépendance au reste de l'application.
   Utilisé par test-biomeca.html, et destiné à être appelé par index.html.

   Usage :
     import { analyserVideo, VERSION } from './biomeca.js';
     const r = await analyserVideo(elementVideo, { main:'D' });

   Tout le calcul se fait sur l'appareil. Rien n'est envoyé nulle part. */

export const VERSION = 'biomeca-1';

const CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODELE = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/' +
               'pose_landmarker_full/float16/1/pose_landmarker_full.task';

/* ------------------------------------------------------------------ points */
export const P = { nez:0, epG:11, epD:12, coG:13, coD:14, poG:15, poD:16,
                   idxG:19, idxD:20, haG:23, haD:24, geG:25, geD:26, chG:27, chD:28,
                   talG:29, talD:30, piedG:31, piedD:32 };

/* ------------------------------------------------------------- géométrie */
export function angle(a, b, c) {              // angle en b, en degrés, en 3D
  const u = [a.x-b.x, a.y-b.y, a.z-b.z];
  const w = [c.x-b.x, c.y-b.y, c.z-b.z];
  const d = u[0]*w[0] + u[1]*w[1] + u[2]*w[2];
  const n = Math.hypot(...u) * Math.hypot(...w);
  return n ? Math.acos(Math.max(-1, Math.min(1, d/n))) * 180/Math.PI : NaN;
}
export const ecart = (a, b) => Math.hypot(a.x-b.x, a.y-b.y, (a.z||0)-(b.z||0));

const moyenne = t => t.reduce((s,x)=>s+x, 0) / (t.length || 1);
const ecartType = t => {
  if (t.length < 2) return NaN;
  const m = moyenne(t);
  return Math.sqrt(moyenne(t.map(x => (x-m)*(x-m))));
};

const MODELE_LEGER = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/' +
                     'pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

/* ----------------------------------------------------------------- modèle */
/* Deux variantes : 'complet' pour l'analyse d'une vidéo déjà enregistrée,
   'leger' pour le direct, où il faut tenir la cadence sur un téléphone. */
const _poses = {};
export async function chargerModele(surAvancement, variante) {
  const v = variante === 'leger' ? 'leger' : 'complet';
  if (_poses[v]) return _poses[v];
  if (surAvancement) surAvancement('Chargement du modèle…');
  const m = await import(CDN);
  const vision = await m.FilesetResolver.forVisionTasks(CDN + '/wasm');
  _poses[v] = await m.PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: v === 'leger' ? MODELE_LEGER : MODELE, delegate: 'GPU' },
    runningMode: 'VIDEO', numPoses: 1, minPoseDetectionConfidence: 0.5
  });
  return _poses[v];
}

/* --------------------------------------------------- lecture de la vidéo */
async function lireImages(video, surAvancement) {
  const pl = await chargerModele(surAvancement);
  const images = [];
  let vus = 0, complets = 0;

  if (video.readyState < 1) await new Promise(r => video.onloadedmetadata = r);
  video.muted = true;
  video.currentTime = 0;
  await video.play().catch(() => {});

  await new Promise(fin => {
    const pas = () => {
      if (video.ended || video.currentTime >= video.duration - 0.02) return fin();
      let r = null;
      try { r = pl.detectForVideo(video, performance.now()); } catch (_) {}
      if (r && r.landmarks && r.landmarks[0]) {
        const n = r.landmarks[0];
        vus++;
        // le joueur est-il entier dans le cadre ?
        const requis = [P.epG, P.epD, P.haG, P.haD, P.chG, P.chD, P.poG, P.poD];
        const entier = requis.every(i => (n[i].visibility ?? 1) > 0.5 &&
                                          n[i].y > -0.02 && n[i].y < 1.02 &&
                                          n[i].x > -0.02 && n[i].x < 1.02);
        if (entier) complets++;
        images.push({ t: video.currentTime, n,
                      w: (r.worldLandmarks && r.worldLandmarks[0]) || n, entier });
      }
      if (surAvancement && video.duration)
        surAvancement(null, video.currentTime / video.duration);
      if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(pas);
      else setTimeout(pas, 33);
    };
    if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(pas);
    else setTimeout(pas, 33);
  });
  video.pause();
  return { images, cadrage: vus ? complets / vus : 0 };
}

/* ------------------------------------- repérage des tirs dans la séquence */
/* Un tir = sommet du poignet de tir (y minimal), isolé des autres d'au moins
   0,7 s, et suffisamment marqué par rapport au reste du mouvement. */
function repererTirs(images, poignet, hauteurCorps) {
  const y = images.map(f => f.n[poignet].y);
  const t = images.map(f => f.t);
  const fenetre = 0.35, ecartMin = 0.7, saillieMin = 0.18 * hauteurCorps;
  const bruts = [];

  for (let i = 0; i < y.length; i++) {
    let min = Infinity, max = -Infinity, estMin = true;
    for (let j = 0; j < y.length; j++) {
      if (Math.abs(t[j] - t[i]) > fenetre) continue;
      if (y[j] < y[i] - 1e-9) estMin = false;
      if (y[j] < min) min = y[j];
      if (y[j] > max) max = y[j];
    }
    if (estMin && (max - y[i]) >= saillieMin) bruts.push(i);
  }
  // fusionner les sommets trop rapprochés : on garde le plus haut
  const gardes = [];
  for (const i of bruts) {
    const dernier = gardes[gardes.length - 1];
    if (dernier !== undefined && t[i] - t[dernier] < ecartMin) {
      if (y[i] < y[dernier]) gardes[gardes.length - 1] = i;
    } else gardes.push(i);
  }
  return gardes;
}

/* ---------------------------------------------------- phases du tir */
/* La grille de Williams ne note pas un instant : elle note une posture,
   un chargement, une montée, un relâcher, un follow-through, une retombée.
   On découpe donc le geste avant de mesurer quoi que ce soit.            */
export function phasesDuTir(images, iR, cote) {
  const { ge, ha, ch } = cote;
  const genou = i => angle(images[i].w[ha], images[i].w[ge], images[i].w[ch]);

  // flexion maximale (genou le plus fermé) dans la seconde et demie avant le relâcher
  let iF = Math.max(0, iR - 1), flexionMax = Infinity;
  for (let i = iR; i >= 0 && images[iR].t - images[i].t <= 1.5; i--) {
    const a = genou(i);
    if (isFinite(a) && a < flexionMax) { flexionMax = a; iF = i; }
  }
  // posture de départ : genou le plus ouvert avant la descente
  let iD = iF, repos = -Infinity;
  for (let i = iF; i >= 0 && images[iF].t - images[i].t <= 1.8; i--) {
    const a = genou(i);
    if (isFinite(a) && a > repos) { repos = a; iD = i; }
  }
  // fin de la poussée : le genou a retrouvé 90 % de son amplitude
  let iPoussee = iF;
  const seuil = flexionMax + 0.9 * (repos - flexionMax);
  for (let i = iF; i <= iR; i++) { if (genou(i) >= seuil) { iPoussee = i; break; } }

  let iFT = iR, iFin = iR;
  while (iFT  < images.length - 1 && images[iFT].t  - images[iR].t < 0.60) iFT++;
  while (iFin < images.length - 1 && images[iFin].t - images[iR].t < 1.40) iFin++;

  return { iD, iF, iPoussee, iR, iFT, iFin, reposGenou: repos, flexionMax };
}

/* ------------------------------------------------- mesures pour un tir */
function mesurerTir(images, iR, cote) {
  const R = images[iR];
  const { po, co, ep, ix, poAutre, ge, ha, ch } = cote;

  const ph = phasesDuTir(images, iR, cote);
  const iF = ph.iF, flexionMin = ph.flexionMax;
  const D = images[ph.iD], FT = images[ph.iFT], FIN = images[ph.iFin];

  // un quart de seconde après le relâcher, pour le suivi du geste
  let iA = iR;
  while (iA < images.length - 1 && images[iA].t - R.t < 0.25) iA++;
  const A = images[iA];

  const larg = ecart(R.w[P.epG], R.w[P.epD]) || 1;
  const haut = Math.abs((R.n[P.chG].y + R.n[P.chD].y)/2 -
                        (R.n[P.epG].y + R.n[P.epD].y)/2) || 1;
  const hanches = f => (f.n[P.haG].x + f.n[P.haD].x) / 2;

  // axe du finish : le poignet de tir finit-il dans l'axe du corps ?
  const axeChevilles = (R.w[P.chG].x + R.w[P.chD].x) / 2;

  /* ---- posture de départ ---- */
  const dirPied = (f, tal, pied) => {
    const a = f.w[tal], b = f.w[pied];
    if (!a || !b) return NaN;
    return Math.atan2(b.z - a.z, b.x - a.x) * 180 / Math.PI;
  };
  let ouverturePieds = Math.abs(dirPied(D, P.talG, P.piedG) - dirPied(D, P.talD, P.piedD));
  if (isFinite(ouverturePieds)) { ouverturePieds %= 360; if (ouverturePieds > 180) ouverturePieds = 360 - ouverturePieds; }

  const largD = ecart(D.w[P.epG], D.w[P.epD]) || larg;
  const milieu = (a, b) => (a + b) / 2;
  const poidsLateral = Math.abs(milieu(D.w[P.haG].x, D.w[P.haD].x) - milieu(D.w[P.chG].x, D.w[P.chD].x)) / largD;

  /* ---- chargement ---- */
  const G = images[iF];
  const valgus = (geI, haI, chI) => {
    const h = G.w[haI], k = G.w[geI], c = G.w[chI];
    const p = (c.y - h.y) ? (k.y - h.y) / (c.y - h.y) : 0.5;
    return Math.abs(k.x - (h.x + p * (c.x - h.x))) / largD;
  };
  const genouxValgus = Math.max(valgus(P.geG, P.haG, P.chG), valgus(P.geD, P.haD, P.chD));
  const poidsCharge = Math.abs(milieu(G.w[P.haG].x, G.w[P.haD].x) - milieu(G.w[P.chG].x, G.w[P.chD].x)) / largD;

  /* ---- montée : les jambes finissent-elles avant le bras ? ---- */
  const synchro = R.t - images[ph.iPoussee].t;

  /* ---- relâcher : avant-bras vertical ---- */
  const avB = { x: R.w[po].x - R.w[co].x, y: R.w[po].y - R.w[co].y, z: R.w[po].z - R.w[co].z };
  const nAvB = Math.hypot(avB.x, avB.y, avB.z);
  const avantBras = nAvB ? Math.acos(Math.max(-1, Math.min(1, -avB.y / nAvB))) * 180 / Math.PI : NaN;

  /* ---- follow-through ---- */
  const coudeHaut = (FT.n[ep].y - FT.n[co].y) / haut;
  let maintien = 0;
  for (let i = iR; i < images.length; i++) {
    if (images[i].n[po].y > images[i].n[ep].y) break;
    maintien = images[i].t - R.t;
  }

  /* ---- retombée ---- */
  let stabilite = 0;
  const refX = milieu(FT.n[P.haG].x, FT.n[P.haD].x);
  for (let i = ph.iFT; i <= ph.iFin; i++) {
    stabilite = Math.max(stabilite, Math.abs(milieu(images[i].n[P.haG].x, images[i].n[P.haD].x) - refX) / haut);
  }

  /* ---- mouvements parasites pendant la montée ---- */
  let parasites = 0;
  const incl = i => Math.atan2(images[i].w[P.epD].y - images[i].w[P.epG].y,
                               images[i].w[P.epD].x - images[i].w[P.epG].x) * 180 / Math.PI;
  let mn = Infinity, mx = -Infinity;
  for (let i = iF; i <= iR; i++) { const a = incl(i); if (a < mn) mn = a; if (a > mx) mx = a; }
  if (isFinite(mn) && isFinite(mx)) parasites = mx - mn;

  return {
    t:           +R.t.toFixed(2),
    // posture de départ
    ouverturePieds, poidsLateral,
    postureGenou: ph.reposGenou,
    // chargement
    genouxValgus, poidsCharge,
    descenteDuree: images[iF].t - images[ph.iD].t,
    // montée
    synchro, parasites,
    // relâcher
    avantBras,
    // follow-through et retombée
    coudeHaut, maintien, stabilite,
    extension:   angle(R.w[ep], R.w[co], R.w[po]),                 // degrés
    ecartCoude:  Math.abs(R.w[co].x - R.w[ep].x) / larg,           // ratio
    appuis:      ecart(R.w[P.chG], R.w[P.chD]) / larg,             // ratio
    derive:      Math.abs(hanches(A) - hanches(images[iF])) / haut,// ratio
    mainGuide:   ecart(A.w[poAutre], R.w[poAutre]) / larg,         // ratio
    poignet:     angle(A.w[co], A.w[po], A.w[ix]),                 // degrés
    hauteurRel:  (R.n[ep].y - R.n[po].y) / haut,                   // ratio
    axeFinish:   Math.abs(A.w[po].x - axeChevilles) / larg,        // ratio
    duree:       R.t - images[iF].t,                               // secondes
    flexion:     flexionMin,                                       // degrés
    cadrageOk:   R.entier
  };
}

/* ------------------------------------------------------------- seuils */
/* Valeurs de départ, volontairement génériques. Elles ont vocation à être
   remplacées par les seuils calibrés sur les notes de Williams. */
/* Les seuils marqués « à caler » sont des valeurs de départ, à remplacer par
   celles de Williams une fois qu'il aura corrigé quelques dizaines de tirs. */
export const SEUILS = {
  // ---- posture de départ ----
  appuis:         { min: 0.85, max: 1.35, phase: 'posture', libelle: 'Largeur des appuis', unite: '%', pourcent: true },
  ouverturePieds: { max: 30, phase: 'posture', libelle: 'Orientation des pieds', unite: '°', acaler: true },
  postureGenou:   { min: 150, max: 174, phase: 'posture', libelle: 'Flexion des genoux au départ', unite: '°', acaler: true },
  poidsLateral:   { max: 0.12, phase: 'posture', libelle: 'Poids centré sur les appuis', unite: '%', pourcent: true, acaler: true },
  // ---- chargement ----
  flexion:        { phase: 'chargement', libelle: 'Flexion maximale des genoux', unite: '°' },
  genouxValgus:   { max: 0.12, phase: 'chargement', libelle: 'Genoux dans l\'axe', unite: '%', pourcent: true, acaler: true },
  poidsCharge:    { max: 0.14, phase: 'chargement', libelle: 'Répartition du poids en charge', unite: '%', pourcent: true, acaler: true },
  descenteDuree:  { phase: 'chargement', libelle: 'Durée de la descente', unite: 's' },
  // ---- montée ----
  synchro:        { min: 0, max: 0.30, phase: 'montee', libelle: 'Jambes finies avant le bras', unite: 's', acaler: true },
  parasites:      { max: 8, phase: 'montee', libelle: 'Mouvements parasites des épaules', unite: '°', acaler: true },
  duree:          { phase: 'montee', libelle: 'Durée du geste' , unite: 's' },
  // ---- relâcher ----
  extension:      { min: 160, phase: 'relacher', libelle: 'Extension du bras au relâcher', unite: '°' },
  ecartCoude:     { max: 0.22, phase: 'relacher', libelle: 'Coude sous le ballon', unite: '%', pourcent: true },
  avantBras:      { max: 15, phase: 'relacher', libelle: 'Avant-bras vertical', unite: '°', acaler: true },
  mainGuide:      { max: 0.25, phase: 'relacher', libelle: 'Poussée de la main guide', unite: '%', pourcent: true },
  hauteurRel:     { phase: 'relacher', libelle: 'Hauteur du relâcher', unite: '%', pourcent: true },
  // ---- follow-through ----
  poignet:        { max: 150, phase: 'follow', libelle: 'Cassure du poignet', unite: '°' },
  coudeHaut:      { min: 0, phase: 'follow', libelle: 'Coude terminé haut', unite: '%', pourcent: true, acaler: true },
  maintien:       { min: 0.8, phase: 'follow', libelle: 'Maintien de la position', unite: 's', acaler: true },
  axeFinish:      { max: 0.25, phase: 'follow', libelle: 'Finish dans l\'axe du corps', unite: '%', pourcent: true },
  // ---- retombée ----
  derive:         { max: 0.10, phase: 'retombee', libelle: 'Dérive à la retombée', unite: '%', pourcent: true },
  stabilite:      { max: 0.08, phase: 'retombee', libelle: 'Stabilité après le tir', unite: '%', pourcent: true, acaler: true }
};

export const PHASES = {
  posture:    { label: 'Posture de départ', ordre: 1 },
  chargement: { label: 'Chargement', ordre: 2 },
  montee:     { label: 'Montée', ordre: 3 },
  relacher:   { label: 'Relâcher', ordre: 4 },
  follow:     { label: 'Follow-through', ordre: 5 },
  retombee:   { label: 'Retombée', ordre: 6 }
};

/* ================================================================== 360°
   Une mesure n'est pas également fiable sous tous les angles : un coude
   écarté ne se voit pas de profil, une main guide qui pousse ne se voit pas
   du côté du bras de tir. On le dit, au lieu de faire semblant.
   'bonne'   : le mouvement se fait dans le plan filmé
   'estimee' : reconstitué en 3D, moins sûr
   'nulle'   : le corps cache le mouvement, on ne retient pas la valeur   */

export const ANGLES = {
  face: { label: 'Face', ordre: 1,
    consigne: 'Pose le téléphone face au joueur, dos au panier, à 3 ou 4 mètres.' },
  cote_tir: { label: 'Côté main de tir', ordre: 2,
    consigne: 'Déplace le téléphone sur le côté de sa main de tir, de profil.' },
  cote_oppose: { label: 'Côté opposé', ordre: 3,
    consigne: 'Passe de l’autre côté, toujours de profil.' },
  derriere: { label: 'Derrière', ordre: 4,
    consigne: 'Place-toi derrière le joueur, dans l’axe du panier.' }
};

const FRONTAL  = { face:'bonne', derriere:'bonne', cote_tir:'nulle',   cote_oppose:'nulle' };
const SAGITTAL = { cote_tir:'bonne', cote_oppose:'bonne', face:'estimee', derriere:'estimee' };
const TEMPOREL = { face:'bonne', derriere:'bonne', cote_tir:'bonne', cote_oppose:'bonne' };

export const FIABILITE = {
  appuis:         FRONTAL,
  ouverturePieds: FRONTAL,
  postureGenou:   SAGITTAL,
  poidsLateral:   FRONTAL,
  flexion:        SAGITTAL,
  genouxValgus:   FRONTAL,
  poidsCharge:    FRONTAL,
  descenteDuree:  TEMPOREL,
  synchro:        TEMPOREL,
  parasites:      { face:'bonne', derriere:'bonne', cote_tir:'estimee', cote_oppose:'estimee' },
  duree:          TEMPOREL,
  extension:      { cote_tir:'bonne', cote_oppose:'estimee', face:'estimee', derriere:'estimee' },
  ecartCoude:     FRONTAL,
  avantBras:      { cote_tir:'bonne', cote_oppose:'estimee', face:'estimee', derriere:'estimee' },
  mainGuide:      { cote_oppose:'bonne', face:'bonne', derriere:'estimee', cote_tir:'nulle' },
  hauteurRel:     TEMPOREL,
  poignet:        { cote_tir:'bonne', cote_oppose:'estimee', face:'estimee', derriere:'estimee' },
  coudeHaut:      { cote_tir:'bonne', cote_oppose:'bonne', face:'estimee', derriere:'estimee' },
  maintien:       TEMPOREL,
  axeFinish:      FRONTAL,
  derive:         TEMPOREL,
  stabilite:      TEMPOREL
};

export function fiabilite(cle, angle) {
  const f = FIABILITE[cle];
  return (f && f[angle]) || 'estimee';
}

/* séries = [{ angle:'face', tirs:[...] }, ...]
   Pour chaque mesure on ne retient que les angles où elle est fiable ;
   à défaut, les angles où elle est estimée. On dit toujours d'où vient
   le chiffre et sur combien de tirs il repose. */
export function bilan360(series) {
  const out = {};
  for (const cle of Object.keys(SEUILS)) {
    for (const niveau of ['bonne', 'estimee']) {
      const vals = [], angles = [];
      for (const s of series) {
        if (fiabilite(cle, s.angle) !== niveau) continue;
        const v = (s.tirs || []).map(t => t[cle]).filter(isFinite);
        if (!v.length) continue;
        vals.push(...v);
        angles.push(s.angle);
      }
      if (!vals.length) continue;
      const avis = vals.map(v => juger(cle, v)).filter(a => a !== null);
      out[cle] = {
        moyenne: moyenne(vals), min: Math.min(...vals), max: Math.max(...vals),
        ecartType: ecartType(vals), nbTirs: vals.length,
        dans: avis.filter(Boolean).length, juges: avis.length,
        niveau, angles
      };
      break;
    }
  }
  return out;
}

/* Dérive de fatigue : le geste du dernier tiers ressemble-t-il encore au
   premier ? Les tirs doivent être fournis dans l'ordre chronologique. */
export function fatigue(tirs) {
  const ext = tirs.map(t => t.extension).filter(isFinite);
  const dur = tirs.map(t => t.duree).filter(isFinite);
  if (ext.length < 9) return null;
  const n = Math.max(3, Math.floor(ext.length / 3));
  const debut = ext.slice(0, n), fin = ext.slice(-n);
  const dDebut = dur.slice(0, n), dFin = dur.slice(-n);
  return {
    tirsCompares: n,
    extensionDebut: moyenne(debut),
    extensionFin: moyenne(fin),
    extensionDelta: moyenne(fin) - moyenne(debut),
    dureeDelta: moyenne(dFin) - moyenne(dDebut)
  };
}

export function juger(cle, valeur) {
  const s = SEUILS[cle];
  if (!s || !isFinite(valeur)) return null;            // null = pas d'avis
  if (s.min !== undefined && valeur < s.min) return false;
  if (s.max !== undefined && valeur > s.max) return false;
  if (s.min === undefined && s.max === undefined) return null;
  return true;
}

/* -------------------------------------------- côté du corps qui tire */
export function coteDe(main) {
  return main === 'G'
    ? { po:P.poG, co:P.coG, ep:P.epG, ix:P.idxG, poAutre:P.poD, ge:P.geG, ha:P.haG, ch:P.chG }
    : { po:P.poD, co:P.coD, ep:P.epD, ix:P.idxD, poAutre:P.poG, ge:P.geD, ha:P.haD, ch:P.chD };
}

/* ------------------------------------------------- séance en direct */
/* Même logique de mesure que pour une vidéo, mais au fil de l'eau :
   on garde trois secondes d'images en mémoire et on décide qu'un tir a eu
   lieu une fois qu'on a vu la suite du geste. Rien n'est enregistré. */
export function creerSeance(main) {
  const cot = coteDe(main);
  const images = [];
  let dernierTir = -99;

  return {
    tirs: [],
    /* renvoie les mesures du tir quand un tir vient d'être reconnu, sinon null */
    ajouter(landmarks, world, t) {
      images.push({ t, n: landmarks, w: world || landmarks, entier: true });
      while (images.length && t - images[0].t > 3) images.shift();
      if (images.length < 12 || t - images[0].t < 0.8) return null;

      // on examine l'image d'il y a 0,30 s : on connaît ce qui précède et ce qui suit
      let c = 0, meilleur = 1e9;
      for (let i = 0; i < images.length; i++) {
        const d = Math.abs((t - 0.30) - images[i].t);
        if (d < meilleur) { meilleur = d; c = i; }
      }
      if (images[c].t - dernierTir < 0.8) return null;

      const yc = images[c].n[cot.po].y;
      let min = Infinity, max = -Infinity, estMin = true;
      for (let i = 0; i < images.length; i++) {
        if (Math.abs(images[i].t - images[c].t) > 0.30) continue;
        const y = images[i].n[cot.po].y;
        if (y < yc - 1e-9) estMin = false;
        if (y < min) min = y;
        if (y > max) max = y;
      }
      if (!estMin) return null;

      const haut = Math.abs((images[c].n[P.chG].y + images[c].n[P.chD].y) / 2 -
                            (images[c].n[P.epG].y + images[c].n[P.epD].y) / 2) || 0.4;
      if ((max - yc) < 0.18 * haut) return null;

      dernierTir = images[c].t;
      const m = mesurerTir(images, c, cot);
      this.tirs.push(m);
      return m;
    }
  };
}

/* --------------------------------------------------------- point d'entrée */
export async function analyserVideo(video, options = {}) {
  const main = options.main === 'G' ? 'G' : 'D';
  const surAvancement = options.surAvancement;

  const { images, cadrage } = await lireImages(video, surAvancement);
  if (images.length < 8) {
    return { erreur: 'joueur_non_detecte', images: images.length, cadrage };
  }

  const cote = coteDe(main);

  const ref = images[Math.floor(images.length/2)];
  const hauteurCorps = Math.abs((ref.n[P.chG].y + ref.n[P.chD].y)/2 -
                                (ref.n[P.epG].y + ref.n[P.epD].y)/2) || 0.4;

  let sommets = repererTirs(images, cote.po, hauteurCorps);
  if (!sommets.length) {                       // repli : le point le plus haut
    let i = 0;
    for (let j = 1; j < images.length; j++)
      if (images[j].n[cote.po].y < images[i].n[cote.po].y) i = j;
    sommets = [i];
  }

  const tirs = sommets.map(i => ({ ...mesurerTir(images, i, cote), image: i }));

  // régularité : seulement si plusieurs tirs exploitables
  const bons = tirs.filter(t => isFinite(t.extension) && isFinite(t.duree));
  const regularite = bons.length >= 3 ? {
    nbTirs: bons.length,
    extensionEcartType: ecartType(bons.map(t => t.extension)),
    dureeEcartType: ecartType(bons.map(t => t.duree)),
    dureeMoyenne: moyenne(bons.map(t => t.duree))
  } : null;

  return {
    version: VERSION, main,
    images, tirs, regularite,
    qualite: {
      cadrage,                                   // part d'images où le joueur est entier
      suffisant: cadrage >= 0.7,
      message: cadrage >= 0.7 ? null
        : 'Le joueur sort du cadre sur une partie de la vidéo : filme-le en entier, pieds compris.'
    }
  };
}

/* ============================================ grille de Williams
   Les 47 critères de la fiche d'auto-évaluation du lancer franc, dans
   l'ordre de la fiche. `mesure` dit quelle mesure automatique l'éclaire ;
   `manque` dit ce qu'il faudrait pour les critères encore hors de portée :
   'ballon' (suivi du ballon), 'mains' (21 points par main), 'coach' (l'œil). */
export const GRILLE = [
  ['Posture de départ', 'Appuis équilibrés', 'appuis'],
  ['Posture de départ', 'Orientation des pieds', 'ouverturePieds'],
  ['Posture de départ', 'Flexion des genoux', 'postureGenou'],
  ['Footwork de mise en place', 'Routine identique à chaque tir', 'routine'],
  ['Footwork de mise en place', 'Placement des pieds', 'poidsLateral'],
  ['Footwork de mise en place', 'Maîtrise de la stabilisation', 'parasites'],
  ['Dribble de préparation', 'Nombre de dribbles constant', null, 'ballon'],
  ['Dribble de préparation', 'Hauteur du dribble', null, 'ballon'],
  ['Dribble de préparation', 'Contrôle de la main', null, 'mains'],
  ['Dribble de préparation', 'Position du poignet', null, 'mains'],
  ['Dribble de préparation', 'Position du coude', null, 'mains'],
  ['Attraper / Placement', 'Prise de balle propre', null, 'mains'],
  ['Attraper / Placement', 'Verrouillage de la main de tir', null, 'mains'],
  ['Attraper / Placement', 'Main guide correctement placée', 'mainGuide'],
  ['Footwork de chargement', 'Répartition du poids', 'poidsCharge'],
  ['Footwork de chargement', 'Positionnement des genoux', 'genouxValgus'],
  ['Footwork de chargement', 'Équilibre général', 'derive'],
  ['Alignement du bras de tir', 'Coude sous le ballon', 'ecartCoude'],
  ['Alignement du bras de tir', 'Avant-bras vertical', 'avantBras'],
  ['Alignement du bras de tir', 'Alignement ballon-coude-panier', null, 'ballon'],
  ['Squat TDF V1', 'Descente contrôlée', 'descenteDuree'],
  ['Squat TDF V1', 'Maintien de l\'équilibre', 'poidsCharge'],
  ['Squat TDF V1', 'Création de force vers le haut', 'flexion'],
  ['Squat TDF V2', 'Synchronisation pieds-jambes-bras', 'synchro'],
  ['Squat TDF V2', 'Fluidité du mouvement', 'duree'],
  ['Squat TDF V2', 'Transfert d\'énergie', 'synchro'],
  ['Lancer du coude', 'Extension du coude', 'extension'],
  ['Lancer du coude', 'Direction du mouvement', 'axeFinish'],
  ['Lancer du coude', 'Stabilité de l\'épaule', 'parasites'],
  ['Lancer de la main', 'Cassure du poignet', 'poignet'],
  ['Lancer de la main', 'Doigts orientés vers le cercle', null, 'mains'],
  ['Lancer de la main', 'Sortie de balle propre', null, 'ballon'],
  ['Stabilisation', 'Corps stable', 'stabilite'],
  ['Stabilisation', 'Aucun mouvement parasite', 'parasites'],
  ['Stabilisation', 'Équilibre jusqu\'à la sortie de balle', 'derive'],
  ['Finalisation', 'Extension complète', 'extension'],
  ['Finalisation', 'Maintien de la position', 'maintien'],
  ['Finalisation', 'Regard fixé sur la cible', null, 'coach'],
  ['Relâchement (Follow Through)', 'Main dans le cercle', null, 'ballon'],
  ['Relâchement (Follow Through)', 'Coude terminé haut', 'coudeHaut'],
  ['Relâchement (Follow Through)', 'Maintien 1 à 2 secondes', 'maintien'],
  ['Évaluation du résultat', 'Trajectoire de balle', null, 'ballon'],
  ['Évaluation du résultat', 'Rotation de balle', null, 'ballon'],
  ['Évaluation du résultat', 'Précision du tir', null, 'ballon'],
  ['Posture finale', 'Position des pieds', 'appuis'],
  ['Posture finale', 'Alignement du corps', 'stabilite'],
  ['Posture finale', 'Position finale du bras de tir', 'coudeHaut'],
  ['Posture finale', 'Équilibre général après le tir', 'derive']
].map(([etape, critere, mesure, manque]) => ({ etape, critere, mesure: mesure || null, manque: manque || null }));

/* Note sur 5 proposée à partir d'une mesure. Williams garde la main :
   c'est une suggestion, pas un verdict. */
export function noteSuggeree(cle, valeur) {
  const s = SEUILS[cle];
  if (!s || !isFinite(valeur)) return null;
  const aMin = s.min !== undefined, aMax = s.max !== undefined;
  if (!aMin && !aMax) return null;

  let dehors = 0, marge = 1;
  if (aMin && aMax) {
    const l = s.max - s.min;
    if (valeur < s.min) dehors = (s.min - valeur) / l;
    else if (valeur > s.max) dehors = (valeur - s.max) / l;
    else marge = Math.min(valeur - s.min, s.max - valeur) / (l / 2);
  } else if (aMin) {
    const b = Math.abs(s.min) || 1;
    if (valeur < s.min) dehors = (s.min - valeur) / b;
    else marge = Math.min(1, (valeur - s.min) / (0.06 * b));
  } else {
    const b = Math.abs(s.max) || 1;
    if (valeur > s.max) dehors = (valeur - s.max) / b;
    else marge = Math.min(1, (s.max - valeur) / (0.35 * b));
  }
  if (dehors === 0) return marge >= 0.35 ? 5 : 4;
  if (dehors <= 0.15) return 3;
  if (dehors <= 0.40) return 2;
  return 1;
}

/* Remplit la grille à partir d'un bilan 360 (ou d'une moyenne de série).
   `mesures` = sortie de bilan360() ou de moyennes(). */
export function remplirGrille(mesures, extras) {
  const e = extras || {};
  return GRILLE.map(g => {
    const ligne = { etape: g.etape, critere: g.critere, mesure: g.mesure,
                    manque: g.manque, valeur: null, note: null,
                    angles: null, niveau: null, acaler: false };
    if (!g.mesure) return ligne;
    if (g.mesure === 'routine') {
      if (e.routine === undefined || e.routine === null) return ligne;
      ligne.valeur = e.routine;
      ligne.note = e.routine <= 4 ? 5 : (e.routine <= 6 ? 4 : (e.routine <= 9 ? 3 : (e.routine <= 13 ? 2 : 1)));
      ligne.acaler = true;
      return ligne;
    }
    const m = mesures && mesures[g.mesure];
    if (!m) return ligne;
    ligne.valeur = m.moyenne;
    ligne.note = noteSuggeree(g.mesure, m.moyenne);
    ligne.angles = m.angles || null;
    ligne.niveau = m.niveau || null;
    ligne.acaler = !!(SEUILS[g.mesure] && SEUILS[g.mesure].acaler);
    return ligne;
  });
}

/* ------------------------------------------------ moyenne sur la série */
/* Moyenne de chaque mesure sur TOUS les tirs détectés, qu'ils soient
   marqués ou ratés : on mesure le geste, pas le résultat. Pour chaque
   mesure on renvoie aussi combien de tirs sont dans la cible. */
export function moyennes(r) {
  if (!r || r.erreur) return null;
  const out = {};
  for (const cle of Object.keys(SEUILS)) {
    const vals = r.tirs.map(t => t[cle]).filter(isFinite);
    if (!vals.length) continue;
    const avis = r.tirs.map(t => juger(cle, t[cle])).filter(a => a !== null);
    out[cle] = {
      moyenne: moyenne(vals),
      min: Math.min(...vals),
      max: Math.max(...vals),
      ecartType: ecartType(vals),
      dans: avis.filter(Boolean).length,
      juges: avis.length,
      total: r.tirs.length
    };
  }
  return out;
}

/* ------------------------------------------- résumé prêt à être stocké */
/* Ce que l'application enverra à Supabase : des nombres, jamais d'image. */
export function resume(r) {
  if (!r || r.erreur) return null;
  const moy = moyennes(r) || {};
  const m = {}, conf = {};
  for (const [cle, v] of Object.entries(moy)) {
    m[cle] = +v.moyenne.toFixed(3);
    if (v.juges) conf[cle] = v.dans + '/' + v.juges;
  }
  return {
    version: r.version,
    main: r.main,
    nb_tirs: r.tirs.length,
    cadrage: +r.qualite.cadrage.toFixed(2),
    moyennes: m,
    tirs_dans_la_cible: conf,
    regularite: r.regularite ? {
      extension_ecart_type: +r.regularite.extensionEcartType.toFixed(1),
      duree_ecart_type: +r.regularite.dureeEcartType.toFixed(3)
    } : null
  };
}
