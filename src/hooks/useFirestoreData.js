import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';

export function useFirestoreData() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState([]);
  const [bros, setBros] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [scheduledJobs, setScheduledJobs] = useState([]);
  const [stockMovements, setStockMovements] = useState([]);
  const [financialTransactions, setFinancialTransactions] = useState([]);
  const [barOpenThreshold, setBarOpenThreshold] = useState(8); // Seuil par défaut : 8 bouteilles
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
      const docRef = await addDoc(collection(db, collectionName), {
        ...data,
        createdAt: serverTimestamp()
      });
      console.log(`Document sauvegardé dans ${collectionName} avec ID:`, docRef.id);
      return docRef.id;
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
      const docRef = doc(db, collectionName, id);
      await updateDoc(docRef, {
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
      const docRef = doc(db, collectionName, id);
      await deleteDoc(docRef);
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
      const unsubscribe = onSnapshot(collection(db, collectionName), (snapshot) => {
        if (!snapshot.metadata.hasPendingWrites) {
          const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setState(data);
          console.log(`Données chargées de ${collectionName}:`, data);
        }
      });
      return unsubscribe;
    } catch (error) {
      console.error(`Erreur chargement ${collectionName}:`, error);
    }
  };

  useEffect(() => {
    console.log("Chargement des données depuis Firebase...");

    window.history.replaceState({ screen: 'home' }, '', '#home');

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
    let unsubscribeSurpriseSettings = null;
    let unsubscribeTripSettings = null;

    const setupListeners = async () => {
      unsubscribeMembers = await loadFromFirebase('members', setMembers);
      unsubscribeBros = await loadFromFirebase('bros', setBros);
      unsubscribeProducts = await loadFromFirebase('products', setProducts);
      unsubscribeOrders = await loadFromFirebase('orders', setOrders);
      unsubscribeJobs = await loadFromFirebase('jobs', setJobs);
      unsubscribeStockMovements = await loadFromFirebase('stockMovements', setStockMovements);
      unsubscribeScheduledJobs = await loadFromFirebase('scheduledJobs', setScheduledJobs);
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
      if (unsubscribeSurpriseSettings) unsubscribeSurpriseSettings();
      if (unsubscribeTripSettings) unsubscribeTripSettings();
    };
  }, []);

  return {
    isOnline,
    loading,
    members, setMembers,
    bros, setBros,
    products, setProducts,
    orders, setOrders,
    jobs, setJobs,
    scheduledJobs, setScheduledJobs,
    stockMovements, setStockMovements,
    financialTransactions, setFinancialTransactions,
    financialGoal, setFinancialGoal,
    popularProducts, setPopularProducts,
    barOpenThreshold, setBarOpenThreshold,
    surpriseSettings, setSurpriseSettings,
    tripPasswordProtected, setTripPasswordProtected,
    saveToFirebase, updateInFirebase, deleteFromFirebase,
  };
}
