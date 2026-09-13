import { useState, useEffect } from 'react';
import { authReady, db } from '../firebase';
import { addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, serverTimestamp, where } from 'firebase/firestore';
import {
  collectionRef, currentSeasonDocPath, docRef, otherSectionId, seasonIdAt,
  DEFAULT_SECTION_ID, LEGACY_SEASON_ID
} from '../lib/seasons';

/**
 * Toutes les données de l'app pour une saison donnée. Changer de saison
 * rebranche l'ensemble des listeners sur d'autres documents : les deux saisons
 * n'ont rien en commun.
 */
export function useFirestoreData(seasonId = LEGACY_SEASON_ID, { manager = true, sectionId = DEFAULT_SECTION_ID } = {}) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState([]);
  const [bros, setBros] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [scheduledJobs, setScheduledJobs] = useState([]);
  // Boulots de l'autre section qui lui sont ouverts, dans sa saison en cours.
  const [sharedJobs, setSharedJobs] = useState([]);
  const [sharedSeasonId, setSharedSeasonId] = useState(null);
  const [stockMovements, setStockMovements] = useState([]);
  const [financialTransactions, setFinancialTransactions] = useState([]);
  const [barOpenThreshold, setBarOpenThreshold] = useState(8); // Seuil par défaut : 8 bouteilles
  const [hourlyRate, setHourlyRate] = useState(10.00); // Tarif horaire des boulots
  const [surpriseSettings, setSurpriseSettings] = useState({
    price: 200,
    eligibleProducts: [],
    weights: {},
    exclusiveProducts: [] // 🆕 produits exclusifs au verre surprise
  });
  const [financialGoal, setFinancialGoal] = useState({
    amount: 0,
    description: '',
    deadline: '',
    isActive: false
  });
  const [popularProducts, setPopularProducts] = useState([]);
  const [tripPasswordProtected, setTripPasswordProtected] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const saveToFirebase = async (collectionName, data) => {
    setLoading(true);
    try {
      const created = await addDoc(collectionRef(db, seasonId, collectionName, sectionId), {
        ...data,
        createdAt: serverTimestamp()
      });
      console.log(`Document sauvegardé dans ${seasonId}/${collectionName} avec ID:`, created.id);
      return created.id;
    } catch (error) {
      console.error('Erreur sauvegarde Firebase:', error);
      alert(`Erreur de connexion Firebase: ${error.message}`);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateInFirebase = async (collectionName, id, data) => {
    setLoading(true);
    try {
      await updateDoc(docRef(db, seasonId, collectionName, id, sectionId), {
        ...data,
        updatedAt: serverTimestamp()
      });
      console.log(`Document ${collectionName}/${id} mis à jour`);
    } catch (error) {
      console.error('Erreur mise à jour Firebase:', error);
      alert(`Erreur de mise à jour: ${error.message}`);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deleteFromFirebase = async (collectionName, id) => {
    setLoading(true);
    try {
      await deleteDoc(docRef(db, seasonId, collectionName, id, sectionId));
      console.log(`Document ${collectionName}/${id} supprimé`);
    } catch (error) {
      console.error('Erreur suppression Firebase:', error);
      alert(`Erreur de suppression: ${error.message}`);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const loadFromFirebase = async (collectionName, setState) => {
    try {
      const unsubscribe = onSnapshot(collectionRef(db, seasonId, collectionName, sectionId), (snapshot) => {
        if (!snapshot.metadata.hasPendingWrites) {
          const data = snapshot.docs.map(d => ({
            id: d.id,
            ...d.data()
          }));
          setState(data);
        }
      });
      return unsubscribe;
    } catch (error) {
      console.error(`Erreur chargement ${collectionName}:`, error);
    }
  };

  useEffect(() => {
    console.log(`Chargement des données de la saison ${seasonId} (${sectionId})...`);

    window.history.replaceState({ screen: 'home' }, '', '#home');

    // Changement de saison : on repart d'un état vide, sinon les données de la
    // saison précédente restent affichées le temps que les listeners répondent.
    setMembers([]);
    setBros([]);
    setProducts([]);
    setOrders([]);
    setJobs([]);
    setScheduledJobs([]);
    setStockMovements([]);
    setFinancialTransactions([]);
    // Les réglages ne sont écrits que si la saison en contient : sans remise à
    // zéro, une saison sans réglages hériterait de ceux de la précédente.
    setFinancialGoal({ amount: 0, description: '', deadline: '', isActive: false });
    setSurpriseSettings({ price: 200, eligibleProducts: [], weights: {}, exclusiveProducts: [] });
    setBarOpenThreshold(8);
    setHourlyRate(10.00);
    setPopularProducts([]);
    setTripPasswordProtected(false);

    let unsubscribeMembers = null;
    let unsubscribeBros = null;
    let unsubscribeProducts = null;
    let unsubscribeOrders = null;
    let unsubscribeJobs = null;
    let unsubscribeStockMovements = null;
    let unsubscribeScheduledJobs = null;
    let unsubscribeFinancialTransactions = null;
    let unsubscribeFinancialGoals = null;
    let unsubscribePopularProducts = null;
    let unsubscribeBarSettings = null;
    let unsubscribeJobSettings = null;
    let unsubscribeSurpriseSettings = null;
    let unsubscribeTripSettings = null;
    let unsubscribeOtherCurrent = null;
    let unsubscribeShared = null;

    // Les abonnements peuvent être posés après le démontage (changement de
    // saison rapide) : on les coupe alors immédiatement.
    let cancelled = false;
    const track = (unsubscribe) => {
      if (cancelled && unsubscribe) unsubscribe();
      return unsubscribe;
    };

    const setupListeners = async () => {
      // Les règles Firestore exigent une session : on attend la connexion
      // anonyme avant de s'abonner, sinon les premières lectures sont
      // refusées.
      await authReady;
      if (cancelled) return;

      // Boulots, Bro et boulots programmés : lisibles par tout compte actif.
      unsubscribeBros = track(await loadFromFirebase('bros', setBros));
      unsubscribeJobs = track(await loadFromFirebase('jobs', setJobs));
      unsubscribeScheduledJobs = track(await loadFromFirebase('scheduledJobs', setScheduledJobs));

      // Boulots ouverts par l'autre section : on suit sa saison en cours, puis
      // ses boulots marqués openToOtherSection (la requête doit porter ce
      // filtre, c'est ce que les règles vérifient).
      const other = otherSectionId(sectionId);
      setSharedJobs([]);
      unsubscribeOtherCurrent = track(onSnapshot(
        doc(db, ...currentSeasonDocPath(other)),
        (snapshot) => {
          const otherSeason = (snapshot.exists() && snapshot.data().seasonId) || seasonIdAt();
          setSharedSeasonId(otherSeason);
          if (unsubscribeShared) unsubscribeShared();
          unsubscribeShared = track(onSnapshot(
            query(collectionRef(db, otherSeason, 'scheduledJobs', other), where('openToOtherSection', '==', true)),
            (snap) => setSharedJobs(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
            (error) => console.error("Lecture des boulots ouverts par l'autre section impossible:", error)
          ));
        },
        (error) => console.error("Lecture de la saison de l'autre section impossible:", error)
      ));

      // Le reste est réservé aux animateurs par les règles Firestore : un
      // animé n'y est pas abonné, sinon chaque lecture serait refusée.
      if (!manager) return;

      unsubscribeMembers = track(await loadFromFirebase('members', setMembers));
      unsubscribeProducts = track(await loadFromFirebase('products', setProducts));
      unsubscribeOrders = track(await loadFromFirebase('orders', setOrders));
      unsubscribeStockMovements = track(await loadFromFirebase('stockMovements', setStockMovements));
      unsubscribeFinancialTransactions = await loadFromFirebase('financialTransactions', setFinancialTransactions);
      unsubscribeFinancialGoals = await loadFromFirebase('financialGoals', (goals) => {
        if (goals && goals.length > 0) {
          setFinancialGoal(goals[0]);
        }
      });

      unsubscribeTripSettings = await loadFromFirebase('tripSettings', (settings) => {
        if (settings && settings.length > 0) {
          const latestSettings = settings.sort((a, b) =>
            new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)
          )[0];
          setTripPasswordProtected(latestSettings.isProtected || false);
        }
      });

      unsubscribeSurpriseSettings = await loadFromFirebase('surpriseSettings', (settings) => {
        if (settings && settings.length > 0) {
          const latest = settings.sort((a, b) =>
            new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
          )[0];

          setSurpriseSettings({
            enabled: latest.enabled || false,
            price: latest.price || 2.5,
            pricePer11: latest.pricePer11 || 25.0,
            eligibleProducts: latest.eligibleProducts || [],
            weights: latest.weights || {},
            exclusiveProducts: latest.exclusiveProducts || [] // 🆕
          });
        }
      });

      unsubscribePopularProducts = await loadFromFirebase('popularProducts', (popular) => {
        if (popular && popular.length > 0) {
          const sortedPopular = popular.sort((a, b) => {
            const dateA = new Date(a.lastUpdated || a.createdAt || 0);
            const dateB = new Date(b.lastUpdated || b.createdAt || 0);
            return dateB - dateA;
          });
          setPopularProducts(sortedPopular[0].products || ['Jupiler', 'Coca', 'Stella', 'Fanta']);
        } else {
          setPopularProducts(['Jupiler', 'Coca', 'Stella', 'Fanta']);
        }
      });
      unsubscribeJobSettings = await loadFromFirebase('jobSettings', (settings) => {
        if (settings && settings.length > 0) {
          const latest = settings.sort((a, b) =>
            new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)
          )[0];
          if (latest.hourlyRate > 0) setHourlyRate(latest.hourlyRate);
        }
      });

      // Charger le seuil d'ouverture du bar
      unsubscribeBarSettings = await loadFromFirebase('barSettings', (settings) => {
        if (settings && settings.length > 0) {
          const latestSettings = settings.sort((a, b) =>
            new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)
          )[0];
          setBarOpenThreshold(latestSettings.openThreshold || 8);
        }
      });
    };

    setupListeners();

    return () => {
      cancelled = true;
      if (unsubscribeMembers) unsubscribeMembers();
      if (unsubscribeBros) unsubscribeBros();
      if (unsubscribeProducts) unsubscribeProducts();
      if (unsubscribeOrders) unsubscribeOrders();
      if (unsubscribeJobs) unsubscribeJobs();
      if (unsubscribeStockMovements) unsubscribeStockMovements();
      if (unsubscribeScheduledJobs) unsubscribeScheduledJobs();
      if (unsubscribeFinancialTransactions) unsubscribeFinancialTransactions();
      if (unsubscribeFinancialGoals) unsubscribeFinancialGoals();
      if (unsubscribePopularProducts) unsubscribePopularProducts();
      if (unsubscribeBarSettings) unsubscribeBarSettings();
      if (unsubscribeJobSettings) unsubscribeJobSettings();
      if (unsubscribeSurpriseSettings) unsubscribeSurpriseSettings();
      if (unsubscribeTripSettings) unsubscribeTripSettings();
      if (unsubscribeOtherCurrent) unsubscribeOtherCurrent();
      if (unsubscribeShared) unsubscribeShared();
    };
  }, [seasonId, manager, sectionId]);

  return {
    isOnline,
    // setLoading est utilisé par les écrans qui enchaînent plusieurs écritures
    // (validation d'une commande) et pilotent eux-mêmes l'indicateur.
    loading, setLoading,
    members, setMembers,
    bros, setBros,
    products, setProducts,
    orders, setOrders,
    jobs, setJobs,
    scheduledJobs, setScheduledJobs,
    sharedJobs, sharedSeasonId,
    stockMovements, setStockMovements,
    financialTransactions, setFinancialTransactions,
    financialGoal, setFinancialGoal,
    popularProducts, setPopularProducts,
    barOpenThreshold, setBarOpenThreshold,
    hourlyRate, setHourlyRate,
    surpriseSettings, setSurpriseSettings,
    tripPasswordProtected, setTripPasswordProtected,
    saveToFirebase, updateInFirebase, deleteFromFirebase,
  };
}
