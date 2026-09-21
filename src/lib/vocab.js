/**
 * Vocabulaire des sections.
 *
 * Les garçons sont les « Brothers », abrégé « Bro » (invariable au pluriel).
 * Les filles sont les « Grandes ». Les identifiants techniques (collection
 * `bros`, champ `broId`…) restent communs aux deux sections : seul le texte
 * affiché change.
 *
 * Les champs d'accord évitent les fautes de genre : `inscrit${v.e}s` donne
 * « inscrits » ou « inscrites ».
 */
const VOCAB = {
  garcons: {
    section: 'Brothers',
    one: 'Bro',
    many: 'Bro',
    e: '',
    the: 'le Bro',
    it: 'le',
    ofThe: 'du Bro',
    toThe: 'au Bro',
    your: 'ton Bro',
    thisOne: 'Ce Bro',
    requis: 'requis',
    actif: 'actif',
    tous: 'tous',
    ils: 'Ils',
    seuls: 'Seuls'
  },
  filles: {
    section: 'Grandes',
    one: 'Grande',
    many: 'Grandes',
    e: 'e',
    the: 'la Grande',
    it: 'la',
    ofThe: 'de la Grande',
    toThe: 'à la Grande',
    your: 'ta Grande',
    thisOne: 'Cette Grande',
    requis: 'requises',
    actif: 'active',
    tous: 'toutes',
    ils: 'Elles',
    seuls: 'Seules'
  }
};

/** Vocabulaire d'une section ; celui des Brothers si la section est inconnue. */
export const vocabFor = (sectionId) => VOCAB[sectionId] || VOCAB.garcons;
