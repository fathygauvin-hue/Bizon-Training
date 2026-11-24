/* Bizon Training — profil du basketteur (préparation mentale).
   Les 27 questions et le barème sont ceux du questionnaire du préparateur
   mental. Barème vérifié en recoupant un passage complet avec ses scores :
     - sections à choix unique : nombre de réponses par axe / 6
     - échelles : (somme des notes − n) / (4n), les items inversés comptés 6 − x
   Aucune interprétation n'est ajoutée ici : ce fichier calcule, il ne juge pas. */

export const VERSION_MENTAL = 'mental-1';

export const ECHELLE = [
  'Pas du tout', 'Plutôt pas', 'Ni oui ni non', 'Plutôt oui', 'Tout à fait'
];

export const SECTIONS = [
  { cle: 'resilience',  titre: 'Résilience mentale',   type: 'echelle' },
  { cle: 'leadership',  titre: 'Style de leadership',  type: 'choix' },
  { cle: 'jeu',         titre: 'Profil de jeu',        type: 'choix' },
  { cle: 'motivation',  titre: 'Motivation et pression', type: 'echelle' }
];

export const AXES = {
  leadership: {
    vocal:      'Capitaine vocal',
    exemple:    'Leader par l’exemple',
    tactique:   'Leader tactique',
    protecteur: 'Leader protecteur'
  },
  jeu: {
    organisateur: 'Organisateur',
    scoreur:      'Scoreur',
    interieur:    'Intérieur',
    role:         'Joueur de rôle'
  }
};

/* Titres de profil affichés au joueur */
export const TITRES = {
  leadership: {
    vocal:      'Le capitaine vocal',
    exemple:    'Le leader par l’exemple',
    tactique:   'Le leader tactique',
    protecteur: 'Le leader protecteur'
  },
  jeu: {
    organisateur: 'Profil organisateur',
    scoreur:      'Profil scoreur',
    interieur:    'Profil intérieur',
    role:         'Joueur de rôle — l’indispensable'
  }
};

export const QUESTIONS = [
  /* ---------------- 1. Résilience mentale ---------------- */
  { n: 1, section: 'resilience', mesure: 'resilience',
    texte: 'Je crois en mes qualités, même face à un adversaire qui semble plus fort sur le papier.' },
  { n: 2, section: 'resilience', mesure: 'resilience',
    texte: 'Après un tir manqué, je continue à vouloir le ballon pour prendre le tir suivant.' },
  { n: 3, section: 'resilience', mesure: 'resilience', inverse: true,
    texte: 'Une mauvaise série de tirs me fait douter de mes capacités pour le reste du match.' },
  { n: 4, section: 'resilience', mesure: 'resilience',
    texte: 'Je reste concentré sur mon rôle, même lorsque je suis peu sollicité dans le jeu.' },
  { n: 5, section: 'resilience', mesure: 'resilience',
    texte: 'Après une défaite difficile, je parviens à transformer ma déception en énergie pour progresser.' },

  /* ---------------- 2. Style de leadership ---------------- */
  { n: 6, section: 'leadership',
    texte: 'Dans les dernières minutes d’un match serré, ton rôle naturel dans le groupe est plutôt de…',
    options: [
      ['vocal',      'Prendre la parole pour mobiliser l’équipe et maintenir son énergie.'],
      ['exemple',    'Élever ton propre niveau d’intensité pour entraîner les autres.'],
      ['tactique',   'Observer les choix adverses et proposer un ajustement collectif.'],
      ['protecteur', 'Rassurer un coéquipier qui semble perdre confiance.']
    ] },
  { n: 7, section: 'leadership',
    texte: 'Un jeune coéquipier commet deux erreurs évitables consécutives. Tu as tendance à…',
    options: [
      ['tactique',   'Lui expliquer calmement ce qu’il peut ajuster.'],
      ['protecteur', 'Le rassurer pour qu’il reste engagé dans le match.'],
      ['exemple',    'Montrer l’attitude attendue dès l’action suivante.'],
      ['vocal',      'Le reprendre clairement et immédiatement pour provoquer une réaction.']
    ] },
  { n: 8, section: 'leadership',
    texte: 'Pendant un temps mort, tu es généralement du genre à…',
    options: [
      ['protecteur', 'Observer l’état émotionnel de tes coéquipiers.'],
      ['tactique',   'Proposer au coach un ajustement précis.'],
      ['vocal',      'Prendre la parole pour galvaniser le groupe.'],
      ['exemple',    'Rester concentré sur ta propre préparation et montrer ton sérieux.']
    ] },
  { n: 9, section: 'leadership',
    texte: 'Ce que tes coéquipiers retiennent le plus souvent de toi en tant que leader, c’est…',
    options: [
      ['exemple',    'Ton sérieux et ta constance à l’entraînement.'],
      ['protecteur', 'Ta capacité à maintenir l’unité du groupe.'],
      ['vocal',      'Ta voix dans les moments importants.'],
      ['tactique',   'Ta lecture du jeu et la précision de tes consignes.']
    ] },
  { n: 10, section: 'leadership',
    texte: 'Après une victoire importante, tu as plutôt tendance à…',
    options: [
      ['tactique',   'Analyser rapidement ce qui a fonctionné dans le jeu.'],
      ['protecteur', 'Féliciter individuellement les joueurs qui en ont besoin.'],
      ['vocal',      'Célébrer avec énergie et entraîner le groupe.'],
      ['exemple',    'Rester mesuré et déjà concentré sur la suite.']
    ] },
  { n: 11, section: 'leadership',
    texte: 'Une décision arbitrale défavorable énerve fortement l’équipe. Tu as tendance à…',
    options: [
      ['exemple',    'Rester maîtrisé et montrer l’attitude à adopter.'],
      ['tactique',   'Recentrer le groupe sur le plan de jeu et la prochaine possession.'],
      ['vocal',      'Canaliser l’énergie de l’équipe en prenant la parole.'],
      ['protecteur', 'Aller calmer individuellement les joueurs les plus énervés.']
    ] },

  /* ---------------- 3. Profil de jeu ---------------- */
  { n: 12, section: 'jeu',
    texte: 'Sur le terrain, ce qui te procure le plus de satisfaction, c’est…',
    options: [
      ['organisateur', 'Trouver la passe qui place un coéquipier dans les meilleures conditions.'],
      ['scoreur',      'Créer et réussir un tir difficile.'],
      ['interieur',    'Imposer ta présence physique près du panier.'],
      ['role',         'Effectuer les actions utiles qui ne se voient pas toujours dans les statistiques.']
    ] },
  { n: 13, section: 'jeu',
    texte: 'En attaque placée, tu recherches avant tout…',
    options: [
      ['role',         'Les déplacements et les écrans qui libèrent tes coéquipiers.'],
      ['interieur',    'Une position proche du panier pour recevoir ou prendre un rebond offensif.'],
      ['organisateur', 'Le ballon pour organiser le jeu et contrôler le rythme.'],
      ['scoreur',      'De l’espace pour créer ton propre tir.']
    ] },
  { n: 14, section: 'jeu',
    texte: 'En défense, ta priorité naturelle est plutôt de…',
    options: [
      ['interieur',    'Protéger la raquette et contrôler les rebonds.'],
      ['role',         'Prendre la mission défensive la plus difficile, même sans reconnaissance.'],
      ['organisateur', 'Anticiper les actions et couper les lignes de passe.'],
      ['scoreur',      'Mettre une forte pression sur ton adversaire direct.']
    ] },
  { n: 15, section: 'jeu',
    texte: 'Ce que ton coach te demande le plus souvent, c’est de…',
    options: [
      ['scoreur',      'Créer du danger offensif.'],
      ['organisateur', 'Gérer le rythme et organiser les temps forts ou faibles du match.'],
      ['interieur',    'Apporter de la présence physique dans la raquette.'],
      ['role',         'Réaliser les tâches collectives et défensives indispensables.']
    ] },
  { n: 16, section: 'jeu',
    texte: 'Après un match, tu ressens le plus de fierté lorsque tu as…',
    options: [
      ['role',         'Fait gagner l’équipe grâce à des actions qui ne ressortent pas forcément dans les statistiques.'],
      ['organisateur', 'Créé de nombreuses occasions pour tes coéquipiers.'],
      ['scoreur',      'Marqué des paniers importants.'],
      ['interieur',    'Dominé dans les rebonds, les duels ou la protection du cercle.']
    ] },
  { n: 17, section: 'jeu',
    texte: 'Dans ton rôle idéal, tu aimerais surtout être…',
    options: [
      ['scoreur',      'Le joueur capable de faire basculer le match par son scoring.'],
      ['role',         'Le joueur polyvalent prêt à répondre à tous les besoins de l’équipe.'],
      ['interieur',    'Le point d’ancrage physique de l’équipe près du panier.'],
      ['organisateur', 'Le chef d’orchestre qui organise et fait jouer les autres.']
    ] },

  /* ---------------- 4. Motivation et pression ---------------- */
  { n: 18, section: 'motivation', mesure: 'motivation',
    texte: 'Je continuerais à travailler mon jeu avec la même exigence, même sans public, médias ou récompense.' },
  { n: 19, section: 'motivation', mesure: 'motivation',
    texte: 'Le plaisir de progresser compte autant pour moi que les résultats obtenus.' },
  { n: 20, section: 'motivation', mesure: 'motivation', inverse: true,
    texte: 'Sans objectif extérieur, comme une sélection, un contrat ou un classement, j’ai du mal à rester motivé à l’entraînement.' },
  { n: 21, section: 'motivation', mesure: 'motivation',
    texte: 'Même lorsque personne ne remarque mes efforts, je cherche à progresser.' },
  { n: 22, section: 'motivation', mesure: 'motivation', inverse: true,
    texte: 'Lorsque mes résultats tardent à venir, j’ai tendance à réduire mes efforts.' },
  { n: 23, section: 'motivation', mesure: 'pression',
    texte: 'Plus l’enjeu est important, plus je parviens à me concentrer sur les gestes essentiels.' },
  { n: 24, section: 'motivation', mesure: 'pression', inverse: true,
    texte: 'Mes pensées s’accélèrent au point de perturber mon jeu en fin de match serré.' },
  { n: 25, section: 'motivation', mesure: 'pression',
    texte: 'Je reste lucide dans mes choix tactiques pendant les dernières possessions d’un match serré.' },
  { n: 26, section: 'motivation', mesure: 'pression',
    texte: 'Dans les moments décisifs, je parviens à rester concentré sur l’action présente.' },
  { n: 27, section: 'motivation', mesure: 'pression', inverse: true,
    texte: 'Après une erreur importante, j’y repense encore pendant les actions suivantes.' }
];

/* Paliers de lecture de la résilience. À confirmer avec le préparateur :
   ce sont les seuls chiffres de ce fichier qui ne viennent pas de son barème. */
export const PALIERS = [
  [80, 'Très solide'],
  [65, 'Solide'],
  [50, 'En construction'],
  [0,  'À travailler']
];
export function palier(score) {
  for (const [seuil, mot] of PALIERS) if (score >= seuil) return mot;
  return PALIERS[PALIERS.length - 1][1];
}

/* reponses : { 1: 4, 2: 4, 3: 2, …, 6: 'tactique', … } */
export function calculer(reponses) {
  const ech = (mesure) => {
    const q = QUESTIONS.filter(x => x.mesure === mesure);
    let somme = 0, n = 0;
    for (const x of q) {
      const v = Number(reponses[x.n]);
      if (!isFinite(v) || v < 1 || v > 5) continue;
      somme += x.inverse ? (6 - v) : v;
      n++;
    }
    return n ? Math.round(((somme - n) / (4 * n)) * 100) : null;
  };

  const compter = (section) => {
    const q = QUESTIONS.filter(x => x.section === section);
    const axes = {};
    for (const a of Object.keys(AXES[section])) axes[a] = 0;
    let n = 0;
    for (const x of q) {
      const a = reponses[x.n];
      if (a && axes[a] !== undefined) { axes[a]++; n++; }
    }
    const pour = {};
    for (const a of Object.keys(axes)) pour[a] = n ? Math.round((axes[a] / n) * 100) : 0;
    // classement : on n'affiche un profil secondaire que s'il a au moins une réponse
    const tri = Object.keys(axes).sort((x, y) => axes[y] - axes[x]);
    const principal = axes[tri[0]] > 0 ? tri[0] : null;
    const secondaire = (tri[1] && axes[tri[1]] > 0) ? tri[1] : null;
    return { comptes: axes, pourcents: pour, reponses: n, principal, secondaire };
  };

  const resilience = ech('resilience');
  const leadership = compter('leadership');
  const jeu = compter('jeu');

  return {
    version: VERSION_MENTAL,
    resilience,
    resilienceLabel: resilience === null ? null : palier(resilience),
    leadership, jeu,
    motivation: ech('motivation'),
    pression: ech('pression'),
    complet: QUESTIONS.every(q => reponses[q.n] !== undefined && reponses[q.n] !== null)
  };
}
