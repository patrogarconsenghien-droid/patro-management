import { createContext, useContext } from 'react';

export const ROLES = {
  ANIME: 'anime',
  ANIMATEUR: 'animateur',
  ADMIN: 'admin'
};

export const ROLE_LABELS = {
  anime: 'Animé',
  animateur: 'Animateur',
  admin: 'Admin'
};

export const SECTIONS = {
  garcons: 'Brothers',
  filles: 'Grandes'
};

// Comptes qui deviennent admin dès leur première connexion. Sans eux, personne
// ne pourrait valider le tout premier compte.
export const BOOTSTRAP_ADMINS = ['rscokart@gmail.com'];

const isActive = (profile) => profile?.status === 'active';

/** Animateurs et admins : accès à toute l'app de leur section. */
export const canManage = (profile) =>
  isActive(profile) && (profile.role === ROLES.ANIMATEUR || profile.role === ROLES.ADMIN);

export const isAdmin = (profile) => isActive(profile) && profile.role === ROLES.ADMIN;

/** Compte actif, fourni par AuthGate : { user, profile, signOut }. */
export const AccountContext = createContext(null);

export const useCurrentAccount = () => useContext(AccountContext);

/** Prénom pour saluer : « Romain Scokart » → « Romain ». */
export const firstNameOf = (profile) =>
  String(profile?.displayName || profile?.email || '').split(/[\s@]/)[0];
