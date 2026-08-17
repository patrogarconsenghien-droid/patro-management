import React, { useState, useEffect } from 'react';
import {
  Beer, Wrench, Settings, Users, Plus, Minus, ShoppingCart,
  ArrowLeft, Trash2, DollarSign, Clock, User, CheckCircle,
  BarChart3, Wifi, WifiOff, Plane
} from 'lucide-react';
import { useNotifications } from './useNotifications';
import { Bell, Check, X } from 'lucide-react';
import TonneauSurprise from './components/TonneauSurprise';
import TripManager from './TripManager';
import Modal from './components/Modal';
import HeaderBase from './components/Header';
import SeasonBanner from './components/SeasonBanner';
import { useSeasons } from './hooks/useSeasons';
import HomeScreen from './Home';
import SettingsScreen from './Settings';
import BoulotsScreen from './Boulots';
import { formatCurrency, formatDate, formatDateTime } from './lib/format';
import { createStockHelpers } from './lib/stock';
import { useFirestoreData } from './hooks/useFirestoreData';

const PatroApp = () => {

  const [currentScreen, setCurrentScreen] = useState('home');

  // La saison consultée détermine sur quelles données toute l'app travaille.
  const {
    activeSeasonId, viewedSeasonId, seasons, isViewingArchive,
    selectSeason, backToActiveSeason
  } = useSeasons();

  const {
    isOnline, loading,
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
  } = useFirestoreData(viewedSeasonId);
  const { updateStock, getStockStatus } = createStockHelpers({ products, updateInFirebase, saveToFirebase });
  const Header = ({ title, onBack }) => (
    <>
      <HeaderBase title={title} onBack={onBack} loading={loading} isOnline={isOnline} />
      {isViewingArchive && (
        <SeasonBanner seasonId={viewedSeasonId} onBackToActive={backToActiveSeason} />
      )}
    </>
  );
  const [memberSearch, setMemberSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [selectedMember, setSelectedMember] = useState(null);
  const [cart, setCart] = useState({});
  const [cartTotal, setCartTotal] = useState(0);
  const [repaymentAmount, setRepaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [hourlyRate, setHourlyRate] = useState(10.00);
  const [newMemberName, setNewMemberName] = useState('');
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false); // ✅ Ici maintenant
  const [productSearch, setProductSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [showOnlyInStock, setShowOnlyInStock] = useState(false);
  const [sortBy, setSortBy] = useState('name'); // 'name', 'price', 'stock'
  const [settingsAuthenticated, setSettingsAuthenticated] = useState(false);
  const [selectedBro, setSelectedBro] = useState(null);
  const [newMemberIsExternal, setNewMemberIsExternal] = useState(false);
  const [directPayment, setDirectPayment] = useState(false);
  const [directPaymentMethod, setDirectPaymentMethod] = useState('');
  const [showRoulette, setShowRoulette] = useState(false);
  const [rouletteSurprises, setRouletteSurprises] = useState([]);
  const [rouletteResult, setRouletteResult] = useState(null);
  const [rouletteOptions, setRouletteOptions] = useState([]);
  // ===== GESTION VOYAGE =====
  const [tripAuthenticated, setTripAuthenticated] = useState(false);
  const [sharedItems, setSharedItems] = useState({});

  const tripLockedMessages = [
    {
      title: "Accès refusé ❌",
      description: "Non, cliquer plus fort ne débloquera pas le voyage. Va bosser."
    },
    {
      title: "Toujours pas partis",
      description: "Et spoiler : ce n’est pas aujourd’hui non plus."
    },
    {
      title: "Bien tenté 😏",
      description: "Mais la curiosité ne paie pas le bus."
    },
    {
      title: "Zone Voyage verrouillée 🔒",
      description: "Cette section s’ouvre avec de l’argent, pas de l’espoir."
    },
    {
      title: "Calme-toi explorateur",
      description: "L’aventure commence après le financement."
    },
    {
      title: "Tu pensais vraiment voir des infos ?",
      description: "On admire l’optimisme."
    },
    {
      title: "Accès bloqué 🚫",
      description: "Les vacances ne se débloquent pas au talent."
    },
    {
      title: "Spoiler alert 🚨",
      description: "Ce message est tout ce que tu obtiendras aujourd’hui."
    },
    {
      title: "Erreur 404",
      description: "Voyage introuvable. Cause probable : zéro départ."
    },
    {
      title: "Toujours trop tôt",
      description: "Même Google ne trouve pas encore le voyage."
    },
    {
      title: "Indice du jour 💡",
      description: "Travailler aide étrangement à partir en voyage."
    },
    {
      title: "Avant de rêver",
      description: "Il faudrait peut-être commencer par bosser."
    },
    {
      title: "Accès verrouillé 🔐",
      description: "Insister ne rendra pas cette page magique."
    },
    {
      title: "Mauvais timing",
      description: "Le voyage n’a même pas commencé à exister."
    },
    {
      title: "Bien essayé",
      description: "Mais ce bouton ne sert à rien. Vraiment."
    },
    {
      title: "Patience requise ⏳",
      description: "Oui, encore. Et oui, toujours."
    },
    {
      title: "Tu veux les infos ?",
      description: "Commence par aider à payer le voyage."
    },
    {
      title: "Zone indisponible",
      description: "Ce n’est pas un bug. C’est volontaire."
    },
    {
      title: "Toujours pas l’heure",
      description: "Reviens quand on aura quitté le pays."
    },
    {
      title: "Accès refusé",
      description: "Négociation refusée. Décision finale."
    },
    {
      title: "Tu pensais contourner ?",
      description: "Joli essai. Mauvais résultat."
    },
    {
      title: "Aucune info ici",
      description: "Même en cherchant très fort."
    },
    {
      title: "Le voyage attend",
      description: "Toi, tu peux encore travailler."
    },
    {
      title: "Encore un clic inutile",
      description: "Mais au moins tu auras essayé."
    },
    {
      title: "Section bloquée",
      description: "Parce que non, ce n’est pas encore le moment."
    }
  ];





  console.log('🔍 Rendu avec screen:', currentScreen);



  const [newTransaction, setNewTransaction] = useState({
    type: 'income', // 'income' ou 'expense'
    amount: '',
    description: '',
    paymentMethod: 'cash',
    category: 'other'
  });

  // --- VERRE SURPRISE ---
  const rarityWeights = {
    commun: 50,
    normal: 30,
    rare: 10,
    legendaire: 1
  };



  const [newJob, setNewJob] = useState({
    description: '', date: new Date().toISOString().split('T')[0],
    customRate: 10.00, bros: [], isPaid: false, paymentMethod: ''
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

  const { isSupported, permission, requestPermission } = useNotifications(); // ✅ Maintenant ici
  const [selectedDay, setSelectedDay] = useState(null);
  const [salesStatsSortBy, setSalesStatsSortBy] = useState('quantity');
  const [randomTripMessage, setRandomTripMessage] = useState(null);

  useEffect(() => {
    if (showModal && modalType === "trip-locked") {
      const randomIndex = Math.floor(Math.random() * tripLockedMessages.length);
      setRandomTripMessage(tripLockedMessages[randomIndex]);
    }
  }, [showModal, modalType]);





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

  // 🎯 Met à jour la pondération (rareté) d’un produit surprise
  const updateProductWeight = (productId, rarityValue) => {
    const newWeights = {
      ...surpriseSettings.weights,
      [productId]: rarityValue
    };
    setSurpriseSettings(prev => ({ ...prev, weights: newWeights }));
  };

  const saveSurpriseSettings = async () => {
    try {
      // On s’assure que les pondérations existent bien
      const weightsToSave = surpriseSettings.weights || {};

      await saveToFirebase('surpriseSettings', {
        ...surpriseSettings,
        weights: weightsToSave, // 🔥 sauvegarde des pondérations
        updatedAt: new Date().toISOString()
      });

      alert('✅ Paramètres du verre surprise enregistrés avec succès !');
    } catch (error) {
      console.error('Erreur sauvegarde paramètres verre surprise:', error);
      alert('❌ Erreur lors de la sauvegarde des paramètres du verre surprise.');
    }
  };



  const navigateTo = (screen, member = null, bro = null) => {
    setCurrentScreen(screen);
    setSelectedMember(member);
    setSelectedBro(bro);
    setCart({});

    // Pousser l'état dans l'historique pour la navigation mobile
    window.history.pushState(
      { screen: screen, selectedMember: member, selectedBro: bro },
      '',
      `#${screen}`
    );
  };

  const addMember = async () => {
    if (newMemberName.trim()) {
      const newMember = {
        name: newMemberName.trim(),
        balance: 0,
        isExternal: newMemberIsExternal  // ⭐ Utilise la valeur de la checkbox
      };

      try {
        await saveToFirebase('members', newMember);
        setNewMemberName('');
        setNewMemberIsExternal(false);
        setShowModal(false);
      } catch (error) {
        alert('Erreur lors de l\'ajout du membre');
      }
    }
  };

  const getFilteredProducts = () => {
    let filtered = products;

    // 🔍 Filtrer par recherche
    if (productSearch.trim()) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(productSearch.toLowerCase())
      );
    }

    // 🏷️ Filtrer par catégorie
    if (activeCategory !== 'all') {
      filtered = filtered.filter(product => product.category === activeCategory);
    }

    // 📦 Filtrer par stock uniquement
    if (showOnlyInStock) {
      filtered = filtered.filter(product => product.stock > 0);
    }

    // 🧮 Trier les produits
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

    // 🎲 Ajouter le Verre Surprise si activé
    if (surpriseSettings.enabled) {
      // ✅ Vérifie si le produit "verre_surprise" n'est pas déjà présent
      const hasSurprise = filtered.some(p => p.id === 'verre_surprise');

      if (surpriseSettings.enabled) {
        const hasSurprise = filtered.some(p => p.id === 'verre_surprise');

        if (!hasSurprise) {
          // 🔍 Calcule le stock total disponible des produits éligibles
          const eligibleProducts = products.filter(p =>
            surpriseSettings.eligibleProducts.includes(p.id)
          );
          const totalStock = eligibleProducts.reduce((sum, p) => sum + (p.stock || 0), 0);

          // ✅ N’ajoute le verre surprise que s’il y a du stock global
          if (totalStock > 0 && (activeCategory === 'Boissons' || activeCategory === 'all')) {
            filtered.unshift({
              id: 'verre_surprise',
              name: '🎲 Verre Surprise',
              price: surpriseSettings.price || 2.5,
              pricePer11: surpriseSettings.pricePer11 || (surpriseSettings.price * 10), // optionnel: prix réduit
              category: 'Boissons',
              stock: totalStock,          // 🟢 somme du stock des bières éligibles
              stockType: 'mixed',         // permet de vendre à l’unité ou par 11
              isSurprise: true
            });
          }
        }
      }

    }

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

    // ⭐ NOUVEAU : Déterminer le prix selon le type de membre
    const basePrice = selectedMember?.isExternal ? (product.externalPrice || product.price) : product.price;

    let pricePerUnit;
    let quantityToAdd;

    switch (saleType) {
      case 'pack':
        pricePerUnit = (product.pricePerPack || basePrice * product.packSize) / product.packSize;
        quantityToAdd = product.packSize;
        break;
      case 'eleven':
        pricePerUnit = (product.pricePer11 || basePrice * 11) / 11;
        quantityToAdd = 11;
        break;
      default: // 'unit'
        pricePerUnit = basePrice;  // ⭐ Utilise le bon prix
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

  // ===== FONCTIONS DE PARTAGE =====
  const addPersonToSharedItem = (itemIndex, member) => {
    setSharedItems(prev => {
      const current = prev[itemIndex] || { members: [orderConfirmation.member], totalShares: 1 };
      if (current.members.find(m => m.id === member.id)) {
        alert('Cette personne est déjà dans le partage !');
        return prev;
      }
      return {
        ...prev,
        [itemIndex]: {
          members: [...current.members, member],
          totalShares: current.totalShares + 1
        }
      };
    });
  };

  const removePersonFromSharedItem = (itemIndex, memberId) => {
    setSharedItems(prev => {
      const current = prev[itemIndex];
      if (!current) return prev;
      const newMembers = current.members.filter(m => m.id !== memberId);
      if (newMembers.length <= 1) {
        const newState = { ...prev };
        delete newState[itemIndex];
        return newState;
      }
      return {
        ...prev,
        [itemIndex]: {
          members: newMembers,
          totalShares: current.totalShares - 1
        }
      };
    });
  };

  const calculateSplitPrice = (totalPrice, numberOfPeople) => {
    const pricePerPerson = totalPrice / numberOfPeople;
    return Math.ceil(pricePerPerson ) ;
  };

  const isItemSharable = (item) => {
    return item.productName.includes('Bac') || item.productName.includes('Lot de 11');
  };

  // 🔧 FONCTION confirmOrder - VERSION FINALE CORRIGÉE
// Cette version utilise les bons noms de champs pour que l'historique fonctionne

const confirmOrder = async () => {
  try {
    const { member, items, total } = orderConfirmation;

    if (!member) return;
    if (directPayment && !directPaymentMethod) {
      alert('Veuillez sélectionner un mode de paiement');
      return;
    }

    setLoading(true);

    // ===== GESTION DES PARTAGES =====
    const ordersToCreate = [];
    const processedItems = new Set();

    // Parcourir les items partagés
    Object.entries(sharedItems).forEach(([itemIndex, shareInfo]) => {
      const item = items[parseInt(itemIndex)];
      processedItems.add(parseInt(itemIndex));

      const splitPrice = calculateSplitPrice(item.total, shareInfo.totalShares);

      // Créer une commande pour chaque personne dans le partage
      shareInfo.members.forEach(shareMember => {
        ordersToCreate.push({
          member: shareMember,
          items: [{
            ...item,
            total: splitPrice,
            isShared: true,
            sharedWith: shareInfo.members.length,
            originalTotal: item.total
          }],
          total: splitPrice,
          isPartOfSharedOrder: true
        });
      });
    });

    // Ajouter les items non partagés pour le membre principal
    items.forEach((item, index) => {
      if (!processedItems.has(index)) {
        ordersToCreate.push({
          member: member,
          items: [item],
          total: item.total,
          isPartOfSharedOrder: false
        });
      }
    });

    // ===== TRAITER CHAQUE COMMANDE =====
    for (const orderData of ordersToCreate) {
      const orderMember = orderData.member;
      
      // Gestion verre surprise (si applicable)
      if (orderConfirmation.isSurprise && orderConfirmation.surprises) {
        // Séparer les produits exclusifs des produits normaux
const exclusiveDrawn = {};
const normalSurprises = [];

for (const surprise of orderConfirmation.surprises) {
  if (surprise.isExclusive) {
    exclusiveDrawn[surprise.id] = (exclusiveDrawn[surprise.id] || 0) + 1;
  } else {
    normalSurprises.push(surprise);
  }
}

// Décrémenter le stock des produits normaux
for (const surprise of normalSurprises) {
  await updateStock(surprise.id, -1, 'Verre Surprise');
}

// Décrémenter le stock des produits exclusifs et sauvegarder
if (Object.keys(exclusiveDrawn).length > 0) {
  const updatedExclusive = (surpriseSettings.exclusiveProducts || []).map(p => ({
    ...p,
    stock: Math.max(0, (p.stock || 0) - (exclusiveDrawn[p.id] || 0))
  }));
  const newSettings = { ...surpriseSettings, exclusiveProducts: updatedExclusive };
  setSurpriseSettings(newSettings);
  await saveToFirebase('surpriseSettings', {
    ...newSettings,
    updatedAt: new Date().toISOString()
  });
}
      }

      // ⭐ SI PAIEMENT DIRECT : Créer un rechargement
      if (directPayment && directPaymentMethod && orderData.member.id === member.id) {
        const rechargeTransaction = {
          memberId: orderMember.id,
          memberName: orderMember.name,
          type: 'recharge',
          amount: orderData.total,  // ← IMPORTANT : "amount" pas "total"
          paymentMethod: directPaymentMethod,
          timestamp: new Date().toISOString(),
          items: []
        };
        await saveToFirebase('orders', rechargeTransaction);
      }

      // Créer la commande
      const order = {
        memberId: orderMember.id,
        memberName: orderMember.name,
        type: 'order',
        amount: orderData.total,  // ← IMPORTANT : "amount" pas "total"
        timestamp: new Date().toISOString(),
        items: orderData.items
      };
      await saveToFirebase('orders', order);

      // Mettre à jour le stock (une seule fois pour les items partagés)
      if (!orderData.isPartOfSharedOrder || orderData.member.id === member.id) {
        for (const item of orderData.items) {
          const product = products.find(p => p.id === item.productId);
          if (product && item.productId !== 'verre_surprise') {
            const quantityToReduce = item.saleType === 'pack' 
              ? item.quantity * product.packSize
              : item.saleType === 'eleven'
              ? item.quantity * 11
              : item.quantity;

            await updateStock(item.productId, -quantityToReduce, `Vente à ${orderMember.name}`);
          }
        }
      }

      // Mettre à jour le solde
      const balanceChange = directPayment && orderData.member.id === member.id
        ? 0  // Si paiement direct : +total puis -total = 0
        : -orderData.total;  // Sinon : juste débiter
      
      await updateInFirebase('members', orderMember.id, {
        balance: orderMember.balance + balanceChange
      });
    }

    // Réinitialiser tout
    setCart({});
    setCartTotal(0);
    setOrderConfirmation({ show: false, member: null, items: [], total: 0 });
    setDirectPayment(false);
    setDirectPaymentMethod('');
    setSharedItems({});
    
    alert(ordersToCreate.length > 1 
      ? `✅ ${ordersToCreate.length} commandes validées avec succès !`
      : '✅ Commande validée avec succès !');
    
    setSelectedMember(null);
    navigateTo('bar-order');

  } catch (error) {
    console.error('Erreur lors de la validation:', error);
    alert('Erreur lors de la validation de la commande');
  } finally {
    setLoading(false);
  }
};




  const validateOrder = async () => {
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

    // Vérifier le stock (sauf verre surprise)
    Object.entries(totalUnitsNeeded).forEach(([productId, totalNeeded]) => {
      if (productId === 'verre_surprise') return;
      const product = products.find(p => p.id === productId);
      if (product && product.stock < totalNeeded) {
        stockIssues.push(`${product.name}: stock insuffisant`);
      }
    });

    if (stockIssues.length > 0) {
      alert('⚠️ Stock insuffisant pour certains produits :\n' + stockIssues.join('\n'));
      return;
    }

    // 🟣 Vérifier s’il y a un verre surprise dans la commande
    const hasSurprise = Object.values(cart).some(item => item.productId === 'verre_surprise');

    // 🎲 --- VERRE SURPRISE ---
    if (hasSurprise) {// 🎯 Sélection des produits éligibles
      const exclusiveEligible = (surpriseSettings.exclusiveProducts || [])
  .filter(p => p.stock > 0)
  .map(p => ({ ...p, isExclusive: true }));

const eligible = [
  ...products.filter(p => surpriseSettings.eligibleProducts.includes(p.id) && p.stock > 0),
  ...exclusiveEligible
];

      if (eligible.length === 0) {
        alert("Aucun produit disponible pour le verre surprise !");
        return;
      }

      // 🎲 Nouveau tirage selon probabilités officielles (60 / 25 / 13.5 / 1.5)
      const surprises = [];
      const stockCopy = {};
      eligible.forEach(p => (stockCopy[p.id] = p.stock));

      Object.values(cart).forEach(item => {
        if (item.productId === 'verre_surprise') {

          for (let i = 0; i < item.quantity; i++) {
            const available = eligible.filter(p => stockCopy[p.id] > 0);
            if (available.length === 0) break;

            // 🟣 Regrouper par rareté selon surpriseSettings.weights
            const communs = available.filter(p => surpriseSettings.weights[p.id] === 70);
            const normals = available.filter(p => surpriseSettings.weights[p.id] === 40);
            const rares = available.filter(p => surpriseSettings.weights[p.id] === 15);
            const legendaires = available.filter(p => surpriseSettings.weights[p.id] === 1);

            // 🟣 Tirage de rareté
            const r = Math.random() * 100;
            let rarity = "normal";

            if (r < 60) rarity = "commun";
            else if (r < 60 + 25) rarity = "normal";
            else if (r < 60 + 25 + 13.5) rarity = "rare";
            else rarity = "legendaire";

            // 🟣 Sélection équitable dans la rareté tirée
            let pool = [];
            if (rarity === "commun") pool = communs;
            else if (rarity === "normal") pool = normals;
            else if (rarity === "rare") pool = rares;
            else pool = legendaires;

            // Si aucune dans cette rareté → fallback sur tout ce qui reste
            if (!pool || pool.length === 0) pool = available;

            const chosen = pool[Math.floor(Math.random() * pool.length)];

            // 🟣 Décrémenter le stock
            stockCopy[chosen.id]--;
            if (stockCopy[chosen.id] <= 0) delete stockCopy[chosen.id];

            // 🟣 Ajouter à la liste des surprises
            surprises.push({
              ...chosen,
              rarity
            });
          }
        }
      });

      if (surprises.length === 0) {
        alert("Tous les produits éligibles sont en rupture de stock !");
        return;
      }

      // 🎰 Préparer et afficher la "roulette"
      setRouletteOptions(eligible);    // nécessaire pour afficher les noms
      setRouletteSurprises(surprises); // données envoyées au TonneauSurprise
      setShowRoulette(true);           // affiche la fenêtre
      setRouletteResult(null);         // reset
      return; // ne continue pas validateOrder()
    }


    // 🟢 Cas normal : commande sans verre surprise
    const orderItems = Object.values(cart).map(cartItem => {
      const product = products.find(p => p.id === cartItem.productId);
      if (!product) return null;

      let price = 0;
      let displayQuantity = 0;
      let displayName = product.name;

      if (cartItem.saleType === 'pack') {
        // Prix d’UN bac
        price = product.pricePerPack;

        // Nombre de bacs achetés
        displayQuantity = cartItem.quantity / product.packSize;

        displayName += ` (Bac de ${product.packSize})`;
      }
      else if (cartItem.saleType === 'eleven') {
        // Prix d’UN mètre (lot de 11)
        price = product.pricePer11;

        // Nombre de mètres
        displayQuantity = cartItem.quantity / 11;

        displayName += ` (Lot de 11)`;
      }
      else {
        // Vente à l’unité
        price = product.price;
        displayQuantity = cartItem.quantity;
      }

      return {
        productId: cartItem.productId,
        productName: displayName,
        quantity: displayQuantity,  // ✔ correct affiché
        pricePerUnit: price,        // ✔ prix réel par bac/mètre/unité
        saleType: cartItem.saleType,
        total: price * displayQuantity  // ✔ NE MULTIPLIE PLUS PAR 11 OU 24
      };

    }).filter(Boolean);

    const total = orderItems.reduce((sum, i) => sum + i.total, 0);

    setOrderConfirmation({
      show: true,
      member: selectedMember,
      items: orderItems,
      total,
      isSurprise: false
    });



    // Afficher le modal de confirmation standard
    setOrderConfirmation({
      show: true,
      member: selectedMember,
      items: orderItems,
      total,
      isSurprise: false
    });
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


  const categories = ['Alcool', 'Bière', 'Boissons', 'Snacks', 'Nourriture', 'Autre'].filter(cat =>
    products.some(p => p.category === cat)
  );



  const SETTINGS_SCREENS = ['settings-password', 'settings', 'settings-surprise', 'settings-bar-threshold', 'settings-products', 'settings-stock', 'settings-rate', 'settings-history', 'settings-goal', 'settings-popular', 'settings-report', 'settings-close-season'];

  if (currentScreen === 'home') {
    return (
      <HomeScreen
        navigateTo={navigateTo}
        tripPasswordProtected={tripPasswordProtected}
        settingsAuthenticated={settingsAuthenticated}
        showModal={showModal}
        modalType={modalType}
        setShowModal={setShowModal}
        setModalType={setModalType}
        randomTripMessage={randomTripMessage}
        loading={loading}
        isOnline={isOnline}
      />
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
                    <h3 className="font-medium">
                      {member.name}
                      {member.isExternal && (
                        <span className="ml-2 text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                          👤 Externe
                        </span>
                      )}
                    </h3>
                    {(() => {
                      // Calculer le solde réel à partir des transactions
                      const memberOrders = orders.filter(order => order.memberId === member.id);

                      const totalSpent = memberOrders
                        .filter(order => order.type === 'order')
                        .reduce((sum, order) => sum + (order.amount || 0), 0);

                      const totalRecharged = memberOrders
                        .filter(order => order.type === 'repayment' || order.type === 'recharge')
                        .reduce((sum, order) => sum + (order.amount || 0), 0);

                      const realBalance = totalRecharged - totalSpent;

                      return (
                        <p className={`text-sm font-semibold ${realBalance < 0 ? 'text-red-500' : 'text-green-500'}`}>
                          Solde: {formatCurrency(realBalance)}
                        </p>
                      );
                    })()}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => { setSelectedMember(member); setModalType('repay'); setShowModal(true); }}
                      className={`px-3 py-1 text-white rounded text-sm active:scale-95 transition-transform ${member.balance < 0 ? 'bg-green-500' : 'bg-blue-500'}`}
                    >
                      {member.balance < 0 ? 'Rembourser' : 'Recharger'}
                    </button>
                    <button
                      onClick={() => navigateTo('member-history', member)}
                      className="px-3 py-1 bg-purple-500 text-white rounded text-sm active:scale-95 transition-transform"
                      title="Voir l'historique"
                    >
                      📊
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
              <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  id="isExternal"
                  checked={newMemberIsExternal}
                  onChange={(e) => setNewMemberIsExternal(e.target.checked)}
                  className="w-5 h-5"
                />
                <label htmlFor="isExternal" className="text-sm font-medium">
                  👤 Membre externe (prix différents)
                </label>
              </div>
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
              {(() => {
                // Calculer le solde réel
                const memberOrders = orders.filter(order => order.memberId === selectedMember?.id);
                const totalSpent = memberOrders
                  .filter(order => order.type === 'order')
                  .reduce((sum, order) => sum + (order.amount || 0), 0);
                const totalRecharged = memberOrders
                  .filter(order => order.type === 'repayment' || order.type === 'recharge')
                  .reduce((sum, order) => sum + (order.amount || 0), 0);
                const realBalance = totalRecharged - totalSpent;

                return (
                  <p>Solde actuel: <strong className={realBalance < 0 ? 'text-red-500' : 'text-green-500'}>
                    {formatCurrency(realBalance)}
                  </strong></p>
                );
              })()}

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

  if (SETTINGS_SCREENS.includes(currentScreen)) {
    return (
      <SettingsScreen
        screen={currentScreen}
        navigateTo={navigateTo}
        loading={loading}
        isOnline={isOnline}
        showModal={showModal}
        modalType={modalType}
        setShowModal={setShowModal}
        setModalType={setModalType}
        settingsAuthenticated={settingsAuthenticated}
        setSettingsAuthenticated={setSettingsAuthenticated}
        hourlyRate={hourlyRate}
        setHourlyRate={setHourlyRate}
        surpriseSettings={surpriseSettings}
        setSurpriseSettings={setSurpriseSettings}
        rarityWeights={rarityWeights}
        updateProductWeight={updateProductWeight}
        saveSurpriseSettings={saveSurpriseSettings}
        barOpenThreshold={barOpenThreshold}
        setBarOpenThreshold={setBarOpenThreshold}
        popularProducts={popularProducts}
        setPopularProducts={setPopularProducts}
        financialGoal={financialGoal}
        setFinancialGoal={setFinancialGoal}
        products={products}
        setProducts={setProducts}
        categories={categories}
        orders={orders}
        setOrders={setOrders}
        jobs={jobs}
        setJobs={setJobs}
        financialTransactions={financialTransactions}
        setFinancialTransactions={setFinancialTransactions}
        members={members}
        setMembers={setMembers}
        bros={bros}
        setBros={setBros}
        stockMovements={stockMovements}
        updateStock={updateStock}
        getStockStatus={getStockStatus}
        updateInFirebase={updateInFirebase}
        deleteFromFirebase={deleteFromFirebase}
        saveToFirebase={saveToFirebase}
        isSupported={isSupported}
        permission={permission}
        requestPermission={requestPermission}
        tripPasswordProtected={tripPasswordProtected}
        setTripPasswordProtected={setTripPasswordProtected}
        activeSeasonId={activeSeasonId}
        viewedSeasonId={viewedSeasonId}
        seasons={seasons}
        isViewingArchive={isViewingArchive}
        selectSeason={selectSeason}
        backToActiveSeason={backToActiveSeason}
      />
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
            setMemberSearch('');
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
                filteredMembers.map(member => {
                  // Calculer le solde réel
                  const memberOrders = orders.filter(order => order.memberId === member.id);
                  const totalSpent = memberOrders
                    .filter(order => order.type === 'order')
                    .reduce((sum, order) => sum + (order.amount || 0), 0);
                  const totalRecharged = memberOrders
                    .filter(order => order.type === 'repayment' || order.type === 'recharge')
                    .reduce((sum, order) => sum + (order.amount || 0), 0);
                  const realBalance = totalRecharged - totalSpent;

                  return (
                    <div key={member.id} className="bg-white rounded-lg shadow-sm">
                      <button
                        onClick={() => {
                          setSelectedMember(member);
                          navigateTo('bar-products', member);
                          setMemberSearch('');
                        }}
                        className="w-full p-4 text-left active:scale-95 transition-transform"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h3 className="font-medium">{member.name}</h3>
                            <p className={`text-sm ${realBalance < 0 ? 'text-red-500' : 'text-green-500'}`}>
                              Solde: {formatCurrency(realBalance)}
                            </p>
                          </div>
                          <div className="text-gray-400">→</div>
                        </div>
                      </button>

                      {/* Bouton de rechargement rapide */}
                      <div className="px-4 pb-3 flex justify-end border-t pt-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedMember(member);
                            setModalType('repay');
                            setShowModal(true);
                          }}
                          className={`px-3 py-1 text-white rounded text-sm active:scale-95 transition-transform ${realBalance < 0 ? 'bg-green-500' : 'bg-blue-500'
                            }`}
                        >
                          💰 {realBalance < 0 ? 'Rembourser' : 'Recharger'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Modal de rechargement (réutilisé depuis bar-members) */}
          <Modal
            isOpen={showModal && modalType === 'repay'}
            onClose={() => { setShowModal(false); setRepaymentAmount(''); setPaymentMethod(''); setSelectedMember(null); }}
            title={selectedMember?.balance < 0 ? 'Remboursement' : 'Recharger le compte'}
          >
            {selectedMember && (
              <div className="space-y-4">
                <p>Membre: <strong>{selectedMember.name}</strong></p>
                {(() => {
                  const memberOrders = orders.filter(order => order.memberId === selectedMember?.id);
                  const totalSpent = memberOrders
                    .filter(order => order.type === 'order')
                    .reduce((sum, order) => sum + (order.amount || 0), 0);
                  const totalRecharged = memberOrders
                    .filter(order => order.type === 'repayment' || order.type === 'recharge')
                    .reduce((sum, order) => sum + (order.amount || 0), 0);
                  const realBalance = totalRecharged - totalSpent;

                  return (
                    <p>Solde actuel: <strong className={realBalance < 0 ? 'text-red-500' : 'text-green-500'}>
                      {formatCurrency(realBalance)}
                    </strong></p>
                  );
                })()}

                <div>
                  <label className="block text-sm font-medium mb-1">Montant</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={repaymentAmount}
                    onChange={(e) => setRepaymentAmount(e.target.value)}
                    className="w-full p-3 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Mode de paiement</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setPaymentMethod('cash')}
                      className={`p-3 rounded-lg border-2 transition-all ${paymentMethod === 'cash'
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 bg-white'
                        }`}
                    >
                      💵 Cash
                    </button>
                    <button
                      onClick={() => setPaymentMethod('account')}
                      className={`p-3 rounded-lg border-2 transition-all ${paymentMethod === 'account'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white'
                        }`}
                    >
                      🏦 Compte
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => {
                    repayMember();
                    setShowModal(false);
                  }}
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
  }

  if (currentScreen === 'member-history') {
    // Filtrer les commandes de ce membre
    const memberOrders = orders
      .filter(order => order.memberId === selectedMember?.id)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Calculer les statistiques
    const totalSpent = memberOrders
      .filter(order => order.type === 'order')
      .reduce((sum, order) => sum + (order.amount || 0), 0);

    const totalRecharged = memberOrders
      .filter(order => order.type === 'repayment' || order.type === 'recharge')
      .reduce((sum, order) => sum + (order.amount || 0), 0);

    const totalOrders = memberOrders.filter(order => order.type === 'order').length;

    return (
      <div className="min-h-screen bg-gray-50">
        <Header

          title={`Historique - ${selectedMember?.name}`}
          onBack={() => navigateTo('bar-members')}
        />
        {/* Bouton pour basculer externe/normal */}
        <div className="p-4">
          <button
            onClick={async () => {
              const newStatus = !selectedMember.isExternal;
              if (confirm(`${selectedMember.name} sera marqué comme ${newStatus ? 'EXTERNE' : 'MEMBRE NORMAL'}. Confirmer ?`)) {
                await updateInFirebase('members', selectedMember.id, { isExternal: newStatus });
                setSelectedMember({ ...selectedMember, isExternal: newStatus });
              }
            }}
            className={`w-full p-3 rounded-lg active:scale-95 transition-transform ${selectedMember?.isExternal
              ? 'bg-orange-500 text-white'
              : 'bg-blue-500 text-white'
              }`}
          >
            {selectedMember?.isExternal ? '👤 Membre Externe' : '👥 Membre Normal'}
            <span className="block text-xs mt-1">
              Appuyer pour changer
            </span>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Statistiques du membre */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h3 className="font-semibold text-lg mb-3">📊 Statistiques</h3>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center">
                <div className="bg-blue-100 p-3 rounded-lg">
                  <p className="text-xl font-bold text-blue-600">{totalOrders}</p>
                  <p className="text-sm text-blue-700">Commandes</p>
                </div>
              </div>
              <div className="text-center">
                <div className="bg-red-100 p-3 rounded-lg">
                  <p className="text-xl font-bold text-red-600">{formatCurrency(totalSpent)}</p>
                  <p className="text-sm text-red-700">Total dépensé</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="bg-green-100 p-3 rounded-lg">
                  <p className="text-xl font-bold text-green-600">{formatCurrency(totalRecharged)}</p>
                  <p className="text-sm text-green-700">Total rechargé</p>
                </div>
              </div>
              <div className="text-center">
                {(() => {
                  // Calculer le solde réel à partir des transactions
                  const realBalance = totalRecharged - totalSpent;

                  return (
                    <div className={`p-3 rounded-lg ${realBalance >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                      <p className={`text-xl font-bold ${realBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(realBalance)}
                      </p>
                      <p className={`text-sm ${realBalance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        Solde calculé
                      </p>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Historique des transactions */}
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-4 border-b">
              <h3 className="font-semibold">🕒 Historique des Transactions</h3>
            </div>

            {memberOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">📝</div>
                <p>Aucune transaction pour ce membre</p>
              </div>
            ) : (
              <div className="divide-y max-h-96 overflow-y-auto">
                {memberOrders.map(order => (
                  <div key={order.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          {/* Badge type de transaction */}
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${order.type === 'order'
                            ? 'bg-red-100 text-red-800'
                            : order.type === 'repayment'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-blue-100 text-blue-800'
                            }`}>
                            {order.type === 'order' ? '🛒 Commande' :
                              order.type === 'repayment' ? '💰 Remboursement' :
                                '🔄 Rechargement'}
                          </span>

                          {/* Badge mode de paiement pour remboursements/rechargements */}
                          {(order.type === 'repayment' || order.type === 'recharge') && order.paymentMethod && (
                            <span className={`text-xs px-2 py-1 rounded-full ${order.paymentMethod === 'cash'
                              ? 'bg-green-50 text-green-700'
                              : 'bg-blue-50 text-blue-700'
                              }`}>
                              {order.paymentMethod === 'cash' ? '💵 Cash' : '🏦 Compte'}
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-gray-600 mb-1">
                          {formatDateTime(order.timestamp)}
                        </p>

                        {/* Détail des articles pour les commandes */}
                        {order.type === 'order' && order.items && order.items.length > 0 && (
                          <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                            <p className="font-medium text-gray-700 mb-1">Articles commandés :</p>
                            {order.items.map((item, index) => (
                              <div key={index} className="flex justify-between text-gray-600">
                                <span>{item.quantity}x {item.productName}</span>
                                <span>{formatCurrency(item.total)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="text-right ml-4">
                        <p className={`text-lg font-bold ${order.type === 'order' ? 'text-red-600' : 'text-green-600'
                          }`}>
                          {order.type === 'order' ? '-' : '+'}{formatCurrency(order.amount)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Produits les plus achetés */}
          {(() => {
            const productStats = {};
            memberOrders
              .filter(order => order.type === 'order' && order.items)
              .forEach(order => {
                order.items.forEach(item => {
                  if (!productStats[item.productName]) {
                    productStats[item.productName] = {
                      name: item.productName,
                      quantity: 0,
                      total: 0
                    };
                  }
                  productStats[item.productName].quantity += item.quantity;
                  productStats[item.productName].total += item.total;
                });
              });

            const topProducts = Object.values(productStats)
              .sort((a, b) => b.quantity - a.quantity)
              .slice(0, 5);

            return topProducts.length > 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-4">
                <h3 className="font-semibold mb-3">🏆 Produits Préférés</h3>
                <div className="space-y-2">
                  {topProducts.map((product, index) => (
                    <div key={product.name} className="flex items-center justify-between p-2 bg-yellow-50 rounded">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-bold text-yellow-600">#{index + 1}</span>
                        <span className="font-medium">{product.name}</span>
                      </div>
                      <div className="text-right text-sm">
                        <p className="font-semibold">{product.quantity} achetés</p>
                        <p className="text-gray-600">{formatCurrency(product.total)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null;
          })()}
        </div>
      </div>
    );
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

              <div className="grid grid-cols-2 gap-3">
                {(() => {
                  const filteredProducts = products
                    .filter(p => popularProducts.includes(p.name) && p.stock > 0)
                    .slice(0, 4);

                  return filteredProducts.map(product => {
                    const stockStatus = getStockStatus(product);
                    const isOutOfStock = product.stock <= 0;
                    const unitQuantity = cart[`${product.id}-unit`]?.quantity || 0;

                    return (
                      <div key={product.id} className={`bg-white p-3 rounded-lg shadow-sm border-2 border-yellow-200 ${isOutOfStock ? 'opacity-50' : ''}`}>
                        <div className="text-center">
                          <h4 className="font-medium text-sm mb-1">{product.name}</h4>
                          <p className="text-blue-600 font-semibold text-sm">
                            {formatCurrency(selectedMember?.isExternal ? (product.externalPrice || product.price) : product.price)}
                            {selectedMember?.isExternal && product.externalPrice && product.externalPrice !== product.price && (
                              <span className="ml-1 text-xs text-orange-600">(externe)</span>
                            )}
                          </p>
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
                          <p className="text-blue-600 font-semibold text-sm">
                            {formatCurrency(selectedMember?.isExternal ? (product.externalPrice || product.price) : product.price)}
                            {selectedMember?.isExternal && product.externalPrice && product.externalPrice !== product.price && (
                              <span className="ml-1 text-xs text-orange-600">(ext)</span>
                            )}
                          </p>
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
                          {(product.stock >= 11 || product.isSurprise) && product.pricePer11 && (
                            <div className="bg-green-50 p-2 rounded">
                              <div className="flex items-center justify-between">
                                <div className="text-xs">
                                  <div className="font-medium">Mètre (11)</div>
                                  <div className="text-green-600 font-semibold">
                                    {formatCurrency(product.pricePer11)}
                                  </div>
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

        <TonneauSurprise
          open={showRoulette}
          surprises={rouletteSurprises.map(p => ({
            id: p.id,
            name: p.name,
            rarity: p.rarity || 'normal',
            price: surpriseSettings.price
          }))}
          onComplete={(revealed) => {
            console.log("=== 🎲 onComplete déclenché ===");
            console.log("revealed =", revealed);

            if (!revealed || revealed.length === 0) {
              console.log("❌ revealed vide, on ne fait rien");
              return;
            }

            setShowRoulette(false);

            // Vérif normalItems (produits hors verre surprise)
            const normalItems = [];
            Object.values(cart).forEach(cartItem => {
              if (cartItem.productId !== 'verre_surprise') {
                const product = products.find(p => p.id === cartItem.productId);

                if (!product) {
                  console.log("PRODUIT NON TROUVÉ pour ", cartItem.productId);
                  return;
                }

                let price = 0;
                let displayQuantity = 0;
                let displayName = product.name;

                if (cartItem.saleType === 'pack') {
                  // ✅ Pour un bac : prix = prix du bac complet, quantité affichée = nombre de bacs
                  price = product.pricePerPack;
                  displayQuantity = cartItem.quantity / product.packSize;
                  displayName += ` (Bac de ${product.packSize})`;
                } else if (cartItem.saleType === 'eleven') {
                  // ✅ Pour un mètre : prix = prix du mètre complet, quantité affichée = nombre de mètres
                  price = product.pricePer11;
                  displayQuantity = cartItem.quantity / 11;
                  displayName += ` (Lot de 11)`;
                } else {
                  // Vente à l'unité normale
                  price = product.price;
                  displayQuantity = cartItem.quantity;
                }

                normalItems.push({
                  productId: cartItem.productId,
                  productName: displayName,
                  quantity: displayQuantity,
                  pricePerUnit: price,
                  saleType: cartItem.saleType,
                  total: price * displayQuantity
                });
              }
            });

            console.log("normalItems =", normalItems);

            // 🎲 Construire les items surprise
            const surpriseCartItem = Object.values(cart).find(item => item.productId === 'verre_surprise');
            const isMeterSale = surpriseCartItem?.saleType === 'eleven';

            const surpriseItems = revealed.map(p => {
              const pricePerUnit = isMeterSale ? surpriseSettings.pricePer11 / 11 : surpriseSettings.price;

              return {
                productId: p.id,
                productName: `🎲 Verre Surprise : ${p.name}`,
                quantity: 1,
                pricePerUnit: pricePerUnit,
                saleType: "unit",
                total: pricePerUnit
              };
            });

            console.log("surpriseItems =", surpriseItems);

            const finalItems = [...normalItems, ...surpriseItems];
            const finalTotal = finalItems.reduce((sum, i) => sum + i.total, 0);

            console.log("finalItems =", finalItems);
            console.log("finalTotal =", finalTotal);

            // ✅ Afficher la confirmation de commande avec les vrais produits
            setOrderConfirmation({
              show: true,
              member: selectedMember,
              items: finalItems,
              total: finalTotal,
              isSurprise: true,
              surprises: revealed
            });

            setCart({});
          }}
        />

        {/* Modal de confirmation */}
        <Modal
          isOpen={orderConfirmation.show}
          onClose={() => {
            setOrderConfirmation({ show: false, member: null, items: [], total: 0 });
            setDirectPayment(false);
            setDirectPaymentMethod('');
            setSharedItems({});
          }}
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
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium text-gray-700">Articles commandés :</h4>
                  {orderConfirmation.items.map((item, index) => {
                    const shared = sharedItems[index];
                    const isSharable = isItemSharable(item);

                    return (
                      <div key={index} className="border rounded-lg p-3 bg-gray-50">
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="font-medium">{item.quantity}x {item.productName}</span>
                            {shared && (
                              <div className="text-xs text-blue-600 mt-1">
                                Partagé entre {shared.totalShares} personne{shared.totalShares > 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                          <span className="font-semibold text-green-600">
                            {formatCurrency(item.total)}
                          </span>
                        </div>

                        {isSharable && (
                          <div className="mt-3 border-t pt-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-700">
                                👥 Partager avec d'autres
                              </span>
                              {!shared && (
                                <button
                                  onClick={() => {
                                    setSharedItems(prev => ({
                                      ...prev,
                                      [index]: {
                                        members: [orderConfirmation.member],
                                        totalShares: 1
                                      }
                                    }));
                                    setShowModal(true);
                                    setModalType('add-person-to-share');
                                    setSelectedMember({ itemIndex: index });
                                  }}
                                  className="px-3 py-1 bg-blue-500 text-white rounded text-sm active:scale-95 transition-transform"
                                >
                                  + Ajouter
                                </button>
                              )}
                            </div>

                            {shared && (
                              <div className="space-y-2">
                                {shared.members.map((member, mIndex) => {
                                  const splitPrice = calculateSplitPrice(item.total, shared.totalShares);
                                  return (
                                    <div key={member.id} className="flex items-center justify-between bg-white p-2 rounded">
                                      <div className="flex items-center space-x-2">
                                        <User size={16} className="text-blue-500" />
                                        <span className="text-sm font-medium">{member.name}</span>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <span className="text-sm font-semibold text-blue-600">
                                          {formatCurrency(splitPrice)}
                                        </span>
                                        {mIndex > 0 && (
                                          <button
                                            onClick={() => removePersonFromSharedItem(index, member.id)}
                                            className="p-1 text-red-500 hover:bg-red-50 rounded active:scale-95 transition-transform"
                                          >
                                            <X size={14} />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}

                                <button
                                  onClick={() => {
                                    setShowModal(true);
                                    setModalType('add-person-to-share');
                                    setSelectedMember({ itemIndex: index });
                                  }}
                                  className="w-full py-2 border-2 border-dashed border-blue-300 text-blue-600 rounded text-sm font-medium hover:bg-blue-50 active:scale-95 transition-transform"
                                >
                                  + Ajouter une autre personne
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-green-800">Total à payer :</span>
                    <span className="text-xl font-bold text-green-600">
                      {formatCurrency(orderConfirmation.total)}
                    </span>
                  </div>
                </div>

                {/* Option de paiement direct */}
                <div className="border-t pt-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <input
                      type="checkbox"
                      id="directPayment"
                      checked={directPayment}
                      onChange={(e) => {
                        setDirectPayment(e.target.checked);
                        if (!e.target.checked) setDirectPaymentMethod('');
                      }}
                      className="w-5 h-5"
                    />
                    <label htmlFor="directPayment" className="font-medium text-gray-700">
                      💳 Le membre paie maintenant
                    </label>
                  </div>

                  {directPayment && (
                    <div className="space-y-3 ml-7">
                      <p className="text-sm text-gray-600">
                        Choisissez le mode de paiement :
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setDirectPaymentMethod('cash')}
                          className={`p-3 border rounded-lg text-sm font-medium active:scale-95 transition-transform ${directPaymentMethod === 'cash'
                            ? 'bg-green-100 border-green-500 text-green-700'
                            : 'bg-gray-50 border-gray-300 text-gray-600'
                            }`}
                        >
                          💵 Cash
                        </button>
                        <button
                          type="button"
                          onClick={() => setDirectPaymentMethod('account')}
                          className={`p-3 border rounded-lg text-sm font-medium active:scale-95 transition-transform ${directPaymentMethod === 'account'
                            ? 'bg-blue-100 border-blue-500 text-blue-700'
                            : 'bg-gray-50 border-gray-300 text-gray-600'
                            }`}
                        >
                          🏦 Compte
                        </button>
                      </div>

                      <div className="bg-blue-50 p-3 rounded-lg">
                        <p className="text-sm text-blue-700">
                          ✅ Le compte sera rechargé de <strong>{formatCurrency(orderConfirmation.total)}</strong> puis débité du même montant
                        </p>
                        <p className="text-xs text-blue-600 mt-1">
                          Solde final: {formatCurrency(orderConfirmation.member.balance)}
                        </p>
                      </div>
                    </div>
                  )}

                  {!directPayment && (
                    <div className="bg-orange-50 p-3 rounded-lg ml-7">
                      <p className="text-sm text-orange-700">
                        Le montant sera débité du solde
                      </p>
                      <p className="text-sm font-semibold text-orange-800 mt-1">
                        Nouveau solde: {formatCurrency(orderConfirmation.member.balance - orderConfirmation.total)}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => {
                      setOrderConfirmation({ show: false, member: null, items: [], total: 0 });
                      setDirectPayment(false);
                      setDirectPaymentMethod('');
                    }}
                    className="flex-1 p-3 bg-gray-500 text-white rounded-lg active:scale-95 transition-transform"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={confirmOrder}
                    disabled={directPayment && !directPaymentMethod}
                    className="flex-1 p-3 bg-green-500 text-white rounded-lg active:scale-95 transition-transform disabled:bg-gray-300"
                  >
                    {directPayment ? '💳 Payer et Valider' : '✅ Valider'}
                  </button>
                </div>
              </>
            )}
          </div>
        </Modal>
        {/* Modal pour ajouter une personne au partage */}
        <Modal
          isOpen={showModal && modalType === 'add-person-to-share'}
          onClose={() => {
            setShowModal(false);
            setSelectedMember(null);
          }}
          title="Ajouter au partage"
        >
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Sélectionnez la personne avec qui partager
            </p>

            <input
              type="text"
              placeholder="Rechercher un membre..."
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              className="w-full p-3 border rounded-lg"
            />

            <div className="max-h-96 overflow-y-auto space-y-2">
              {members
                .filter(member =>
                  member.name.toLowerCase().includes(memberSearch.toLowerCase()) &&
                  member.id !== orderConfirmation.member?.id &&
                  !sharedItems[selectedMember?.itemIndex]?.members.find(m => m.id === member.id)
                )
                .map(member => (
                  <button
                    key={member.id}
                    onClick={() => {
                      addPersonToSharedItem(selectedMember.itemIndex, member);
                      setShowModal(false);
                      setMemberSearch('');
                    }}
                    className="w-full p-3 bg-gray-50 hover:bg-blue-50 rounded-lg text-left active:scale-95 transition-transform"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{member.name}</h4>
                        <p className="text-sm text-gray-600">
                          Solde: {formatCurrency(member.balance)}
                        </p>
                      </div>
                      <Plus className="text-blue-500" size={20} />
                    </div>
                  </button>
                ))}
            </div>
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

  const BOULOTS_SCREENS = ['boulots', 'boulots-scheduled', 'boulots-validate', 'boulots-bros', 'boulots-new', 'boulots-history', 'boulots-stats'];

  if (BOULOTS_SCREENS.includes(currentScreen)) {
    return (
      <BoulotsScreen
        screen={currentScreen}
        navigateTo={navigateTo}
        loading={loading}
        isOnline={isOnline}
        showModal={showModal}
        modalType={modalType}
        setShowModal={setShowModal}
        setModalType={setModalType}
        bros={bros}
        setBros={setBros}
        jobs={jobs}
        setJobs={setJobs}
        scheduledJobs={scheduledJobs}
        setScheduledJobs={setScheduledJobs}
        hourlyRate={hourlyRate}
        newJob={newJob}
        setNewJob={setNewJob}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        saveToFirebase={saveToFirebase}
        updateInFirebase={updateInFirebase}
        deleteFromFirebase={deleteFromFirebase}
      />
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


      // NOUVEAU : Calculer les soldes des membres
      let totalMemberBalances = 0;
      let positiveBalances = 0; // Argent qu'on doit aux membres (crédits)
      let negativeBalances = 0; // Argent que les membres nous doivent (dettes)

      members.forEach(member => {
        const balance = member.balance || 0;
        totalMemberBalances += balance;

        if (balance > 0) {
          positiveBalances += balance;
        } else {
          negativeBalances += Math.abs(balance);
        }
      });


      return {
        cashTotal,
        accountTotal,
        stockValue,
        totalMemberBalances,
        positiveBalances,
        negativeBalances,
        grandTotal: cashTotal + accountTotal
      };
    };

    const { cashTotal, accountTotal, stockValue, totalMemberBalances, positiveBalances, negativeBalances, grandTotal } = calculateTotals();

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
              {/* NOUVEAU : Soldes des Membres */}
              <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="bg-orange-500 p-2 rounded-full">
                      <span className="text-white text-lg">👥</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-orange-800">Soldes Membres</h3>
                      <p className="text-sm text-orange-600">Argent virtuel en circulation</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${totalMemberBalances >= 0 ? 'text-orange-600' : 'text-green-600'}`}>
                      {formatCurrency(-totalMemberBalances)}
                    </p>
                    <div className="text-xs text-orange-500 space-y-1">
                      {positiveBalances > 0 && (
                        <p>💰 creance : {formatCurrency(positiveBalances)}</p>
                      )}
                      {negativeBalances > 0 && (
                        <p>💸 credit: {formatCurrency(negativeBalances)}</p>
                      )}
                      <p>👤 {members.length} membre(s)</p>
                    </div>
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
              onClick={() => navigateTo('finance-bar-report')}
              className="w-full p-4 bg-white rounded-lg shadow-md active:scale-95 transition-transform"
            >
              <div className="flex items-center space-x-3">
                <Beer className="text-yellow-500" size={24} />
                <div className="text-left">
                  <h3 className="font-semibold">Rapport Bar</h3>
                  <p className="text-gray-600 text-sm">Chiffre d'affaires par jour d'ouverture</p>
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
            <button
              onClick={() => navigateTo('finance-scheduled-income')}
              className="w-full p-4 bg-white rounded-lg shadow-md active:scale-95 transition-transform"
            >
              <div className="flex items-center space-x-3">
                <Wrench className="text-yellow-500" size={24} />
                <div className="text-left">
                  <h3 className="font-semibold">Revenus Futurs Boulots</h3>
                  <p className="text-gray-600 text-sm">Argent des boulots programmés</p>
                </div>
              </div>
            </button>
            <button
              onClick={() => navigateTo('finance-sales-stats')}
              className="w-full p-4 bg-white rounded-lg shadow-md active:scale-95 transition-transform"
            >
              <div className="flex items-center space-x-3">
                <ShoppingCart className="text-yellow-500" size={24} />
                <div className="text-left">
                  <h3 className="font-semibold">Statistiques de Vente</h3>
                  <p className="text-gray-600 text-sm">Total vendu par produit</p>
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
  if (currentScreen === 'finance-sales-stats') {
    // Calculer les statistiques de vente par produit (regroupées)
    const calculateSalesStats = () => {
      const productStats = {};

      // Parcourir toutes les commandes
      orders
        .filter(order => order.type === 'order' && order.items)
        .forEach(order => {
          order.items.forEach(item => {
            // Nettoyer le nom du produit pour regrouper les conditionnements
            let cleanProductName = item.productName;

            // Enlever les suffixes comme "(Bac de 24)", "(Lot de 11)", etc.
            cleanProductName = cleanProductName
              .replace(/\s*\(Bac de \d+\)$/i, '')
              .replace(/\s*\(Lot de \d+\)$/i, '')
              .replace(/\s*\(Mètre\)$/i, '')
              .trim();

            if (!productStats[cleanProductName]) {
              productStats[cleanProductName] = {
                name: cleanProductName,
                totalQuantity: 0,
                orderCount: 0
              };
            }

            productStats[cleanProductName].totalQuantity += item.quantity || 0;
            productStats[cleanProductName].orderCount += 1;
          });
        });

      // Convertir en array et trier par quantité
      const statsArray = Object.values(productStats)
        .sort((a, b) => b.totalQuantity - a.totalQuantity);

      return {
        productStats: statsArray,
        totalProducts: statsArray.length,
        totalQuantitySold: statsArray.reduce((sum, stat) => sum + stat.totalQuantity, 0)
      };
    };

    const { productStats, totalProducts, totalQuantitySold } = calculateSalesStats();

    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Quantités Vendues" onBack={() => navigateTo('finance')} />

        <div className="p-4 space-y-6">
          {/* Résumé global */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 text-center">📦 Résumé des Quantités</h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="bg-blue-100 p-4 rounded-lg">
                  <p className="text-3xl font-bold text-blue-600">{totalProducts}</p>
                  <p className="text-sm text-blue-700">Produits différents vendus</p>
                </div>
              </div>
              <div className="text-center">
                <div className="bg-green-100 p-4 rounded-lg">
                  <p className="text-3xl font-bold text-green-600">{totalQuantitySold}</p>
                  <p className="text-sm text-green-700">Articles vendus au total</p>
                </div>
              </div>
            </div>
          </div>

          {/* Liste des produits */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              🏆 Classement par Quantité Vendue
            </h2>

            {productStats.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <ShoppingCart size={48} className="mx-auto mb-2 opacity-50" />
                <p>Aucune vente enregistrée</p>
                <p className="text-sm mt-1">Commencez à vendre pour voir les statistiques</p>
              </div>
            ) : (
              <div className="space-y-3">
                {productStats.map((stat, index) => {
                  const currentProduct = products.find(p => p.name === stat.name);
                  const stockStatus = currentProduct ? getStockStatus(currentProduct) : null;
                  const maxQuantity = productStats[0].totalQuantity;

                  return (
                    <div key={stat.name} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-4 flex-1">
                        {/* Position avec médailles */}
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${index === 0 ? 'bg-yellow-500' :
                          index === 1 ? 'bg-gray-400' :
                            index === 2 ? 'bg-orange-600' : 'bg-gray-300'
                          }`}>
                          {index < 3 ? (
                            <span className="text-lg">
                              {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                            </span>
                          ) : (
                            index + 1
                          )}
                        </div>

                        {/* Info produit */}
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-800 text-lg">{stat.name}</h4>
                          <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                            <span className="font-medium text-blue-600">
                              📦 {stat.totalQuantity} unités vendues
                            </span>
                            <span className="text-purple-600">
                              📊 {stat.orderCount} fois commandé
                            </span>
                          </div>

                          {/* Barre de progression */}
                          <div className="mt-2 w-full max-w-xs">
                            <div className="bg-gray-200 rounded-full h-3">
                              <div
                                className="bg-gradient-to-r from-blue-400 to-blue-600 h-3 rounded-full transition-all duration-1000 ease-out"
                                style={{
                                  width: `${(stat.totalQuantity / maxQuantity) * 100}%`
                                }}
                              ></div>
                            </div>
                          </div>
                        </div>

                        {/* Stock actuel */}
                        <div className="text-right">
                          {currentProduct ? (
                            <div>
                              <div className={`px-3 py-1 rounded-full text-sm font-medium ${stockStatus.bg} ${stockStatus.color} mb-1`}>
                                Stock: {currentProduct.stock}
                              </div>
                              <div className="text-xs text-gray-500">
                                {currentProduct.category}
                              </div>
                            </div>
                          ) : (
                            <div className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
                              Produit supprimé
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top 3 podium */}
          {productStats.length >= 3 && (
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">🏆 Podium des Ventes</h2>

              <div className="flex justify-center items-end space-x-4">
                {/* 2ème place */}
                <div className="text-center">
                  <div className="bg-gray-400 text-white rounded-lg p-4 mb-2 h-20 flex items-center justify-center">
                    <div>
                      <div className="text-2xl">🥈</div>
                    </div>
                  </div>
                  <p className="font-semibold text-gray-800">{productStats[1].name}</p>
                  <p className="text-sm text-gray-600">{productStats[1].totalQuantity} unités</p>
                </div>

                {/* 1ère place */}
                <div className="text-center">
                  <div className="bg-yellow-500 text-white rounded-lg p-4 mb-2 h-24 flex items-center justify-center">
                    <div>
                      <div className="text-3xl">🥇</div>
                    </div>
                  </div>
                  <p className="font-bold text-gray-800 text-lg">{productStats[0].name}</p>
                  <p className="text-sm text-gray-600 font-semibold">{productStats[0].totalQuantity} unités</p>
                </div>

                {/* 3ème place */}
                <div className="text-center">
                  <div className="bg-orange-600 text-white rounded-lg p-4 mb-2 h-16 flex items-center justify-center">
                    <div>
                      <div className="text-xl">🥉</div>
                    </div>
                  </div>
                  <p className="font-semibold text-gray-800">{productStats[2].name}</p>
                  <p className="text-sm text-gray-600">{productStats[2].totalQuantity} unités</p>
                </div>
              </div>
            </div>
          )}

          {/* Conseils pratiques */}
          {productStats.length > 0 && (
            <div className="bg-gradient-to-r from-blue-100 to-indigo-100 rounded-xl p-4">
              <h3 className="font-semibold text-blue-800 mb-2">💡 Conseils Stock</h3>
              <div className="text-sm text-blue-700 space-y-1">
                <p>🏆 Produit star: <strong>{productStats[0]?.name}</strong> ({productStats[0]?.totalQuantity} vendus)</p>
                <p>📊 Moyenne par produit: <strong>{Math.round(totalQuantitySold / totalProducts)}</strong> unités</p>
                {(() => {
                  const lowStock = productStats.filter(stat => {
                    const product = products.find(p => p.name === stat.name);
                    return product && product.stock <= product.alertThreshold;
                  });
                  return lowStock.length > 0 ? (
                    <p>⚠️ Attention stock faible: <strong>{lowStock.map(s => s.name).join(', ')}</strong></p>
                  ) : (
                    <p>✅ Tous les best-sellers ont un stock correct</p>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (currentScreen === 'finance-scheduled-income') {
    // Calculer les revenus futurs des boulots programmés
    const calculateScheduledIncome = () => {
      let totalIncomeComplete = 0;
      let totalIncomePartial = 0;
      const jobAnalysis = [];

      scheduledJobs.forEach(job => {
        const costPerBro = job.customRate * job.estimatedHours;
        const totalCostComplete = costPerBro * job.brosNeeded;
        const totalCostPartial = costPerBro * job.registeredBros.length;

        totalIncomeComplete += totalCostComplete;
        totalIncomePartial += totalCostPartial;

        jobAnalysis.push({
          ...job,
          costPerBro,
          totalCostComplete,
          totalCostPartial,
          isReady: job.registeredBros.length >= job.brosNeeded,
          missingBros: Math.max(0, job.brosNeeded - job.registeredBros.length)
        });
      });

      return {
        totalIncomeComplete,
        totalIncomePartial,
        jobAnalysis,
        totalJobs: scheduledJobs.length
      };
    };

    const { totalIncomeComplete, totalIncomePartial, jobAnalysis, totalJobs } = calculateScheduledIncome();

    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Revenus Futurs Boulots" onBack={() => navigateTo('finance')} />

        <div className="p-4 space-y-6">
          {/* Résumé financier */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 text-center">💰 Revenus Prévisionnels</h2>

            <div className="grid grid-cols-1 gap-4 mb-4">
              {/* Revenus si tous complets */}
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-green-800">Si tous les boulots sont complets</h3>
                    <p className="text-sm text-green-600">{totalJobs} boulots à quota plein</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(totalIncomeComplete)}</p>
                  </div>
                </div>
              </div>

              {/* Revenus actuels */}
              <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-orange-800">Avec inscriptions actuelles</h3>
                    <p className="text-sm text-orange-600">État actuel des inscriptions</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-orange-600">{formatCurrency(totalIncomePartial)}</p>
                  </div>
                </div>
              </div>

              {/* Différence */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-blue-800">Revenus potentiels supplémentaires</h3>
                    <p className="text-sm text-blue-600">Si tous les quotas sont atteints</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-blue-600">
                      +{formatCurrency(totalIncomeComplete - totalIncomePartial)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Liste des boulots */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">📋 Détail par Boulot</h2>

            {totalJobs === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Wrench size={48} className="mx-auto mb-2 opacity-50" />
                <p>Aucun boulot programmé</p>
                <p className="text-sm mt-1">Programmez des boulots pour voir les revenus futurs</p>
              </div>
            ) : (
              <div className="space-y-4">
                {jobAnalysis
                  .sort((a, b) => new Date(a.date) - new Date(b.date))
                  .map(job => (
                    <div key={job.id} className={`p-4 rounded-lg border-2 ${job.isReady ? 'border-green-200 bg-green-50' :
                      job.registeredBros.length > 0 ? 'border-orange-200 bg-orange-50' :
                        'border-red-200 bg-red-50'
                      }`}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-800">{job.description}</h3>
                          <p className="text-sm text-gray-600">{formatDate(job.date)}</p>
                          <p className="text-xs text-gray-500">
                            {job.timeStart || '09:00'} • {job.estimatedHours}h • {formatCurrency(job.customRate)}/h
                          </p>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-medium ${job.isReady ? 'bg-green-100 text-green-800' :
                          job.registeredBros.length > 0 ? 'bg-orange-100 text-orange-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                          {job.registeredBros.length}/{job.brosNeeded} Bro
                        </div>
                      </div>

                      {/* Calculs financiers */}
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="bg-white bg-opacity-70 p-3 rounded">
                          <p className="text-gray-600">Revenus si complet:</p>
                          <p className="font-bold text-green-600">{formatCurrency(job.totalCostComplete)}</p>
                          <p className="text-xs text-gray-500">{job.brosNeeded} × {formatCurrency(job.costPerBro)}</p>
                        </div>
                        <div className="bg-white bg-opacity-70 p-3 rounded">
                          <p className="text-gray-600">Revenus actuels:</p>
                          <p className="font-bold text-orange-600">{formatCurrency(job.totalCostPartial)}</p>
                          <p className="text-xs text-gray-500">{job.registeredBros.length} × {formatCurrency(job.costPerBro)}</p>
                        </div>
                      </div>

                      {/* Bro inscrits */}
                      <div className="mt-3">
                        <p className="text-sm font-medium text-gray-700 mb-2">Bro inscrits:</p>
                        {job.registeredBros.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {job.registeredBros.map((registration, index) => {
                              const bro = bros.find(b => b.id === registration.broId);
                              return (
                                <span key={index} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                  {bro?.name || 'Inconnu'}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">Aucun bro inscrit</p>
                        )}

                        {job.missingBros > 0 && (
                          <p className="text-xs text-red-600 mt-1">
                            ⚠️ Il manque encore {job.missingBros} bro(s)
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Conseils */}
          {totalJobs > 0 && (
            <div className="bg-gradient-to-r from-blue-100 to-indigo-100 rounded-xl p-4">
              <h3 className="font-semibold text-blue-800 mb-2">💡 Analyse</h3>
              <div className="text-sm text-blue-700 space-y-1">
                <p>• Boulots prêts: {jobAnalysis.filter(j => j.isReady).length}/{totalJobs}</p>
                <p>• Boulots partiels: {jobAnalysis.filter(j => j.registeredBros.length > 0 && !j.isReady).length}</p>
                <p>• Boulots sans inscription: {jobAnalysis.filter(j => j.registeredBros.length === 0).length}</p>
                <p>• Revenus garantis: {formatCurrency(totalIncomePartial)} (inscriptions actuelles)</p>
                <p>• Revenus potentiels: +{formatCurrency(totalIncomeComplete - totalIncomePartial)} si quotas complets</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
  if (currentScreen === 'bro-details') {
    if (!selectedBro) {
      navigateTo('boulots-bros');
      return null;
    }

    // Récupérer tous les boulots de ce Bro
    const broJobs = jobs
      .filter(job => job.broId === selectedBro.id)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    // Calculer les statistiques
    const totalHours = broJobs.reduce((sum, job) => sum + (job.hours || 0), 0);
    const totalEarnings = broJobs.reduce((sum, job) => sum + (job.total || 0), 0);

    const stats = {
      totalJobs: broJobs.length,
      totalHours: totalHours,
      totalEarnings: totalEarnings,
      paidJobs: broJobs.filter(job => job.isPaid).length,
      unpaidJobs: broJobs.filter(job => !job.isPaid).length,
      unpaidAmount: broJobs.filter(job => !job.isPaid).reduce((sum, job) => sum + (job.total || 0), 0),
      averageHourlyRate: broJobs.length > 0 ? broJobs.reduce((sum, job) => sum + (job.hourlyRate || 0), 0) / broJobs.length : 0,
      averageHoursPerJob: broJobs.length > 0 ? totalHours / broJobs.length : 0
    };

    // Grouper par mois pour le graphique
    const monthlyStats = {};
    broJobs.forEach(job => {
      const monthKey = new Date(job.date).toISOString().substring(0, 7); // YYYY-MM
      if (!monthlyStats[monthKey]) {
        monthlyStats[monthKey] = { hours: 0, earnings: 0, jobs: 0 };
      }
      monthlyStats[monthKey].hours += job.hours || 0;
      monthlyStats[monthKey].earnings += job.total || 0;
      monthlyStats[monthKey].jobs += 1;
    });

    const monthlyData = Object.entries(monthlyStats)
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return (
      <div className="min-h-screen bg-gray-50">
        <Header
          title={`Profil - ${selectedBro.name}`}
          onBack={() => {
            setSelectedBro(null);
            navigateTo('boulots-bros');
          }}
        />

        <div className="p-4 space-y-6">
          {/* Carte du profil */}
          <div className="bg-gradient-to-r from-green-100 to-blue-100 rounded-xl shadow-lg p-6">
            <div className="flex items-center space-x-4 mb-4">
              <div className="bg-green-500 rounded-full w-16 h-16 flex items-center justify-center">
                <span className="text-2xl text-white font-bold">
                  {selectedBro.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">{selectedBro.name}</h2>
                <p className="text-gray-600">Membre de l'équipe Bro</p>
              </div>
            </div>

            {/* Statistiques principales */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white bg-opacity-70 p-3 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600">{stats.totalHours}h</p>
                <p className="text-sm text-gray-700">Heures totales</p>
              </div>
              <div className="bg-white bg-opacity-70 p-3 rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(stats.totalEarnings)}</p>
                <p className="text-sm text-gray-700">Gains totaux</p>
              </div>
            </div>
          </div>

          {/* Statistiques détaillées */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">📊 Statistiques Détaillées</h3>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-lg font-bold text-gray-800">{stats.totalJobs}</p>
                <p className="text-sm text-gray-600">Boulots effectués</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-lg font-bold text-purple-600">{formatCurrency(stats.averageHourlyRate)}</p>
                <p className="text-sm text-gray-600">Tarif moyen/h</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 p-3 rounded-lg">
                <p className="text-lg font-bold text-green-600">{stats.paidJobs}</p>
                <p className="text-sm text-green-700">Boulots payés</p>
              </div>
              <div className="bg-red-50 p-3 rounded-lg">
                <p className="text-lg font-bold text-red-600">{stats.unpaidJobs}</p>
                <p className="text-sm text-red-700">Boulots à payer</p>
                {stats.unpaidAmount > 0 && (
                  <p className="text-xs text-red-600 font-semibold">{formatCurrency(stats.unpaidAmount)}</p>
                )}
              </div>
            </div>
          </div>

          {/* Évolution mensuelle */}
          {monthlyData.length > 1 && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">📈 Évolution Mensuelle</h3>

              <div className="space-y-3">
                {monthlyData.slice(-6).map((data, index) => {
                  const maxHours = Math.max(...monthlyData.map(d => d.hours));
                  const percentage = maxHours > 0 ? (data.hours / maxHours) * 100 : 0;

                  return (
                    <div key={data.month} className="flex items-center space-x-3">
                      <div className="w-16 text-sm font-medium text-gray-600">
                        {new Date(data.month + '-01').toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })}
                      </div>
                      <div className="flex-1">
                        <div className="bg-gray-200 rounded-full h-6 relative">
                          <div
                            className="bg-gradient-to-r from-green-400 to-green-600 h-6 rounded-full transition-all duration-1000 ease-out flex items-center justify-end pr-2"
                            style={{ width: `${Math.max(percentage, 5)}%` }}
                          >
                            <span className="text-white text-xs font-bold">
                              {data.hours}h
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="w-20 text-right text-sm font-semibold text-green-600">
                        {formatCurrency(data.earnings)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Historique des boulots */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              📋 Historique des Boulots ({broJobs.length})
            </h3>

            {broJobs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Wrench size={48} className="mx-auto mb-2 opacity-50" />
                <p>Aucun boulot enregistré</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {broJobs.map(job => (
                  <div key={job.id} className={`p-4 rounded-lg border ${job.isPaid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                    }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-medium text-gray-800">{job.description}</h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${job.isPaid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                            {job.isPaid ? '✅ Payé' : '⏳ À payer'}
                          </span>
                          {job.isPartialCompletion && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              ⚠️ Partiel
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{formatDate(job.date)}</p>
                        <p className="text-xs text-gray-500">
                          {job.hours}h × {formatCurrency(job.hourlyRate)}/h
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-bold ${job.isPaid ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(job.total)}
                        </p>
                        {job.isPaid && job.paymentMethod && (
                          <p className="text-xs text-gray-500">
                            {job.paymentMethod === 'cash' ? '💵 Cash' : '🏦 Compte'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions rapides */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">⚡ Actions Rapides</h3>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  // Pré-remplir le formulaire avec ce Bro
                  setNewJob({
                    description: '',
                    date: new Date().toISOString().split('T')[0],
                    customRate: hourlyRate,
                    bros: [{ broId: selectedBro.id, hours: 0 }],
                    isPaid: false,
                    paymentMethod: ''
                  });
                  navigateTo('boulots-new');
                }}
                className="p-3 bg-green-500 text-white rounded-lg active:scale-95 transition-transform"
              >
                <div className="text-center">
                  <Plus size={20} className="mx-auto mb-1" />
                  <span className="text-sm font-medium">Nouveau Boulot</span>
                </div>
              </button>

              {stats.unpaidJobs > 0 && (
                <button
                  onClick={() => navigateTo('boulots-history')}
                  className="p-3 bg-red-500 text-white rounded-lg active:scale-95 transition-transform"
                >
                  <div className="text-center">
                    <DollarSign size={20} className="mx-auto mb-1" />
                    <span className="text-sm font-medium">Payer Boulots</span>
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* Insights */}
          <div className="bg-gradient-to-r from-blue-100 to-indigo-100 rounded-xl p-4">
            <h3 className="font-semibold text-blue-800 mb-2">💡 Insights</h3>
            <div className="text-sm text-blue-700 space-y-1">
              {stats.totalJobs > 0 && (
                <>
                  <p>📊 Moyenne: <strong>{Math.round(stats.totalHours / stats.totalJobs * 10) / 10}h</strong> par boulot</p>
                  <p>💰 Gain moyen: <strong>{formatCurrency(stats.totalEarnings / stats.totalJobs)}</strong> par boulot</p>
                  {stats.unpaidJobs > 0 && (
                    <p>⚠️ En attente: <strong>{formatCurrency(stats.unpaidAmount)}</strong> à percevoir</p>
                  )}
                  {monthlyData.length > 1 && (
                    <p>📈 Tendance: <strong>
                      {monthlyData[monthlyData.length - 1].hours > monthlyData[monthlyData.length - 2].hours
                        ? '↗️ En hausse'
                        : '↘️ En baisse'}
                    </strong> ce mois</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentScreen === 'finance-history') {
    // Combiner toutes les transactions financières
    const allFinancialTransactions = [
      // Les transactions financières existantes
      ...financialTransactions.map(t => ({ ...t, source: 'financial' })),

      // Ajouter les rechargements de compte (mais pas les commandes)
      ...orders
        .filter(o => o.type === 'recharge' || o.type === 'repayment')
        .map(o => ({
          id: o.id,
          type: o.type === 'recharge' ? 'recharge' : 'repayment',
          amount: o.amount,
          description: `${o.type === 'recharge' ? 'Rechargement' : 'Remboursement'} - ${o.memberName}`,
          paymentMethod: o.paymentMethod,
          timestamp: o.timestamp,
          source: 'member'
        })),

      // Ajouter les boulots payés
      ...jobs
        .filter(j => j.isPaid)
        .map(j => ({
          id: j.id,
          type: 'job',
          amount: j.total,
          description: `Boulot - ${j.broName} (${j.hours}h)`,
          paymentMethod: j.paymentMethod,
          timestamp: j.date || j.timestamp || j.createdAt,
          source: 'job',
          hours: j.hours,
          broName: j.broName
        }))
    ];

    // Compter les différents types
    const incomeCount = financialTransactions.filter(t => t.type === 'income').length;
    const expenseCount = financialTransactions.filter(t => t.type === 'expense').length;
    const rechargeCount = orders.filter(o => o.type === 'recharge' || o.type === 'repayment').length;
    const jobCount = jobs.filter(j => j.isPaid).length;

    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Historique Financier" onBack={() => navigateTo('finance')} />

        <div className="p-4">
          {/* Résumé rapide */}
          <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <h3 className="font-semibold text-lg mb-3 text-center">📊 Résumé</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center">
                <div className="bg-green-100 p-3 rounded-lg">
                  <p className="text-xl font-bold text-green-600">{incomeCount}</p>
                  <p className="text-sm text-green-700">Rentrées</p>
                </div>
              </div>
              <div className="text-center">
                <div className="bg-red-100 p-3 rounded-lg">
                  <p className="text-xl font-bold text-red-600">{expenseCount}</p>
                  <p className="text-sm text-red-700">Frais</p>
                </div>
              </div>
              <div className="text-center">
                <div className="bg-blue-100 p-3 rounded-lg">
                  <p className="text-xl font-bold text-blue-600">{rechargeCount}</p>
                  <p className="text-sm text-blue-700">Rechargements</p>
                </div>
              </div>
              <div className="text-center">
                <div className="bg-purple-100 p-3 rounded-lg">
                  <p className="text-xl font-bold text-purple-600">{jobCount}</p>
                  <p className="text-sm text-purple-700">Boulots</p>
                </div>
              </div>
            </div>
          </div>

          {/* Liste des transactions */}
          {allFinancialTransactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">💰</div>
              <p>Aucune transaction financière</p>
              <p className="text-sm mt-1">Utilisez les boutons "Ajouter Rentrée" ou "Ajouter Frais"</p>
            </div>
          ) : (
            <div className="space-y-3">
              {allFinancialTransactions
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .map(transaction => (
                  <div key={`${transaction.source}-${transaction.id}`} className="bg-white p-4 rounded-lg shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          {/* Badge type de transaction */}
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${transaction.type === 'income' ? 'bg-green-100 text-green-800' :
                            transaction.type === 'expense' ? 'bg-red-100 text-red-800' :
                              transaction.type === 'recharge' ? 'bg-blue-100 text-blue-800' :
                                transaction.type === 'repayment' ? 'bg-green-100 text-green-800' :
                                  transaction.type === 'job' ? 'bg-purple-100 text-purple-800' :
                                    'bg-gray-100 text-gray-800'
                            }`}>
                            {transaction.type === 'income' ? '💰 Rentrée' :
                              transaction.type === 'expense' ? '💸 Frais' :
                                transaction.type === 'recharge' ? '🔄 Rechargement' :
                                  transaction.type === 'repayment' ? '💰 Remboursement' :
                                    transaction.type === 'job' ? '🔨 Boulot' :
                                      'Transaction'}
                          </span>

                          {/* Badge mode de paiement */}
                          {transaction.paymentMethod && (
                            <span className={`text-xs px-2 py-1 rounded-full ${transaction.paymentMethod === 'cash'
                              ? 'bg-green-50 text-green-700'
                              : 'bg-blue-50 text-blue-700'
                              }`}>
                              {transaction.paymentMethod === 'cash' ? '💵 Cash' : '🏦 Compte'}
                            </span>
                          )}
                        </div>

                        {/* Description */}
                        <p className="font-medium mb-1">{transaction.description}</p>

                        {/* Catégorie si présente (pour les transactions financières) */}
                        {transaction.category && transaction.source === 'financial' && (
                          <p className="text-sm text-gray-500 mb-1">
                            {transaction.category === 'cotisation' && '📋 Cotisation'}
                            {transaction.category === 'bar' && '🍺 Bar'}
                            {transaction.category === 'boulot' && '🔨 Boulot'}
                            {transaction.category === 'event' && '🎉 Événement'}
                            {transaction.category === 'don' && '🎁 Don'}
                            {transaction.category === 'bank_transfer' && '🏦 Transfert bancaire'}
                            {transaction.category === 'autre' && '📌 Autre'}
                          </p>
                        )}

                        {/* Date */}
                        <p className="text-sm text-gray-500">
                          {formatDate(transaction.timestamp)}
                        </p>
                      </div>

                      {/* Montant */}
                      <div className="text-right ml-4">
                        <p className={`text-lg font-bold ${transaction.type === 'expense' ? 'text-red-600' : 'text-green-600'
                          }`}>
                          {transaction.type === 'expense' ? '-' : '+'}{formatCurrency(transaction.amount)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      </div>
    );
  }

  if (currentScreen === 'finance-bar-report') {
    // Fonction pour calculer les jours d'ouverture du bar
    const calculateBarOpenDays = () => {
      const dayGroups = {};

      orders.filter(order => order.type === 'order').forEach(order => {
        // Créer la date en forçant l'interprétation locale
        const orderDate = new Date(order.timestamp);

        // Obtenir l'heure locale (corrige automatiquement UTC)
        const localHour = orderDate.getHours();
        const localDate = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate());

        // Calculer le jour de service (de 10h à 10h le lendemain)
        let serviceDate;
        if (localHour < 10) {
          // Si avant 10h, c'est la continuation de la soirée de la veille
          serviceDate = new Date(localDate);
          serviceDate.setDate(localDate.getDate() - 1);
        } else {
          // Si après 10h, c'est le jour actuel
          serviceDate = new Date(localDate);
        }

        const dayKey = serviceDate.getFullYear() + '-' +
          String(serviceDate.getMonth() + 1).padStart(2, '0') + '-' +
          String(serviceDate.getDate()).padStart(2, '0');
        if (!dayGroups[dayKey]) {
          dayGroups[dayKey] = {
            date: dayKey,
            orders: [],
            totalRevenue: 0,
            totalItems: 0,
            totalBottles: 0
          };
        }

        dayGroups[dayKey].orders.push(order);
        dayGroups[dayKey].totalRevenue += order.amount || 0;

        // Compter les articles et bouteilles
        if (order.items) {
          order.items.forEach(item => {
            const quantity = item.quantity || 0;
            dayGroups[dayKey].totalItems += quantity;

            // Considérer comme bouteille si c'est dans les catégories boissons
            const product = products.find(p => p.id === item.productId);
            if (product && ['Boissons', 'Bière', 'Alcool'].includes(product.category)) {
              dayGroups[dayKey].totalBottles += quantity;
            }
          });
        }
      });

      // Filtrer les jours avec plus de 8 bouteilles (bar ouvert)
      return Object.values(dayGroups)
        .filter(day => day.totalBottles > barOpenThreshold)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    };

    const openDays = calculateBarOpenDays();


    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Rapport Bar" onBack={() => navigateTo('finance')} />

        <div className="p-4 space-y-6">
          {/* Statistiques globales */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 text-center">🍺 Statistiques Bar</h2>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center">
                <div className="bg-blue-100 p-3 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{openDays.length}</p>
                  <p className="text-sm text-blue-700">Jours d'ouverture</p>
                </div>
              </div>
              <div className="text-center">
                <div className="bg-green-100 p-3 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(openDays.reduce((sum, day) => sum + day.totalRevenue, 0))}
                  </p>
                  <p className="text-sm text-green-700">CA Total Bar</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="bg-orange-100 p-3 rounded-lg">
                  <p className="text-xl font-bold text-orange-600">
                    {openDays.reduce((sum, day) => sum + day.totalItems, 0)}
                  </p>
                  <p className="text-xs text-orange-700">Articles vendus</p>
                </div>
              </div>
              <div className="text-center">
                <div className="bg-purple-100 p-3 rounded-lg">
                  <p className="text-xl font-bold text-purple-600">
                    {openDays.reduce((sum, day) => sum + day.totalBottles, 0)}
                  </p>
                  <p className="text-xs text-purple-700">Bouteilles vendues</p>
                </div>
              </div>
              <div className="text-center">
                <div className="bg-yellow-100 p-3 rounded-lg">
                  <p className="text-xl font-bold text-yellow-600">
                    {openDays.length > 0 ? formatCurrency(openDays.reduce((sum, day) => sum + day.totalRevenue, 0) / openDays.length) : '0€'}
                  </p>
                  <p className="text-xs text-yellow-700">CA moyen/jour</p>
                </div>
              </div>
            </div>
          </div>

          {/* Liste des jours d'ouverture */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">📅 Jours d'Ouverture</h2>

            {openDays.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">🍺</div>
                <p>Aucun jour d'ouverture détecté</p>
                <p className="text-sm mt-1">Critère: plus de {barOpenThreshold} bouteilles vendues entre 10h-10h</p>
              </div>
            ) : (
              <div className="space-y-3">
                {openDays.map(day => (
                  <button
                    key={day.date}
                    onClick={() => setSelectedDay(day)}
                    className="w-full p-4 bg-gray-50 hover:bg-blue-50 rounded-lg text-left active:scale-95 transition-transform"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-800">
                          {(() => {
                            // Forcer l'interprétation locale de la date ISO
                            const [year, month, dayNum] = day.date.split('-');
                            const localDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(dayNum));
                            return localDate.toLocaleDateString('fr-FR', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            });
                          })()}
                        </h3>
                        <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                          <span>🛍️ {day.totalItems} articles</span>
                          <span>🍺 {day.totalBottles} bouteilles</span>
                          <span>👥 {day.orders.length} commandes</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-green-600">
                          {formatCurrency(day.totalRevenue)}
                        </p>
                        <p className="text-xs text-gray-500">CA du jour</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Conseils */}
          <div className="bg-gradient-to-r from-blue-100 to-indigo-100 rounded-xl p-4">
            <h3 className="font-semibold text-blue-800 mb-2">💡 Analyse</h3>
            <div className="text-sm text-blue-700 space-y-1">
              {openDays.length > 0 ? (
                <>
                  <p>• Le bar a été ouvert {openDays.length} jour(s) au total</p>
                  <p>• Meilleur jour: {(() => {
                    const bestDay = openDays.reduce((best, day) =>
                      day.totalRevenue > best.totalRevenue ? day : best
                    );
                    return `${formatDate(bestDay.date)} (${formatCurrency(bestDay.totalRevenue)})`;
                  })()}</p>
                  <p>• Critère d'ouverture: minimum {barOpenThreshold} bouteilles vendues par jour</p>
                </>
              ) : (
                <p>• Aucune activité bar détectée selon les critères (8+ bouteilles/jour)</p>
              )}
            </div>
          </div>
        </div>

        {/* Modal détail du jour */}
        <Modal
          isOpen={selectedDay !== null}
          onClose={() => setSelectedDay(null)}
          title={selectedDay ? `Détail du ${formatDate(selectedDay.date)}` : ''}
        >
          {selectedDay && (
            <div className="space-y-4">
              {/* Résumé du jour */}
              <div className="bg-blue-50 p-3 rounded-lg">
                <h4 className="font-semibold text-blue-800 mb-2">
                  📊 Résumé du {new Date(selectedDay.date).toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long'
                  })}
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-white p-2 rounded">
                    <p className="font-medium text-green-600">{formatCurrency(selectedDay.totalRevenue)}</p>
                    <p className="text-gray-600">Chiffre d'affaires</p>
                  </div>
                  <div className="bg-white p-2 rounded">
                    <p className="font-medium text-blue-600">{selectedDay.orders.length}</p>
                    <p className="text-gray-600">Commandes</p>
                  </div>
                  <div className="bg-white p-2 rounded">
                    <p className="font-medium text-purple-600">{selectedDay.totalItems}</p>
                    <p className="text-gray-600">Articles vendus</p>
                  </div>
                  <div className="bg-white p-2 rounded">
                    <p className="font-medium text-orange-600">{selectedDay.totalBottles}</p>
                    <p className="text-gray-600">Bouteilles</p>
                  </div>
                </div>
              </div>
              {/* Détail des ventes */}
              <div>
                <h4 className="font-semibold text-gray-800 mb-3">🛒 Détail des Ventes</h4>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {selectedDay.orders
                    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
                    .map(order => (
                      <div key={order.id} className="bg-gray-50 p-3 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{order.memberName}</span>
                          <span className="font-semibold text-green-600">
                            {formatCurrency(order.amount)}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">
                          <p className="mb-1">{new Date(order.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
                          {order.items && order.items.length > 0 && (
                            <div className="space-y-1">
                              {order.items.map((item, idx) => (
                                <div key={idx} className="flex justify-between">
                                  <span>{item.quantity}x {item.productName}</span>
                                  <span>{formatCurrency(item.total)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
              {/* Analyse des produits */}
              <div>
                <h4 className="font-semibold text-gray-800 mb-3">📈 Top Produits du Jour</h4>
                <div className="space-y-2">
                  {(() => {
                    const productStats = {};
                    selectedDay.orders.forEach(order => {
                      if (order.items) {
                        order.items.forEach(item => {
                          if (!productStats[item.productName]) {
                            productStats[item.productName] = {
                              name: item.productName,
                              quantity: 0,
                              revenue: 0
                            };
                          }
                          productStats[item.productName].quantity += item.quantity;
                          productStats[item.productName].revenue += item.total;
                        });
                      }
                    });

                    return Object.values(productStats)
                      .sort((a, b) => b.quantity - a.quantity)
                      .slice(0, 5)
                      .map((product, idx) => (
                        <div key={product.name} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-bold text-gray-500">#{idx + 1}</span>
                            <span className="font-medium">{product.name}</span>
                          </div>
                          <div className="text-right text-sm">
                            <p className="font-semibold">{product.quantity} vendus</p>
                            <p className="text-green-600">{formatCurrency(product.revenue)}</p>
                          </div>
                        </div>
                      ));
                  })()}
                </div>
              </div>
            </div>
          )}
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

                <style>{`
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













  // ===== ÉCRAN VOYAGE =====
  if (currentScreen === 'trip') {
    return (
      <TripManager
        onBack={() => navigateTo('home')}
        bros={bros}
        financialData={{
          transactions: financialTransactions,
          orders: orders,
          jobs: jobs
        }}
        formatCurrency={formatCurrency}
        seasonId={viewedSeasonId}
      />
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