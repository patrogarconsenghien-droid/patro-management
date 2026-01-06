import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Plus, Trash2, DollarSign, Calendar, BarChart3, 
  Plane, Clock, Users, MapPin
} from 'lucide-react';
import { db } from './firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp, getDocs, query, limit } from 'firebase/firestore';

/**
 * 🗺️ COMPOSANT TRIPMANAGER
 * Gestion complète des voyages : dépenses, calendrier, budget
 */

const eventCategories = {
  travel: { 
    label: 'Déplacement', 
    icon: '✈️', 
    color: 'blue',
    bgClass: 'bg-blue-100',
    borderClass: 'border-blue-500',
    textClass: 'text-blue-700'
  },
  visit: { 
    label: 'Visite', 
    icon: '🏛️', 
    color: 'purple',
    bgClass: 'bg-purple-100',
    borderClass: 'border-purple-500',
    textClass: 'text-purple-700'
  },
  outing: { 
    label: 'Sortie', 
    icon: '🎉', 
    color: 'pink',
    bgClass: 'bg-pink-100',
    borderClass: 'border-pink-500',
    textClass: 'text-pink-700'
  },
  sport: { 
    label: 'Activité sportive', 
    icon: '⚽', 
    color: 'green',
    bgClass: 'bg-green-100',
    borderClass: 'border-green-500',
    textClass: 'text-green-700'
  },
  food: { 
    label: 'Restaurant', 
    icon: '🍽️', 
    color: 'orange',
    bgClass: 'bg-orange-100',
    borderClass: 'border-orange-500',
    textClass: 'text-orange-700'
  },
  hotel: { 
    label: 'Hébergement', 
    icon: '🏨', 
    color: 'indigo',
    bgClass: 'bg-indigo-100',
    borderClass: 'border-indigo-500',
    textClass: 'text-indigo-700'
  },
  activity: { 
    label: 'Activité', 
    icon: '🎯', 
    color: 'teal',
    bgClass: 'bg-teal-100',
    borderClass: 'border-teal-500',
    textClass: 'text-teal-700'
  },
  other: { 
    label: 'Autre', 
    icon: '📌', 
    color: 'gray',
    bgClass: 'bg-gray-100',
    borderClass: 'border-gray-500',
    textClass: 'text-gray-700'
  }
};

// Fonction helper pour obtenir les infos d'une catégorie
const getCategoryInfo = (category) => {
  return eventCategories[category] || eventCategories.other;
};

const TripManager = ({ 
  onBack, 
  bros = [], 
  financialData = { transactions: [], orders: [], jobs: [] },
  formatCurrency = (amount) => `${amount.toFixed(2)}€`
}) => {
  
  // ============================================
  // 📊 ÉTATS (VARIABLES)
  // ============================================
  
  // Écran actuel dans la section voyage
  const [currentScreen, setCurrentScreen] = useState('main'); // 'password', 'main', 'expenses', 'calendar', 'graph'
  // Vue détaillée d'un jour
const [selectedDay, setSelectedDay] = useState(null); // Date du jour sélectionné
const [showEventModal, setShowEventModal] = useState(false); // Modal d'ajout d'événement


  // Paramètres du voyage
  const [tripSettings, setTripSettings] = useState({
    startDate: '',
    endDate: '',
    passwordProtected: false,
    tripPassword: '1234' // Mot de passe par défaut
  });
  
  // Authentification
  const [tripAuthenticated, setTripAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  
  // Dépenses
  const [tripExpenses, setTripExpenses] = useState([]);
  const [newExpense, setNewExpense] = useState({
    description: '',
    amount: '',
    category: 'before', // 'before' ou 'during'
    date: new Date().toISOString().split('T')[0],
    sharedWith: 'all', // 'all' ou ID d'un brother
    paidBy: ''
  });
  
  // Événements calendrier
  const [tripEvents, setTripEvents] = useState([]);
  const [newEvent, setNewEvent] = useState({
  title: '',
  date: '',
  timeStart: '10:00',  // ← Changé de 'time' à 'timeStart'
  timeEnd: '',         // ← Ajouté
  price: '',
  description: '',
  type: 'activity'
});
  // ============================================
  // 🔥 FIREBASE - ÉCOUTE EN TEMPS RÉEL
  // ============================================
  
  useEffect(() => {
    // Écouter les dépenses
    const unsubExpenses = onSnapshot(
      collection(db, 'tripExpenses'),
      (snapshot) => {
        const expenses = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setTripExpenses(expenses);
      },
      (error) => console.error('❌ Erreur tripExpenses:', error)
    );
    
    // Écouter les événements
    const unsubEvents = onSnapshot(
      collection(db, 'tripEvents'),
      (snapshot) => {
        const events = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setTripEvents(events);
      },
      (error) => console.error('❌ Erreur tripEvents:', error)
    );
    
    // Écouter les paramètres voyage
    const unsubSettings = onSnapshot(
      collection(db, 'tripSettings'),
      (snapshot) => {
        if (!snapshot.empty) {
          const settings = snapshot.docs[0].data();
          setTripSettings({
            startDate: settings.startDate || '',
            endDate: settings.endDate || '',
            passwordProtected: settings.passwordProtected || false,
            tripPassword: settings.tripPassword || '1234'
          });
        }
      },
      (error) => console.error('❌ Erreur tripSettings:', error)
    );
    
    return () => {
      unsubExpenses();
      unsubEvents();
      unsubSettings();
    };
  }, []);
  
  // ============================================
  // 💰 CALCULS BUDGET
  // ============================================
  
  const calculateBudget = () => {
    // Budget de départ = Total finance - Dépenses préliminaires
    let totalFinance = 0;
    
    // Ajouter les transactions financières
    financialData.transactions.forEach(transaction => {
      const amount = transaction.amount || 0;
      totalFinance += transaction.type === 'income' ? amount : -amount;
    });
    
    // Ajouter les remboursements/rechargements
    financialData.orders.forEach(order => {
      if (order.type === 'repayment' || order.type === 'recharge') {
        totalFinance += order.amount || 0;
      } else if (order.type === 'order') {
        totalFinance += order.amount || 0;
      }
    });
    
    // Ajouter les revenus des boulots payés
    financialData.jobs.forEach(job => {
      if (job.isPaid) {
        totalFinance += job.total || 0;
      }
    });
    
    // Dépenses avant voyage
    const beforeExpenses = tripExpenses
      .filter(exp => exp.category === 'before')
      .reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
    
    // Budget disponible pour le voyage
    const budgetAvailable = totalFinance - beforeExpenses;
    
    // Dépenses pendant voyage
    const duringExpenses = tripExpenses
      .filter(exp => exp.category === 'during')
      .reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
    
    // Budget restant
    const budgetRemaining = budgetAvailable - duringExpenses;
    
    return {
      totalFinance,
      beforeExpenses,
      budgetAvailable,
      duringExpenses,
      budgetRemaining,
      percentUsed: budgetAvailable > 0 ? (duringExpenses / budgetAvailable) * 100 : 0
    };
  };
  
  // ============================================
  // 🔧 FONCTIONS FIREBASE
  // ============================================
  
  const addExpense = async () => {
    if (!newExpense.description || !newExpense.amount) {
      alert('❌ Remplissez la description et le montant');
      return;
    }
    
    try {
      await addDoc(collection(db, 'tripExpenses'), {
        ...newExpense,
        amount: parseFloat(newExpense.amount),
        timestamp: serverTimestamp()
      });
      
      alert('✅ Dépense ajoutée !');
      setNewExpense({
        description: '',
        amount: '',
        category: 'before',
        date: new Date().toISOString().split('T')[0],
        sharedWith: 'all',
        paidBy: ''
      });
    } catch (error) {
      console.error('❌ Erreur ajout dépense:', error);
      alert('❌ Erreur lors de l\'ajout');
    }
  };
  
  const deleteExpense = async (expenseId) => {
    if (!confirm('Supprimer cette dépense ?')) return;
    
    try {
      await deleteDoc(doc(db, 'tripExpenses', expenseId));
      alert('✅ Dépense supprimée !');
    } catch (error) {
      console.error('❌ Erreur suppression:', error);
      alert('❌ Erreur lors de la suppression');
    }
  };
  
  const addEvent = async () => {
  if (!newEvent.title || !newEvent.date || !newEvent.timeStart) {
    alert('❌ Remplissez le titre, la date et l\'heure de début');
    return;
  }
  
  try {
    await addDoc(collection(db, 'tripEvents'), {
      ...newEvent,
      time: newEvent.timeStart, // Pour compatibilité avec anciens événements
      price: parseFloat(newEvent.price) || 0,
      timestamp: serverTimestamp()
    });
      
      alert('✅ Événement ajouté !');
      setNewEvent({
        title: '',
        date: '',
        time: '10:00',
        timeEnd: '',
        price: '',
        description: '',
        type: 'activity'
      });
    } catch (error) {
      console.error('❌ Erreur ajout événement:', error);
      alert('❌ Erreur lors de l\'ajout');
    }
  };
  
  const deleteEvent = async (eventId) => {
    if (!confirm('Supprimer cet événement ?')) return;
    
    try {
      await deleteDoc(doc(db, 'tripEvents', eventId));
      alert('✅ Événement supprimé !');
    } catch (error) {
      console.error('❌ Erreur suppression:', error);
      alert('❌ Erreur lors de la suppression');
    }
  };
  
  const saveTripSettings = async (settings) => {
    try {
      // Chercher si des paramètres existent déjà
      const q = query(collection(db, 'tripSettings'), limit(1));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        // Créer
        await addDoc(collection(db, 'tripSettings'), settings);
      } else {
        // Mettre à jour
        const docId = snapshot.docs[0].id;
        await updateDoc(doc(db, 'tripSettings', docId), settings);
      }
      
      alert('✅ Paramètres sauvegardés !');
    } catch (error) {
      console.error('❌ Erreur sauvegarde paramètres:', error);
      alert('❌ Erreur lors de la sauvegarde');
    }
  };
  
  // ============================================
  // 🎨 COMPOSANTS D'EN-TÊTE
  // ============================================

  // ===================================================================
// 🆕 NOUVEAUX COMPOSANTS À AJOUTER DANS TRIPMANAGER.JSX
// ===================================================================
// Ajoute ces composants APRÈS les fonctions Firebase (ligne ~280)

// ============================================
// 🎯 NAVIGATION ENTRE JOURS
// ============================================

const navigateDay = (direction) => {
  if (!selectedDay) return;
  
  const calendarDays = generateCalendarDays();
  const currentIndex = calendarDays.findIndex(
    day => day.toISOString().split('T')[0] === selectedDay.toISOString().split('T')[0]
  );
  
  if (direction === 'prev' && currentIndex > 0) {
    setSelectedDay(calendarDays[currentIndex - 1]);
  } else if (direction === 'next' && currentIndex < calendarDays.length - 1) {
    setSelectedDay(calendarDays[currentIndex + 1]);
  }
};

// ============================================
// 📅 GÉNÉRER LES JOURS DU CALENDRIER
// ============================================

const generateCalendarDays = () => {
  if (!tripSettings.startDate || !tripSettings.endDate) return [];
  
  const days = [];
  const start = new Date(tripSettings.startDate);
  const end = new Date(tripSettings.endDate);
  
  let currentDate = new Date(start);
  while (currentDate <= end) {
    days.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return days;
};

// ============================================
// 🔍 RÉCUPÉRER ÉVÉNEMENTS D'UN JOUR
// ============================================

const getEventsForDay = (date) => {
  if (!date) return [];
  const dateString = date.toISOString().split('T')[0];
  return tripEvents
    .filter(event => event.date === dateString)
    .sort((a, b) => a.time.localeCompare(b.time));
};

// ============================================
// ⏰ MODAL AJOUT ÉVÉNEMENT
// ============================================

const EventModal = ({ 
  isOpen, 
  onClose, 
  preSelectedDate = null,
  tripSettings = { startDate: '', endDate: '' }
}) => {
  if (!isOpen) return null;
  
  // ============================================
  // 📅 DATE PAR DÉFAUT INTELLIGENTE
  // ============================================
  const getDefaultDate = () => {
    // 1. Si on a cliqué sur un jour spécifique, utiliser cette date
    if (preSelectedDate) {
      return preSelectedDate;
    }
    
    // 2. Sinon, utiliser la PREMIÈRE DATE DU VOYAGE
    if (tripSettings.startDate) {
      return tripSettings.startDate;
    }
    
    // 3. En dernier recours, aujourd'hui
    return new Date().toISOString().split('T')[0];
  };
  
  // ============================================
  // 📊 ÉTAT LOCAL DU FORMULAIRE
  // ============================================
  const [localEvent, setLocalEvent] = useState({
    title: '',
    type: 'activity',
    date: '',  // Vide au départ, sera rempli par useEffect
    timeStart: '10:00',
    timeEnd: '',
    price: '',
    description: ''
  });
  
  // ============================================
  // ⚡ INITIALISER À L'OUVERTURE DU MODAL
  // ============================================
  useEffect(() => {
    if (isOpen) {
      // Réinitialiser le formulaire avec la date par défaut
      setLocalEvent({
        title: '',
        type: 'activity',
        date: getDefaultDate(),  // ← Date automatique ici
        timeStart: '10:00',
        timeEnd: '',
        price: '',
        description: ''
      });
    }
  }, [isOpen, preSelectedDate, tripSettings.startDate]);
  
  // ============================================
  // 💾 AJOUTER L'ÉVÉNEMENT
  // ============================================
  const handleAddEvent = async () => {
    // Validation des champs obligatoires
    if (!localEvent.title || !localEvent.date || !localEvent.timeStart) {
      alert('❌ Remplissez au moins le titre, la date et l\'heure de début');
      return;
    }
    
    // Validation : date dans la période du voyage
    if (tripSettings.startDate && localEvent.date < tripSettings.startDate) {
      alert('❌ La date est avant le début du voyage');
      return;
    }
    
    if (tripSettings.endDate && localEvent.date > tripSettings.endDate) {
      alert('❌ La date est après la fin du voyage');
      return;
    }
    
    try {
      // Ajouter l'événement dans Firebase
      await addDoc(collection(db, 'tripEvents'), {
        ...localEvent,
        time: localEvent.timeStart, // Pour compatibilité avec anciens événements
        price: parseFloat(localEvent.price) || 0,
        timestamp: serverTimestamp()
      });
      
      alert('✅ Événement ajouté avec succès !');
      onClose();
      
      // Le formulaire sera réinitialisé à la prochaine ouverture via useEffect
    } catch (error) {
      console.error('❌ Erreur lors de l\'ajout:', error);
      alert('❌ Erreur lors de l\'ajout de l\'événement');
    }
  };
  
  // ============================================
  // 🎨 RENDU DU MODAL
  // ============================================
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
        
        {/* ========== HEADER ========== */}
        <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white z-10">
          <h3 className="font-bold text-lg text-gray-800">➕ Ajouter un événement</h3>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Fermer"
          >
            <Plus className="rotate-45" size={20} />
          </button>
        </div>
        
        {/* ========== FORMULAIRE ========== */}
        <div className="p-4 space-y-3">
          
          {/* Titre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ✏️ Titre de l'événement *
            </label>
            <input
              type="text"
              placeholder="Ex: Visite du Musée du Louvre"
              value={localEvent.title}
              onChange={(e) => setLocalEvent({...localEvent, title: e.target.value})}
              className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none transition-colors"
              autoFocus
            />
          </div>
          
          {/* Type/Catégorie */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              🏷️ Catégorie
            </label>
            <select
              value={localEvent.type}
              onChange={(e) => setLocalEvent({...localEvent, type: e.target.value})}
              className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none transition-colors"
            >
              {Object.entries(eventCategories).map(([key, cat]) => (
                <option key={key} value={key}>
                  {cat.icon} {cat.label}
                </option>
              ))}
            </select>
          </div>
          
          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              📅 Date de l'événement *
              {tripSettings.startDate && tripSettings.endDate && (
                <span className="block text-xs text-gray-500 mt-0.5 font-normal">
                  Période du voyage : {new Date(tripSettings.startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} 
                  {' '}- {new Date(tripSettings.endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              )}
            </label>
            <input
              type="date"
              value={localEvent.date}
              onChange={(e) => setLocalEvent({...localEvent, date: e.target.value})}
              min={tripSettings.startDate || undefined}
              max={tripSettings.endDate || undefined}
              className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none transition-colors"
            />
          </div>
          
          {/* Heures début et fin */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ⏰ Heure début *
              </label>
              <input
                type="time"
                value={localEvent.timeStart}
                onChange={(e) => setLocalEvent({...localEvent, timeStart: e.target.value})}
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none transition-colors"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ⏰ Heure fin
              </label>
              <input
                type="time"
                value={localEvent.timeEnd}
                onChange={(e) => setLocalEvent({...localEvent, timeEnd: e.target.value})}
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none transition-colors"
                placeholder="Optionnel"
              />
            </div>
          </div>
          
          {/* Prix */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              💰 Prix (€)
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={localEvent.price}
              onChange={(e) => setLocalEvent({...localEvent, price: e.target.value})}
              className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none transition-colors"
            />
          </div>
          
          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              📝 Description
            </label>
            <textarea
              placeholder="Ajoutez des détails (optionnel)..."
              value={localEvent.description}
              onChange={(e) => setLocalEvent({...localEvent, description: e.target.value})}
              className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none transition-colors resize-none"
              rows="3"
            />
          </div>
          
          {/* Info sur les champs obligatoires */}
          <p className="text-xs text-gray-500 italic">
            * Champs obligatoires
          </p>
          
          {/* Boutons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 p-3 bg-gray-200 text-gray-700 rounded-lg active:scale-95 transition-transform font-semibold hover:bg-gray-300"
            >
              Annuler
            </button>
            
            <button
              onClick={handleAddEvent}
              className="flex-1 p-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg active:scale-95 transition-transform font-semibold hover:from-blue-600 hover:to-blue-700 shadow-md"
            >
              ✅ Ajouter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// 📱 VUE DÉTAILLÉE D'UN JOUR (TIMELINE)
// ============================================

const DayDetailScreen = ({ day, onBack, tripSettings }) => {
  const dayEvents = getEventsForDay(day);
  const calendarDays = generateCalendarDays();
  const dayIndex = calendarDays.findIndex(
    d => d.toISOString().split('T')[0] === day.toISOString().split('T')[0]
  );
  const dayNumber = dayIndex + 1;
  const isFirst = dayIndex === 0;
  const isLast = dayIndex === calendarDays.length - 1;
  
  const dayOfWeek = day.toLocaleDateString('fr-FR', { weekday: 'long' });
  
  // Générer les heures de 0h à 23h
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  // Positionner un événement dans la timeline
  const getEventPosition = (event) => {
    const [startHour, startMin] = event.timeStart.split(':').map(Number);
    const startInMinutes = startHour * 60 + startMin;
    
    let durationInMinutes = 60; // Par défaut 1h
    if (event.timeEnd) {
      const [endHour, endMin] = event.timeEnd.split(':').map(Number);
      const endInMinutes = endHour * 60 + endMin;
      durationInMinutes = endInMinutes - startInMinutes;
    }
    
    return {
      top: `${(startInMinutes / 60) * 80}px`, // 80px par heure
      height: `${(durationInMinutes / 60) * 80}px`
    };
  };
  
  const categoryInfo = (type) => getCategoryInfo(type);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 pb-20">
      {/* Header avec navigation */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white p-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="p-2 hover:bg-white/20 rounded-lg">
            <ArrowLeft size={24} />
          </button>
          
          <div className="text-center flex-1">
            <div className="text-sm opacity-90">Jour {dayNumber}</div>
            <h2 className="text-lg font-bold capitalize">{dayOfWeek}</h2>
            <div className="text-sm">{day.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          </div>
          
          <button 
            onClick={() => setShowEventModal(true)}
            className="p-2 hover:bg-white/20 rounded-lg"
          >
            <Plus size={24} />
          </button>
        </div>
        
        {/* Navigation jours */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/30">
          <button
            onClick={() => navigateDay('prev')}
            disabled={isFirst}
            className={`flex items-center space-x-1 px-3 py-1 rounded-lg ${
              isFirst ? 'opacity-30' : 'hover:bg-white/20'
            }`}
          >
            <ArrowLeft size={16} />
            <span className="text-sm">Jour précédent</span>
          </button>
          
          <button
            onClick={() => navigateDay('next')}
            disabled={isLast}
            className={`flex items-center space-x-1 px-3 py-1 rounded-lg ${
              isLast ? 'opacity-30' : 'hover:bg-white/20'
            }`}
          >
            <span className="text-sm">Jour suivant</span>
            <ArrowLeft className="rotate-180" size={16} />
          </button>
        </div>
      </div>
      
      {/* Timeline */}
      <div className="p-4">
        {dayEvents.length === 0 ? (
          <div className="bg-white rounded-xl p-6 text-center">
            <Calendar size={48} className="mx-auto text-gray-400 mb-3" />
            <p className="text-gray-500">Aucun événement prévu ce jour</p>
            <button
              onClick={() => setShowEventModal(true)}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg active:scale-95 transition-transform"
            >
              ➕ Ajouter un événement
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="flex">
              {/* Colonne des heures */}
              <div className="w-16 flex-shrink-0 border-r border-gray-200">
                {hours.map(hour => (
                  <div key={hour} className="h-20 border-b border-gray-100 flex items-start justify-center pt-1">
                    <span className="text-xs text-gray-500 font-mono">
                      {hour.toString().padStart(2, '0')}:00
                    </span>
                  </div>
                ))}
              </div>
              
              {/* Colonne des événements */}
              <div className="flex-1 relative" style={{ minHeight: `${24 * 80}px` }}>
                {/* Lignes horizontales */}
                {hours.map(hour => (
                  <div key={hour} className="absolute left-0 right-0 border-b border-gray-100" style={{ top: `${hour * 80}px`, height: '80px' }}></div>
                ))}
                
                {/* Événements positionnés */}
                {dayEvents.map(event => {
                  const position = getEventPosition(event);
                  const cat = categoryInfo(event.type);
                  
                  return (
                    <div
                      key={event.id}
                      className={`absolute left-2 right-2 ${cat.bgClass} ${cat.borderClass} border-l-4 rounded-lg p-2 shadow-md overflow-hidden`}
                      style={{ top: position.top, minHeight: position.height }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-1 mb-1">
                            <span className="text-lg">{cat.icon}</span>
                            <h4 className={`font-semibold text-sm ${cat.textClass} truncate`}>
                              {event.title}
                            </h4>
                          </div>
                          
                          <div className={`text-xs ${cat.textClass} space-y-1`}>
                            <div className="flex items-center space-x-1">
                              <Clock size={10} />
                              <span>
                                {event.timeStart}
                                {event.timeEnd && ` - ${event.timeEnd}`}
                              </span>
                            </div>
                            
                            {event.price > 0 && (
                              <div className="flex items-center space-x-1 font-semibold">
                                <DollarSign size={10} />
                                <span>{formatCurrency(event.price)}</span>
                              </div>
                            )}
                            
                            {event.description && (
                              <p className="text-xs opacity-80 italic line-clamp-2">
                                {event.description}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <button
                          onClick={() => deleteEvent(event.id)}
                          className="ml-1 p-1 hover:bg-red-100 rounded"
                        >
                          <Trash2 size={14} className="text-red-500" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Modal ajout événement */}
      <EventModal 
  isOpen={showEventModal} 
  onClose={() => setShowEventModal(false)}
  preSelectedDate={day.toISOString().split('T')[0]}
  tripSettings={tripSettings}
/>
    </div>
  );
};


  
  const Header = ({ title, onBack }) => (
    <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-4 flex items-center sticky top-0 z-10 shadow-lg">
      <button onClick={onBack} className="mr-3 p-2 hover:bg-white/20 rounded-lg active:scale-95 transition-transform">
        <ArrowLeft size={24} />
      </button>
      <h1 className="text-xl font-bold flex-1">{title}</h1>
    </div>
  );
  
  // ============================================
  // 🔒 ÉCRAN MOT DE PASSE
  // ============================================
  
  if (currentScreen === 'password') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50">
        <Header title="🔒 Accès Voyage" onBack={onBack} />
        
        <div className="p-4">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-md mx-auto mt-20">
            <div className="text-center mb-6">
              <Plane size={48} className="mx-auto text-orange-500 mb-4" />
              <h2 className="text-xl font-bold text-gray-800">Section Voyage Protégée</h2>
              <p className="text-gray-600 mt-2">Entrez le mot de passe pour accéder</p>
            </div>
            
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Mot de passe"
              className="w-full p-3 border rounded-lg mb-4"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  if (passwordInput === tripSettings.tripPassword) {
                    setTripAuthenticated(true);
                    setPasswordInput('');
                    setCurrentScreen('main');
                  } else {
                    alert('❌ Mot de passe incorrect');
                    setPasswordInput('');
                  }
                }
              }}
            />
            
            <button
              onClick={() => {
                if (passwordInput === tripSettings.tripPassword) {
                  setTripAuthenticated(true);
                  setPasswordInput('');
                  setCurrentScreen('main');
                } else {
                  alert('❌ Mot de passe incorrect');
                  setPasswordInput('');
                }
              }}
              className="w-full p-3 bg-orange-500 text-white rounded-lg active:scale-95 transition-transform font-semibold"
            >
              🔓 Déverrouiller
            </button>
            
            <button
              onClick={() => {
                setPasswordInput('');
                onBack();
              }}
              className="w-full p-3 bg-gray-300 text-gray-800 rounded-lg mt-2 active:scale-95 transition-transform"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // ============================================
  // 🏠 ÉCRAN PRINCIPAL VOYAGE
  // ============================================
  
  if (currentScreen === 'main') {
    const budget = calculateBudget();
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 pb-20">
        <Header title="🗺️ Gestion Voyage" onBack={onBack} />
        
        <div className="p-4 space-y-4">
          {/* Résumé du budget */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">💰 Budget Voyage</h2>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Finances totales :</span>
                <span className="text-lg font-bold text-blue-600">{formatCurrency(budget.totalFinance)}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Dépenses préliminaires :</span>
                <span className="text-lg font-bold text-orange-600">-{formatCurrency(budget.beforeExpenses)}</span>
              </div>
              
              <div className="h-px bg-gray-200"></div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-700 font-semibold">Budget disponible :</span>
                <span className="text-xl font-bold text-green-600">{formatCurrency(budget.budgetAvailable)}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Dépensé pendant :</span>
                <span className="text-lg font-bold text-purple-600">-{formatCurrency(budget.duringExpenses)}</span>
              </div>
              
              <div className="h-px bg-gray-200"></div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-800 font-bold">Reste :</span>
                <span className={`text-2xl font-bold ${budget.budgetRemaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(budget.budgetRemaining)}
                </span>
              </div>
              
              {/* Barre de progression */}
              <div className="mt-4">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Utilisation du budget</span>
                  <span>{Math.min(budget.percentUsed, 100).toFixed(0)}%</span>
                </div>
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${
                      budget.percentUsed < 50 ? 'bg-green-500' :
                      budget.percentUsed < 80 ? 'bg-yellow-500' :
                      budget.percentUsed < 100 ? 'bg-orange-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(budget.percentUsed, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Période du voyage */}
          {tripSettings.startDate && tripSettings.endDate ? (
            <div className="bg-blue-100 border border-blue-200 p-4 rounded-xl">
              <div className="flex items-center space-x-3">
                <Calendar className="text-blue-600" size={24} />
                <div>
                  <p className="font-semibold text-blue-800">Période du voyage</p>
                  <p className="text-blue-700 text-sm">
                    Du {new Date(tripSettings.startDate).toLocaleDateString('fr-FR')} 
                    {' '}au {new Date(tripSettings.endDate).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-100 border border-yellow-200 p-4 rounded-xl">
              <p className="text-yellow-800 text-sm">
                ⚠️ Dates du voyage non configurées. Allez dans l'onglet Calendrier pour les définir.
              </p>
            </div>
          )}
          
          {/* Boutons de navigation */}
          <div className="space-y-3">
            <button
              onClick={() => setCurrentScreen('expenses')}
              className="w-full p-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl shadow-lg active:scale-95 transition-transform"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <DollarSign size={24} />
                  <div className="text-left">
                    <p className="font-semibold">Gérer les dépenses</p>
                    <p className="text-sm text-purple-100">Avant et pendant le voyage</p>
                  </div>
                </div>
                <ArrowLeft className="rotate-180" size={20} />
              </div>
            </button>
            
            <button
              onClick={() => setCurrentScreen('calendar')}
              className="w-full p-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl shadow-lg active:scale-95 transition-transform"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Calendar size={24} />
                  <div className="text-left">
                    <p className="font-semibold">Calendrier / Agenda</p>
                    <p className="text-sm text-blue-100">Activités et événements</p>
                  </div>
                </div>
                <ArrowLeft className="rotate-180" size={20} />
              </div>
            </button>
            
            <button
              onClick={() => setCurrentScreen('graph')}
              className="w-full p-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl shadow-lg active:scale-95 transition-transform"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <BarChart3 size={24} />
                  <div className="text-left">
                    <p className="font-semibold">Graphique Budget</p>
                    <p className="text-sm text-green-100">Visualisation détaillée</p>
                  </div>
                </div>
                <ArrowLeft className="rotate-180" size={20} />
              </div>
            </button>
          </div>
          
          {/* Statistiques rapides */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl p-4 shadow-md">
              <p className="text-sm text-gray-600 mb-1">Dépenses</p>
              <p className="text-2xl font-bold text-purple-600">{tripExpenses.length}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-md">
              <p className="text-sm text-gray-600 mb-1">Événements</p>
              <p className="text-2xl font-bold text-blue-600">{tripEvents.length}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // ============================================
  // 💸 ÉCRAN GESTION DES DÉPENSES
  // ============================================
  
  if (currentScreen === 'expenses') {
    const beforeExpenses = tripExpenses.filter(exp => exp.category === 'before');
    const duringExpenses = tripExpenses.filter(exp => exp.category === 'during');
    
    const totalBefore = beforeExpenses.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
    const totalDuring = duringExpenses.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 pb-20">
        <Header title="💰 Dépenses Voyage" onBack={() => setCurrentScreen('main')} />
        
        <div className="p-4 space-y-4">
          {/* Résumé */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl p-4 shadow-lg">
              <p className="text-sm text-gray-600">Avant voyage</p>
              <p className="text-2xl font-bold text-orange-600">{formatCurrency(totalBefore)}</p>
              <p className="text-xs text-gray-500">{beforeExpenses.length} dépense(s)</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-lg">
              <p className="text-sm text-gray-600">Pendant voyage</p>
              <p className="text-2xl font-bold text-purple-600">{formatCurrency(totalDuring)}</p>
              <p className="text-xs text-gray-500">{duringExpenses.length} dépense(s)</p>
            </div>
          </div>
          
          {/* Formulaire ajout dépense */}
          <div className="bg-white rounded-xl shadow-lg p-4">
            <h3 className="font-bold text-gray-800 mb-3">➕ Ajouter une dépense</h3>
            
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Description (ex: Vol Paris-Tokyo)"
                value={newExpense.description}
                onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                className="w-full p-2 border rounded-lg"
              />
              
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="Montant (€)"
                  value={newExpense.amount}
                  onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
                  className="w-full p-2 border rounded-lg"
                />
                
                <input
                  type="date"
                  value={newExpense.date}
                  onChange={(e) => setNewExpense({...newExpense, date: e.target.value})}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
              
              <select
                value={newExpense.category}
                onChange={(e) => setNewExpense({...newExpense, category: e.target.value})}
                className="w-full p-2 border rounded-lg"
              >
                <option value="before">📋 Avant le voyage</option>
                <option value="during">✈️ Pendant le voyage</option>
              </select>
              
              <select
                value={newExpense.sharedWith}
                onChange={(e) => setNewExpense({...newExpense, sharedWith: e.target.value})}
                className="w-full p-2 border rounded-lg"
              >
                <option value="all">👥 Pour tout le monde</option>
                {bros.map(bro => (
                  <option key={bro.id} value={bro.id}>👤 {bro.name}</option>
                ))}
              </select>
              
              <button
                onClick={addExpense}
                className="w-full p-3 bg-purple-500 text-white rounded-lg active:scale-95 transition-transform font-semibold"
              >
                ➕ Ajouter la dépense
              </button>
            </div>
          </div>
          
          {/* Liste des dépenses AVANT */}
          <div className="bg-white rounded-xl shadow-lg p-4">
            <h3 className="font-bold text-orange-600 mb-3">📋 Dépenses Avant le Voyage</h3>
            
            {beforeExpenses.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Aucune dépense préliminaire</p>
            ) : (
              <div className="space-y-2">
                {beforeExpenses.sort((a, b) => new Date(b.date) - new Date(a.date)).map(expense => {
                  const sharedName = expense.sharedWith === 'all' 
                    ? 'Tout le monde' 
                    : bros.find(b => b.id === expense.sharedWith)?.name || 'Inconnu';
                  
                  return (
                    <div key={expense.id} className="flex items-start justify-between p-3 bg-orange-50 rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-800">{expense.description}</h4>
                        <p className="text-sm text-gray-600">
                          {new Date(expense.date).toLocaleDateString('fr-FR')}
                        </p>
                        <p className="text-xs text-gray-500">
                          👥 {sharedName}
                        </p>
                      </div>
                      <div className="text-right ml-3">
                        <p className="font-bold text-orange-600">{formatCurrency(expense.amount)}</p>
                        <button
                          onClick={() => deleteExpense(expense.id)}
                          className="mt-1 p-1 text-red-500 hover:bg-red-100 rounded active:scale-95 transition-transform"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* Liste des dépenses PENDANT */}
          <div className="bg-white rounded-xl shadow-lg p-4">
            <h3 className="font-bold text-purple-600 mb-3">✈️ Dépenses Pendant le Voyage</h3>
            
            {duringExpenses.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Aucune dépense pendant le voyage</p>
            ) : (
              <div className="space-y-2">
                {duringExpenses.sort((a, b) => new Date(b.date) - new Date(a.date)).map(expense => {
                  const sharedName = expense.sharedWith === 'all' 
                    ? 'Tout le monde' 
                    : bros.find(b => b.id === expense.sharedWith)?.name || 'Inconnu';
                  
                  return (
                    <div key={expense.id} className="flex items-start justify-between p-3 bg-purple-50 rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-800">{expense.description}</h4>
                        <p className="text-sm text-gray-600">
                          {new Date(expense.date).toLocaleDateString('fr-FR')}
                        </p>
                        <p className="text-xs text-gray-500">
                          👥 {sharedName}
                        </p>
                      </div>
                      <div className="text-right ml-3">
                        <p className="font-bold text-purple-600">{formatCurrency(expense.amount)}</p>
                        <button
                          onClick={() => deleteExpense(expense.id)}
                          className="mt-1 p-1 text-red-500 hover:bg-red-100 rounded active:scale-95 transition-transform"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
  
  // ============================================
  // 📅 ÉCRAN CALENDRIER / AGENDA
  // ============================================
  
 // ===================================================================
// 📅 NOUVEL ÉCRAN CALENDRIER - À REMPLACER DANS TRIPMANAGER.JSX
// ===================================================================
// Remplace l'ancien "if (currentScreen === 'calendar')" par ce code

  // ============================================
  // 📅 ÉCRAN CALENDRIER SIMPLIFIÉ
  // ============================================
  
  if (currentScreen === 'calendar') {
    const calendarDays = generateCalendarDays();
    const totalEventCost = tripEvents.reduce((sum, event) => sum + (parseFloat(event.price) || 0), 0);
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 pb-20">
        <Header title="📅 Calendrier Voyage" onBack={() => setCurrentScreen('main')} />
        
        <div className="p-4 space-y-4">
          
          {/* Bouton AJOUTER ÉVÉNEMENT en haut */}
          <button
            onClick={() => setShowEventModal(true)}
            className="w-full p-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl shadow-lg active:scale-95 transition-transform flex items-center justify-center space-x-2"
          >
            <Plus size={24} />
            <span className="font-semibold text-lg">Ajouter un événement</span>
          </button>
          
          {/* Résumé */}
          {calendarDays.length > 0 && (
            <div className="bg-white rounded-xl p-4 shadow-lg">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-600">Durée du voyage</p>
                  <p className="text-2xl font-bold text-blue-600">{calendarDays.length} jours</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600">Événements</p>
                  <p className="text-2xl font-bold text-purple-600">{tripEvents.length}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Coût total</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(totalEventCost)}</p>
                </div>
              </div>
            </div>
          )}
          
          {/* CALENDRIER AVEC CASES PAR JOUR */}
          {calendarDays.length > 0 ? (
            <div className="space-y-3">
              {calendarDays.map((day, index) => {
                const dayEvents = getEventsForDay(day);
                const dayOfWeek = day.toLocaleDateString('fr-FR', { weekday: 'short' });
                const isToday = day.toDateString() === new Date().toDateString();
                const dayNumber = index + 1;
                
                return (
                  <button
                    key={day.toISOString()} 
                    onClick={() => {
                      setSelectedDay(day);
                      setCurrentScreen('day-detail');
                    }}
                    className={`w-full border-2 rounded-xl p-4 text-left active:scale-98 transition-transform ${
                      isToday 
                        ? 'border-blue-500 bg-blue-50' 
                        : dayEvents.length > 0 
                          ? 'border-purple-300 bg-purple-50 hover:bg-purple-100'
                          : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    {/* En-tête du jour */}
                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-300">
                      <div className="flex items-center space-x-3">
                        <div className={`text-center ${isToday ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'} rounded-lg p-2 min-w-[60px]`}>
                          <div className="text-xs font-semibold uppercase">{dayOfWeek}</div>
                          <div className="text-2xl font-bold">{day.getDate()}</div>
                        </div>
                        
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-bold text-blue-600">Jour {dayNumber}</span>
                            {isToday && (
                              <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">
                                Aujourd'hui
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">
                            {day.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Événements</p>
                        <p className="text-2xl font-bold text-purple-600">{dayEvents.length}</p>
                      </div>
                    </div>
                    
                    {/* Aperçu des événements */}
                    {dayEvents.length === 0 ? (
                      <p className="text-gray-400 text-sm text-center py-2 italic">
                        Aucun événement prévu
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {dayEvents.slice(0, 3).map(event => {
                          const cat = getCategoryInfo(event.type);
                          return (
                            <div 
                              key={event.id} 
                              className={`flex items-center space-x-2 p-2 rounded ${cat.bgClass}`}
                            >
                              <span className="text-sm">{cat.icon}</span>
                              <span className={`text-sm font-medium ${cat.textClass} flex-1 truncate`}>
                                {event.title}
                              </span>
                              <span className="text-xs text-gray-600">{event.timeStart}</span>
                            </div>
                          );
                        })}
                        {dayEvents.length > 3 && (
                          <p className="text-xs text-gray-500 text-center pt-1">
                            + {dayEvents.length - 3} autre(s)
                          </p>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="bg-yellow-100 border border-yellow-300 rounded-xl p-6 text-center">
              <Calendar size={48} className="mx-auto text-yellow-600 mb-3" />
              <p className="text-yellow-800 font-semibold">Configurez d'abord les dates du voyage</p>
              <p className="text-yellow-700 text-sm mt-1">
                Cliquez sur le bouton ci-dessous
              </p>
            </div>
          )}
          
          {/* Bouton CHANGER LES DATES en bas */}
          <button
            onClick={() => setCurrentScreen('edit-dates')}
            className="w-full p-4 bg-white border-2 border-gray-300 rounded-xl shadow-md active:scale-95 transition-transform flex items-center justify-center space-x-2"
          >
            <Calendar size={20} className="text-gray-600" />
            <span className="font-semibold text-gray-700">
              {calendarDays.length > 0 ? 'Modifier les dates' : 'Configurer les dates'}
            </span>
          </button>
        </div>
        
        {/* Modal ajout événement */}
        <EventModal 
          isOpen={showEventModal} 
          onClose={() => setShowEventModal(false)}
        />
      </div>
    );
  }
  
  // ============================================
  // 📆 ÉCRAN MODIFICATION DES DATES
  // ============================================
  
  if (currentScreen === 'edit-dates') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50">
        <Header title="📆 Dates du Voyage" onBack={() => setCurrentScreen('calendar')} />
        
        <div className="p-4">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-md mx-auto">
            <h3 className="font-bold text-gray-800 mb-4">⚙️ Configuration de la période</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  📅 Date de départ
                </label>
                <input
                  type="date"
                  value={tripSettings.startDate}
                  onChange={(e) => setTripSettings({...tripSettings, startDate: e.target.value})}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  📅 Date de retour
                </label>
                <input
                  type="date"
                  value={tripSettings.endDate}
                  onChange={(e) => setTripSettings({...tripSettings, endDate: e.target.value})}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                />
              </div>
              
              {tripSettings.startDate && tripSettings.endDate && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    <strong>Durée :</strong>{' '}
                    {Math.ceil((new Date(tripSettings.endDate) - new Date(tripSettings.startDate)) / (1000 * 60 * 60 * 24)) + 1} jours
                  </p>
                </div>
              )}
              
              <button
                onClick={() => {
                  saveTripSettings(tripSettings);
                  setCurrentScreen('calendar');
                }}
                disabled={!tripSettings.startDate || !tripSettings.endDate}
                className="w-full p-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg active:scale-95 transition-transform font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                💾 Sauvegarder et retour
              </button>
              
              <button
                onClick={() => setCurrentScreen('calendar')}
                className="w-full p-3 bg-gray-200 text-gray-700 rounded-lg active:scale-95 transition-transform"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // ============================================
  // 📱 VUE DÉTAILLÉE D'UN JOUR
  // ============================================
  
  if (currentScreen === 'day-detail' && selectedDay) {
    return <DayDetailScreen 
  day={selectedDay} 
  onBack={() => setCurrentScreen('calendar')}
  tripSettings={tripSettings}
/>;
  }

// FIN DU NOUVEL ÉCRAN CALENDRIER
  
  // ============================================
  // 📊 ÉCRAN GRAPHIQUE BUDGET
  // ============================================
  
  if (currentScreen === 'graph') {
    const budget = calculateBudget();
    
    // Préparer les données pour le graphique
    const categories = [
      { name: 'Finances initiales', value: budget.totalFinance, color: 'bg-blue-500' },
      { name: 'Dépenses avant', value: budget.beforeExpenses, color: 'bg-orange-500' },
      { name: 'Budget disponible', value: budget.budgetAvailable, color: 'bg-green-500' },
      { name: 'Dépenses pendant', value: budget.duringExpenses, color: 'bg-purple-500' },
      { name: 'Reste', value: Math.max(0, budget.budgetRemaining), color: 'bg-teal-500' }
    ];
    
    const maxValue = Math.max(...categories.map(c => c.value));
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 pb-20">
        <Header title="📊 Graphique Budget" onBack={() => setCurrentScreen('main')} />
        
        <div className="p-4 space-y-4">
          {/* Résumé en chiffres */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">💰 Résumé Financier</h2>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <span className="font-semibold text-gray-700">Finances totales</span>
                <span className="text-xl font-bold text-blue-600">{formatCurrency(budget.totalFinance)}</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                <span className="font-semibold text-gray-700">- Dépenses préliminaires</span>
                <span className="text-xl font-bold text-orange-600">{formatCurrency(budget.beforeExpenses)}</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg border-2 border-green-300">
                <span className="font-bold text-gray-800">= Budget voyage</span>
                <span className="text-2xl font-bold text-green-600">{formatCurrency(budget.budgetAvailable)}</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                <span className="font-semibold text-gray-700">- Dépensé pendant</span>
                <span className="text-xl font-bold text-purple-600">{formatCurrency(budget.duringExpenses)}</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-teal-50 rounded-lg border-2 border-teal-300">
                <span className="font-bold text-gray-800">= Reste</span>
                <span className={`text-2xl font-bold ${budget.budgetRemaining >= 0 ? 'text-teal-600' : 'text-red-600'}`}>
                  {formatCurrency(budget.budgetRemaining)}
                </span>
              </div>
            </div>
          </div>
          
          {/* Graphique en barres */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="font-bold text-gray-800 mb-4">📊 Visualisation</h3>
            
            <div className="space-y-4">
              {categories.map((cat, index) => (
                <div key={index}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{cat.name}</span>
                    <span className="font-bold text-gray-800">{formatCurrency(cat.value)}</span>
                  </div>
                  <div className="h-8 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${cat.color} transition-all duration-1000`}
                      style={{ width: `${(cat.value / maxValue) * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Alerte budget */}
          {budget.percentUsed >= 80 && (
            <div className="bg-red-100 border border-red-300 p-4 rounded-xl">
              <p className="text-red-800 font-semibold">
                ⚠️ Attention ! Vous avez utilisé {budget.percentUsed.toFixed(0)}% de votre budget.
              </p>
            </div>
          )}
          
          {budget.budgetRemaining < 0 && (
            <div className="bg-red-100 border border-red-300 p-4 rounded-xl">
              <p className="text-red-800 font-semibold">
                🚨 Budget dépassé de {formatCurrency(Math.abs(budget.budgetRemaining))} !
              </p>
            </div>
          )}
          
          {/* Statistiques */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="font-bold text-gray-800 mb-4">📈 Statistiques</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <p className="text-sm text-gray-600">Dépenses totales</p>
                <p className="text-xl font-bold text-purple-600">
                  {formatCurrency(budget.beforeExpenses + budget.duringExpenses)}
                </p>
              </div>
              
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600">Nb dépenses</p>
                <p className="text-xl font-bold text-blue-600">{tripExpenses.length}</p>
              </div>
              
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-sm text-gray-600">Dépense moyenne</p>
                <p className="text-xl font-bold text-green-600">
                  {tripExpenses.length > 0 
                    ? formatCurrency((budget.beforeExpenses + budget.duringExpenses) / tripExpenses.length)
                    : formatCurrency(0)
                  }
                </p>
              </div>
              
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <p className="text-sm text-gray-600">Budget utilisé</p>
                <p className="text-xl font-bold text-orange-600">{budget.percentUsed.toFixed(0)}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Par défaut, vérifier si authentifié
  if (tripSettings.passwordProtected && !tripAuthenticated) {
    setCurrentScreen('password');
  } else if (currentScreen !== 'main') {
    setCurrentScreen('main');
  }
  
  return null;
};

export default TripManager;