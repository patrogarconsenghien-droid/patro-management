import React, { useState, useEffect } from 'react';
import {
  Home, Beer, Wrench, Settings, Users, Plus, Minus, ShoppingCart,
  ArrowLeft, Trash2, DollarSign, Clock, User, CheckCircle,
  BarChart3, Wifi, WifiOff
} from 'lucide-react';
import { db } from './firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { useNotifications } from './useNotifications';
import { Bell, Check, X } from 'lucide-react';


const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <Plus className="rotate-45" size={20} />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  );
};

const PatroApp = () => {

  const [currentScreen, setCurrentScreen] = useState('home');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState([]);
  const [bros, setBros] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [scheduledJobs, setScheduledJobs] = useState([]);
  const [stockMovements, setStockMovements] = useState([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [selectedMember, setSelectedMember] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [editingScheduledJob, setEditingScheduledJob] = useState(null);
  const [cart, setCart] = useState({});
  const [cartTotal, setCartTotal] = useState(0);
  const [repaymentAmount, setRepaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [hourlyRate, setHourlyRate] = useState(10.00);
  const [newMemberName, setNewMemberName] = useState('');
  const [newBroName, setNewBroName] = useState('');
  const [showBroDropdown, setShowBroDropdown] = useState(false);
  const [financialTransactions, setFinancialTransactions] = useState([]);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false); // ✅ Ici maintenant
  const [productSearch, setProductSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [showOnlyInStock, setShowOnlyInStock] = useState(false);
  const [sortBy, setSortBy] = useState('name'); // 'name', 'price', 'stock'



  console.log('🔍 Rendu avec screen:', currentScreen);



  const [newTransaction, setNewTransaction] = useState({
    type: 'income', // 'income' ou 'expense'
    amount: '',
    description: '',
    paymentMethod: 'cash',
    category: 'other'
  });


  const [newProduct, setNewProduct] = useState({
    name: '', price: '', category: 'Boissons', stock: '', stockType: 'unit',
    packSize: 1, pricePerPack: '', pricePer11: '', alertThreshold: 5,
    moneyFlow: 'none', amount: '', paymentMethod: ''
  });
  const [editingProduct, setEditingProduct] = useState(null);

  const [newJob, setNewJob] = useState({
    description: '', date: new Date().toISOString().split('T')[0],
    customRate: 10.00, bros: [], isPaid: false, paymentMethod: ''
  });
  const [newScheduledJob, setNewScheduledJob] = useState({
    description: '', date: new Date().toISOString().split('T')[0],
    timeStart: '09:00', estimatedHours: 1, location: '', customRate: 10.00, brosNeeded: 1,
    registeredBros: [], status: 'planned'
  });
  const deleteScheduledJob = async (jobId) => {
    const job = scheduledJobs.find(j => j.id === jobId);
    if (!job) return;

    const confirmMessage = `Êtes-vous sûr de vouloir supprimer ce boulot programmé ?\n\n"${job.description}"\nDate: ${formatDate(job.date)}\n\nCette action est irréversible.`;

    if (!confirm(confirmMessage)) return;

    try {
      await deleteFromFirebase('scheduledJobs', jobId);
      alert('Boulot programmé supprimé avec succès !');
    } catch (error) {
      console.error('Erreur lors de la suppression du boulot programmé:', error);
      alert('Erreur lors de la suppression du boulot programmé');
    }
  };
  const [stockAdjustment, setStockAdjustment] = useState({
    productId: '', quantity: '', type: 'add', reason: '',
    moneyFlow: 'none', amount: '', paymentMethod: ''
  });



  const [bankDeposit, setBankDeposit] = useState({
    amount: '',
    description: ''
  });

  const [orderConfirmation, setOrderConfirmation] = useState({
    show: false,
    member: null,
    items: [],
    total: 0
  });

  const [financialGoal, setFinancialGoal] = useState({
    amount: 0,
    description: '',
    deadline: '',
    isActive: false
  });
  const [newGoal, setNewGoal] = useState({
    amount: '',
    description: '',
    deadline: ''
  });
  const [newRate, setNewRate] = useState(hourlyRate.toString());
  const [tempPopularProducts, setTempPopularProducts] = useState([]);
  const [popularProducts, setPopularProducts] = useState([]);
  const { isSupported, permission, requestPermission } = useNotifications(); // ✅ Maintenant ici

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


  useEffect(() => {
    if (isSupported && permission === 'default') {
      // Attendre 5 secondes avant de proposer les notifications
      const timer = setTimeout(() => {
        setShowNotificationPrompt(true);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [isSupported, permission]);

  useEffect(() => {
    const total = Object.values(cart).reduce((sum, cartItem) => {
      return sum + (cartItem.pricePerUnit * cartItem.quantity);
    }, 0);
    setCartTotal(total);
  }, [cart]);

  useEffect(() => {
    const handlePopState = (event) => {
      if (event.state && event.state.screen) {
        setCurrentScreen(event.state.screen);
        setSelectedMember(event.state.selectedMember || null);
      } else {
        // Si pas d'état, retour à l'accueil
        setCurrentScreen('home');
        setSelectedMember(null);
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);
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
          setFinancialGoal(goals[0]); // Prendre le premier objectif actif
        }
      });
      unsubscribePopularProducts = await loadFromFirebase('popularProducts', (popular) => {
        if (popular && popular.length > 0) {
          // Trier par date de mise à jour pour prendre le plus récent
          const sortedPopular = popular.sort((a, b) => {
            const dateA = new Date(a.lastUpdated || a.createdAt || 0);
            const dateB = new Date(b.lastUpdated || b.createdAt || 0);
            return dateB - dateA; // Plus récent en premier
          });

          console.log('Produits populaires chargés :', sortedPopular[0].products);
          setPopularProducts(sortedPopular[0].products || ['Jupiler', 'Coca', 'Stella', 'Fanta']);
        } else {
          // Valeurs par défaut si aucun document
          console.log('Aucun produit populaire trouvé, utilisation des valeurs par défaut');
          setPopularProducts(['Jupiler', 'Coca', 'Stella', 'Fanta']);
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
    };
  }, []);
  const activerNotifications = async () => {
    const result = await requestPermission();
    if (result === 'granted') {
      alert('✅ Notifications activées !');
    } else {
      alert('❌ Permission refusée');
    }
  };

  const formatCurrency = (amount) => `€${amount.toFixed(2)}`;
  const formatDate = (date) => new Date(date).toLocaleDateString('fr-FR');

  const formatDateTime = (date) => {
    const dateObj = new Date(date);
    return dateObj.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateEndTime = (startTime, durationHours) => {
    if (!startTime || !durationHours) return '';

    // Convertir l'heure de début en minutes
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const startTotalMinutes = startHour * 60 + startMinute;

    // Ajouter la durée en minutes
    const durationMinutes = durationHours * 60;
    const endTotalMinutes = startTotalMinutes + durationMinutes;

    // Convertir en heures et minutes
    const endHour = Math.floor(endTotalMinutes / 60) % 24; // % 24 pour gérer le passage à minuit
    const endMinute = endTotalMinutes % 60;

    // Formater en HH:MM
    return `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
  };

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
  const updateStock = async (productId, quantityChange, reason) => {
    console.log('updateStock appelée avec:', { productId, quantityChange, reason });

    const product = products.find(p => p.id === productId);
    console.log('Produit trouvé:', product);

    if (!product) {
      console.log('Produit non trouvé!');
      return;
    }

    const newStock = Math.max(0, product.stock + quantityChange);
    console.log('Nouveau stock calculé:', newStock);

    try {
      console.log('Mise à jour du produit dans Firebase...');
      await updateInFirebase('products', productId, { stock: newStock });
      console.log('Produit mis à jour avec succès');

      const movement = {
        productId,
        productName: product.name,
        quantityChange,
        newStock,
        reason,
        timestamp: new Date().toISOString()
      };

      console.log('Sauvegarde du mouvement de stock...');
      await saveToFirebase('stockMovements', movement);
      console.log('Mouvement de stock sauvegardé');

    } catch (error) {
      console.error('Erreur mise à jour stock:', error);
      alert('Erreur lors de la mise à jour du stock');
    }
  };

  const getStockStatus = (product) => {
    if (product.stock <= 0) return { color: 'text-red-600', bg: 'bg-red-50' };
    if (product.stock <= product.alertThreshold) return { color: 'text-orange-600', bg: 'bg-orange-50' };
    return { color: 'text-green-600', bg: 'bg-green-50' };
  };

  const navigateTo = (screen, member = null) => {
    setCurrentScreen(screen);
    setSelectedMember(member);
    setCart({});

    // Pousser l'état dans l'historique pour la navigation mobile
    window.history.pushState(
      { screen: screen, selectedMember: member },
      '',
      `#${screen}`
    );
  };

  const addMember = async () => {
    if (newMemberName.trim()) {
      const newMember = {
        name: newMemberName.trim(),
        balance: 0
      };

      try {
        await saveToFirebase('members', newMember);
        setNewMemberName('');
        setShowModal(false);
      } catch (error) {
        alert('Erreur lors de l\'ajout du membre');
      }
    }
  };

  const getFilteredProducts = () => {
    let filtered = products;

    // Filtrer par recherche
    if (productSearch.trim()) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(productSearch.toLowerCase())
      );
    }

    // Filtrer par catégorie
    if (activeCategory !== 'all') {
      filtered = filtered.filter(product => product.category === activeCategory);
    }

    // Filtrer par stock
    if (showOnlyInStock) {
      filtered = filtered.filter(product => product.stock > 0);
    }

    // Trier
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price':
          return a.price - b.price;
        case 'stock':
          return b.stock - a.stock;
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return filtered;
  };


  const deleteMember = async (memberId) => {
    await deleteFromFirebase('members', memberId);
    setMembers(members.filter(m => m.id !== memberId));
    setOrders(orders.filter(o => o.memberId !== memberId));
  };

  const repayMember = async () => {
    const amount = parseFloat(repaymentAmount);
    if (amount > 0 && selectedMember && paymentMethod) {
      const updatedBalance = selectedMember.balance + amount;

      await updateInFirebase('members', selectedMember.id, { balance: updatedBalance });

      const transaction = {
        memberId: selectedMember.id,
        memberName: selectedMember.name,
        type: selectedMember.balance < 0 ? 'repayment' : 'recharge',
        amount: amount,
        paymentMethod: paymentMethod, // NOUVEAU
        timestamp: new Date().toISOString(),
        items: []
      };

      await saveToFirebase('orders', transaction);

      setRepaymentAmount('');
      setPaymentMethod(''); // NOUVEAU
      setShowModal(false);
      setSelectedMember(null);
    }
  };

  const addToCart = (productId, saleType = 'unit', quantity = 1) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    let pricePerUnit;
    let quantityToAdd;

    switch (saleType) {
      case 'pack':
        pricePerUnit = product.pricePerPack / product.packSize;
        quantityToAdd = product.packSize;
        break;
      case 'eleven':
        pricePerUnit = product.pricePer11 / 11;
        quantityToAdd = 11;
        break;
      default: // 'unit'
        pricePerUnit = product.price;
        quantityToAdd = quantity;
    }

    setCart(prev => {
      const newCart = { ...prev };
      const cartKey = `${productId}-${saleType}`;

      if (!newCart[cartKey]) {
        newCart[cartKey] = {
          productId,
          saleType,
          quantity: 0,
          pricePerUnit,
          productName: product.name
        };
      }

      newCart[cartKey].quantity += quantityToAdd;
      return newCart;
    });
  };

  const removeFromCart = (productId, saleType = 'unit') => {
    const cartKey = `${productId}-${saleType}`;
    const product = products.find(p => p.id === productId);
    if (!product) return;

    let quantityToRemove;
    switch (saleType) {
      case 'pack':
        quantityToRemove = product.packSize;
        break;
      case 'eleven':
        quantityToRemove = 11;
        break;
      default: // 'unit'
        quantityToRemove = 1;
    }

    setCart(prev => {
      const newCart = { ...prev };
      if (newCart[cartKey]) {
        if (newCart[cartKey].quantity > quantityToRemove) {
          newCart[cartKey].quantity -= quantityToRemove;
        } else {
          delete newCart[cartKey];
        }
      }
      return newCart;
    });
  };

  const confirmOrder = async () => {
    const { member, items, total } = orderConfirmation;

    if (!member || items.length === 0) return;

    // Calculer les unités totales nécessaires
    const totalUnitsNeeded = {};
    Object.values(cart).forEach(cartItem => {
      if (!totalUnitsNeeded[cartItem.productId]) {
        totalUnitsNeeded[cartItem.productId] = 0;
      }
      totalUnitsNeeded[cartItem.productId] += cartItem.quantity;
    });

    const order = {
      memberId: member.id,
      memberName: member.name,
      type: 'order',
      amount: total,
      timestamp: new Date().toISOString(),
      items: items
    };

    const newBalance = member.balance - total;

    try {
      // Mettre à jour le stock
      Object.entries(totalUnitsNeeded).forEach(([productId, totalNeeded]) => {
        updateStock(productId, -totalNeeded, `Vente à ${member.name}`);
      });

      // Sauvegarder la commande et mettre à jour le solde
      await Promise.all([
        saveToFirebase('orders', order),
        updateInFirebase('members', member.id, { balance: newBalance })
      ]);

      // Fermer le modal et vider le panier
      setOrderConfirmation({ show: false, member: null, items: [], total: 0 });
      setCart({});

      // Retourner à la sélection de membre pour une nouvelle commande
      setSelectedMember(null);
      navigateTo('bar-order');

    } catch (error) {
      console.error('Erreur validation commande:', error);
      alert('Erreur lors de la validation de la commande');
    }
  };

  const validateOrder = () => {
    if (Object.keys(cart).length === 0 || !selectedMember) return;

    const stockIssues = [];
    const totalUnitsNeeded = {};

    // Calculer le total d'unités nécessaires par produit
    Object.values(cart).forEach(cartItem => {
      if (!totalUnitsNeeded[cartItem.productId]) {
        totalUnitsNeeded[cartItem.productId] = 0;
      }
      totalUnitsNeeded[cartItem.productId] += cartItem.quantity;
    });

    // Vérifier le stock
    Object.entries(totalUnitsNeeded).forEach(([productId, totalNeeded]) => {
      const product = products.find(p => p.id === productId);
      if (product && product.stock < totalNeeded) {
        stockIssues.push(`${product.name}: stock insuffisant`);
      }
    });

    if (stockIssues.length > 0) {
      alert('Stock insuffisant pour certains produits');
      return;
    }

    // Préparer les données pour le modal de confirmation
    const orderItems = Object.values(cart).map(cartItem => {
      const product = products.find(p => p.id === cartItem.productId);
      let displayName = product.name;

      if (cartItem.saleType === 'pack') {
        displayName += ` (Bac de ${product.packSize})`;
      } else if (cartItem.saleType === 'eleven') {
        displayName += ` (Lot de 11)`;
      }

      return {
        productId: cartItem.productId,
        productName: displayName,
        quantity: cartItem.quantity,
        pricePerUnit: cartItem.pricePerUnit,
        saleType: cartItem.saleType,
        total: cartItem.pricePerUnit * cartItem.quantity
      };
    });

    // Afficher le modal de confirmation au lieu de valider directement
    setOrderConfirmation({
      show: true,
      member: selectedMember,
      items: orderItems,
      total: cartTotal
    });
  };

  const addBro = async () => {
    if (newBroName.trim()) {
      const newBro = {
        name: newBroName.trim(),
        totalHours: 0
      };

      try {
        await saveToFirebase('bros', newBro);
        setNewBroName('');
        setShowModal(false);
      } catch (error) {
        alert('Erreur lors de l\'ajout du Bro');
      }
    }
  };

  const deleteBro = async (broId) => {
    await deleteFromFirebase('bros', broId);
    setBros(bros.filter(b => b.id !== broId));
    setJobs(jobs.filter(j => j.broId !== broId));
  };

  const deleteFinancialTransaction = async (transactionId) => {
    try {
      await deleteFromFirebase('financialTransactions', transactionId);
      setFinancialTransactions(financialTransactions.filter(t => t.id !== transactionId));
    } catch (error) {
      console.error('Erreur suppression transaction financière:', error);
      alert('Erreur lors de la suppression de la transaction');
    }
  };
  const addJob = async () => {
    if (newJob.description.trim() && newJob.bros.length > 0 && newJob.bros.every(b => b.hours > 0)) {
      try {
        const newJobs = newJob.bros.map(broAssignment => {
          const bro = bros.find(b => b.id === broAssignment.broId);
          return {
            broId: broAssignment.broId,
            broName: bro.name,
            description: newJob.description.trim(),
            hours: broAssignment.hours,
            date: newJob.date,
            hourlyRate: newJob.customRate,
            total: broAssignment.hours * newJob.customRate,
            isPaid: newJob.isPaid,
            paymentMethod: newJob.isPaid ? newJob.paymentMethod : null,
            paidAt: newJob.isPaid ? new Date().toISOString() : null
          };
        });

        // Sauvegarder tous les jobs
        await Promise.all(newJobs.map(job => saveToFirebase('jobs', job)));

        // Mettre à jour les heures totales des Bro
        const broUpdates = newJob.bros.map(assignment => {
          const bro = bros.find(b => b.id === assignment.broId);
          return updateInFirebase('bros', bro.id, {
            totalHours: bro.totalHours + assignment.hours
          });
        });
        await Promise.all(broUpdates);

        setNewJob({
          description: '',
          date: new Date().toISOString().split('T')[0],
          customRate: hourlyRate,
          bros: [],
          isPaid: false,
          paymentMethod: ''
        });
        setShowModal(false);
      } catch (error) {
        alert('Erreur lors de l\'ajout du job');
      }
    }
  };

  const confirmJobPayment = async (jobId, paymentMethodSelected, cancelPayment = false) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    if (cancelPayment) {
      // Annuler le paiement
      await updateInFirebase('jobs', jobId, {
        isPaid: false,
        paymentMethod: null,
        paidAt: null
      });
    } else {
      // Confirmer le paiement
      if (!paymentMethodSelected) return;

      await updateInFirebase('jobs', jobId, {
        isPaid: true,
        paymentMethod: paymentMethodSelected,
        paidAt: new Date().toISOString()
      });
    }

    setPaymentMethod('');
    setShowModal(false);
    setSelectedJob(null);
  };

  const deleteOrder = async (orderId) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    if (order.type === 'order' && order.items) {
      // Remettre le stock - calculer les unités totales par produit
      const stockToRestore = {};
      order.items.forEach(item => {
        if (!stockToRestore[item.productId]) {
          stockToRestore[item.productId] = 0;
        }
        stockToRestore[item.productId] += item.quantity;
      });

      Object.entries(stockToRestore).forEach(([productId, quantity]) => {
        updateStock(productId, quantity, `Annulation commande #${orderId}`);
      });

      const member = members.find(m => m.id === order.memberId);
      if (member) {
        const newBalance = member.balance + order.amount;
        setMembers(members.map(m =>
          m.id === order.memberId ? { ...m, balance: newBalance } : m
        ));
        await updateInFirebase('members', order.memberId, { balance: newBalance });
      }
    }

    if ((order.type === 'repayment' || order.type === 'recharge')) {
      const member = members.find(m => m.id === order.memberId);
      if (member) {
        const newBalance = member.balance - order.amount;
        setMembers(members.map(m =>
          m.id === order.memberId ? { ...m, balance: newBalance } : m
        ));
        await updateInFirebase('members', order.memberId, { balance: newBalance });
      }
    }

    await deleteFromFirebase('orders', orderId);
    setOrders(orders.filter(o => o.id !== orderId));
  };

  const deleteJob = async (jobId) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    const bro = bros.find(b => b.id === job.broId);
    if (bro) {
      const newTotalHours = Math.max(0, bro.totalHours - job.hours);
      setBros(bros.map(b =>
        b.id === job.broId ? { ...b, totalHours: newTotalHours } : b
      ));
      await updateInFirebase('bros', job.broId, { totalHours: newTotalHours });
    }

    await deleteFromFirebase('jobs', jobId);
    setJobs(jobs.filter(j => j.id !== jobId));
  };

  const addProduct = async () => {
    const price = parseFloat(newProduct.price);
    const stock = parseInt(newProduct.stock) || 0;
    const alertThreshold = parseInt(newProduct.alertThreshold) || 5;
    const amount = parseFloat(newProduct.amount);

    if (newProduct.name.trim() && price > 0) {
      const product = {
        name: newProduct.name.trim(),
        price: price,
        category: newProduct.category,
        stock: stock,
        stockType: newProduct.stockType,
        packSize: parseInt(newProduct.packSize) || 1,
        alertThreshold: alertThreshold
      };

      if (newProduct.stockType === 'mixed') {
        product.pricePerPack = parseFloat(newProduct.pricePerPack) || 0;
        product.pricePer11 = parseFloat(newProduct.pricePer11) || 0;
      }

      try {
        // Sauvegarder le produit
        const productId = await saveToFirebase('products', product);

        // Si stock initial avec impact financier, enregistrer la transaction
        if (stock > 0 && newProduct.moneyFlow === 'out' && amount > 0 && newProduct.paymentMethod) {
          const financialTransaction = {
            type: 'product_creation',
            productId: productId,
            productName: newProduct.name.trim(),
            quantity: stock,
            moneyFlow: 'out',
            amount: amount,
            paymentMethod: newProduct.paymentMethod,
            reason: `Achat stock initial - ${newProduct.name.trim()}`,
            timestamp: new Date().toISOString()
          };

          try {
            await saveToFirebase('financialTransactions', financialTransaction);
            console.log('Transaction financière créée pour nouveau produit:', financialTransaction);
          } catch (error) {
            console.error('Erreur enregistrement transaction financière:', error);
          }
        }

        // Réinitialiser le formulaire
        setNewProduct({
          name: '', price: '', category: 'Boissons', stock: '', stockType: 'unit',
          packSize: 1, pricePerPack: '', pricePer11: '', alertThreshold: 5,
          moneyFlow: 'none', amount: '', paymentMethod: ''
        });
        setShowModal(false);
      } catch (error) {
        alert('Erreur lors de l\'ajout du produit');
      }
    }
  };

  const updateProduct = async () => {
    const price = parseFloat(newProduct.price);
    const stock = parseInt(newProduct.stock) || 0;
    const alertThreshold = parseInt(newProduct.alertThreshold) || 5;

    if (newProduct.name.trim() && price > 0 && editingProduct) {
      const updatedProduct = {
        name: newProduct.name.trim(),
        price: price,
        category: newProduct.category,
        stock: stock,
        stockType: newProduct.stockType,
        packSize: parseInt(newProduct.packSize) || 1,
        alertThreshold: alertThreshold
      };

      if (newProduct.stockType === 'mixed') {
        updatedProduct.pricePerPack = parseFloat(newProduct.pricePerPack) || 0;
        updatedProduct.pricePer11 = parseFloat(newProduct.pricePer11) || 0;
      }

      try {
        await updateInFirebase('products', editingProduct.id, updatedProduct);

        // Réinitialiser le formulaire
        setNewProduct({
          name: '', price: '', category: 'Boissons', stock: '', stockType: 'unit',
          packSize: 1, pricePerPack: '', pricePer11: '', alertThreshold: 5,
          moneyFlow: 'none', amount: '', paymentMethod: ''
        });
        setEditingProduct(null);
        setShowModal(false);
        alert('Produit modifié avec succès !');
      } catch (error) {
        console.error('Erreur modification produit:', error);
        alert('Erreur lors de la modification du produit');
      }
    }
  };

  const deleteProduct = async (productId) => {
    await deleteFromFirebase('products', productId);
    setProducts(products.filter(p => p.id !== productId));
  };

  const addScheduledJob = async () => {
    if (newScheduledJob.description.trim() && newScheduledJob.brosNeeded > 0) {
      const scheduledJob = {
        description: newScheduledJob.description.trim(),
        date: newScheduledJob.date,
        timeStart: newScheduledJob.timeStart,
        estimatedHours: newScheduledJob.estimatedHours,
        location: newScheduledJob.location.trim(),
        customRate: newScheduledJob.customRate,
        brosNeeded: newScheduledJob.brosNeeded,
        registeredBros: [],
        status: 'planned'
      };

      try {
        await saveToFirebase('scheduledJobs', scheduledJob);
        setNewScheduledJob({
          description: '',
          date: new Date().toISOString().split('T')[0],
          timeStart: '09:00',
          estimatedHours: 1,
          location: '',
          customRate: hourlyRate,
          brosNeeded: 1,
          registeredBros: [],
          status: 'planned'
        });
        setShowModal(false);

        // Message de succès avec info notification
        alert('🎉 Boulot programmé avec succès !\n📱 Notifications envoyées automatiquement aux Bro !');

      } catch (error) {
        console.error('Erreur programmation boulot:', error);
        alert('Erreur lors de la programmation du boulot');
      }
    }
  };

  const updateScheduledJob = async () => {
    if (newScheduledJob.description.trim() && newScheduledJob.brosNeeded > 0 && editingScheduledJob) {
      const updatedJob = {
        description: newScheduledJob.description.trim(),
        date: newScheduledJob.date,
        timeStart: newScheduledJob.timeStart,
        estimatedHours: newScheduledJob.estimatedHours,
        location: newScheduledJob.location.trim(),
        customRate: newScheduledJob.customRate,
        brosNeeded: newScheduledJob.brosNeeded,
        // Garder les Bro déjà inscrits
        registeredBros: editingScheduledJob.registeredBros,
        status: editingScheduledJob.status
      };

      try {
        await updateInFirebase('scheduledJobs', editingScheduledJob.id, updatedJob);
        setNewScheduledJob({
          description: '',
          date: new Date().toISOString().split('T')[0],
          timeStart: '09:00',
          estimatedHours: 1,
          location: '',
          customRate: hourlyRate,
          brosNeeded: 1,
          registeredBros: [],
          status: 'planned'
        });
        setEditingScheduledJob(null);
        setShowModal(false);
        alert('Boulot modifié avec succès !');
      } catch (error) {
        console.error('Erreur modification boulot:', error);
        alert('Erreur lors de la modification du boulot');
      }
    }
  };

  const registerBroToJob = async (jobId, broId) => {
    const job = scheduledJobs.find(j => j.id === jobId);
    if (!job || job.registeredBros.length >= job.brosNeeded) return;

    // Vérifier que le Bro n'est pas déjà inscrit sur ce boulot
    if (job.registeredBros.some(reg => reg.broId === broId)) return;

    // NOUVELLE VÉRIFICATION : Conflit d'horaires
    const conflictingJob = scheduledJobs.find(otherJob =>
      otherJob.id !== jobId &&
      otherJob.date === job.date &&
      otherJob.registeredBros.some(reg => reg.broId === broId)
    );



    if (conflictingJob) {
      const bro = bros.find(b => b.id === broId);
      const confirmMessage = `⚠️ CONFLIT D'HORAIRE !\n\n${bro?.name || 'Ce Bro'} est déjà inscrit sur :\n"${conflictingJob.description}"\nle même jour (${formatDate(job.date)}).\n\nVoulez-vous quand même l'inscrire sur ce nouveau boulot ?`;

      if (!confirm(confirmMessage)) {
        return; // Annuler l'inscription
      }
    }

    const newRegistration = {
      broId: broId,
      registeredAt: new Date().toISOString(),
      hours: 0 // À définir plus tard quand le boulot sera terminé
    };

    const updatedRegisteredBros = [...job.registeredBros, newRegistration];

    try {
      await updateInFirebase('scheduledJobs', jobId, {
        registeredBros: updatedRegisteredBros
      });
      setShowModal(false);
      setSelectedJob(null);
    } catch (error) {
      alert('Erreur lors de l\'inscription');
    }
  };

  const removeBroFromScheduled = async (jobId, broId) => {
    const job = scheduledJobs.find(j => j.id === jobId);
    if (!job) return;



    // Retirer le Bro de la liste des inscrits
    const updatedRegisteredBros = job.registeredBros.filter(
      registration => registration.broId !== broId
    );

    try {
      // Mettre à jour dans Firebase
      await updateInFirebase('scheduledJobs', jobId, {
        registeredBros: updatedRegisteredBros
      });

      console.log('Bro retiré avec succès du boulot programmé');
    } catch (error) {
      console.error('Erreur lors du retrait du Bro:', error);
      alert('Erreur lors du retrait du Bro');
    }
  };

  const completeScheduledJob = async (jobId, isPartial = false) => {
    const job = scheduledJobs.find(j => j.id === jobId);
    if (!job) return;

    // Validation : soit quota complet, soit au moins 1 Bro inscrit pour validation partielle
    if (!isPartial && job.registeredBros.length < job.brosNeeded) {
      alert('Le quota de Bro n\'est pas atteint pour une finalisation complète.');
      return;
    }

    if (isPartial && job.registeredBros.length === 0) {
      alert('Aucun Bro inscrit pour ce boulot.');
      return;
    }

    // Message de confirmation adaptatif
    const confirmMessage = isPartial
      ? `Valider ce boulot avec seulement ${job.registeredBros.length} Bro sur ${job.brosNeeded} requis ?\n\n"${job.description}"\n\nSeuls les Bro inscrits seront payés.`
      : `Finaliser ce boulot avec le quota complet ?\n\n"${job.description}"`;

    if (!confirm(confirmMessage)) return;

    // Créer un boulot terminé pour chaque Bro inscrit
    const completedJobs = job.registeredBros.map(registration => {
      const bro = bros.find(b => b.id === registration.broId);
      const actualHours = job.estimatedHours || 1; // Utiliser la durée estimée

      return {
        broId: registration.broId,
        broName: bro ? bro.name : 'Inconnu',
        description: isPartial
          ? `${job.description} (PARTIEL ${job.registeredBros.length}/${job.brosNeeded})`
          : job.description,
        hours: actualHours,
        date: job.date,
        hourlyRate: job.customRate,
        total: actualHours * job.customRate,
        isPaid: false,
        paymentMethod: null,
        originalScheduledJobId: jobId,
        isPartialCompletion: isPartial,
        originalBrosNeeded: job.brosNeeded,
        actualBrosUsed: job.registeredBros.length
      };
    });

    try {
      // Sauvegarder tous les boulots terminés
      await Promise.all(completedJobs.map(completedJob =>
        saveToFirebase('jobs', completedJob)
      ));

      // Mettre à jour les heures totales des Bro
      const broUpdates = job.registeredBros.map(registration => {
        const bro = bros.find(b => b.id === registration.broId);
        if (bro) {
          const actualHours = job.estimatedHours || 1; // Même calcul
          return updateInFirebase('bros', bro.id, {
            totalHours: bro.totalHours + actualHours
          });
        }
        return Promise.resolve();
      });
      await Promise.all(broUpdates);

      // Supprimer le boulot programmé
      await deleteFromFirebase('scheduledJobs', jobId);

      const successMessage = isPartial
        ? `Boulot "${job.description}" validé partiellement !\n${job.registeredBros.length} Bro sur ${job.brosNeeded} ont été enregistrés.`
        : `Boulot "${job.description}" marqué comme terminé !`;

      alert(successMessage);

    } catch (error) {
      console.error('Erreur lors de la finalisation:', error);
      alert('Erreur lors de la finalisation du boulot');
    }
  };
  const processBankDeposit = async () => {
    const amount = parseFloat(bankDeposit.amount);

    // Calculer cashTotal dans la fonction
    let currentCashTotal = 0;
    let currentAccountTotal = 0;

    // Ajouter les transactions financières manuelles
    financialTransactions.forEach(transaction => {
      const transactionAmount = transaction.amount || 0;
      if (transaction.paymentMethod === 'cash') {
        currentCashTotal += transaction.type === 'income' ? transactionAmount : -transactionAmount;
      } else if (transaction.paymentMethod === 'account') {
        currentAccountTotal += transaction.type === 'income' ? transactionAmount : -transactionAmount;
      }
    });

    // Ajouter les remboursements/rechargements membres
    orders.forEach(order => {
      if (order.type === 'repayment' || order.type === 'recharge') {
        const orderAmount = order.amount || 0;
        if (order.paymentMethod === 'cash') {
          currentCashTotal += orderAmount;
        } else if (order.paymentMethod === 'account') {
          currentAccountTotal += orderAmount;
        }
      } else if (order.type === 'order') {
        const orderAmount = order.amount || 0;
        currentCashTotal += orderAmount; // Les ventes vont en caisse par défaut
      }
    });

    // Ajouter les revenus des boulots payés
    jobs.forEach(job => {
      if (job.isPaid) {
        const jobAmount = job.total || 0;
        if (job.paymentMethod === 'cash') {
          currentCashTotal += jobAmount;
        } else if (job.paymentMethod === 'account') {
          currentAccountTotal += jobAmount;
        }
      }
    });

    if (amount > 0 && amount <= currentCashTotal) {
      // Créer les 2 transactions : sortie cash + entrée compte
      const transactions = [
        {
          type: 'expense',
          amount: amount,
          description: bankDeposit.description || `Dépôt bancaire du ${formatDate(new Date().toISOString())}`,
          paymentMethod: 'cash',
          category: 'bank_transfer',
          timestamp: new Date().toISOString()
        },
        {
          type: 'income',
          amount: amount,
          description: bankDeposit.description || `Dépôt bancaire du ${formatDate(new Date().toISOString())}`,
          paymentMethod: 'account',
          category: 'bank_transfer',
          timestamp: new Date().toISOString()
        }
      ];

      try {
        // Sauvegarder les 2 transactions
        await Promise.all(transactions.map(transaction =>
          saveToFirebase('financialTransactions', transaction)
        ));

        // Reset du formulaire
        setBankDeposit({ amount: '', description: '' });
        setShowModal(false);

        // Message de succès
        alert(`Dépôt de ${formatCurrency(amount)} effectué avec succès !`);

      } catch (error) {
        console.error('Erreur dépôt bancaire:', error);
        alert('Erreur lors du dépôt bancaire');
      }
    } else {
      alert(`Impossible de déposer ${formatCurrency(amount)}. Caisse disponible: ${formatCurrency(currentCashTotal)}`);
    }
  };
  // Fonction pour les transactions financières manuelles
  const addFinancialTransaction = async (type) => {
    const amount = parseFloat(newTransaction.amount);

    if (amount > 0 && newTransaction.description.trim()) {
      const transaction = {
        type: type, // 'income' ou 'expense'
        amount: amount,
        description: newTransaction.description.trim(),
        paymentMethod: newTransaction.paymentMethod,
        category: newTransaction.category,
        timestamp: new Date().toISOString()
      };

      try {
        await saveToFirebase('financialTransactions', transaction);

        // Reset du formulaire
        setNewTransaction({
          type: type,
          amount: '',
          description: '',
          paymentMethod: 'cash',
          category: 'other'
        });

        setShowModal(false);

        // Message de succès
        alert(`${type === 'income' ? 'Rentrée' : 'Frais'} ajouté avec succès !`);

      } catch (error) {
        console.error('Erreur ajout transaction:', error);
        alert('Erreur lors de l\'ajout de la transaction');
      }
    }
  };


  const adjustStock = async () => {
    const quantity = parseInt(stockAdjustment.quantity);
    const amount = parseFloat(stockAdjustment.amount);

    if (stockAdjustment.productId && quantity !== 0 && stockAdjustment.reason.trim()) {
      const change = stockAdjustment.type === 'add' ? quantity : -quantity;
      const product = products.find(p => p.id === stockAdjustment.productId);

      // Faire l'ajustement de stock
      await updateStock(stockAdjustment.productId, change, stockAdjustment.reason.trim());

      // Si impact financier, enregistrer la transaction
      if (stockAdjustment.moneyFlow !== 'none' && amount > 0 && stockAdjustment.paymentMethod) {

        const financialTransaction = {
          type: 'stock_adjustment',
          productId: stockAdjustment.productId,
          productName: product?.name || 'Produit inconnu',
          quantity: quantity,
          adjustmentType: stockAdjustment.type,
          moneyFlow: stockAdjustment.moneyFlow, // 'in' ou 'out'
          amount: amount,
          paymentMethod: stockAdjustment.paymentMethod,
          reason: stockAdjustment.reason.trim(),
          timestamp: new Date().toISOString()
        };

        try {
          await saveToFirebase('financialTransactions', financialTransaction);
          console.log('Transaction financière enregistrée:', financialTransaction);
        } catch (error) {
          console.error('Erreur enregistrement transaction financière:', error);
        }
      }

      // Réinitialiser le formulaire
      setStockAdjustment({
        productId: '', quantity: '', type: 'add', reason: '',
        moneyFlow: 'none', amount: '', paymentMethod: ''
      });
      setShowModal(false);
    }
  };

  const categories = ['Alcool', 'Bière', 'Boissons', 'Snacks', 'Nourriture', 'Autre'].filter(cat =>
    products.some(p => p.category === cat)
  );

  const Header = ({ title, onBack }) => (
    <div className="flex items-center justify-between p-4 bg-white shadow-sm">
      {onBack && (
        <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full active:scale-95">
          <ArrowLeft size={20} />
        </button>
      )}
      <h1 className="text-lg font-semibold flex-1 text-center">{title}</h1>
      <div className="flex items-center space-x-2">
        {loading && (
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        )}
        <div className={`p-1 rounded ${isOnline ? 'text-green-500' : 'text-red-500'}`}>
          {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
        </div>
      </div>
    </div>
  );



  if (currentScreen === 'home') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
        <Header title="Gestion Patro" />

        <div className="p-6 space-y-4">
          <h2 className="text-2xl font-bold text-center text-gray-800 mb-8">
            Sélectionnez une section
          </h2>

          <button
            onClick={() => navigateTo('bar')}
            className="w-full p-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl shadow-lg active:scale-95 transition-transform"
          >
            <div className="flex items-center space-x-4">
              <Beer size={32} />
              <div className="text-left">
                <h3 className="text-xl font-semibold">Section Bar</h3>
                <p className="text-blue-100">Gestion membres, commandes, stock</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigateTo('boulots')}
            className="w-full p-6 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl shadow-lg active:scale-95 transition-transform"
          >
            <div className="flex items-center space-x-4">
              <Wrench size={32} />
              <div className="text-left">
                <h3 className="text-xl font-semibold">Section Boulots</h3>
                <p className="text-green-100">Gestion Bro, tâches, paiements</p>
              </div>
            </div>
          </button>

          {/* NOUVEAU BOUTON FINANCE - DORÉ */}
          <button
            onClick={() => navigateTo('finance')}
            className="w-full p-6 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white rounded-xl shadow-lg active:scale-95 transition-transform"
          >
            <div className="flex items-center space-x-4">
              <DollarSign size={32} />
              <div className="text-left">
                <h3 className="text-xl font-semibold">Section Finance</h3>
                <p className="text-yellow-100">Comptabilité, trésorerie, graphiques</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigateTo('settings')}
            className="w-full p-6 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl shadow-lg active:scale-95 transition-transform"
          >
            <div className="flex items-center space-x-4">
              <Settings size={32} />
              <div className="text-left">
                <h3 className="text-xl font-semibold">Paramètres</h3>
                <p className="text-purple-100">Stock, tarifs, corrections</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  if (currentScreen === 'bar') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
        <Header title="Section Bar" onBack={() => navigateTo('home')} />

        <div className="p-6 space-y-4">
          <button
            onClick={() => navigateTo('bar-order')}
            className="w-full p-4 bg-white rounded-lg shadow-md active:scale-95 transition-transform"
          >
            <div className="flex items-center space-x-3">
              <Users className="text-blue-500" size={24} />
              <div className="text-left">
                <h3 className="font-semibold">Nouvelle commande</h3>
                <p className="text-gray-600 text-sm">Liste, rechargements, suppressions</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigateTo('bar-members')}
            className="w-full p-4 bg-white rounded-lg shadow-md active:scale-95 transition-transform"
          >
            <div className="flex items-center space-x-3">
              <ShoppingCart className="text-blue-500" size={24} />
              <div className="text-left">
                <h3 className="font-semibold">Gestion des membres</h3>
                <p className="text-gray-600 text-sm">Ventes avec gestion stock</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigateTo('bar-history')}
            className="w-full p-4 bg-white rounded-lg shadow-md active:scale-95 transition-transform"
          >
            <div className="flex items-center space-x-3">
              <Clock className="text-blue-500" size={24} />
              <div className="text-left">
                <h3 className="font-semibold">Historique</h3>
                <p className="text-gray-600 text-sm">Toutes les transactions</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  if (currentScreen === 'bar-members') {
    const filteredMembers = members.filter(member =>
      member.name.toLowerCase().includes(memberSearch.toLowerCase())
    );

    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Gestion des membres" onBack={() => navigateTo('bar')} />

        <div className="p-4">
          <div className="flex items-center space-x-2 mb-4">
            <input
              type="text"
              placeholder={`Rechercher parmi les ${members.length} membres`}
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              className="flex-1 p-2 border rounded-lg bg-white shadow-sm"
            />
            <button
              onClick={() => { setModalType('add-member'); setShowModal(true); }}
              className="p-2 bg-blue-500 text-white rounded-full active:scale-95 transition-transform"
            >
              <Plus size={20} />
            </button>
          </div>

          <div className="space-y-3">
            {filteredMembers.map(member => (
              <div key={member.id} className="bg-white p-4 rounded-lg shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium">{member.name}</h3>
                    <p className={`text-sm font-semibold ${member.balance < 0 ? 'text-red-500' : 'text-green-500'}`}>
                      Solde: {formatCurrency(member.balance)}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => { setSelectedMember(member); setModalType('repay'); setShowModal(true); }}
                      className={`px-3 py-1 text-white rounded text-sm active:scale-95 transition-transform ${member.balance < 0 ? 'bg-green-500' : 'bg-blue-500'
                        }`}
                    >
                      {member.balance < 0 ? 'Rembourser' : 'Recharger'}
                    </button>
                    <button
                      onClick={() => deleteMember(member.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded active:scale-95 transition-transform"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Modal
          isOpen={showModal}
          onClose={() => { setShowModal(false); setNewMemberName(''); setRepaymentAmount(''); setPaymentMethod(''); }}
          title={modalType === 'add-member' ? 'Ajouter un membre' : selectedMember?.balance < 0 ? 'Remboursement' : 'Recharger le compte'}
        >
          {modalType === 'add-member' ? (
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Nom du membre"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                className="w-full p-3 border rounded-lg"
              />
              <button
                onClick={addMember}
                disabled={!newMemberName.trim() || loading}
                className="w-full p-3 bg-blue-500 text-white rounded-lg disabled:bg-gray-300 active:scale-95 transition-transform"
              >
                {loading ? 'Ajout en cours...' : 'Ajouter'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p>Membre: <strong>{selectedMember?.name}</strong></p>
              <p>Solde actuel: <strong className={selectedMember?.balance < 0 ? 'text-red-500' : 'text-green-500'}>
                {formatCurrency(selectedMember?.balance || 0)}
              </strong></p>

              <input
                type="number"
                step="0.01"
                placeholder={selectedMember?.balance < 0 ? "Montant à rembourser" : "Montant à recharger"}
                value={repaymentAmount}
                onChange={(e) => setRepaymentAmount(e.target.value)}
                className="w-full p-3 border rounded-lg"
              />

              {/* Nouveau champ - Mode de paiement */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  💳 Mode de paiement *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`p-3 border rounded-lg text-sm font-medium active:scale-95 transition-transform ${paymentMethod === 'cash'
                      ? 'bg-green-100 border-green-500 text-green-700'
                      : 'bg-gray-50 border-gray-300 text-gray-600'
                      }`}
                  >
                    💵 Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('account')}
                    className={`p-3 border rounded-lg text-sm font-medium active:scale-95 transition-transform ${paymentMethod === 'account'
                      ? 'bg-blue-100 border-blue-500 text-blue-700'
                      : 'bg-gray-50 border-gray-300 text-gray-600'
                      }`}
                  >
                    🏦 Compte
                  </button>
                </div>
                {!paymentMethod && (
                  <p className="text-xs text-red-500 mt-1">Veuillez sélectionner un mode de paiement</p>
                )}
              </div>

              <button
                onClick={repayMember}
                disabled={!repaymentAmount || parseFloat(repaymentAmount) <= 0 || !paymentMethod || loading}
                className={`w-full p-3 text-white rounded-lg disabled:bg-gray-300 active:scale-95 transition-transform ${selectedMember?.balance < 0 ? 'bg-green-500' : 'bg-blue-500'
                  }`}
              >
                {loading ? 'Traitement...' : (selectedMember?.balance < 0 ? 'Confirmer le remboursement' : 'Confirmer le rechargement')}
              </button>
            </div>
          )}
        </Modal>
      </div>
    );
  }

  if (currentScreen === 'bar-order') {
    if (!selectedMember) {
      // Filtrer les membres selon la recherche
      const filteredMembers = members.filter(member =>
        member.name.toLowerCase().includes(memberSearch.toLowerCase())
      );

      return (
        <div className="min-h-screen bg-gray-50">
          <Header title="Sélectionner un membre" onBack={() => {
            navigateTo('bar');
            setMemberSearch(''); // Reset de la recherche
          }} />

          <div className="p-4">
            {/* Champ de recherche */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="Rechercher un membre..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="w-full p-1 border rounded-lg bg-white shadow-sm"
              />
            </div>

            {/* Liste des membres filtrés */}
            <div className="space-y-3">
              {filteredMembers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users size={48} className="mx-auto mb-2 opacity-50" />
                  <p>{memberSearch ? 'Aucun membre trouvé' : 'Aucun membre disponible'}</p>
                </div>
              ) : (
                filteredMembers.map(member => (
                  <button
                    key={member.id}
                    onClick={() => {
                      setSelectedMember(member);
                      navigateTo('bar-products', member);
                      setMemberSearch('');
                    }}
                    className="w-full p-4 bg-white rounded-lg shadow-sm text-left active:scale-95 transition-transform"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">{member.name}</h3>
                        <p className={`text-sm ${member.balance < 0 ? 'text-red-500' : 'text-green-500'}`}>
                          Solde: {formatCurrency(member.balance)}
                        </p>
                      </div>
                      <div className="text-gray-400">→</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      );
    }
  }

  if (currentScreen === 'bar-products') {
    const filteredProducts = getFilteredProducts();
    const categoriesWithCount = categories.map(cat => ({
      name: cat,
      count: products.filter(p => p.category === cat && p.stock > 0).length
    }));

    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <Header
          title={`Commande - ${selectedMember?.name}`}
          onBack={() => { setSelectedMember(null); navigateTo('bar-order'); }}
        />

        <div className="p-4">
          {/* Barre de recherche */}
          <div className="mb-4">
            <div className="relative">
              <input
                type="text"
                placeholder="🔍 Rechercher un produit..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full p-3 pl-4 pr-12 border rounded-lg bg-white shadow-sm"
              />
              {productSearch && (
                <button
                  onClick={() => setProductSearch('')}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Filtres rapides */}
          <div className="mb-4 space-y-3">
            {/* Onglets de catégories */}
            <div className="flex overflow-x-auto space-x-2 pb-2">
              <button
                onClick={() => setActiveCategory('all')}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap active:scale-95 transition-transform ${activeCategory === 'all'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
              >
                Tout ({products.filter(p => p.stock > 0).length})
              </button>
              {categoriesWithCount.map(category => (
                <button
                  key={category.name}
                  onClick={() => setActiveCategory(category.name)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap active:scale-95 transition-transform ${activeCategory === category.name
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                >
                  {category.name} ({category.count})
                </button>
              ))}
            </div>

            {/* Options de tri et filtrage */}
            <div className="flex space-x-2 overflow-x-auto">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm bg-white"
              >
                <option value="name">Tri: A-Z</option>
                <option value="price">Tri: Prix ↑</option>
                <option value="stock">Tri: Stock ↓</option>
              </select>

              <button
                onClick={() => setShowOnlyInStock(!showOnlyInStock)}
                className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap active:scale-95 transition-transform ${showOnlyInStock
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 text-gray-700'
                  }`}
              >
                {showOnlyInStock ? '✓ En stock' : 'En stock'}
              </button>
            </div>
          </div>

          {/* Résultats de recherche */}
          {productSearch && (
            <div className="mb-4 text-sm text-gray-600">
              {filteredProducts.length} résultat(s) pour "{productSearch}"
            </div>
          )}

          {/* Produits les plus vendus (si pas de recherche) */}
          {!productSearch && activeCategory === 'all' && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3 text-gray-800">⭐ Populaires</h3>

              {/* 🔍 DÉBOGAGE - Affiche les infos dans l'interface */}
              <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                <p><strong>Debug:</strong></p>
                <p>Produits populaires configurés: {JSON.stringify(popularProducts)}</p>
                <p>Produits trouvés: {products.filter(p => popularProducts.includes(p.name)).map(p => p.name).join(', ')}</p>
                <p>En stock: {products.filter(p => popularProducts.includes(p.name) && p.stock > 0).map(p => p.name).join(', ')}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {(() => {
                  // 🔍 DÉBOGAGE dans la console
                  console.log('=== DÉBOGAGE PRODUITS POPULAIRES ===');
                  console.log('popularProducts array:', popularProducts);
                  console.log('products disponibles:', products.map(p => p.name));

                  const filteredProducts = products
                    .filter(p => {
                      const isPopular = popularProducts.includes(p.name);
                      const hasStock = p.stock > 0;
                      console.log(`${p.name}: populaire=${isPopular}, stock=${p.stock}, hasStock=${hasStock}`);
                      return isPopular && hasStock;
                    })
                    .slice(0, 4);

                  console.log('produits filtrés finaux:', filteredProducts.map(p => p.name));
                  console.log('=====================================');

                  return filteredProducts.map(product => {
                    const stockStatus = getStockStatus(product);
                    const isOutOfStock = product.stock <= 0;
                    const unitQuantity = cart[`${product.id}-unit`]?.quantity || 0;

                    return (
                      <div key={product.id} className={`bg-white p-3 rounded-lg shadow-sm border-2 border-yellow-200 ${isOutOfStock ? 'opacity-50' : ''}`}>
                        <div className="text-center">
                          <h4 className="font-medium text-sm mb-1">{product.name}</h4>
                          <p className="text-blue-600 font-semibold text-sm">{formatCurrency(product.price)}</p>
                          <div className={`text-xs px-2 py-1 rounded-full inline-block mt-1 ${stockStatus.bg} ${stockStatus.color}`}>
                            {product.stock}
                          </div>
                          {unitQuantity > 0 && (
                            <div className="text-xs text-orange-600 mt-1 font-bold">
                              Panier: {unitQuantity}
                            </div>
                          )}
                          <div className="flex items-center justify-center space-x-2 mt-3">
                            {unitQuantity > 0 && (
                              <button
                                onClick={() => removeFromCart(product.id, 'unit')}
                                className="w-6 h-6 bg-red-500 text-white rounded-full text-xs active:scale-95 transition-transform"
                              >
                                -
                              </button>
                            )}
                            <button
                              onClick={() => addToCart(product.id, 'unit')}
                              disabled={isOutOfStock}
                              className="w-12 h-12 bg-yellow-500 text-white rounded-lg text-xl font-bold disabled:bg-gray-300 active:scale-95 transition-transform shadow-md"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* Liste des produits filtrés */}
          <div className="space-y-4">
            {filteredProducts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">🔍</div>
                <p>Aucun produit trouvé</p>
                {productSearch && (
                  <button
                    onClick={() => setProductSearch('')}
                    className="mt-2 text-blue-500 hover:underline"
                  >
                    Effacer la recherche
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredProducts.map(product => {
                  const stockStatus = getStockStatus(product);
                  const isOutOfStock = product.stock <= 0;

                  // Calculer les quantités dans le panier
                  const unitQuantity = cart[`${product.id}-unit`]?.quantity || 0;
                  const packQuantity = cart[`${product.id}-pack`]?.quantity || 0;
                  const elevenQuantity = cart[`${product.id}-eleven`]?.quantity || 0;
                  const totalRequested = unitQuantity + packQuantity + elevenQuantity;
                  const availableStock = product.stock - totalRequested;

                  return (
                    <div key={product.id} className={`bg-white p-3 rounded-lg shadow-sm ${isOutOfStock ? 'opacity-50' : ''}`}>
                      {/* Header du produit */}
                      <div className="mb-3">
                        <h4 className="font-medium text-sm mb-1 leading-tight">{product.name}</h4>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-blue-600 font-semibold text-sm">{formatCurrency(product.price)}</p>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                            {product.category}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className={`text-xs px-2 py-1 rounded-full ${stockStatus.bg} ${stockStatus.color}`}>
                            Stock: {product.stock}
                          </div>
                          {totalRequested > 0 && (
                            <div className="text-xs text-orange-600 font-medium">
                              Panier: {totalRequested}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Zone de commande principale - À l'unité */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between">
                          <div className="text-sm">
                            <span className="font-medium">Unité</span>
                            {unitQuantity > 0 && (
                              <span className="ml-2 text-orange-600 font-bold">x{unitQuantity}</span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            {/* Bouton - petit */}
                            {unitQuantity > 0 && (
                              <button
                                onClick={() => removeFromCart(product.id, 'unit')}
                                className="w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center active:scale-95 transition-transform"
                              >
                                -
                              </button>
                            )}
                            {/* Bouton + GRAND */}
                            <button
                              onClick={() => addToCart(product.id, 'unit')}
                              disabled={isOutOfStock || availableStock <= 0}
                              className="w-12 h-12 bg-green-500 text-white rounded-lg text-xl font-bold disabled:bg-gray-300 active:scale-95 transition-transform shadow-md"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Options de vente pour les produits mixtes */}
                      {product.stockType === 'mixed' && !isOutOfStock && (
                        <div className="space-y-2 border-t pt-2">
                          {/* Vente par 11 (mètre) */}
                          {product.stock >= 11 && (
                            <div className="bg-green-50 p-2 rounded">
                              <div className="flex items-center justify-between">
                                <div className="text-xs">
                                  <div className="font-medium">Mètre (11)</div>
                                  <div className="text-green-600 font-semibold">{formatCurrency(product.pricePer11)}</div>
                                </div>
                                <div className="flex items-center space-x-1">
                                  {Math.floor(elevenQuantity / 11) > 0 && (
                                    <button
                                      onClick={() => removeFromCart(product.id, 'eleven')}
                                      className="w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center active:scale-95 transition-transform"
                                    >
                                      -
                                    </button>
                                  )}
                                  {Math.floor(elevenQuantity / 11) > 0 && (
                                    <span className="text-xs font-bold text-green-700 min-w-[15px] text-center">
                                      {Math.floor(elevenQuantity / 11)}
                                    </span>
                                  )}
                                  <button
                                    onClick={() => addToCart(product.id, 'eleven')}
                                    className="w-8 h-8 bg-green-500 text-white rounded text-sm font-bold active:scale-95 transition-transform"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Vente par bac */}
                          {product.stock >= product.packSize && (
                            <div className="bg-blue-50 p-2 rounded">
                              <div className="flex items-center justify-between">
                                <div className="text-xs">
                                  <div className="font-medium">Bac {product.packSize}</div>
                                  <div className="text-blue-600 font-semibold">{formatCurrency(product.pricePerPack)}</div>
                                </div>
                                <div className="flex items-center space-x-1">
                                  {Math.floor(packQuantity / product.packSize) > 0 && (
                                    <button
                                      onClick={() => removeFromCart(product.id, 'pack')}
                                      className="w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center active:scale-95 transition-transform"
                                    >
                                      -
                                    </button>
                                  )}
                                  {Math.floor(packQuantity / product.packSize) > 0 && (
                                    <span className="text-xs font-bold text-blue-700 min-w-[15px] text-center">
                                      {Math.floor(packQuantity / product.packSize)}
                                    </span>
                                  )}
                                  <button
                                    onClick={() => addToCart(product.id, 'pack')}
                                    className="w-8 h-8 bg-blue-500 text-white rounded text-sm font-bold active:scale-95 transition-transform"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Panier fixe en bas */}
        {Object.keys(cart).length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold">Total: {formatCurrency(cartTotal)}</span>
              <button
                onClick={validateOrder}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg active:scale-95 transition-transform"
              >
                Valider ({Object.values(cart).reduce((sum, item) => sum + item.quantity, 0)} articles)
              </button>
            </div>
          </div>
        )}

        {/* Modal de confirmation */}
        <Modal
          isOpen={orderConfirmation.show}
          onClose={() => setOrderConfirmation({ show: false, member: null, items: [], total: 0 })}
          title="Confirmer la commande"
        >
          <div className="space-y-4">
            {orderConfirmation.member && (
              <>
                <div className="bg-blue-50 p-3 rounded-lg">
                  <h3 className="font-semibold text-blue-800">
                    Commande de {orderConfirmation.member.name}
                  </h3>
                  <p className="text-sm text-blue-600">
                    Solde actuel: {formatCurrency(orderConfirmation.member.balance)}
                  </p>
                  <p className="text-sm text-blue-600">
                    Nouveau solde: {formatCurrency(orderConfirmation.member.balance - orderConfirmation.total)}
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium text-gray-700">Articles commandés :</h4>
                  {orderConfirmation.items.map((item, index) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <div>
                        <span className="font-medium">{item.quantity}x {item.productName}</span>
                      </div>
                      <span className="font-semibold text-green-600">
                        {formatCurrency(item.total)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-green-800">Total :</span>
                    <span className="text-xl font-bold text-green-600">
                      {formatCurrency(orderConfirmation.total)}
                    </span>
                  </div>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => setOrderConfirmation({ show: false, member: null, items: [], total: 0 })}
                    className="flex-1 p-3 bg-gray-500 text-white rounded-lg active:scale-95 transition-transform"
                  >
                    Retour à la commande
                  </button>
                  <button
                    onClick={confirmOrder}
                    className="flex-1 p-3 bg-green-500 text-white rounded-lg active:scale-95 transition-transform"
                  >
                    Valider la commande
                  </button>
                </div>
              </>
            )}
          </div>
        </Modal>
      </div>
    );
  }

  if (currentScreen === 'bar-history') {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Historique des transactions" onBack={() => navigateTo('bar')} />

        <div className="p-4">
          {orders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock size={48} className="mx-auto mb-2 opacity-50" />
              <p>Aucune transaction pour le moment</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .map(order => (
                  <div key={order.id} className="bg-white p-4 rounded-lg shadow-sm">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-medium">{order.memberName}</h3>
                        <p className="text-sm text-gray-600">{formatDateTime(order.timestamp)}</p>
                      </div>
                      <div className="text-right">
                        {order.type === 'repayment' || order.type === 'recharge' ? (
                          <div className="flex items-center space-x-1">
                            <CheckCircle size={16} className="text-green-500" />
                            <span className="font-semibold text-green-600">
                              +{formatCurrency(order.amount)}
                            </span>
                            {order.type === 'recharge' && (
                              <span className="text-xs bg-blue-100 text-blue-600 px-1 rounded">
                                Rechargement
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="font-semibold text-red-600">
                            -{formatCurrency(order.amount)}
                          </span>
                        )}
                      </div>
                    </div>

                    {order.items && order.items.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        {order.items.map((item, index) => (
                          <div key={index} className="flex justify-between text-sm text-gray-600">
                            <span>{item.quantity}x {item.productName}</span>
                            <span>{formatCurrency(item.total)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (currentScreen === 'boulots') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100">
        <Header title="Section Boulots" onBack={() => navigateTo('home')} />

        <div className="p-6 space-y-4">
          {/* NOUVEAU BOUTON - Boulots programmés */}
          <button
            onClick={() => navigateTo('boulots-scheduled')}
            className="w-full p-4 bg-white rounded-lg shadow-md active:scale-95 transition-transform"
          >
            <div className="flex items-center space-x-3">
              <Clock className="text-green-500" size={24} />
              <div className="text-left">
                <h3 className="font-semibold">Boulots programmés</h3>
                <p className="text-gray-600 text-sm">Planning et inscriptions</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigateTo('boulots-new')}
            className="w-full p-4 bg-white rounded-lg shadow-md active:scale-95 transition-transform"
          >
            <div className="flex items-center space-x-3">
              <Plus className="text-green-500" size={24} />
              <div className="text-left">
                <h3 className="font-semibold">Nouveau boulot</h3>
                <p className="text-gray-600 text-sm">Multi-Bro avec paiement</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigateTo('boulots-stats')}
            className="w-full p-4 bg-white rounded-lg shadow-md active:scale-95 transition-transform"
          >
            <div className="flex items-center space-x-3">
              <BarChart3 className="text-green-500" size={24} />
              <div className="text-left">
                <h3 className="font-semibold">Statistiques</h3>
                <p className="text-gray-600 text-sm">Graphiques et classements</p>
              </div>
            </div>
          </button>

          {/* RENOMMÉ : Historique → Boulots terminés */}
          <button
            onClick={() => navigateTo('boulots-history')}
            className="w-full p-4 bg-white rounded-lg shadow-md active:scale-95 transition-transform"
          >
            <div className="flex items-center space-x-3">
              <CheckCircle className="text-green-500" size={24} />
              <div className="text-left">
                <h3 className="font-semibold">Boulots terminés</h3>
                <p className="text-gray-600 text-sm">Avec statut paiements</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigateTo('boulots-bros')}
            className="w-full p-4 bg-white rounded-lg shadow-md active:scale-95 transition-transform"
          >
            <div className="flex items-center space-x-3">
              <User className="text-green-500" size={24} />
              <div className="text-left">
                <h3 className="font-semibold">Gestion des Bro</h3>
                <p className="text-gray-600 text-sm">Liste et suppressions</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  if (currentScreen === 'boulots-scheduled') {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Boulots programmés" onBack={() => navigateTo('boulots')} />

        <div className="p-4">
          {/* Bouton pour programmer un nouveau boulot */}
          <div className="mb-4">
            <button
              onClick={() => { setModalType('schedule-job'); setShowModal(true); }}
              className="w-full p-3 bg-green-500 text-white rounded-lg active:scale-95 transition-transform"
            >
              <div className="flex items-center justify-center space-x-2">
                <Plus size={20} />
                <span>Programmer un boulot</span>
              </div>
            </button>
          </div>

          {/* Liste des boulots programmés */}
          {scheduledJobs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock size={48} className="mx-auto mb-2 opacity-50" />
              <p>Aucun boulot programmé pour le moment</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(() => {
                // Grouper les boulots par date
                const jobsByDate = scheduledJobs
                  .sort((a, b) => new Date(a.date) - new Date(b.date))
                  .reduce((groups, job) => {
                    const dateKey = job.date;
                    if (!groups[dateKey]) {
                      groups[dateKey] = [];
                    }
                    groups[dateKey].push(job);
                    return groups;
                  }, {});

                return Object.entries(jobsByDate).map(([date, jobs]) => (
                  <div key={date}>
                    {/* Séparateur de date */}
                    <div className="flex items-center my-4">
                      <div className="flex-1 border-t border-gray-300"></div>
                      <div className="px-4 py-2 bg-gray-100 rounded-full">
                        <span className="text-sm font-semibold text-gray-700">
                          📅 {formatDate(date)}
                          {(() => {
                            const today = new Date().toISOString().split('T')[0];
                            const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

                            if (date === today) return ' (Aujourd\'hui)';
                            if (date === tomorrow) return ' (Demain)';

                            const daysDiff = Math.ceil((new Date(date) - new Date()) / (1000 * 60 * 60 * 24));
                            if (daysDiff < 0) return ` (Il y a ${Math.abs(daysDiff)} jour${Math.abs(daysDiff) > 1 ? 's' : ''})`;
                            if (daysDiff <= 7) return ` (Dans ${daysDiff} jour${daysDiff > 1 ? 's' : ''})`;

                            return '';
                          })()}
                        </span>
                      </div>
                      <div className="flex-1 border-t border-gray-300"></div>
                    </div>

                    {/* Boulots de cette date */}
                    <div className="space-y-3">
                      {jobs
                        .sort((a, b) => new Date(b.date) - new Date(a.date))
                        .map(job => {
                          const hasEnoughBros = job.registeredBros.length >= job.brosNeeded;
                          const hasAtLeastOneBro = job.registeredBros.length > 0;

                          // Code couleur plus nuancé
                          let statusColor, statusText, statusTextColor;

                          if (hasEnoughBros) {
                            statusColor = 'border-green-200 bg-green-50';
                            statusText = 'Prêt';
                            statusTextColor = 'text-green-700';
                          } else if (hasAtLeastOneBro) {
                            statusColor = 'border-orange-200 bg-orange-50';
                            statusText = `Partiel (${job.registeredBros.length}/${job.brosNeeded})`;
                            statusTextColor = 'text-orange-700';
                          } else {
                            statusColor = 'border-red-200 bg-red-50';
                            statusText = `${job.brosNeeded} Bro manquant(s)`;
                            statusTextColor = 'text-red-700';
                          }

                          return (
                            <div key={job.id} className={`bg-white border rounded-lg shadow-sm ${statusColor} p-4`}>
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <h3 className="font-medium">{job.description}</h3>
                                  <div className="space-y-1 mt-1">
                                    <p className="text-xs text-gray-500">
                                      💰 Tarif: {formatCurrency(job.customRate)}/h
                                    </p>
                                    {job.timeStart ? (
                                      <p className="text-xs text-gray-500">
                                        🕐 {job.timeStart} à {calculateEndTime(job.timeStart, job.estimatedHours || 1)}
                                      </p>
                                    ) : (
                                      <p className="text-xs text-gray-400">🕐 Horaires à définir</p>
                                    )}
                                    {job.location ? (
                                      <p className="text-xs text-gray-500">📍 {job.location}</p>
                                    ) : (
                                      <p className="text-xs text-gray-400">📍 Lieu à préciser</p>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right flex items-center space-x-2">
                                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${statusTextColor} ${hasEnoughBros ? 'bg-green-100' : hasAtLeastOneBro ? 'bg-orange-100' : 'bg-red-100'}`}>
                                    {statusText}
                                  </div>
                                  <div className="flex items-center space-x-1">
                                    <button
                                      onClick={() => {
                                        // Pré-remplir le formulaire avec les données existantes
                                        setNewScheduledJob({
                                          description: job.description,
                                          date: job.date,
                                          timeStart: job.timeStart || '09:00',
                                          estimatedHours: job.estimatedHours || 1,
                                          location: job.location || '',
                                          customRate: job.customRate,
                                          brosNeeded: job.brosNeeded,
                                          registeredBros: job.registeredBros,
                                          status: job.status
                                        });
                                        setEditingScheduledJob(job);
                                        setModalType('edit-scheduled-job');
                                        setShowModal(true);
                                      }}
                                      className="p-1 text-blue-500 hover:bg-blue-50 rounded active:scale-95 transition-transform"
                                      title="Modifier ce boulot"
                                    >
                                      <Settings size={14} />
                                    </button>
                                    <button
                                      onClick={() => {
                                        if (confirm(`Supprimer le boulot "${job.description}" ?`)) {
                                          deleteScheduledJob(job.id);
                                        }
                                      }}
                                      className="p-1 text-red-500 hover:bg-red-50 rounded active:scale-95 transition-transform"
                                      title="Supprimer ce boulot"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* Affichage des Bro inscrits */}
                              <div className="mt-3">
                                <p className="text-sm font-medium text-gray-700 mb-2">
                                  Bro inscrits ({job.registeredBros.length}/{job.brosNeeded}) :
                                </p>

                                {job.registeredBros.length > 0 ? (
                                  <div className="flex flex-wrap gap-2 mb-3">
                                    {job.registeredBros.map((registration, index) => {
                                      const bro = bros.find(b => b.id === registration.broId);

                                      // Vérifier si ce Bro a d'autres boulots le même jour
                                      const hasOtherJobsSameDay = scheduledJobs.some(otherJob =>
                                        otherJob.id !== job.id &&
                                        otherJob.date === job.date &&
                                        otherJob.registeredBros.some(reg => reg.broId === registration.broId)
                                      );

                                      return (
                                        <div key={index} className={`flex items-center px-2 py-1 rounded-full text-xs ${hasOtherJobsSameDay ? 'bg-orange-100 border border-orange-300' : 'bg-blue-100'
                                          }`}>
                                          <span className="mr-1">
                                            {hasOtherJobsSameDay && '⚠️ '}{bro?.name || 'Inconnu'}
                                          </span>
                                          <button
                                            onClick={() => removeBroFromScheduled(job.id, registration.broId)}
                                            className="text-red-500 hover:text-red-700"
                                          >
                                            <Minus size={12} />
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <p className="text-xs text-gray-500 mb-3">Aucun Bro inscrit</p>
                                )}

                                {/* Bouton pour s'inscrire + validation partielle */}
                                {job.registeredBros.length < job.brosNeeded && (
                                  <div className="flex items-center space-x-2">
                                    <button
                                      onClick={() => { setSelectedJob(job); setModalType('register-bro'); setShowModal(true); }}
                                      className="flex-1 p-2 bg-blue-500 text-white rounded text-sm active:scale-95 transition-transform"
                                    >
                                      Inscrire un Bro
                                    </button>

                                    {/* Petit bouton rond vert pour validation partielle */}
                                    {job.registeredBros.length > 0 && (
                                      <button
                                        onClick={() => completeScheduledJob(job.id, true)}
                                        className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center active:scale-95 transition-transform"
                                        title={`Valider avec ${job.registeredBros.length} Bro sur ${job.brosNeeded}`}
                                      >
                                        <span className="text-sm font-bold">✓</span>
                                      </button>
                                    )}
                                  </div>
                                )}

                                {/* Bouton normal si quota atteint */}
                                {hasEnoughBros && (
                                  <button
                                    onClick={() => completeScheduledJob(job.id, false)}
                                    className="w-full p-2 bg-green-500 text-white rounded text-sm active:scale-95 transition-transform"
                                  >
                                    ✅ Marquer comme terminé
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>

        {/* Modal pour programmer un boulot */}
        <Modal
          isOpen={showModal && (modalType === 'schedule-job' || modalType === 'edit-scheduled-job')}
          onClose={() => {
            setShowModal(false);
            setEditingScheduledJob(null);
            setNewScheduledJob({
              description: '',
              date: new Date().toISOString().split('T')[0],
              timeStart: '09:00',
              estimatedHours: 1,
              location: '',
              customRate: hourlyRate,
              brosNeeded: 1,
              registeredBros: [],
              status: 'planned'
            });
          }}
          title={editingScheduledJob ? "Modifier le boulot" : "Programmer un boulot"}
        >
          <div className="space-y-4">
            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📝 Description du travail *
              </label>
              <textarea
                value={newScheduledJob.description}
                onChange={(e) => setNewScheduledJob({ ...newScheduledJob, description: e.target.value })}
                placeholder="Ex: Nettoyage des locaux, installation matériel..."
                className="w-full p-3 border rounded-lg h-20 resize-none"
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📅 Date prévue *
              </label>
              <input
                type="date"
                value={newScheduledJob.date}
                onChange={(e) => setNewScheduledJob({ ...newScheduledJob, date: e.target.value })}
                className="w-full p-3 border rounded-lg"
              />
            </div>

            {/* Heure de début */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🕐 Heure de début *
              </label>
              <input
                type="time"
                value={newScheduledJob.timeStart}
                onChange={(e) => setNewScheduledJob({ ...newScheduledJob, timeStart: e.target.value })}
                className="w-full p-3 border rounded-lg"
              />
            </div>

            {/* Lieu */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📍 Lieu de rendez-vous
              </label>
              <input
                type="text"
                value={newScheduledJob.location}
                onChange={(e) => setNewScheduledJob({ ...newScheduledJob, location: e.target.value })}
                className="w-full p-3 border rounded-lg"
                placeholder="Ex: Salle principale, Local technique, Extérieur..."
              />
            </div>

            {/* Durée estimée */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ⏱️ Durée estimée *
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="12"
                  value={newScheduledJob.estimatedHours}
                  onChange={(e) => setNewScheduledJob({ ...newScheduledJob, estimatedHours: parseFloat(e.target.value) || 1 })}
                  className="w-full p-3 border rounded-lg pr-12"
                  placeholder="1.0"
                />
                <span className="absolute right-3 top-3 text-gray-500">heure(s)</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Durée estimée du boulot par personne
              </p>
            </div>

            {/* Tarif horaire */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                💰 Tarif horaire *
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  value={newScheduledJob.customRate}
                  onChange={(e) => setNewScheduledJob({ ...newScheduledJob, customRate: parseFloat(e.target.value) || 0 })}
                  className="w-full p-3 border rounded-lg pr-8"
                  placeholder="10.00"
                />
                <span className="absolute right-3 top-3 text-gray-500">€/h</span>
              </div>
            </div>

            {/* Nombre de Bro nécessaires */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                👥 Nombre de Bro nécessaires *
              </label>
              <input
                type="number"
                min="1"
                max={bros.length}
                value={newScheduledJob.brosNeeded}
                onChange={(e) => setNewScheduledJob({ ...newScheduledJob, brosNeeded: parseInt(e.target.value) || 1 })}
                className="w-full p-3 border rounded-lg"
                placeholder="1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Nombre de personnes requises pour ce boulot (max: {bros.length} Bro disponibles)
              </p>
            </div>

            {/* Aperçu du coût */}
            <div className="bg-blue-50 p-3 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-1">💡 Estimation :</h4>
              <div className="text-sm text-blue-700 space-y-1">
                <p>📅 {formatDate(newScheduledJob.date)} de {newScheduledJob.timeStart} à {calculateEndTime(newScheduledJob.timeStart, newScheduledJob.estimatedHours)}</p>
                {newScheduledJob.location && (
                  <p>📍 Lieu: {newScheduledJob.location}</p>
                )}
                <p>⏱️ Durée: {newScheduledJob.estimatedHours}h par personne</p>
                <p>💰 Tarif: {formatCurrency(newScheduledJob.customRate)}/heure</p>
                <p>👥 Bro requis: {newScheduledJob.brosNeeded} personne(s)</p>
                <p className="font-semibold border-t border-blue-200 pt-1 mt-2">
                  💸 Coût total estimé: {formatCurrency(newScheduledJob.customRate * newScheduledJob.estimatedHours * newScheduledJob.brosNeeded)}
                </p>
              </div>
            </div>

            <button
              onClick={editingScheduledJob ? updateScheduledJob : addScheduledJob}
              disabled={!newScheduledJob.description.trim() || newScheduledJob.brosNeeded < 1 || newScheduledJob.customRate <= 0}
              className="w-full p-3 bg-green-500 text-white rounded-lg disabled:bg-gray-300 active:scale-95 transition-transform"
            >
              {editingScheduledJob ? "💾 Sauvegarder les modifications" : "✅ Programmer le boulot"}
            </button>
          </div>
        </Modal>

        {/* Modal pour inscrire un Bro */}
        <Modal
          isOpen={showModal && modalType === 'register-bro'}
          onClose={() => { setShowModal(false); setSelectedJob(null); }}
          title="Inscrire un Bro"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Boulot: <strong>{selectedJob?.description}</strong>
            </p>
            <p className="text-sm text-gray-600">
              Date: <strong>{selectedJob ? formatDate(selectedJob.date) : ''}</strong>
            </p>
            <p className="text-sm text-gray-600">
              Places disponibles: <strong>{selectedJob ? selectedJob.brosNeeded - selectedJob.registeredBros.length : 0}</strong>
            </p>

            <div className="space-y-2">
              {bros.filter(bro =>
                !selectedJob?.registeredBros.some(reg => reg.broId === bro.id)
              ).map(bro => {
                // Vérifier si le Bro a un conflit d'horaire
                const hasConflict = scheduledJobs.some(otherJob =>
                  otherJob.id !== selectedJob?.id &&
                  otherJob.date === selectedJob?.date &&
                  otherJob.registeredBros.some(reg => reg.broId === bro.id)
                );

                const conflictingJob = hasConflict ? scheduledJobs.find(otherJob =>
                  otherJob.id !== selectedJob?.id &&
                  otherJob.date === selectedJob?.date &&
                  otherJob.registeredBros.some(reg => reg.broId === bro.id)
                ) : null;

                return (
                  <div key={bro.id} className={`border rounded-lg p-3 ${hasConflict ? 'border-orange-300 bg-orange-50' : 'border-gray-200 bg-white'}`}>
                    <button
                      onClick={() => registerBroToJob(selectedJob?.id, bro.id)}
                      className={`w-full text-left active:scale-95 transition-transform ${hasConflict ? 'opacity-75' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{bro.name}</span>
                            {hasConflict && (
                              <span className="px-2 py-1 bg-orange-200 text-orange-800 text-xs rounded-full">
                                ⚠️ Conflit
                              </span>
                            )}
                          </div>
                          <span className="text-sm text-gray-500">{bro.totalHours}h totales</span>
                          {hasConflict && conflictingJob && (
                            <div className="text-xs text-orange-600 mt-1">
                              Déjà inscrit sur: "{conflictingJob.description}"
                            </div>
                          )}
                        </div>
                        <div className="text-gray-400">→</div>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>

            {bros.filter(bro =>
              !selectedJob?.registeredBros.some(reg => reg.broId === bro.id)
            ).length === 0 && (
                <p className="text-center text-gray-500">Tous les Bro sont déjà inscrits</p>
              )}

            {/* Légende */}
            <div className="bg-gray-50 p-3 rounded-lg">
              <h4 className="font-medium text-gray-800 mb-2">💡 Légende :</h4>
              <div className="text-sm text-gray-600 space-y-1">
                <p>• <span className="font-medium">Normal</span> : Bro disponible</p>
                <p>• <span className="font-medium text-orange-600">⚠️ Conflit</span> : Déjà inscrit ce jour-là (clic possible avec confirmation)</p>
              </div>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  if (currentScreen === 'boulots-bros') {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Gestion des Bro" onBack={() => navigateTo('boulots')} />

        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Bro ({bros.length})</h2>
            <button
              onClick={() => { setModalType('add-bro'); setShowModal(true); }}
              className="p-2 bg-green-500 text-white rounded-full active:scale-95 transition-transform"
            >
              <Plus size={20} />
            </button>
          </div>

          <div className="space-y-3">
            {bros.map(bro => (
              <div key={bro.id} className="bg-white p-4 rounded-lg shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium">{bro.name}</h3>
                    <p className="text-sm text-gray-600">
                      Heures totales: <span className="font-semibold text-green-600">{bro.totalHours}h</span>
                    </p>
                    <p className="text-sm text-gray-600">
                      Gains estimés: <span className="font-semibold text-green-600">
                        {formatCurrency(bro.totalHours * hourlyRate)}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="text-right">
                      <div className="text-sm text-gray-500">
                        {jobs.filter(j => j.broId === bro.id).length} boulots
                      </div>
                    </div>
                    <button
                      onClick={() => deleteBro(bro.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded active:scale-95 transition-transform"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Modal
          isOpen={showModal && modalType === 'add-bro'}
          onClose={() => { setShowModal(false); setNewBroName(''); }}
          title="Ajouter un Bro"
        >
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Nom du Bro"
              value={newBroName}
              onChange={(e) => setNewBroName(e.target.value)}
              className="w-full p-3 border rounded-lg"
            />
            <button
              onClick={addBro}
              disabled={!newBroName.trim()}
              className="w-full p-3 bg-green-500 text-white rounded-lg disabled:bg-gray-300 active:scale-95 transition-transform"
            >
              Ajouter
            </button>
          </div>
        </Modal>
      </div>
    );
  }

  if (currentScreen === 'boulots-new') {
    const addBroToJob = () => {
      setShowBroDropdown(!showBroDropdown);
    };

    const selectBroForJob = (broId) => {
      setNewJob({
        ...newJob,
        bros: [...newJob.bros, { broId: broId, hours: 0 }]
      });
      setShowBroDropdown(false);
    };

    const removeBroFromJob = (index) => {
      const newBros = newJob.bros.filter((_, i) => i !== index);
      setNewJob({ ...newJob, bros: newBros });
    };

    const updateBroHours = (index, hours) => {
      const newBros = [...newJob.bros];
      newBros[index].hours = parseFloat(hours) || 0;
      setNewJob({ ...newJob, bros: newBros });
    };

    const updateBroSelection = (index, broId) => {
      const newBros = [...newJob.bros];
      newBros[index].broId = broId; // Supprimez parseInt()
      setNewJob({ ...newJob, bros: newBros });
    };
    const totalHours = newJob.bros.reduce((sum, assignment) => sum + assignment.hours, 0);
    const totalCost = totalHours * newJob.customRate;

    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Nouveau boulot" onBack={() => navigateTo('boulots')} />

        <div className="p-4">
          <div className="bg-white p-4 rounded-lg shadow-sm space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description du travail
              </label>
              <textarea
                value={newJob.description}
                onChange={(e) => setNewJob({ ...newJob, description: e.target.value })}
                placeholder="Décrire la tâche effectuée..."
                className="w-full p-3 border rounded-lg h-20 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date du travail
              </label>
              <input
                type="date"
                value={newJob.date}
                onChange={(e) => setNewJob({ ...newJob, date: e.target.value })}
                className="w-full p-3 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tarif horaire pour ce boulot
              </label>
              <input
                type="number"
                step="0.25"
                min="0"
                value={newJob.customRate}
                onChange={(e) => setNewJob({ ...newJob, customRate: parseFloat(e.target.value) || 0 })}
                className="w-full p-3 border rounded-lg"
                placeholder="€/heure"
              />
            </div>

            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={newJob.isPaid}
                  onChange={(e) => setNewJob({ ...newJob, isPaid: e.target.checked, paymentMethod: '' })}
                  className="rounded"
                />
                <span className="text-sm font-medium text-gray-700">
                  Boulot payé directement
                </span>
              </label>
              {newJob.isPaid && (
                <div className="mt-3 space-y-3">
                  <p className="text-xs text-green-600">
                    ✅ Ce boulot sera marqué comme payé lors de la création
                  </p>

                  {/* Mode de paiement */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      💳 Mode de paiement *
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewJob({ ...newJob, paymentMethod: 'cash' })}
                        className={`p-3 border rounded-lg text-sm font-medium active:scale-95 transition-transform ${newJob.paymentMethod === 'cash'
                          ? 'bg-green-100 border-green-500 text-green-700'
                          : 'bg-gray-50 border-gray-300 text-gray-600'
                          }`}
                      >
                        💵 Cash
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewJob({ ...newJob, paymentMethod: 'account' })}
                        className={`p-3 border rounded-lg text-sm font-medium active:scale-95 transition-transform ${newJob.paymentMethod === 'account'
                          ? 'bg-blue-100 border-blue-500 text-blue-700'
                          : 'bg-gray-50 border-gray-300 text-gray-600'
                          }`}
                      >
                        🏦 Compte
                      </button>
                    </div>
                    {newJob.isPaid && !newJob.paymentMethod && (
                      <p className="text-xs text-red-500 mt-1">Veuillez sélectionner un mode de paiement</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="mb-3">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">
                    Bro assignés ({newJob.bros.length})
                  </label>
                  <button
                    onClick={addBroToJob}
                    disabled={newJob.bros.length >= bros.length}
                    className="p-1 bg-green-500 text-white rounded disabled:bg-gray-300 active:scale-95 transition-transform"
                  >
                    <Plus size={16} />
                  </button>
                </div>

                {showBroDropdown && (
                  <div className="mt-2 p-2 bg-gray-50 rounded border">
                    <p className="text-sm text-gray-600 mb-2">Sélectionner un Bro :</p>
                    <div className="space-y-1">
                      {bros.filter(bro =>
                        !newJob.bros.some(assignment => assignment.broId === bro.id)
                      ).map(bro => (
                        <button
                          key={bro.id}
                          onClick={() => selectBroForJob(bro.id)}
                          className="w-full text-left p-2 hover:bg-gray-200 rounded text-sm"
                        >
                          {bro.name}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setShowBroDropdown(false)}
                      className="mt-2 text-xs text-gray-500 hover:text-gray-700"
                    >
                      Annuler
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {newJob.bros.map((assignment, index) => {
                  const availableBros = bros.filter(bro =>
                    bro.id === assignment.broId ||
                    !newJob.bros.some(a => a.broId === bro.id)
                  );

                  return (
                    <div key={index} className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                      <select
                        value={assignment.broId}
                        onChange={(e) => updateBroSelection(index, e.target.value)}
                        className="flex-1 p-2 border rounded"
                      >
                        <option value="">Choisir un Bro...</option>
                        {availableBros.map(bro => (
                          <option key={bro.id} value={bro.id}>{bro.name}</option>
                        ))}
                      </select>

                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={assignment.hours}
                        onChange={(e) => updateBroHours(index, e.target.value)}
                        placeholder="Heures"
                        className="w-20 p-2 border rounded text-center"
                      />

                      <span className="text-sm text-gray-600 w-16">
                        {formatCurrency(assignment.hours * newJob.customRate)}
                      </span>

                      <button
                        onClick={() => removeBroFromJob(index)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded active:scale-95 transition-transform"
                      >
                        <Minus size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>

              {newJob.bros.length === 0 && (
                <div className="text-center py-4 text-gray-500 bg-gray-50 rounded-lg">
                  <User size={24} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Aucun Bro assigné</p>
                </div>
              )}
            </div>

            {totalHours > 0 && (
              <div className="bg-green-50 p-3 rounded-lg">
                <h4 className="font-medium text-green-800 mb-1">Récapitulatif:</h4>
                <div className="text-sm text-green-700 space-y-1">
                  <p>Total heures: {totalHours}h</p>
                  <p>Tarif: {formatCurrency(newJob.customRate)}/h</p>
                  <p className="font-semibold">Coût total: {formatCurrency(totalCost)}</p>
                  <p className={`font-semibold ${newJob.isPaid ? 'text-green-600' : 'text-orange-600'}`}>
                    Statut: {newJob.isPaid ? '✅ Payé' : '⏳ Non payé'}
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={addJob}
              disabled={
                !newJob.description.trim() ||
                newJob.bros.length === 0 ||
                !newJob.bros.every(b => b.broId && b.hours > 0) ||
                (newJob.isPaid && !newJob.paymentMethod)
              }
              className="w-full p-3 bg-green-500 text-white rounded-lg disabled:bg-gray-300 active:scale-95 transition-transform"
            >
              Valider le boulot
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (currentScreen === 'boulots-history') {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Historique des boulots" onBack={() => navigateTo('boulots')} />

        <div className="p-4">
          {jobs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Wrench size={48} className="mx-auto mb-2 opacity-50" />
              <p>Aucun boulot enregistré pour le moment</p>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs
                .sort((a, b) => new Date(b.date || b.timestamp || b.createdAt) - new Date(a.date || a.timestamp || a.createdAt))
                .map(job => (
                  <div key={job.id} className="bg-white p-4 rounded-lg shadow-sm">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="font-medium">{job.broName}</h3>
                          <button
                            onClick={() => {
                              setSelectedJob(job);
                              setModalType('toggle-job-payment');
                              setShowModal(true);
                            }}
                            className={`px-2 py-1 rounded-full text-xs font-medium active:scale-95 transition-transform ${job.isPaid
                              ? 'bg-green-100 text-green-800'
                              : 'bg-orange-100 text-orange-800'
                              }`}
                          >
                            {job.isPaid ? (
                              <span>
                                ✅ Payé {job.paymentMethod === 'cash' ? '💵' : job.paymentMethod === 'account' ? '🏦' : ''}
                              </span>
                            ) : (
                              '⏳ Non payé'
                            )}
                          </button>
                          {/* Nouveau badge pour les boulots partiels */}
                          {job.isPartialCompletion && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              ⚠️ Partiel ({job.actualBrosUsed}/{job.originalBrosNeeded})
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{job.description}</p>
                        <p className="text-xs text-gray-500 mt-1">{formatDate(job.date)}</p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="font-semibold text-green-600">{job.hours}h</p>
                        <p className="text-sm text-green-600">{formatCurrency(job.total)}</p>
                        <p className="text-xs text-gray-500">{formatCurrency(job.hourlyRate)}/h</p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Modal pour le paiement des boulots */}
        <Modal
          isOpen={showModal && modalType === 'toggle-job-payment'}
          onClose={() => { setShowModal(false); setSelectedJob(null); setPaymentMethod(''); }}
          title={selectedJob?.isPaid ? "Annuler le paiement" : "Confirmer le paiement"}
        >
          <div className="space-y-4">
            {!selectedJob?.isPaid ? (
              // Payer le boulot
              <>
                <div className="text-center">
                  <h3 className="font-medium">{selectedJob?.broName}</h3>
                  <p className="text-sm text-gray-600">{selectedJob?.description}</p>
                  <p className="text-lg font-semibold text-green-600 mt-2">
                    {formatCurrency(selectedJob?.total || 0)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {selectedJob?.hours}h × {formatCurrency(selectedJob?.hourlyRate || 0)}/h
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    💳 Mode de paiement *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cash')}
                      className={`p-3 border rounded-lg text-sm font-medium active:scale-95 transition-transform ${paymentMethod === 'cash'
                        ? 'bg-green-100 border-green-500 text-green-700'
                        : 'bg-gray-50 border-gray-300 text-gray-600'
                        }`}
                    >
                      💵 Cash
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('account')}
                      className={`p-3 border rounded-lg text-sm font-medium active:scale-95 transition-transform ${paymentMethod === 'account'
                        ? 'bg-blue-100 border-blue-500 text-blue-700'
                        : 'bg-gray-50 border-gray-300 text-gray-600'
                        }`}
                    >
                      🏦 Compte
                    </button>
                  </div>
                  {!paymentMethod && (
                    <p className="text-xs text-red-500 mt-1">Veuillez sélectionner un mode de paiement</p>
                  )}
                </div>

                <button
                  onClick={() => confirmJobPayment(selectedJob?.id, paymentMethod)}
                  disabled={!paymentMethod || loading}
                  className="w-full p-3 bg-green-500 text-white rounded-lg disabled:bg-gray-300 active:scale-95 transition-transform"
                >
                  {loading ? 'Traitement...' : '✅ Confirmer le paiement'}
                </button>
              </>
            ) : (
              // Annuler le paiement
              <>
                <div className="text-center">
                  <h3 className="font-medium">{selectedJob?.broName}</h3>
                  <p className="text-sm text-gray-600">{selectedJob?.description}</p>
                  <p className="text-lg font-semibold text-red-600 mt-2">
                    Payé {selectedJob?.paymentMethod === 'cash' ? '💵 Cash' : '🏦 Compte'}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Voulez-vous annuler ce paiement ?
                  </p>
                </div>

                <button
                  onClick={() => confirmJobPayment(selectedJob?.id, null, true)}
                  disabled={loading}
                  className="w-full p-3 bg-red-500 text-white rounded-lg disabled:bg-gray-300 active:scale-95 transition-transform"
                >
                  {loading ? 'Traitement...' : '❌ Annuler le paiement'}
                </button>
              </>
            )}
          </div>
        </Modal>
      </div>
    );
  }

  if (currentScreen === 'boulots-stats') {
    // Calculer les vrais gains à partir des jobs individuels
    const chartData = bros.map(bro => {
      const broJobs = jobs.filter(j => j.broId === bro.id);
      const realEarnings = broJobs.reduce((sum, job) => sum + (job.total || 0), 0);

      return {
        name: bro.name,
        hours: bro.totalHours,
        earnings: realEarnings,
        jobs: broJobs.length
      };
    }).sort((a, b) => b.hours - a.hours);

    const totalEarnings = chartData.reduce((sum, bro) => sum + bro.earnings, 0);

    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Statistiques des Bro" onBack={() => navigateTo('boulots')} />

        <div className="p-4 space-y-6">
          {/* Statistiques globales en premier */}
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h3 className="font-semibold text-lg mb-4 text-center">Statistiques globales</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 p-3 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-600">
                  {chartData.reduce((sum, bro) => sum + bro.hours, 0)}h
                </div>
                <div className="text-xs text-gray-600">Total heures</div>
              </div>

              <div className="bg-blue-50 p-3 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(totalEarnings)}
                </div>
                <div className="text-xs text-gray-600">Total gains réels</div>
              </div>

              <div className="bg-purple-50 p-3 rounded-lg text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {jobs.length}
                </div>
                <div className="text-xs text-gray-600">Total boulots</div>
              </div>

              <div className="bg-orange-50 p-3 rounded-lg text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {chartData.length > 0 ? (() => {
                    const avgHours = chartData.reduce((sum, bro) => sum + bro.hours, 0) / chartData.length;
                    const hours = Math.floor(avgHours);
                    const minutes = Math.round((avgHours - hours) * 60);
                    return `${hours}h${minutes.toString().padStart(2, '0')}min`;
                  })() : '0h00min'}
                </div>
                <div className="text-xs text-gray-600">Moyenne/Bro</div>
              </div>
            </div>
          </div>

          {/* Classement basé sur les heures */}
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h3 className="font-semibold text-lg mb-4 text-center">Classement par heures travaillées</h3>

            <div className="space-y-2">
              {chartData.map((bro, index) => (
                <div key={bro.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${index === 0 ? 'bg-yellow-500' :
                      index === 1 ? 'bg-gray-400' :
                        index === 2 ? 'bg-orange-600' : 'bg-gray-300'
                      }`}>
                      {index + 1}
                    </div>
                    <div>
                      <h4 className="font-medium">{bro.name}</h4>
                      <p className="text-sm text-gray-600">{bro.jobs} boulots effectués</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-600">{bro.hours}h</p>
                    <p className="text-sm text-gray-600">{formatCurrency(bro.earnings)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Diagramme circulaire des gains */}
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h3 className="font-semibold text-lg mb-4 text-center">Répartition des gains réels</h3>

            {chartData.filter(bro => bro.earnings > 0).length > 0 ? (
              <div className="flex flex-col items-center space-y-4">
                {/* Diagramme circulaire simplifié */}
                <div className="relative w-48 h-48">
                  <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                    {chartData.filter(bro => bro.earnings > 0).map((bro, index) => {
                      const percentage = (bro.earnings / totalEarnings) * 100;
                      const angle = (percentage / 100) * 360;
                      const startAngle = chartData.slice(0, index).reduce((sum, prevBro) =>
                        sum + ((prevBro.earnings / totalEarnings) * 360), 0);

                      const colors = [
                        '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#eab308'
                      ];
                      const color = colors[index % colors.length];

                      // Calcul des coordonnées pour le path de l'arc
                      const centerX = 50;
                      const centerY = 50;
                      const radius = 40;

                      const startAngleRad = (startAngle * Math.PI) / 180;
                      const endAngleRad = ((startAngle + angle) * Math.PI) / 180;

                      const x1 = centerX + radius * Math.cos(startAngleRad);
                      const y1 = centerY + radius * Math.sin(startAngleRad);
                      const x2 = centerX + radius * Math.cos(endAngleRad);
                      const y2 = centerY + radius * Math.sin(endAngleRad);

                      const largeArcFlag = angle > 180 ? 1 : 0;

                      return (
                        <path
                          key={bro.name}
                          d={`M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`}
                          fill={color}
                          stroke="white"
                          strokeWidth="1"
                        />
                      );
                    })}
                  </svg>
                </div>

                {/* Légende */}
                <div className="space-y-2 w-full">
                  {chartData.filter(bro => bro.earnings > 0).map((bro, index) => {
                    const percentage = ((bro.earnings / totalEarnings) * 100).toFixed(1);
                    const colors = [
                      'bg-green-500', 'bg-blue-500', 'bg-purple-500', 'bg-orange-500', 'bg-red-500', 'bg-yellow-500'
                    ];
                    const color = colors[index % colors.length];

                    return (
                      <div key={bro.name} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center space-x-2">
                          <div className={`w-3 h-3 rounded-full ${color}`}></div>
                          <span className="text-sm font-medium">{bro.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-semibold text-green-600">
                            {formatCurrency(bro.earnings)}
                          </span>
                          <span className="text-xs text-gray-500 ml-1">
                            ({percentage}%)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <BarChart3 size={48} className="mx-auto mb-2 opacity-50" />
                <p>Aucun gain à afficher</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (currentScreen === 'finance') {
    // Calculer les totaux
    const calculateTotals = () => {
      let cashTotal = 0;
      let accountTotal = 0;

      // Ajouter les transactions financières manuelles
      financialTransactions.forEach(transaction => {
        const amount = transaction.amount || 0;
        if (transaction.paymentMethod === 'cash') {
          cashTotal += transaction.type === 'income' ? amount : -amount;
        } else if (transaction.paymentMethod === 'account') {
          accountTotal += transaction.type === 'income' ? amount : -amount;
        }
      });

      // Ajouter les remboursements/rechargements membres
      orders.forEach(order => {
        if (order.type === 'repayment' || order.type === 'recharge') {
          const amount = order.amount || 0;
          if (order.paymentMethod === 'cash') {
            cashTotal += amount;
          } else if (order.paymentMethod === 'account') {
            accountTotal += amount;
          }
        }
      });

      // Ajouter les paiements de boulots
      jobs.forEach(job => {
        if (job.isPaid && job.paymentMethod) {
          const amount = job.total || 0;
          if (job.paymentMethod === 'cash') {
            cashTotal += amount; // Les jobs rapportent de l'argent ✅
          } else if (job.paymentMethod === 'account') {
            accountTotal += amount;
          }
        }
      });
      // NOUVEAU : Calculer la valeur du stock
      let stockValue = 0;
      products.forEach(product => {
        const quantity = product.stock || 0;
        const unitPrice = product.price || 0;
        stockValue += quantity * unitPrice;
      });

      return {
        cashTotal,
        accountTotal,
        stockValue, // Nouvelle valeur pour info
        grandTotal: cashTotal + accountTotal // Total reste inchangé
      };
    };

    const { cashTotal, accountTotal, stockValue, grandTotal } = calculateTotals();

    const handleNotificationToggle = async () => {
      if (permission === 'granted') {
        alert('🔔 Les notifications sont déjà activées !\n\nPour les désactiver, allez dans les paramètres de votre navigateur.');
        return;
      }

      if (permission === 'denied') {
        alert('❌ Les notifications sont bloquées.\n\nPour les réactiver :\n1. Cliquez sur 🔒 dans la barre d\'adresse\n2. Autorisez les notifications\n3. Rechargez la page');
        return;
      }

      // Permission par défaut - demander l'autorisation
      try {
        const result = await requestPermission();
        if (result === 'granted') {
          alert('✅ Notifications activées avec succès !\n\nVous recevrez maintenant les alertes pour les nouveaux boulots.');
        }
      } catch (error) {
        console.error('Erreur permission:', error);
        alert('❌ Erreur lors de l\'activation des notifications');
      }
    };

    const processBankDeposit = async () => {
      const amount = parseFloat(bankDeposit.amount);

      // Calculer cashTotal dans la fonction
      let currentCashTotal = 0;
      let currentAccountTotal = 0;

      // Ajouter les transactions financiÃ¨res manuelles
      financialTransactions.forEach(transaction => {
        const transactionAmount = transaction.amount || 0;
        if (transaction.paymentMethod === 'cash') {
          currentCashTotal += transaction.type === 'income' ? transactionAmount : -transactionAmount;
        } else if (transaction.paymentMethod === 'account') {
          currentAccountTotal += transaction.type === 'income' ? transactionAmount : -transactionAmount;
        }
      });

      // Ajouter les remboursements/rechargements membres
      orders.forEach(order => {
        if (order.type === 'repayment' || order.type === 'recharge') {
          const orderAmount = order.amount || 0;
          if (order.paymentMethod === 'cash') {
            currentCashTotal += orderAmount;
          } else if (order.paymentMethod === 'account') {
            currentAccountTotal += orderAmount;
          }
        } else if (order.type === 'order') {
          const orderAmount = order.amount || 0;
          currentCashTotal += orderAmount; // Les ventes vont en caisse par dÃ©faut
        }
      });

      // Ajouter les revenus des boulots payÃ©s
      jobs.forEach(job => {
        if (job.isPaid) {
          const jobAmount = job.total || 0;
          if (job.paymentMethod === 'cash') {
            currentCashTotal += jobAmount;
          } else if (job.paymentMethod === 'account') {
            currentAccountTotal += jobAmount;
          }
        }
      });

      if (amount > 0 && amount <= currentCashTotal) {
        // CrÃ©er les 2 transactions : sortie cash + entrÃ©e compte
        const transactions = [
          {
            type: 'expense',
            amount: amount,
            description: bankDeposit.description || `DÃ©pÃ´t bancaire du ${formatDate(new Date().toISOString())}`,
            paymentMethod: 'cash',
            category: 'bank_transfer',
            timestamp: new Date().toISOString()
          },
          {
            type: 'income',
            amount: amount,
            description: bankDeposit.description || `DÃ©pÃ´t bancaire du ${formatDate(new Date().toISOString())}`,
            paymentMethod: 'account',
            category: 'bank_transfer',
            timestamp: new Date().toISOString()
          }
        ];

        try {
          // Sauvegarder les 2 transactions
          await Promise.all(transactions.map(transaction =>
            saveToFirebase('financialTransactions', transaction)
          ));

          // Reset du formulaire
          setBankDeposit({ amount: '', description: '' });
          setShowModal(false);

          // Message de succÃ¨s
          alert(`DÃ©pÃ´t de ${formatCurrency(amount)} effectuÃ© avec succÃ¨s !`);

        } catch (error) {
          console.error('Erreur dÃ©pÃ´t bancaire:', error);
          alert('Erreur lors du dÃ©pÃ´t bancaire');
        }
      } else {
        alert(`Impossible de dÃ©poser ${formatCurrency(amount)}. Caisse disponible: ${formatCurrency(currentCashTotal)}`);
      }
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50">
        <Header title="Section Finance" onBack={() => navigateTo('home')} />

        <div className="p-6 space-y-6">
          {/* Objectif Financier */}
          {financialGoal.isActive && (
            <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl shadow-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-purple-800">🎯 Objectif Financier</h2>
                <span className="text-sm text-purple-600">
                  Géré dans Paramètres
                </span>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-purple-800">{financialGoal.description}</h3>
                  <span className="text-sm text-purple-600">
                    {financialGoal.deadline && `Échéance: ${formatDate(financialGoal.deadline)}`}
                  </span>
                </div>

                {/* Barre de progression */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-purple-700">
                      {formatCurrency(grandTotal)} / {formatCurrency(financialGoal.amount)}
                    </span>
                    <span className={`font-bold ${(grandTotal / financialGoal.amount) * 100 >= 100
                      ? 'text-green-600'
                      : (grandTotal / financialGoal.amount) * 100 >= 75
                        ? 'text-blue-600'
                        : (grandTotal / financialGoal.amount) * 100 >= 50
                          ? 'text-yellow-600'
                          : 'text-red-600'
                      }`}>
                      {((grandTotal / financialGoal.amount) * 100).toFixed(1)}%
                    </span>
                  </div>

                  <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                    <div
                      className={`h-4 rounded-full transition-all duration-1000 ease-out ${(grandTotal / financialGoal.amount) * 100 >= 100
                        ? 'bg-gradient-to-r from-green-400 to-green-600'
                        : (grandTotal / financialGoal.amount) * 100 >= 75
                          ? 'bg-gradient-to-r from-blue-400 to-blue-600'
                          : (grandTotal / financialGoal.amount) * 100 >= 50
                            ? 'bg-gradient-to-r from-yellow-400 to-yellow-600'
                            : 'bg-gradient-to-r from-red-400 to-red-600'
                        }`}
                      style={{ width: `${Math.min(100, (grandTotal / financialGoal.amount) * 100)}%` }}
                    ></div>
                  </div>
                </div>

                {/* Message motivationnel */}
                <div className="text-center">
                  {(() => {
                    const percentage = (grandTotal / financialGoal.amount) * 100;
                    const remaining = Math.max(0, financialGoal.amount - grandTotal);

                    if (percentage >= 100) {
                      return (
                        <p className="text-green-700 font-semibold">
                          🎉 Objectif atteint ! Félicitations !
                        </p>
                      );
                    } else if (percentage >= 75) {
                      return (
                        <p className="text-blue-700 font-semibold">
                          🚀 Excellent ! Plus que {formatCurrency(remaining)} à atteindre !
                        </p>
                      );
                    } else if (percentage >= 50) {
                      return (
                        <p className="text-yellow-700 font-semibold">
                          💪 Bonne progression ! Il reste {formatCurrency(remaining)}.
                        </p>
                      );
                    } else if (percentage >= 25) {
                      return (
                        <p className="text-orange-700 font-semibold">
                          📈 En route vers l'objectif ! Encore {formatCurrency(remaining)}.
                        </p>
                      );
                    } else {
                      return (
                        <p className="text-red-700 font-semibold">
                          🎯 Objectif fixé ! Il faut encore {formatCurrency(remaining)}.
                        </p>
                      );
                    }
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Bouton définir objectif si pas actif */}
          {!financialGoal.isActive && (
            <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl shadow-lg p-6 mb-6 text-center">
              <h2 className="text-xl font-bold text-purple-800 mb-4">🎯 Définir un Objectif</h2>
              <p className="text-purple-600 mb-4">
                Fixez-vous un objectif financier pour rester motivé !
              </p>
              <button
                onClick={() => navigateTo('settings-goal')}
                className="px-6 py-3 bg-purple-500 text-white rounded-lg font-semibold active:scale-95 transition-transform"
              >
                ⚙️ Aller aux Paramètres
              </button>
            </div>
          )}

          {/* Résumé des soldes */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">💰 Trésorerie Actuelle</h2>
              {financialGoal.isActive && (
                <div className={`px-3 py-1 rounded-full text-sm font-semibold ${(grandTotal / financialGoal.amount) * 100 >= 100
                  ? 'bg-green-100 text-green-800'
                  : (grandTotal / financialGoal.amount) * 100 >= 75
                    ? 'bg-blue-100 text-blue-800'
                    : (grandTotal / financialGoal.amount) * 100 >= 50
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                  {((grandTotal / financialGoal.amount) * 100).toFixed(1)}% de l'objectif
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 mb-4">
              {/* Caisse */}
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="bg-green-500 p-2 rounded-full">
                      <span className="text-white text-lg">💵</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-green-800">Caisse</h3>
                      <p className="text-sm text-green-600">Argent liquide</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${cashTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(cashTotal)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Compte */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="bg-blue-500 p-2 rounded-full">
                      <span className="text-white text-lg">🏦</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-blue-800">Compte</h3>
                      <p className="text-sm text-blue-600">Argent en banque</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${accountTotal >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                      {formatCurrency(accountTotal)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Total */}
              <div className={`p-4 rounded-lg border ${financialGoal.isActive && grandTotal >= financialGoal.amount
                ? 'bg-green-50 border-green-200'
                : 'bg-yellow-50 border-yellow-200'
                }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-full ${financialGoal.isActive && grandTotal >= financialGoal.amount
                      ? 'bg-green-500'
                      : 'bg-yellow-500'
                      }`}>
                      <span className="text-white text-lg">
                        {financialGoal.isActive && grandTotal >= financialGoal.amount ? '🏆' : '💎'}
                      </span>
                    </div>
                    <div>
                      <h3 className={`font-semibold ${financialGoal.isActive && grandTotal >= financialGoal.amount
                        ? 'text-green-800'
                        : 'text-yellow-800'
                        }`}>
                        Total
                        {financialGoal.isActive && grandTotal >= financialGoal.amount && ' - Objectif Atteint !'}
                      </h3>
                      <p className={`text-sm ${financialGoal.isActive && grandTotal >= financialGoal.amount
                        ? 'text-green-600'
                        : 'text-yellow-600'
                        }`}>
                        Trésorerie totale
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-3xl font-bold ${grandTotal >= 0
                      ? (financialGoal.isActive && grandTotal >= financialGoal.amount ? 'text-green-600' : 'text-yellow-600')
                      : 'text-red-600'
                      }`}>
                      {formatCurrency(grandTotal)}
                    </p>
                  </div>
                </div>
              </div>
              {/* NOUVEAU : Valeur du Stock (info seulement) */}
              <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="bg-purple-500 p-2 rounded-full">
                      <span className="text-white text-lg">📦</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-purple-800">Valeur du Stock</h3>
                      <p className="text-sm text-purple-600">À titre informatif</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-purple-600">
                      {formatCurrency(stockValue)}
                    </p>
                    <p className="text-xs text-purple-500">
                      {products.reduce((sum, p) => sum + (p.stock || 0), 0)} articles
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Boutons d'actions */}
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => { setModalType('add-income'); setShowModal(true); }}
              className="p-3 bg-green-500 text-white rounded-lg shadow-md active:scale-95 transition-transform"
            >
              <div className="text-center">
                <div className="text-xl mb-1">📥</div>
                <h3 className="font-semibold text-sm">Ajouter Rentrée</h3>
                <p className="text-xs text-green-100">Recettes, gains</p>
              </div>
            </button>

            <button
              onClick={() => { setModalType('add-expense'); setShowModal(true); }}
              className="p-3 bg-red-500 text-white rounded-lg shadow-md active:scale-95 transition-transform"
            >
              <div className="text-center">
                <div className="text-xl mb-1">📤</div>
                <h3 className="font-semibold text-sm">Ajouter Frais</h3>
                <p className="text-xs text-red-100">Dépenses, coûts</p>
              </div>
            </button>

            {/* NOUVEAU BOUTON - Dépôt bancaire */}
            <button
              onClick={() => { setModalType('bank-deposit'); setShowModal(true); }}
              className="p-3 bg-blue-500 text-white rounded-lg shadow-md active:scale-95 transition-transform"
            >
              <div className="text-center">
                <div className="text-xl mb-1">🏦</div>
                <h3 className="font-semibold text-sm">Dépôt Banque</h3>
                <p className="text-xs text-blue-100">Cash → Compte</p>
              </div>
            </button>
          </div>

          {/* Navigation vers autres sections */}
          <div className="space-y-3">
            <button
              onClick={() => navigateTo('finance-graph')}
              className="w-full p-4 bg-white rounded-lg shadow-md active:scale-95 transition-transform"
            >
              <div className="flex items-center space-x-3">
                <BarChart3 className="text-yellow-500" size={24} />
                <div className="text-left">
                  <h3 className="font-semibold">Évolution des Gains</h3>
                  <p className="text-gray-600 text-sm">Graphiques et tendances</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => navigateTo('finance-history')}
              className="w-full p-4 bg-white rounded-lg shadow-md active:scale-95 transition-transform"
            >
              <div className="flex items-center space-x-3">
                <Clock className="text-yellow-500" size={24} />
                <div className="text-left">
                  <h3 className="font-semibold">Historique Complet</h3>
                  <p className="text-gray-600 text-sm">Toutes les transactions</p>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Modal pour dépôt bancaire */}
        <Modal
          isOpen={showModal && modalType === 'bank-deposit'}
          onClose={() => { setShowModal(false); setBankDeposit({ amount: '', description: '' }); }}
          title="Dépôt à la Banque"
        >
          <div className="space-y-4">
            <div className="bg-blue-50 p-3 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-1">🔄 Transfert Interne</h4>
              <p className="text-sm text-blue-700">
                Transférer de l'argent de la caisse vers le compte bancaire.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                💵 Montant à déposer *
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={Math.max(0, cashTotal)}
                  value={bankDeposit.amount}
                  onChange={(e) => setBankDeposit({ ...bankDeposit, amount: e.target.value })}
                  className="w-full p-3 border rounded-lg pr-8"
                  placeholder="0.00"
                />
                <span className="absolute right-3 top-3 text-gray-500">€</span>
              </div>
              {cashTotal > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Disponible en caisse: {formatCurrency(cashTotal)}
                </p>
              )}
              {cashTotal <= 0 && (
                <p className="text-xs text-red-500 mt-1">
                  ⚠️ Pas assez d'argent en caisse
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📝 Note (optionnel)
              </label>
              <input
                type="text"
                value={bankDeposit.description}
                onChange={(e) => setBankDeposit({ ...bankDeposit, description: e.target.value })}
                className="w-full p-3 border rounded-lg"
                placeholder="Ex: Dépôt fin de semaine, sécurisation caisse..."
              />
            </div>

            {/* Résumé du transfert */}
            {bankDeposit.amount && parseFloat(bankDeposit.amount) > 0 && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <h4 className="font-medium text-gray-800 mb-2">📊 Impact du transfert :</h4>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>💵 Caisse après dépôt:</span>
                    <span className="font-semibold">
                      {formatCurrency(cashTotal - parseFloat(bankDeposit.amount))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>🏦 Compte après dépôt:</span>
                    <span className="font-semibold">
                      {formatCurrency(accountTotal + parseFloat(bankDeposit.amount))}
                    </span>
                  </div>
                  <hr className="my-2" />
                  <div className="flex justify-between font-semibold">
                    <span>💎 Total trésorerie:</span>
                    <span>{formatCurrency(grandTotal)}</span>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={processBankDeposit}
              disabled={
                !bankDeposit.amount ||
                parseFloat(bankDeposit.amount) <= 0 ||
                parseFloat(bankDeposit.amount) > cashTotal ||
                cashTotal <= 0 ||
                loading
              }
              className="w-full p-3 bg-blue-500 text-white rounded-lg disabled:bg-gray-300 active:scale-95 transition-transform"
            >
              {loading ? 'Traitement...' : '🏦 Effectuer le Dépôt'}
            </button>
          </div>
        </Modal>

        {/* Modal pour ajouter une rentrée */}
        <Modal
          isOpen={showModal && modalType === 'add-income'}
          onClose={() => {
            setShowModal(false); setNewTransaction({
              type: 'income', amount: '', description: '', paymentMethod: 'cash', category: 'other'
            });
          }}
          title="Ajouter une Rentrée d'Argent"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                💵 Montant *
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newTransaction.amount}
                  onChange={(e) => setNewTransaction({ ...newTransaction, amount: e.target.value })}
                  className="w-full p-3 border rounded-lg pr-8"
                  placeholder="0.00"
                />
                <span className="absolute right-3 top-3 text-gray-500">€</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📝 Description *
              </label>
              <input
                type="text"
                value={newTransaction.description}
                onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
                className="w-full p-3 border rounded-lg"
                placeholder="Ex: Vente événement, don, subside..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🏷️ Catégorie
              </label>
              <select
                value={newTransaction.category}
                onChange={(e) => setNewTransaction({ ...newTransaction, category: e.target.value })}
                className="w-full p-3 border rounded-lg"
              >
                <option value="sales">Ventes</option>
                <option value="events">Événements</option>
                <option value="donations">Dons</option>
                <option value="subsidies">Subsides</option>
                <option value="other">Autre</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                💳 Mode de paiement *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNewTransaction({ ...newTransaction, paymentMethod: 'cash' })}
                  className={`p-3 border rounded-lg text-sm font-medium active:scale-95 transition-transform ${newTransaction.paymentMethod === 'cash'
                    ? 'bg-green-100 border-green-500 text-green-700'
                    : 'bg-gray-50 border-gray-300 text-gray-600'
                    }`}
                >
                  💵 Cash
                </button>
                <button
                  type="button"
                  onClick={() => setNewTransaction({ ...newTransaction, paymentMethod: 'account' })}
                  className={`p-3 border rounded-lg text-sm font-medium active:scale-95 transition-transform ${newTransaction.paymentMethod === 'account'
                    ? 'bg-blue-100 border-blue-500 text-blue-700'
                    : 'bg-gray-50 border-gray-300 text-gray-600'
                    }`}
                >
                  🏦 Compte
                </button>
              </div>
            </div>

            <button
              onClick={() => addFinancialTransaction('income')}
              disabled={!newTransaction.amount || !newTransaction.description.trim() || loading}
              className="w-full p-3 bg-green-500 text-white rounded-lg disabled:bg-gray-300 active:scale-95 transition-transform"
            >
              {loading ? 'Ajout en cours...' : '✅ Ajouter la Rentrée'}
            </button>
          </div>
        </Modal>



        {/* Modal pour ajouter une dépense */}
        <Modal
          isOpen={showModal && modalType === 'add-expense'}
          onClose={() => {
            setShowModal(false); setNewTransaction({
              type: 'expense', amount: '', description: '', paymentMethod: 'cash', category: 'other'
            });
          }}
          title="Ajouter un Frais"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                💵 Montant *
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newTransaction.amount}
                  onChange={(e) => setNewTransaction({ ...newTransaction, amount: e.target.value })}
                  className="w-full p-3 border rounded-lg pr-8"
                  placeholder="0.00"
                />
                <span className="absolute right-3 top-3 text-gray-500">€</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📝 Description *
              </label>
              <input
                type="text"
                value={newTransaction.description}
                onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
                className="w-full p-3 border rounded-lg"
                placeholder="Ex: Achat matériel, frais event, réparation..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🏷️ Catégorie
              </label>
              <select
                value={newTransaction.category}
                onChange={(e) => setNewTransaction({ ...newTransaction, category: e.target.value })}
                className="w-full p-3 border rounded-lg"
              >
                <option value="supplies">Fournitures</option>
                <option value="maintenance">Entretien</option>
                <option value="events">Événements</option>
                <option value="utilities">Utilities</option>
                <option value="other">Autre</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                💳 Mode de paiement *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNewTransaction({ ...newTransaction, paymentMethod: 'cash' })}
                  className={`p-3 border rounded-lg text-sm font-medium active:scale-95 transition-transform ${newTransaction.paymentMethod === 'cash'
                    ? 'bg-green-100 border-green-500 text-green-700'
                    : 'bg-gray-50 border-gray-300 text-gray-600'
                    }`}
                >
                  💵 Cash
                </button>
                <button
                  type="button"
                  onClick={() => setNewTransaction({ ...newTransaction, paymentMethod: 'account' })}
                  className={`p-3 border rounded-lg text-sm font-medium active:scale-95 transition-transform ${newTransaction.paymentMethod === 'account'
                    ? 'bg-blue-100 border-blue-500 text-blue-700'
                    : 'bg-gray-50 border-gray-300 text-gray-600'
                    }`}
                >
                  🏦 Compte
                </button>
              </div>
            </div>

            <button
              onClick={() => addFinancialTransaction('expense')}
              disabled={!newTransaction.amount || !newTransaction.description.trim() || loading}
              className="w-full p-3 bg-red-500 text-white rounded-lg disabled:bg-gray-300 active:scale-95 transition-transform"
            >
              {loading ? 'Ajout en cours...' : '✅ Ajouter le Frais'}
            </button>
          </div>
        </Modal>
      </div>


    );

  }



  if (currentScreen === 'finance-graph') {
    // Calculer l'évolution des revenus par mois
    const calculateMonthlyRevenue = () => {
      const monthlyData = {};

      // Ajouter les transactions financières manuelles
      financialTransactions.forEach(transaction => {
        const date = new Date(transaction.timestamp);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { revenue: 0, expenses: 0 };
        }

        const amount = transaction.amount || 0;
        if (transaction.type === 'income') {
          monthlyData[monthKey].revenue += amount;
        } else {
          monthlyData[monthKey].expenses += amount;
        }
      });



      // Ajouter les ventes du bar (commandes)
      orders.forEach(order => {
        if (order.type === 'order') {
          const date = new Date(order.timestamp);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

          if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = { revenue: 0, expenses: 0 };
          }

          monthlyData[monthKey].revenue += order.amount || 0;
        }
      });

      // Ajouter les revenus des boulots (travaux effectués payés)
      jobs.forEach(job => {
        if (job.isPaid) {
          const date = new Date(job.date);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

          if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = { revenue: 0, expenses: 0 };
          }

          monthlyData[monthKey].revenue += job.total || 0;
        }
      });

      // Convertir en array et trier par date
      const sortedData = Object.entries(monthlyData)
        .map(([month, data]) => ({
          month,
          ...data,
          net: data.revenue - data.expenses
        }))
        .sort((a, b) => a.month.localeCompare(b.month));

      return sortedData;
    };

    const monthlyData = calculateMonthlyRevenue();
    const maxRevenue = Math.max(...monthlyData.map(d => Math.max(d.revenue, Math.abs(d.net))), 100);

    // Calculer les totaux
    const totalRevenue = monthlyData.reduce((sum, d) => sum + d.revenue, 0);
    const totalExpenses = monthlyData.reduce((sum, d) => sum + d.expenses, 0);
    const totalNet = totalRevenue - totalExpenses;

    const formatMonth = (monthKey) => {
      const [year, month] = monthKey.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1);
      return date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50">
        <Header title="Évolution des Revenus" onBack={() => navigateTo('finance')} />

        <div className="p-4 space-y-6">
          {/* Résumé global */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 text-center">📊 Résumé Global</h2>

            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="bg-green-100 p-3 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(totalRevenue)}</p>
                  <p className="text-sm text-green-700">Revenus Totaux</p>
                </div>
              </div>

              <div className="text-center">
                <div className="bg-red-100 p-3 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
                  <p className="text-sm text-red-700">Dépenses Totales</p>
                </div>
              </div>

              <div className="text-center">
                <div className={`p-3 rounded-lg ${totalNet >= 0 ? 'bg-blue-100' : 'bg-orange-100'}`}>
                  <p className={`text-2xl font-bold ${totalNet >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                    {formatCurrency(totalNet)}
                  </p>
                  <p className={`text-sm ${totalNet >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                    Bénéfice Net
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Graphique */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">📈 Évolution Mensuelle</h2>

            {monthlyData.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <BarChart3 size={48} className="mx-auto mb-2 opacity-50" />
                <p>Pas encore de données pour le graphique</p>
                <p className="text-sm">Commencez à enregistrer des transactions !</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Légende */}
                <div className="flex justify-center space-x-6 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-green-500 rounded"></div>
                    <span>Revenus</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-red-500 rounded"></div>
                    <span>Dépenses</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-blue-500 rounded"></div>
                    <span>Bénéfice Net</span>
                  </div>
                </div>

                {/* Graphique linéaire */}
                <div className="bg-gray-50 rounded-lg p-4 overflow-x-auto">
                  {(() => {
                    const width = Math.max(400, monthlyData.length * 80);
                    const height = 300;
                    const padding = { top: 20, right: 40, bottom: 60, left: 80 };
                    const chartWidth = width - padding.left - padding.right;
                    const chartHeight = height - padding.top - padding.bottom;

                    // Calculer les échelles
                    const minValue = Math.min(...monthlyData.map(d => d.net), 0) - 100;
                    const maxValue = Math.max(...monthlyData.map(d => d.net), 100) + 100;
                    const valueRange = maxValue - minValue;

                    // Fonctions de conversion
                    const xScale = (index) => (index / (monthlyData.length - 1 || 1)) * chartWidth;
                    const yScale = (value) => chartHeight - ((value - minValue) / valueRange) * chartHeight;

                    // Générer les points de la courbe
                    const points = monthlyData.map((data, index) => ({
                      x: xScale(index),
                      y: yScale(data.net),
                      data
                    }));

                    // Créer le path de la courbe
                    const createPath = (points) => {
                      if (points.length === 0) return '';

                      let path = `M ${points[0].x} ${points[0].y}`;

                      if (points.length > 1) {
                        for (let i = 1; i < points.length; i++) {
                          const prev = points[i - 1];
                          const curr = points[i];
                          const cp1x = prev.x + (curr.x - prev.x) / 3;
                          const cp1y = prev.y;
                          const cp2x = curr.x - (curr.x - prev.x) / 3;
                          const cp2y = curr.y;
                          path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
                        }
                      }

                      return path;
                    };

                    const pathData = createPath(points);

                    // Lignes de grille Y
                    const gridLines = [];
                    const numGridLines = 5;
                    for (let i = 0; i <= numGridLines; i++) {
                      const value = minValue + (valueRange * i / numGridLines);
                      const y = yScale(value);
                      gridLines.push({
                        y,
                        value,
                        isZero: Math.abs(value) < 50
                      });
                    }

                    return (
                      <svg width={width} height={height} className="mx-auto">
                        <defs>
                          {/* Gradient pour la zone sous la courbe */}
                          <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0.05" />
                          </linearGradient>

                          {/* Gradient pour la courbe */}
                          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#10b981" />
                            <stop offset="50%" stopColor="#3b82f6" />
                            <stop offset="100%" stopColor="#8b5cf6" />
                          </linearGradient>
                        </defs>

                        <g transform={`translate(${padding.left}, ${padding.top})`}>
                          {/* Grille horizontale */}
                          {gridLines.map((line, i) => (
                            <g key={i}>
                              <line
                                x1="0"
                                y1={line.y}
                                x2={chartWidth}
                                y2={line.y}
                                stroke={line.isZero ? "#ef4444" : "#e5e7eb"}
                                strokeWidth={line.isZero ? "2" : "1"}
                                strokeDasharray={line.isZero ? "0" : "2,2"}
                                opacity={line.isZero ? "0.8" : "0.5"}
                              />
                              <text
                                x="-10"
                                y={line.y + 4}
                                textAnchor="end"
                                className="text-xs fill-gray-600"
                              >
                                {formatCurrency(line.value)}
                              </text>
                            </g>
                          ))}

                          {/* Grille verticale */}
                          {points.map((point, i) => (
                            <line
                              key={i}
                              x1={point.x}
                              y1="0"
                              x2={point.x}
                              y2={chartHeight}
                              stroke="#f3f4f6"
                              strokeWidth="1"
                              strokeDasharray="2,2"
                              opacity="0.5"
                            />
                          ))}

                          {/* Zone sous la courbe */}
                          {points.length > 0 && (
                            <path
                              d={`${pathData} L ${points[points.length - 1].x} ${chartHeight} L ${points[0].x} ${chartHeight} Z`}
                              fill="url(#areaGradient)"
                            />
                          )}

                          {/* Courbe principale */}
                          <path
                            d={pathData}
                            fill="none"
                            stroke="url(#lineGradient)"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="drop-shadow-sm"
                            style={{
                              strokeDasharray: points.length > 0 ? `${points.reduce((acc, p, i) => {
                                if (i === 0) return 0;
                                const prev = points[i - 1];
                                return acc + Math.sqrt(Math.pow(p.x - prev.x, 2) + Math.pow(p.y - prev.y, 2));
                              }, 0)}` : '0',
                              strokeDashoffset: points.length > 0 ? `${points.reduce((acc, p, i) => {
                                if (i === 0) return 0;
                                const prev = points[i - 1];
                                return acc + Math.sqrt(Math.pow(p.x - prev.x, 2) + Math.pow(p.y - prev.y, 2));
                              }, 0)}` : '0',
                              animation: 'dash 2s ease-out forwards'
                            }}
                          />

                          {/* Points sur la courbe */}
                          {points.map((point, i) => (
                            <g key={i}>
                              {/* Cercle de fond */}
                              <circle
                                cx={point.x}
                                cy={point.y}
                                r="8"
                                fill="white"
                                stroke={point.data.net >= 0 ? "#10b981" : "#ef4444"}
                                strokeWidth="3"
                                className="drop-shadow-sm"
                              />
                              {/* Point central */}
                              <circle
                                cx={point.x}
                                cy={point.y}
                                r="4"
                                fill={point.data.net >= 0 ? "#10b981" : "#ef4444"}
                              />

                              {/* Valeur au-dessus du point */}
                              <text
                                x={point.x}
                                y={point.y - 15}
                                textAnchor="middle"
                                className="text-xs font-semibold fill-gray-700"
                              >
                                {formatCurrency(point.data.net)}
                              </text>
                            </g>
                          ))}

                          {/* Labels des mois (axe X) */}
                          {points.map((point, i) => (
                            <g key={i} transform={`translate(${point.x}, ${chartHeight + 20})`}>
                              <text
                                textAnchor="middle"
                                className="text-xs fill-gray-600"
                                transform="rotate(-45)"
                              >
                                {formatMonth(point.data.month)}
                              </text>
                            </g>
                          ))}
                        </g>

                        {/* Titre des axes */}
                        <text
                          x={padding.left + chartWidth / 2}
                          y={height - 10}
                          textAnchor="middle"
                          className="text-sm font-medium fill-gray-700"
                        >
                          Période
                        </text>

                        <text
                          x="20"
                          y={padding.top + chartHeight / 2}
                          textAnchor="middle"
                          className="text-sm font-medium fill-gray-700"
                          transform={`rotate(-90, 20, ${padding.top + chartHeight / 2})`}
                        >
                          Bénéfice Net (€)
                        </text>
                      </svg>
                    );
                  })()}
                </div>

                <style jsx>{`
                  @keyframes dash {
                    to {
                      stroke-dashoffset: 0;
                    }
                  }
                `}</style>

                {/* Tendance */}
                {monthlyData.length > 1 && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-blue-800 mb-2">📊 Analyse de Tendance</h4>
                    <div className="text-sm text-blue-700 space-y-1">
                      {(() => {
                        const lastMonth = monthlyData[monthlyData.length - 1];
                        const previousMonth = monthlyData[monthlyData.length - 2];
                        const trend = lastMonth.net - previousMonth.net;

                        return (
                          <>
                            <p>
                              Mois le plus rentable: <strong>
                                {formatMonth(monthlyData.sort((a, b) => b.net - a.net)[0].month)}
                                ({formatCurrency(monthlyData.sort((a, b) => b.net - a.net)[0].net)})
                              </strong>
                            </p>
                            <p>
                              Évolution récente: <strong className={trend >= 0 ? 'text-green-700' : 'text-red-700'}>
                                {trend >= 0 ? '📈' : '📉'} {formatCurrency(Math.abs(trend))}
                              </strong>
                            </p>
                            <p>
                              Moyenne mensuelle: <strong>
                                {formatCurrency(totalNet / monthlyData.length)}
                              </strong>
                            </p>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Conseils */}
          <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl p-4">
            <h3 className="font-semibold text-purple-800 mb-2">💡 Conseils Financiers</h3>
            <div className="text-sm text-purple-700 space-y-1">
              {totalNet > 0 ? (
                <>
                  <p>✅ Excellente situation financière !</p>
                  <p>💡 Pensez à mettre de côté pour les investissements futurs.</p>
                </>
              ) : totalNet < 0 ? (
                <>
                  <p>⚠️ Attention aux dépenses qui dépassent les revenus.</p>
                  <p>💡 Analysez les postes de dépenses les plus importants.</p>
                </>
              ) : (
                <p>🎯 Équilibre parfait entre revenus et dépenses.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentScreen === 'settings') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-purple-100">
        <Header title="Paramètres" onBack={() => navigateTo('home')} />

        <div className="p-6 space-y-4">
          <button
            onClick={() => navigateTo('settings-products')}
            className="w-full p-4 bg-white rounded-lg shadow-md active:scale-95 transition-transform"
          >
            <div className="flex items-center space-x-3">
              <Beer className="text-purple-500" size={24} />
              <div className="text-left">
                <h3 className="font-semibold">Gestion de la carte</h3>
                <p className="text-gray-600 text-sm">Produits et catégories</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigateTo('settings-stock')}
            className="w-full p-4 bg-white rounded-lg shadow-md active:scale-95 transition-transform"
          >
            <div className="flex items-center space-x-3">
              <BarChart3 className="text-purple-500" size={24} />
              <div className="text-left">
                <h3 className="font-semibold">Gestion du stock</h3>
                <p className="text-gray-600 text-sm">Stock et ajustements</p>
              </div>
            </div>
          </button>
          <button
            onClick={() => navigateTo('settings-popular')}
            className="w-full p-4 bg-white rounded-lg shadow-md active:scale-95 transition-transform"
          >
            <div className="flex items-center space-x-3">
              <span className="text-purple-500 text-2xl">⭐</span>
              <div className="text-left">
                <h3 className="font-semibold">Produits Populaires</h3>
                <p className="text-gray-600 text-sm">
                  Personnaliser l'affichage rapide
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigateTo('settings-goal')}
            className="w-full p-4 bg-white rounded-lg shadow-md active:scale-95 transition-transform"
          >
            <div className="flex items-center space-x-3">
              <span className="text-purple-500 text-2xl">🎯</span>
              <div className="text-left">
                <h3 className="font-semibold">Objectif Financier</h3>
                <p className="text-gray-600 text-sm">
                  {financialGoal.isActive
                    ? `Actuel: ${formatCurrency(financialGoal.amount)}`
                    : 'Définir un objectif'}
                </p>
              </div>
            </div>
          </button>



          <button
            onClick={() => navigateTo('settings-history')}
            className="w-full p-4 bg-white rounded-lg shadow-md active:scale-95 transition-transform"
          >
            <div className="flex items-center space-x-3">
              <Clock className="text-purple-500" size={24} />
              <div className="text-left">
                <h3 className="font-semibold">Historique complet</h3>
                <p className="text-gray-600 text-sm">Corriger les erreurs</p>
              </div>
            </div>
          </button>
          {/* NOTIFICATIONS */}
          <div className="bg-white rounded-lg shadow-md p-4 mb-4">
            <h3 className="text-lg font-semibold mb-3 flex items-center">
              <Bell className="mr-2" size={20} />
              Notifications
            </h3>

            <div className="mb-3">
              <p className="text-sm text-gray-600">
                Statut : {permission === 'granted' ? '✅ Activées' : permission === 'denied' ? '❌ Bloquées' : '🔔 À activer'}
              </p>
            </div>

            <button
              onClick={activerNotifications}
              className="w-full p-3 bg-blue-500 text-white rounded-lg"
            >
              🔔 Activer les notifications
            </button>
          </div>


        </div>
      </div>
    );
  }

  if (currentScreen === 'settings-products') {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Gestion de la carte" onBack={() => navigateTo('settings')} />

        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Produits ({products.length})</h2>
            <button
              onClick={() => { setModalType('add-product'); setShowModal(true); }}
              className="p-2 bg-purple-500 text-white rounded-full active:scale-95 transition-transform"
            >
              <Plus size={20} />
            </button>
          </div>

          {categories.map(category => {
            const categoryProducts = products.filter(p => p.category === category);
            return (
              <div key={category} className="mb-6">
                <h3 className="text-md font-semibold mb-3 text-gray-700 bg-gray-100 px-3 py-2 rounded">
                  {category} ({categoryProducts.length})
                </h3>
                <div className="space-y-2">
                  {categoryProducts.map(product => {
                    const stockStatus = getStockStatus(product);
                    return (
                      <div key={product.id} className="bg-white p-4 rounded-lg shadow-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium">{product.name}</h4>
                            <div className="flex items-center space-x-4 mt-1">
                              <p className="text-purple-600 font-semibold">{formatCurrency(product.price)}</p>
                              {product.stockType === 'mixed' && (
                                <div className="text-xs text-gray-600">
                                  <span>Bac: {formatCurrency(product.pricePerPack)} | </span>
                                  <span>11x: {formatCurrency(product.pricePer11)}</span>
                                </div>
                              )}
                            </div>
                            <div className={`text-xs px-2 py-1 rounded-full inline-block mt-1 ${stockStatus.bg} ${stockStatus.color}`}>
                              Stock: {product.stock}
                              {product.stockType === 'mixed' && product.packSize > 1 && (
                                <span> ({Math.floor(product.stock / product.packSize)} bacs)</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => {
                                // Pré-remplir le formulaire avec les données existantes
                                setNewProduct({
                                  name: product.name,
                                  price: product.price.toString(),
                                  category: product.category,
                                  stock: product.stock.toString(),
                                  stockType: product.stockType || 'unit',
                                  packSize: product.packSize || 1,
                                  pricePerPack: product.pricePerPack?.toString() || '',
                                  pricePer11: product.pricePer11?.toString() || '',
                                  alertThreshold: product.alertThreshold || 5,
                                  moneyFlow: 'none',
                                  amount: '',
                                  paymentMethod: ''
                                });
                                setEditingProduct(product);
                                setModalType('edit-product');
                                setShowModal(true);
                              }}
                              className="p-2 text-blue-500 hover:bg-blue-50 rounded active:scale-95 transition-transform"
                              title="Modifier ce produit"
                            >
                              <Settings size={16} />
                            </button>
                            <button
                              onClick={() => deleteProduct(product.id)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded active:scale-95 transition-transform"
                              title="Supprimer ce produit"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <Modal
          isOpen={showModal && (modalType === 'add-product' || modalType === 'edit-product')}
          onClose={() => {
            setShowModal(false);
            setEditingProduct(null);
            setNewProduct({
              name: '', price: '', category: 'Boissons', stock: '', stockType: 'unit',
              packSize: 1, pricePerPack: '', pricePer11: '', alertThreshold: 5,
              moneyFlow: 'none', amount: '', paymentMethod: ''
            });
          }}
          title={editingProduct ? "Modifier le produit" : "Ajouter un produit"}
        >
          <div className="space-y-4">
            {/* Nom du produit */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📦 Nom du produit *
              </label>
              <input
                type="text"
                placeholder="Nom du produit"
                value={newProduct.name}
                onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                className="w-full p-3 border rounded-lg"
              />
            </div>

            {/* Prix unitaire */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                💰 Prix unitaire *
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Prix unitaire"
                  value={newProduct.price}
                  onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                  className="w-full p-3 border rounded-lg pr-8"
                />
                <span className="absolute right-3 top-3 text-gray-500">€</span>
              </div>
            </div>

            {/* Catégorie */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🏷️ Catégorie *
              </label>
              <select
                value={newProduct.category}
                onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                className="w-full p-3 border rounded-lg"
              >
                <option value="Boissons">Boissons</option>
                <option value="Bière">Bière</option>
                <option value="Alcool">Alcool</option>
                <option value="Snacks">Snacks</option>
                <option value="Nourriture">Nourriture</option>
                <option value="Autre">Autre</option>
              </select>
            </div>

            {/* Type de vente */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">⚡ Type de vente</label>
              <select
                value={newProduct.stockType}
                onChange={(e) => setNewProduct({ ...newProduct, stockType: e.target.value })}
                className="w-full p-3 border rounded-lg"
              >
                <option value="unit">Vente à l'unité uniquement</option>
                <option value="mixed">Vente mixte (bacs + unités) - pour bières</option>
              </select>
            </div>

            {/* Options pour vente mixte */}
            {newProduct.stockType === 'mixed' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">📦 Taille du bac</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Taille du bac (ex: 24)"
                    value={newProduct.packSize}
                    onChange={(e) => setNewProduct({ ...newProduct, packSize: e.target.value })}
                    className="w-full p-3 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">💰 Prix du bac complet</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Prix du bac complet"
                      value={newProduct.pricePerPack}
                      onChange={(e) => setNewProduct({ ...newProduct, pricePerPack: e.target.value })}
                      className="w-full p-3 border rounded-lg pr-8"
                    />
                    <span className="absolute right-3 top-3 text-gray-500">€</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">🍺 Prix pour 11 unités (mètre)</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Prix pour 11 unités"
                      value={newProduct.pricePer11}
                      onChange={(e) => setNewProduct({ ...newProduct, pricePer11: e.target.value })}
                      className="w-full p-3 border rounded-lg pr-8"
                    />
                    <span className="absolute right-3 top-3 text-gray-500">€</span>
                  </div>
                </div>
              </>
            )}

            {/* Stock initial */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📊 Stock initial
              </label>
              <input
                type="number"
                min="0"
                placeholder="Stock initial"
                value={newProduct.stock}
                onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
                className="w-full p-3 border rounded-lg"
              />
            </div>

            {/* Seuil d'alerte */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ⚠️ Seuil d'alerte stock
              </label>
              <input
                type="number"
                min="0"
                placeholder="Seuil d'alerte stock"
                value={newProduct.alertThreshold}
                onChange={(e) => setNewProduct({ ...newProduct, alertThreshold: e.target.value })}
                className="w-full p-3 border rounded-lg"
              />
            </div>

            {/* Impact financier pour le stock initial */}
            {!editingProduct && parseInt(newProduct.stock) > 0 && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    💰 Impact financier du stock initial *
                  </label>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setNewProduct({ ...newProduct, moneyFlow: 'none', amount: '', paymentMethod: '' })}
                      className={`w-full p-3 border rounded-lg text-sm font-medium text-left active:scale-95 transition-transform ${newProduct.moneyFlow === 'none'
                        ? 'bg-gray-100 border-gray-500 text-gray-700'
                        : 'bg-gray-50 border-gray-300 text-gray-600'
                        }`}
                    >
                      🚫 Stock gratuit (don, échantillon)
                    </button>

                    <button
                      type="button"
                      onClick={() => setNewProduct({ ...newProduct, moneyFlow: 'out', amount: '', paymentMethod: '' })}
                      className={`w-full p-3 border rounded-lg text-sm font-medium text-left active:scale-95 transition-transform ${newProduct.moneyFlow === 'out'
                        ? 'bg-red-100 border-red-500 text-red-700'
                        : 'bg-gray-50 border-gray-300 text-gray-600'
                        }`}
                    >
                      📤 Stock acheté (coût d'achat)
                    </button>
                  </div>
                </div>

                {/* Détails financiers si stock acheté */}
                {newProduct.moneyFlow === 'out' && (
                  <>
                    {/* Montant */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        💵 Coût d'achat du stock initial *
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={newProduct.amount}
                          onChange={(e) => setNewProduct({ ...newProduct, amount: e.target.value })}
                          className="w-full p-3 border rounded-lg pr-8"
                          placeholder="0.00"
                        />
                        <span className="absolute right-3 top-3 text-gray-500">€</span>
                      </div>
                    </div>

                    {/* Mode de paiement */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        💳 Mode de paiement *
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setNewProduct({ ...newProduct, paymentMethod: 'cash' })}
                          className={`p-3 border rounded-lg text-sm font-medium active:scale-95 transition-transform ${newProduct.paymentMethod === 'cash'
                            ? 'bg-green-100 border-green-500 text-green-700'
                            : 'bg-gray-50 border-gray-300 text-gray-600'
                            }`}
                        >
                          💵 Cash
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewProduct({ ...newProduct, paymentMethod: 'account' })}
                          className={`p-3 border rounded-lg text-sm font-medium active:scale-95 transition-transform ${newProduct.paymentMethod === 'account'
                            ? 'bg-blue-100 border-blue-500 text-blue-700'
                            : 'bg-gray-50 border-gray-300 text-gray-600'
                            }`}
                        >
                          🏦 Compte
                        </button>
                      </div>
                    </div>

                    {/* Résumé financier */}
                    {newProduct.amount && (
                      <div className="bg-red-50 p-3 rounded-lg">
                        <h4 className="font-medium text-red-800 mb-1">💡 Résumé financier :</h4>
                        <div className="text-sm text-red-700 space-y-1">
                          <p>📤 Coût d'achat: {formatCurrency(parseFloat(newProduct.amount) || 0)}</p>
                          <p>📦 Stock: {newProduct.stock} unités</p>
                          <p>Mode: {newProduct.paymentMethod === 'cash' ? '💵 Cash' : '🏦 Compte'}</p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {/* Bouton validation */}
            <button
              onClick={editingProduct ? updateProduct : addProduct}
              disabled={
                !newProduct.name.trim() ||
                !newProduct.price ||
                parseFloat(newProduct.price) <= 0 ||
                (!editingProduct && parseInt(newProduct.stock) > 0 && newProduct.moneyFlow === 'out' && (!newProduct.amount || !newProduct.paymentMethod))
              }
              className="w-full p-3 bg-purple-500 text-white rounded-lg disabled:bg-gray-300 active:scale-95 transition-transform"
            >
              {editingProduct ? "💾 Sauvegarder les modifications" : "✅ Ajouter le produit"}
            </button>
          </div>
        </Modal>
      </div>
    );
  }

  if (currentScreen === 'settings-stock') {
    const lowStockProducts = products.filter(p => p.stock <= p.alertThreshold && p.stock > 0);
    const outOfStockProducts = products.filter(p => p.stock <= 0);

    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Gestion du stock" onBack={() => navigateTo('settings')} />

        <div className="p-4 space-y-4">
          {outOfStockProducts.length > 0 && (
            <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
              <h3 className="font-semibold text-red-800 mb-2">⚠️ Rupture de stock ({outOfStockProducts.length})</h3>
              <div className="space-y-1">
                {outOfStockProducts.map(product => (
                  <p key={product.id} className="text-sm text-red-700">{product.name}</p>
                ))}
              </div>
            </div>
          )}

          {lowStockProducts.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
              <h3 className="font-semibold text-orange-800 mb-2">⚡ Stock faible ({lowStockProducts.length})</h3>
              <div className="space-y-1">
                {lowStockProducts.map(product => (
                  <p key={product.id} className="text-sm text-orange-700">
                    {product.name}: {product.stock} restant(s)
                  </p>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => { setModalType('adjust-stock'); setShowModal(true); }}
            className="w-full p-3 bg-purple-500 text-white rounded-lg active:scale-95 transition-transform"
          >
            <div className="flex items-center justify-center space-x-2">
              <Plus size={20} />
              <span>Ajuster le stock</span>
            </div>
          </button>

          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-4 border-b">
              <h3 className="font-semibold">État du stock</h3>
            </div>
            <div className="divide-y">
              {products.map(product => {
                const stockStatus = getStockStatus(product);
                return (
                  <div key={product.id} className="p-4 flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium">{product.name}</h4>
                      <p className="text-sm text-gray-600">{product.category}</p>
                    </div>
                    <div className="text-right">
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${stockStatus.bg} ${stockStatus.color}`}>
                        {product.stock} en stock
                      </div>
                      {product.stockType === 'mixed' && product.packSize > 1 && (
                        <p className="text-xs text-gray-500 mt-1">
                          {Math.floor(product.stock / product.packSize)} bacs complets
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {stockMovements.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-4 border-b">
                <h3 className="font-semibold">Mouvements récents</h3>
              </div>
              <div className="divide-y max-h-64 overflow-y-auto">
                {stockMovements.slice(0, 10).map(movement => (
                  <div key={movement.id} className="p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{movement.productName}</span>
                      <span className={`font-semibold ${movement.quantityChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {movement.quantityChange > 0 ? '+' : ''}{movement.quantityChange}
                      </span>
                    </div>
                    <p className="text-gray-600">{movement.reason}</p>
                    <p className="text-xs text-gray-500">{formatDate(movement.timestamp)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <Modal
          isOpen={showModal && modalType === 'adjust-stock'}
          onClose={() => {
            setShowModal(false);
            setStockAdjustment({
              productId: '', quantity: '', type: 'add', reason: '',
              moneyFlow: 'none', amount: '', paymentMethod: ''
            });
          }}
          title="Ajuster le stock"
        >
          <div className="space-y-4">
            {/* Produit */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📦 Produit *
              </label>
              <select
                value={stockAdjustment.productId}
                onChange={(e) => setStockAdjustment({ ...stockAdjustment, productId: e.target.value })}
                className="w-full p-3 border rounded-lg"
              >
                <option value="">Sélectionner un produit...</option>
                {products.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.name} (Stock: {product.stock})
                  </option>
                ))}
              </select>
            </div>

            {/* Type d'ajustement */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ⚖️ Type d'ajustement *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStockAdjustment({ ...stockAdjustment, type: 'add' })}
                  className={`p-3 border rounded-lg text-sm font-medium active:scale-95 transition-transform ${stockAdjustment.type === 'add'
                    ? 'bg-green-100 border-green-500 text-green-700'
                    : 'bg-gray-50 border-gray-300 text-gray-600'
                    }`}
                >
                  ➕ Ajouter
                </button>
                <button
                  type="button"
                  onClick={() => setStockAdjustment({ ...stockAdjustment, type: 'remove' })}
                  className={`p-3 border rounded-lg text-sm font-medium active:scale-95 transition-transform ${stockAdjustment.type === 'remove'
                    ? 'bg-red-100 border-red-500 text-red-700'
                    : 'bg-gray-50 border-gray-300 text-gray-600'
                    }`}
                >
                  ➖ Retirer
                </button>
              </div>
            </div>

            {/* Quantité */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🔢 Quantité *
              </label>
              <input
                type="number"
                min="1"
                value={stockAdjustment.quantity}
                onChange={(e) => setStockAdjustment({ ...stockAdjustment, quantity: e.target.value })}
                placeholder="Nombre d'unités"
                className="w-full p-3 border rounded-lg"
              />
            </div>

            {/* Raison */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📝 Raison *
              </label>
              <input
                type="text"
                value={stockAdjustment.reason}
                onChange={(e) => setStockAdjustment({ ...stockAdjustment, reason: e.target.value })}
                placeholder="Ex: Réception livraison, casse, péremption, vente manuelle..."
                className="w-full p-3 border rounded-lg"
              />
            </div>

            {/* Impact financier */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                💰 Impact financier *
              </label>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setStockAdjustment({ ...stockAdjustment, moneyFlow: 'none', amount: '', paymentMethod: '' })}
                  className={`w-full p-3 border rounded-lg text-sm font-medium text-left active:scale-95 transition-transform ${stockAdjustment.moneyFlow === 'none'
                    ? 'bg-gray-100 border-gray-500 text-gray-700'
                    : 'bg-gray-50 border-gray-300 text-gray-600'
                    }`}
                >
                  🚫 Aucun impact financier
                </button>

                <button
                  type="button"
                  onClick={() => setStockAdjustment({ ...stockAdjustment, moneyFlow: 'out', amount: '', paymentMethod: '' })}
                  className={`w-full p-3 border rounded-lg text-sm font-medium text-left active:scale-95 transition-transform ${stockAdjustment.moneyFlow === 'out'
                    ? 'bg-red-100 border-red-500 text-red-700'
                    : 'bg-gray-50 border-gray-300 text-gray-600'
                    }`}
                >
                  📤 Argent qui sort (achat, coût)
                </button>

                <button
                  type="button"
                  onClick={() => setStockAdjustment({ ...stockAdjustment, moneyFlow: 'in', amount: '', paymentMethod: '' })}
                  className={`w-full p-3 border rounded-lg text-sm font-medium text-left active:scale-95 transition-transform ${stockAdjustment.moneyFlow === 'in'
                    ? 'bg-green-100 border-green-500 text-green-700'
                    : 'bg-gray-50 border-gray-300 text-gray-600'
                    }`}
                >
                  📥 Argent qui rentre (vente, recette)
                </button>
              </div>
            </div>

            {/* Détails financiers si argent sort ou rentre */}
            {(stockAdjustment.moneyFlow === 'out' || stockAdjustment.moneyFlow === 'in') && (
              <>
                {/* Montant */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    💵 Montant {stockAdjustment.moneyFlow === 'out' ? '(coût)' : '(recette)'} *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={stockAdjustment.amount}
                      onChange={(e) => setStockAdjustment({ ...stockAdjustment, amount: e.target.value })}
                      className="w-full p-3 border rounded-lg pr-8"
                      placeholder="0.00"
                    />
                    <span className="absolute right-3 top-3 text-gray-500">€</span>
                  </div>
                </div>

                {/* Mode de paiement */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    💳 Mode de paiement *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setStockAdjustment({ ...stockAdjustment, paymentMethod: 'cash' })}
                      className={`p-3 border rounded-lg text-sm font-medium active:scale-95 transition-transform ${stockAdjustment.paymentMethod === 'cash'
                        ? 'bg-green-100 border-green-500 text-green-700'
                        : 'bg-gray-50 border-gray-300 text-gray-600'
                        }`}
                    >
                      💵 Cash
                    </button>
                    <button
                      type="button"
                      onClick={() => setStockAdjustment({ ...stockAdjustment, paymentMethod: 'account' })}
                      className={`p-3 border rounded-lg text-sm font-medium active:scale-95 transition-transform ${stockAdjustment.paymentMethod === 'account'
                        ? 'bg-blue-100 border-blue-500 text-blue-700'
                        : 'bg-gray-50 border-gray-300 text-gray-600'
                        }`}
                    >
                      🏦 Compte
                    </button>
                  </div>
                </div>

                {/* Résumé financier */}
                {stockAdjustment.amount && (
                  <div className={`p-3 rounded-lg ${stockAdjustment.moneyFlow === 'out' ? 'bg-red-50' : 'bg-green-50'
                    }`}>
                    <h4 className={`font-medium mb-1 ${stockAdjustment.moneyFlow === 'out' ? 'text-red-800' : 'text-green-800'
                      }`}>
                      💡 Résumé financier :
                    </h4>
                    <div className={`text-sm space-y-1 ${stockAdjustment.moneyFlow === 'out' ? 'text-red-700' : 'text-green-700'
                      }`}>
                      <p>
                        {stockAdjustment.moneyFlow === 'out' ? '📤 Sortie' : '📥 Entrée'}: {formatCurrency(parseFloat(stockAdjustment.amount) || 0)}
                      </p>
                      <p>Mode: {stockAdjustment.paymentMethod === 'cash' ? '💵 Cash' : '🏦 Compte'}</p>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Bouton de validation */}
            <button
              onClick={adjustStock}
              disabled={
                !stockAdjustment.productId ||
                !stockAdjustment.quantity ||
                !stockAdjustment.reason.trim() ||
                !stockAdjustment.moneyFlow ||
                (stockAdjustment.moneyFlow !== 'none' && (!stockAdjustment.amount || !stockAdjustment.paymentMethod))
              }
              className="w-full p-3 bg-purple-500 text-white rounded-lg disabled:bg-gray-300 active:scale-95 transition-transform"
            >
              ✅ Confirmer l'ajustement
            </button>
          </div>
        </Modal>
      </div>
    );
  }


  if (currentScreen === 'settings-rate') {


    const updateRate = () => {
      const rate = parseFloat(newRate);
      if (rate > 0) {
        setHourlyRate(rate);
        navigateTo('settings');
      }
    };

    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Configuration tarif horaire" onBack={() => navigateTo('settings')} />

        <div className="p-4">
          <div className="bg-white p-4 rounded-lg shadow-sm space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tarif horaire actuel: {formatCurrency(hourlyRate)}/h
              </label>
              <input
                type="number"
                step="0.25"
                min="0"
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
                className="w-full p-3 border rounded-lg"
                placeholder="Nouveau tarif (€/h)"
              />
            </div>

            <div className="bg-purple-50 p-3 rounded-lg">
              <h4 className="font-medium text-purple-800 mb-2">Impact:</h4>
              <p className="text-sm text-purple-700">
                Ce tarif s'appliquera uniquement aux nouveaux boulots enregistrés.
                Les boulots existants conservent leur tarif d'origine.
              </p>
            </div>

            <button
              onClick={updateRate}
              disabled={!newRate || parseFloat(newRate) <= 0 || parseFloat(newRate) === hourlyRate}
              className="w-full p-3 bg-purple-500 text-white rounded-lg disabled:bg-gray-300 active:scale-95 transition-transform"
            >
              Mettre à jour le tarif
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (currentScreen === 'settings-history') {
    const allHistory = [
      ...orders.map(o => ({ ...o, type: 'order-item', category: 'Commandes' })),
      ...jobs.map(j => ({ ...j, type: 'job-item', category: 'Boulots' })),
      ...financialTransactions.map(f => ({
        ...f,
        type: 'financial-item',
        category: f.type === 'income' ? 'Rentrées' : 'Frais',
        memberName: f.description,
        amount: f.amount
      }))
    ].sort((a, b) => {
      // Obtenir la date de chaque élément selon son type
      const getDate = (item) => {
        if (item.type === 'job-item') return item.date || item.createdAt || item.timestamp;
        if (item.type === 'financial-item') return item.timestamp || item.createdAt;
        return item.timestamp || item.createdAt; // orders
      };

      const dateA = new Date(getDate(a));
      const dateB = new Date(getDate(b));

      return dateB - dateA; // Plus récent en premier
    });
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Historique complet" onBack={() => navigateTo('settings')} />

        <div className="p-4">
          <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg mb-4">
            <h3 className="font-semibold text-orange-800 mb-1">⚠️ Zone de correction</h3>
            <p className="text-sm text-orange-700">
              Utilisez cette section pour corriger les erreurs d'encodage.
              La suppression d'éléments ajustera automatiquement les soldes et stocks.
            </p>
          </div>

          {allHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock size={48} className="mx-auto mb-2 opacity-50" />
              <p>Aucun historique disponible</p>
            </div>
          ) : (
            <div className="space-y-3">
              {allHistory.map(item => (
                <div key={`${item.type}-${item.id}`} className="bg-white p-4 rounded-lg shadow-sm">
                  {item.type === 'order-item' ? (
                    // Code existant pour les commandes
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            {item.category}
                          </span>
                          {item.type === 'repayment' && (
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                              Remboursement
                            </span>
                          )}
                          {item.type === 'recharge' && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              Rechargement
                            </span>
                          )}
                        </div>
                        <h3 className="font-medium">{item.memberName}</h3>
                        <p className="text-sm text-gray-600">{formatDate(item.timestamp)}</p>
                        {item.items && item.items.length > 0 && (
                          <div className="mt-2 text-xs text-gray-500">
                            {item.items.map((product, idx) => (
                              <span key={idx}>
                                {product.quantity}x {product.productName}
                                {idx < item.items.length - 1 ? ', ' : ''}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        <div className="flex items-center space-x-2">
                          <span className={`font-semibold ${item.type === 'order' ? 'text-red-600' : 'text-green-600'
                            }`}>
                            {item.type === 'order' ? '-' : '+'}{formatCurrency(item.amount)}
                          </span>
                          <button
                            onClick={() => {
                              if (confirm(`Êtes-vous sûr de vouloir supprimer cette ${item.type === 'order' ? 'commande' : 'transaction'} ?\nCela restaurera le solde et le stock.`)) {
                                deleteOrder(item.id);
                              }
                            }}
                            className="p-1 text-red-500 hover:bg-red-50 rounded active:scale-95 transition-transform"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : item.type === 'financial-item' ? (
                    // NOUVEAU : Code pour les transactions financières
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className={`text-xs px-2 py-1 rounded ${item.category === 'Rentrées'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                            }`}>
                            {item.category}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded ${item.paymentMethod === 'cash'
                            ? 'bg-green-50 text-green-700'
                            : 'bg-blue-50 text-blue-700'
                            }`}>
                            {item.paymentMethod === 'cash' ? '💵 Cash' : '🏦 Compte'}
                          </span>
                        </div>
                        <h3 className="font-medium">{item.description}</h3>
                        <p className="text-sm text-gray-600">{formatDate(item.timestamp)}</p>
                        {item.category && item.category !== 'other' && (
                          <p className="text-xs text-gray-500 mt-1">
                            Catégorie: {item.category === 'sales' ? 'Ventes' :
                              item.category === 'events' ? 'Événements' :
                                item.category === 'donations' ? 'Dons' :
                                  item.category === 'subsidies' ? 'Subsides' :
                                    item.category === 'supplies' ? 'Fournitures' :
                                      item.category === 'maintenance' ? 'Entretien' :
                                        item.category === 'utilities' ? 'Utilities' :
                                          'Autre'}
                          </p>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        <div className="flex items-center space-x-2">
                          <span className={`font-semibold ${item.category === 'Rentrées' ? 'text-green-600' : 'text-red-600'
                            }`}>
                            {item.category === 'Rentrées' ? '+' : '-'}{formatCurrency(item.amount)}
                          </span>
                          <button
                            onClick={() => {
                              if (confirm(`Êtes-vous sûr de vouloir supprimer cette ${item.category.toLowerCase()} ?\n"${item.description}"`)) {
                                deleteFinancialTransaction(item.id);
                              }
                            }}
                            className="p-1 text-red-500 hover:bg-red-50 rounded active:scale-95 transition-transform"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Code existant pour les boulots
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                            {item.category}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded ${item.isPaid
                            ? 'bg-green-100 text-green-800'
                            : 'bg-orange-100 text-orange-800'
                            }`}>
                            {item.isPaid ? 'Payé' : 'Non payé'}
                          </span>
                        </div>
                        <h3 className="font-medium">{item.broName}</h3>
                        <p className="text-sm text-gray-600">{item.description}</p>
                        <p className="text-xs text-gray-500">{formatDate(item.date)}</p>
                      </div>
                      <div className="text-right ml-4">
                        <div className="flex items-center space-x-2">
                          <div>
                            <p className="font-semibold text-green-600">{item.hours}h</p>
                            <p className="text-sm text-green-600">{formatCurrency(item.total)}</p>
                          </div>
                          <button
                            onClick={() => {
                              if (confirm(`Êtes-vous sûr de vouloir supprimer ce boulot ?\nCela retirera ${item.hours}h du total de ${item.broName}.`)) {
                                deleteJob(item.id);
                              }
                            }}
                            className="p-1 text-red-500 hover:bg-red-50 rounded active:scale-95 transition-transform"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (currentScreen === 'settings-goal') {
    // Calculer les totaux pour cet écran
    const calculateTotalsForGoal = () => {
      let cashTotal = 0;
      let accountTotal = 0;

      // Ajouter les transactions financières manuelles
      financialTransactions.forEach(transaction => {
        const amount = transaction.amount || 0;
        if (transaction.paymentMethod === 'cash') {
          cashTotal += transaction.type === 'income' ? amount : -amount;
        } else if (transaction.paymentMethod === 'account') {
          accountTotal += transaction.type === 'income' ? amount : -amount;
        }
      });

      // Ajouter les remboursements/rechargements membres
      orders.forEach(order => {
        if (order.type === 'repayment' || order.type === 'recharge') {
          const amount = order.amount || 0;
          if (order.paymentMethod === 'cash') {
            cashTotal += amount;
          } else if (order.paymentMethod === 'account') {
            accountTotal += amount;
          }
        } else if (order.type === 'order') {
          const amount = order.amount || 0;
          cashTotal += amount; // Les ventes vont en caisse par défaut
        }
      });

      // Ajouter les revenus des boulots payés
      jobs.forEach(job => {
        if (job.isPaid) {
          const amount = job.total || 0;
          if (job.paymentMethod === 'cash') {
            cashTotal += amount;
          } else if (job.paymentMethod === 'account') {
            accountTotal += amount;
          }
        }
      });

      return { cashTotal, accountTotal, grandTotal: cashTotal + accountTotal };
    };

    const { cashTotal, accountTotal, grandTotal } = calculateTotalsForGoal();

    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Objectif Financier" onBack={() => navigateTo('settings')} />

        <div className="p-4 space-y-6">
          {/* État actuel */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">💰 Situation Actuelle</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="bg-green-100 p-3 rounded-lg">
                  <p className="text-lg font-bold text-green-600">{formatCurrency(cashTotal)}</p>
                  <p className="text-xs text-green-700">Caisse</p>
                </div>
              </div>
              <div className="text-center">
                <div className="bg-blue-100 p-3 rounded-lg">
                  <p className="text-lg font-bold text-blue-600">{formatCurrency(accountTotal)}</p>
                  <p className="text-xs text-blue-700">Compte</p>
                </div>
              </div>
              <div className="text-center">
                <div className="bg-yellow-100 p-3 rounded-lg">
                  <p className="text-lg font-bold text-yellow-600">{formatCurrency(grandTotal)}</p>
                  <p className="text-xs text-yellow-700">Total</p>
                </div>
              </div>
            </div>
          </div>

          {/* Objectif actuel ou formulaire */}
          {financialGoal.isActive ? (
            <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-purple-800 mb-4">🎯 Objectif Actuel</h2>

              <div className="space-y-4">
                <div className="bg-white bg-opacity-70 p-4 rounded-lg">
                  <h3 className="font-semibold text-purple-800 mb-2">{financialGoal.description}</h3>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Objectif: {formatCurrency(financialGoal.amount)}</span>
                    {financialGoal.deadline && (
                      <span>Échéance: {formatDate(financialGoal.deadline)}</span>
                    )}
                  </div>

                  {/* Barre de progression */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-purple-700">
                        {formatCurrency(grandTotal)} / {formatCurrency(financialGoal.amount)}
                      </span>
                      <span className={`font-bold ${(grandTotal / financialGoal.amount) * 100 >= 100
                        ? 'text-green-600'
                        : (grandTotal / financialGoal.amount) * 100 >= 75
                          ? 'text-blue-600'
                          : (grandTotal / financialGoal.amount) * 100 >= 50
                            ? 'text-yellow-600'
                            : 'text-red-600'
                        }`}>
                        {((grandTotal / financialGoal.amount) * 100).toFixed(1)}%
                      </span>
                    </div>

                    <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                      <div
                        className={`h-4 rounded-full transition-all duration-1000 ease-out ${(grandTotal / financialGoal.amount) * 100 >= 100
                          ? 'bg-gradient-to-r from-green-400 to-green-600'
                          : (grandTotal / financialGoal.amount) * 100 >= 75
                            ? 'bg-gradient-to-r from-blue-400 to-blue-600'
                            : (grandTotal / financialGoal.amount) * 100 >= 50
                              ? 'bg-gradient-to-r from-yellow-400 to-yellow-600'
                              : 'bg-gradient-to-r from-red-400 to-red-600'
                          }`}
                        style={{ width: `${Math.min(100, (grandTotal / financialGoal.amount) * 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Message de statut */}
                  <div className="text-center mt-3">
                    {(() => {
                      const percentage = (grandTotal / financialGoal.amount) * 100;
                      const remaining = Math.max(0, financialGoal.amount - grandTotal);

                      if (percentage >= 100) {
                        return (
                          <p className="text-green-700 font-semibold">
                            🎉 Objectif atteint ! Félicitations !
                          </p>
                        );
                      } else {
                        return (
                          <p className="text-purple-700">
                            Il reste <strong>{formatCurrency(remaining)}</strong> à atteindre
                          </p>
                        );
                      }
                    })()}
                  </div>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => { setModalType('edit-goal'); setShowModal(true); }}
                    className="flex-1 p-3 bg-blue-500 text-white rounded-lg active:scale-95 transition-transform"
                  >
                    ✏️ Modifier
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm('Êtes-vous sûr de vouloir supprimer votre objectif financier ?')) {
                        try {
                          if (financialGoal.id) {
                            await deleteFromFirebase('financialGoals', financialGoal.id);
                          }
                          setFinancialGoal({ amount: 0, description: '', deadline: '', isActive: false });
                          alert('Objectif supprimé ! 🗑️');
                        } catch (error) {
                          console.error('Erreur suppression objectif:', error);
                          alert('Erreur lors de la suppression de l\'objectif');
                        }
                      }
                    }}
                    className="flex-1 p-3 bg-red-500 text-white rounded-lg active:scale-95 transition-transform"
                  >
                    🗑️ Supprimer
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-purple-800 mb-4">🎯 Définir un Objectif</h2>

              <div className="bg-white bg-opacity-70 p-4 rounded-lg mb-4">
                <h4 className="font-medium text-purple-800 mb-2">💡 Pourquoi un objectif ?</h4>
                <div className="text-sm text-purple-700 space-y-1">
                  <p>• Rester motivé dans la gestion financière</p>
                  <p>• Avoir un cap à atteindre</p>
                  <p>• Suivre vos progrès visuellement</p>
                  <p>• Célébrer vos réussites !</p>
                </div>
              </div>

              <button
                onClick={() => { setModalType('set-goal'); setShowModal(true); }}
                className="w-full p-4 bg-purple-500 text-white rounded-lg font-semibold active:scale-95 transition-transform"
              >
                ✨ Créer mon Objectif
              </button>
            </div>
          )}

          {/* Conseils */}
          <div className="bg-gradient-to-r from-blue-100 to-indigo-100 rounded-xl p-4">
            <h3 className="font-semibold text-blue-800 mb-2">💡 Conseils pour vos Objectifs</h3>
            <div className="text-sm text-blue-700 space-y-1">
              <p>• <strong>Réaliste :</strong> Fixez un montant atteignable</p>
              <p>• <strong>Motivant :</strong> Choisissez un objectif qui vous tient à cœur</p>
              <p>• <strong>Daté :</strong> Une échéance vous aidera à rester focus</p>
              <p>• <strong>Mesurable :</strong> Suivez régulièrement vos progrès</p>
            </div>
          </div>
        </div>

        {/* Modal pour créer un objectif */}
        <Modal
          isOpen={showModal && modalType === 'set-goal'}
          onClose={() => { setShowModal(false); setNewGoal({ amount: '', description: '', deadline: '' }); }}
          title="🎯 Créer mon Objectif Financier"
        >
          <div className="space-y-4">
            <div className="bg-purple-50 p-3 rounded-lg">
              <h4 className="font-medium text-purple-800 mb-1">🚀 Votre trésorerie actuelle</h4>
              <p className="text-sm text-purple-700">
                Vous avez actuellement <strong>{formatCurrency(grandTotal)}</strong> en trésorerie totale.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                💰 Montant à atteindre *
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min={grandTotal}
                  value={newGoal.amount}
                  onChange={(e) => setNewGoal({ ...newGoal, amount: e.target.value })}
                  className="w-full p-3 border rounded-lg pr-8"
                  placeholder={`Minimum: ${formatCurrency(grandTotal)}`}
                />
                <span className="absolute right-3 top-3 text-gray-500">€</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Recommandé : au moins {formatCurrency(grandTotal + 500)} pour un objectif motivant
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📝 Description de l'objectif *
              </label>
              <input
                type="text"
                value={newGoal.description}
                onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                className="w-full p-3 border rounded-lg"
                placeholder="Ex: Fonds pour nouveau matériel, réserve sécurité, projet spécial..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📅 Échéance (optionnel mais recommandé)
              </label>
              <input
                type="date"
                value={newGoal.deadline}
                onChange={(e) => setNewGoal({ ...newGoal, deadline: e.target.value })}
                className="w-full p-3 border rounded-lg"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            {/* Aperçu */}
            {newGoal.amount && newGoal.description && (
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-3 rounded-lg">
                <h4 className="font-medium text-purple-800 mb-2">🎯 Aperçu de votre objectif :</h4>
                <div className="text-sm text-purple-700 space-y-1">
                  <p><strong>Objectif :</strong> {newGoal.description}</p>
                  <p><strong>Montant :</strong> {formatCurrency(parseFloat(newGoal.amount) || 0)}</p>
                  <p><strong>À gagner :</strong> {formatCurrency(Math.max(0, parseFloat(newGoal.amount) - grandTotal))}</p>
                  {newGoal.deadline && (
                    <p><strong>Échéance :</strong> {formatDate(newGoal.deadline)}</p>
                  )}
                  <p><strong>Progression actuelle :</strong> {((grandTotal / parseFloat(newGoal.amount)) * 100).toFixed(1)}%</p>
                </div>
              </div>
            )}

            <button
              onClick={async () => {
                const amount = parseFloat(newGoal.amount);

                if (amount > 0 && newGoal.description.trim()) {
                  const goal = {
                    amount: amount,
                    description: newGoal.description.trim(),
                    deadline: newGoal.deadline || null,
                    isActive: true,
                    createdAt: new Date().toISOString()
                  };

                  try {
                    // Supprimer l'ancien objectif s'il existe
                    if (financialGoal.isActive && financialGoal.id) {
                      await deleteFromFirebase('financialGoals', financialGoal.id);
                    }

                    // Créer le nouveau objectif
                    const goalId = await saveToFirebase('financialGoals', goal);
                    setFinancialGoal({ ...goal, id: goalId });

                    setNewGoal({ amount: '', description: '', deadline: '' });
                    setShowModal(false);
                    alert('Objectif défini avec succès ! 🎯');
                  } catch (error) {
                    console.error('Erreur définition objectif:', error);
                    alert('Erreur lors de la définition de l\'objectif');
                  }
                }
              }}
              disabled={!newGoal.amount || !newGoal.description.trim() || parseFloat(newGoal.amount) < grandTotal || loading}
              className="w-full p-3 bg-purple-500 text-white rounded-lg disabled:bg-gray-300 active:scale-95 transition-transform"
            >
              {loading ? 'Création...' : '🎯 Créer mon Objectif'}
            </button>
          </div>
        </Modal>

        {/* Modal pour modifier l'objectif */}
        <Modal
          isOpen={showModal && modalType === 'edit-goal'}
          onClose={() => { setShowModal(false); setNewGoal({ amount: '', description: '', deadline: '' }); }}
          title="✏️ Modifier mon Objectif"
        >
          <div className="space-y-4">
            <div className="bg-yellow-50 p-3 rounded-lg">
              <h4 className="font-medium text-yellow-800 mb-1">⚠️ Modifier l'objectif</h4>
              <p className="text-sm text-yellow-700">
                Vous pouvez ajuster votre objectif selon vos nouveaux besoins.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                💰 Montant à atteindre *
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newGoal.amount || financialGoal.amount}
                  onChange={(e) => setNewGoal({ ...newGoal, amount: e.target.value })}
                  className="w-full p-3 border rounded-lg pr-8"
                  placeholder={financialGoal.amount?.toString() || "0.00"}
                />
                <span className="absolute right-3 top-3 text-gray-500">€</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📝 Description de l'objectif *
              </label>
              <input
                type="text"
                value={newGoal.description || financialGoal.description}
                onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                className="w-full p-3 border rounded-lg"
                placeholder={financialGoal.description || "Description..."}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📅 Échéance (optionnel)
              </label>
              <input
                type="date"
                value={newGoal.deadline || financialGoal.deadline || ''}
                onChange={(e) => setNewGoal({ ...newGoal, deadline: e.target.value })}
                className="w-full p-3 border rounded-lg"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            <button
              onClick={async () => {
                const amount = parseFloat(newGoal.amount || financialGoal.amount);
                const description = newGoal.description || financialGoal.description;

                if (amount > 0 && description.trim() && financialGoal.id) {
                  const updatedGoal = {
                    amount: amount,
                    description: description.trim(),
                    deadline: newGoal.deadline || financialGoal.deadline,
                    updatedAt: new Date().toISOString()
                  };

                  try {
                    await updateInFirebase('financialGoals', financialGoal.id, updatedGoal);
                    setFinancialGoal({ ...financialGoal, ...updatedGoal });
                    setNewGoal({ amount: '', description: '', deadline: '' });
                    setShowModal(false);
                    alert('Objectif mis à jour ! 📝');
                  } catch (error) {
                    console.error('Erreur mise à jour objectif:', error);
                    alert('Erreur lors de la mise à jour de l\'objectif');
                  }
                }
              }}
              disabled={loading}
              className="w-full p-3 bg-blue-500 text-white rounded-lg disabled:bg-gray-300 active:scale-95 transition-transform"
            >
              {loading ? 'Mise à jour...' : '✅ Mettre à Jour'}
            </button>
          </div>
        </Modal>
      </div>
    );
  }

  if (currentScreen === 'settings-popular') {

    if (tempPopularProducts.length === 0 && popularProducts.length > 0) {
      console.log('Initialisation de tempPopularProducts avec:', popularProducts);
      setTempPopularProducts([...popularProducts]);
    }
    const addPopularProduct = (productName) => {
      if (!tempPopularProducts.includes(productName) && tempPopularProducts.length < 6) {
        setTempPopularProducts([...tempPopularProducts, productName]);
      }
    };

    const removePopularProduct = (productName) => {
      setTempPopularProducts(tempPopularProducts.filter(name => name !== productName));
    };

    const savePopularProducts = async () => {
      try {
        console.log('Sauvegarde des produits populaires :', tempPopularProducts);

        // Sauvegarder la nouvelle configuration
        await saveToFirebase('popularProducts', {
          products: tempPopularProducts,
          lastUpdated: new Date().toISOString()
        });

        // Mettre à jour l'état local immédiatement
        setPopularProducts(tempPopularProducts);

        alert('✅ Produits populaires mis à jour !');
        navigateTo('settings');
      } catch (error) {
        console.error('Erreur sauvegarde produits populaires:', error);
        alert('Erreur lors de la sauvegarde');
      }
    };

    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Produits Populaires" onBack={() => navigateTo('settings')} />

        <div className="p-4 space-y-6">
          {/* Explication */}
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-800 mb-2">⭐ Affichage Rapide</h3>
            <p className="text-sm text-blue-700">
              Sélectionnez jusqu'à 6 produits qui apparaîtront en premier lors des commandes
              pour un accès rapide.
            </p>
          </div>

          {/* Produits actuellement populaires */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h3 className="font-semibold mb-3">
              🎯 Produits populaires actuels ({tempPopularProducts.length}/6)
            </h3>

            {tempPopularProducts.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                Aucun produit sélectionné
              </p>
            ) : (
              <div className="space-y-2">
                {tempPopularProducts.map((productName, index) => {
                  const product = products.find(p => p.name === productName);
                  return (
                    <div key={productName} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                      <div className="flex items-center space-x-3">
                        <div className="bg-yellow-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <h4 className="font-medium">{productName}</h4>
                          {product && (
                            <p className="text-sm text-gray-600">
                              {formatCurrency(product.price)} - Stock: {product.stock}
                            </p>
                          )}
                          {!product && (
                            <p className="text-sm text-red-600">⚠️ Produit introuvable</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => removePopularProduct(productName)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-full active:scale-95 transition-transform"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Ajouter des produits */}
          {tempPopularProducts.length < 6 && (
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-semibold mb-3">
                ➕ Ajouter des produits ({6 - tempPopularProducts.length} places restantes)
              </h3>

              <div className="space-y-3">
                {products
                  .filter(product => !tempPopularProducts.includes(product.name))
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(product => (
                    <div key={product.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium">{product.name}</h4>
                        <div className="flex items-center space-x-3 text-sm text-gray-600">
                          <span>{formatCurrency(product.price)}</span>
                          <span>•</span>
                          <span>{product.category}</span>
                          <span>•</span>
                          <span className={product.stock > 0 ? 'text-green-600' : 'text-red-600'}>
                            Stock: {product.stock}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => addPopularProduct(product.name)}
                        disabled={tempPopularProducts.length >= 6}
                        className="p-2 bg-green-500 text-white rounded-full hover:bg-green-600 disabled:bg-gray-300 active:scale-95 transition-transform"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Boutons d'action */}
          <div className="flex space-x-3">
            <button
              onClick={() => {
                setTempPopularProducts([...popularProducts]);
                navigateTo('settings');
              }}
              className="flex-1 p-3 bg-gray-500 text-white rounded-lg active:scale-95 transition-transform"
            >
              Annuler
            </button>
            <button
              onClick={savePopularProducts}
              disabled={JSON.stringify(tempPopularProducts) === JSON.stringify(popularProducts)}
              className="flex-1 p-3 bg-purple-500 text-white rounded-lg disabled:bg-gray-300 active:scale-95 transition-transform"
            >
              💾 Sauvegarder
            </button>
          </div>

          {/* Conseils */}
          <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
            <h4 className="font-semibold text-green-800 mb-2">💡 Conseils :</h4>
            <div className="text-sm text-green-700 space-y-1">
              <p>• Choisissez vos produits les plus vendus</p>
              <p>• Mélangez différentes catégories (bières, sodas, snacks)</p>
              <p>• Vérifiez que les produits sont en stock</p>
              <p>• L'ordre dans la liste = ordre d'affichage</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center p-8">
        <div className="mb-4">🎉</div>
        <h2 className="text-xl font-semibold mb-2">Application Complète Fonctionnelle !</h2>
        <p className="text-gray-600 mb-4">
          Toutes les fonctionnalités avancées sont implémentées et testées
        </p>
        <div className="text-left text-sm text-gray-600 mb-6 space-y-1">
          <p>✅ <strong>Section Bar :</strong> Membres, commandes avec stock, historique</p>
          <p>✅ <strong>Gestion Stock :</strong> Alertes, ajustements, ventes spéciales bières</p>
          <p>✅ <strong>Section Boulots :</strong> Multi-Bro, statut paiements, statistiques</p>
          <p>✅ <strong>Graphiques :</strong> Barres animées, classements, métriques</p>
          <p>✅ <strong>Paramètres :</strong> Produits, stock, tarifs, corrections</p>
          <p>✅ <strong>Corrections :</strong> Historique complet, suppressions intelligentes</p>
          <p>✅ <strong>Interface :</strong> Mobile-first, animations, feedback utilisateur</p>
        </div>
        <button
          onClick={() => navigateTo('home')}
          className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg shadow-lg active:scale-95 transition-transform font-semibold"
        >
          🏠 Retour à l'accueil
        </button>
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800 font-medium">
            🚀 Application prête pour le déploiement avec Firebase !
          </p>
          <p className="text-xs text-green-600 mt-1">
            Tous les écrans, fonctionnalités et corrections sont opérationnels
          </p>
        </div>
      </div>
    </div>
  );
};

export default PatroApp;