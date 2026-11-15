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
                   idxG:19, idxD:20, haG:23, haD:24, geG:25, geD:26, chG:27, chD:28 };

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

/* ----------------------------------------------------------------- modèle */
let _pose = null;
export async function chargerModele(surAvancement) {
  if (_pose) return _pose;
  if (surAvancement) surAvancement('Chargement du modèle…');
  const m = await import(CDN);
  const vision = await m.FilesetResolver.forVisionTasks(CDN + '/wasm');
  _pose = await m.PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODELE, delegate: 'GPU' },
    runningMode: 'VIDEO', numPoses: 1, minPoseDetectionConfidence: 0.5
  });
  return _pose;
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

/* ------------------------------------------------- mesures pour un tir */
function mesurerTir(images, iR, cote) {
  const R = images[iR];
  const { po, co, ep, ix, poAutre, ge, ha, ch } = cote;

  // début du geste : flexion maximale du genou dans la seconde et demie qui précède
  let iF = Math.max(0, iR - 1), flexionMin = Infinity;
  for (let i = iR; i >= 0 && R.t - images[i].t <= 1.5; i--) {
    const a = angle(images[i].w[ha], images[i].w[ge], images[i].w[ch]);
    if (isFinite(a) && a < flexionMin) { flexionMin = a; iF = i; }
  }
  // un quart de seconde après le relâcher, pour le suivi du geste
  let iA = iR;
  while (iA < images.length - 1 && images[iA].t - R.t < 0.25) iA++;
  const A = images[iA];

  const larg = ecart(R.w[P.epG], R.w[P.epD]) || 1;
  const haut = Math.abs((R.n[P.chG].y + R.n[P.chD].y)/2 -
                        (R.n[P.epG].y + R.n[P.epD].y)/2) || 1;
  const hanches = f => (f.n[P.haG].x + f.n[P.haD].x) / 2;

  return {
    t:           +R.t.toFixed(2),
    extension:   angle(R.w[ep], R.w[co], R.w[po]),                 // degrés
    ecartCoude:  Math.abs(R.w[co].x - R.w[ep].x) / larg,           // ratio
    appuis:      ecart(R.w[P.chG], R.w[P.chD]) / larg,             // ratio
    derive:      Math.abs(hanches(A) - hanches(images[iF])) / haut,// ratio
    mainGuide:   ecart(A.w[poAutre], R.w[poAutre]) / larg,         // ratio
    poignet:     angle(A.w[co], A.w[po], A.w[ix]),                 // degrés
    hauteurRel:  (R.n[ep].y - R.n[po].y) / haut,                   // ratio
    duree:       R.t - images[iF].t,                               // secondes
    flexion:     flexionMin,                                       // degrés
    cadrageOk:   R.entier
  };
}

/* ------------------------------------------------------------- seuils */
/* Valeurs de départ, volontairement génériques. Elles ont vocation à être
   remplacées par les seuils calibrés sur les notes de Williams. */
export const SEUILS = {
  extension:  { min: 160, libelle: 'Extension du bras au relâcher', unite: '°' },
  ecartCoude: { max: 0.22, libelle: 'Écart du coude', unite: '%', pourcent: true },
  appuis:     { min: 0.85, max: 1.35, libelle: 'Largeur des appuis', unite: '%', pourcent: true },
  derive:     { max: 0.10, libelle: 'Dérive à la retombée', unite: '%', pourcent: true },
  mainGuide:  { max: 0.25, libelle: 'Poussée de la main guide', unite: '%', pourcent: true },
  poignet:    { max: 150, libelle: 'Flexion du poignet après tir', unite: '°' },
  hauteurRel: { libelle: 'Hauteur du relâcher', unite: '%', pourcent: true },
  duree:      { libelle: 'Durée du geste', unite: 's' },
  flexion:    { libelle: 'Flexion des genoux', unite: '°' }
};

export function juger(cle, valeur) {
  const s = SEUILS[cle];
  if (!s || !isFinite(valeur)) return null;            // null = pas d'avis
  if (s.min !== undefined && valeur < s.min) return false;
  if (s.max !== undefined && valeur > s.max) return false;
  if (s.min === undefined && s.max === undefined) return null;
  return true;
}

/* --------------------------------------------------------- point d'entrée */
export async function analyserVideo(video, options = {}) {
  const main = options.main === 'G' ? 'G' : 'D';
  const surAvancement = options.surAvancement;

  const { images, cadrage } = await lireImages(video, surAvancement);
  if (images.length < 8) {
    return { erreur: 'joueur_non_detecte', images: images.length, cadrage };
  }

  const cote = main === 'D'
    ? { po:P.poD, co:P.coD, ep:P.epD, ix:P.idxD, poAutre:P.poG, ge:P.geD, ha:P.haD, ch:P.chD }
    : { po:P.poG, co:P.coG, ep:P.epG, ix:P.idxG, poAutre:P.poD, ge:P.geG, ha:P.haG, ch:P.chG };

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

/* ------------------------------------------- résumé prêt à être stocké */
/* Ce que l'application enverra à Supabase : des nombres, jamais d'image. */
export function resume(r) {
  if (!r || r.erreur) return null;
  const m = {};
  for (const cle of Object.keys(SEUILS)) {
    const vals = r.tirs.map(t => t[cle]).filter(isFinite);
    if (vals.length) m[cle] = +moyenne(vals).toFixed(3);
  }
  return {
    version: r.version,
    main: r.main,
    nb_tirs: r.tirs.length,
    cadrage: +r.qualite.cadrage.toFixed(2),
    moyennes: m,
    regularite: r.regularite ? {
      extension_ecart_type: +r.regularite.extensionEcartType.toFixed(1),
      duree_ecart_type: +r.regularite.dureeEcartType.toFixed(3)
    } : null
  };
}
