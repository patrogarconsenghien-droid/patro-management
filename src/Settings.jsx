import React, { useState } from 'react';
import {
  Beer, BarChart3, Bell, Clock, Download, FileText, History, Plane, Plus, Settings, Trash2
} from 'lucide-react';
import Modal from './components/Modal';
import HeaderBase from './components/Header';
import SeasonBanner from './components/SeasonBanner';
import AnnualReport from './AnnualReport';
import CloseSeason from './CloseSeason';
import RepairBalances from './RepairBalances';
import { formatCurrency, formatDate } from './lib/format';
import { buildAnnualReport, getCurrentPatroYear } from './lib/annualReport';
import { seasonLabel, startYearOf } from './lib/seasons';
import { downloadReport } from './lib/reportExport';

const SettingsDomain = ({
  screen,
  navigateTo,
  loading,
  isOnline,
  showModal,
  modalType,
  setShowModal,
  setModalType,
  settingsAuthenticated,
  setSettingsAuthenticated,
  hourlyRate,
  setHourlyRate,
  surpriseSettings,
  setSurpriseSettings,
  rarityWeights,
  updateProductWeight,
  saveSurpriseSettings,
  barOpenThreshold,
  setBarOpenThreshold,
  popularProducts,
  setPopularProducts,
  financialGoal,
  setFinancialGoal,
  products,
  setProducts,
  categories,
  orders,
  setOrders,
  jobs,
  setJobs,
  financialTransactions,
  setFinancialTransactions,
  members,
  setMembers,
  bros,
  setBros,
  stockMovements,
  updateStock,
  getStockStatus,
  updateInFirebase,
  deleteFromFirebase,
  saveToFirebase,
  isSupported,
  permission,
  requestPermission,
  tripPasswordProtected,
  setTripPasswordProtected,
  activeSeasonId,
  viewedSeasonId,
  seasons = [],
  isViewingArchive = false,
  selectSeason,
  backToActiveSeason,
}) => {
  const Header = ({ title, onBack }) => (
    <>
      <HeaderBase title={title} onBack={onBack} loading={loading} isOnline={isOnline} />
      {isViewingArchive && (
        <SeasonBanner seasonId={viewedSeasonId} onBackToActive={backToActiveSeason} />
      )}
    </>
  );

  // Génération en un clic : la saison actuellement consultée, sans rien
  // demander. On se cale sur la saison plutôt que sur la date du jour, sinon
  // un 17 août viserait la saison qui vient de démarrer et qui est vide.
  // L'écran dédié reste là pour choisir une autre période.
  const patroYear = viewedSeasonId ? startYearOf(viewedSeasonId) : getCurrentPatroYear();

  const generateCurrentReport = () => {
    const report = buildAnnualReport({
      year: patroYear,
      mode: 'patro',
      orders,
      jobs,
      financialTransactions,
      members,
      bros,
      products,
      stockMovements
    });

    if (report.meta.isEmpty) {
      alert(
        `Aucune donnée pour la saison ${patroYear}–${patroYear + 1}.\n` +
        'Ouvre le rapport annuel pour choisir une autre période.'
      );
      return;
    }

    downloadReport(report);

    alert(
      `📊 Rapport ${patroYear}–${patroYear + 1} généré !\n\n` +
      `Encaissé : ${formatCurrency(report.summary.totalIn)}\n` +
      `Dépensé : ${formatCurrency(report.summary.expenseTotal)}\n` +
      `Résultat : ${formatCurrency(report.summary.netResult)}\n\n` +
      'Le fichier est dans tes téléchargements.'
    );
  };

  // ===== ÉTAT LOCAL AUX ÉCRANS SETTINGS =====
  const [passwordInput, setPasswordInput] = useState('');
  const [newThreshold, setNewThreshold] = useState(barOpenThreshold.toString());
  const [newProduct, setNewProduct] = useState({
    name: '', price: '', category: 'Boissons', stock: '', stockType: 'unit',
    packSize: 1, pricePerPack: '', pricePer11: '', alertThreshold: 5,
    moneyFlow: 'none', amount: '', paymentMethod: ''
  });
  const [editingProduct, setEditingProduct] = useState(null);
  const [showExternalPrice, setShowExternalPrice] = useState(false);
  const [stockAdjustment, setStockAdjustment] = useState({
    productId: '', quantity: '', type: 'add', reason: '',
    moneyFlow: 'none', amount: '', paymentMethod: ''
  });
  const [newRate, setNewRate] = useState(hourlyRate.toString());
  const [newGoal, setNewGoal] = useState({
    amount: '',
    description: '',
    deadline: ''
  });
  const [tempPopularProducts, setTempPopularProducts] = useState([]);

  // ===== HANDLERS PROPRES À SETTINGS =====
  const activerNotifications = async () => {
    const result = await requestPermission();
    if (result === 'granted') {
      alert('✅ Notifications activées !');
    } else {
      alert('❌ Permission refusée');
    }
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
        externalPrice: parseFloat(newProduct.externalPrice) || price,
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
        externalPrice: parseFloat(newProduct.externalPrice) || price,
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

  if (screen === 'settings-password') {
    const handlePasswordSubmit = () => {
      if (passwordInput === '2107') {
        setSettingsAuthenticated(true);
        setPasswordInput('');
        navigateTo('settings');
      } else {
        alert('❌ Mot de passe incorrect !');
        setPasswordInput('');
      }
    };

    const handleKeyPress = (e) => {
      if (e.key === 'Enter') {
        handlePasswordSubmit();
      }
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-purple-100">
        <Header title="Accès Paramètres" onBack={() => navigateTo('home')} />

        <div className="p-6 flex items-center justify-center min-h-[60vh]">
          <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">🔒</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Zone Protégée</h2>
              <p className="text-gray-600">Accès aux paramètres restreint</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🔑 Mot de passe *
                </label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Entrez le mot de passe"
                  className="w-full p-4 border-2 border-purple-200 rounded-lg text-center text-lg font-mono tracking-wider focus:border-purple-500 focus:outline-none"
                  autoFocus
                />
              </div>

              <button
                onClick={handlePasswordSubmit}
                disabled={!passwordInput.trim()}
                className="w-full p-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed active:scale-95 transition-transform"
              >
                🚀 Déverrouiller
              </button>

              <div className="text-center">
                <button
                  onClick={() => navigateTo('home')}
                  className="text-purple-600 hover:text-purple-800 text-sm"
                >
                  ← Retour à l'accueil
                </button>
              </div>
            </div>

            {/* Indices visuels */}
            <div className="mt-6 p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <p className="text-xs text-purple-700 text-center">
                💡 Protection contre les modifications accidentelles
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'settings') {
    if (!settingsAuthenticated) {
      navigateTo('settings-password');
      return null;
    }
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

          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <button
              onClick={generateCurrentReport}
              className="w-full p-4 active:scale-95 transition-transform"
            >
              <div className="flex items-center space-x-3">
                <Download className="text-purple-500" size={24} />
                <div className="text-left">
                  <h3 className="font-semibold">📊 Générer le rapport {patroYear}–{patroYear + 1}</h3>
                  <p className="text-gray-600 text-sm">
                    Bilan complet de la saison, téléchargé directement
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => navigateTo('settings-report')}
              className="w-full px-4 py-3 border-t border-gray-100 text-sm text-purple-600 active:scale-95 transition-transform"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center space-x-2">
                  <FileText size={16} />
                  <span>Voir le détail ou choisir une autre année</span>
                </span>
                <span className="text-gray-400">→</span>
              </div>
            </button>
          </div>
          {/* --- NOUVEAU BOUTON VERRE SURPRISE --- */}
          <button
            onClick={() => navigateTo('settings-surprise')}
            className="w-full p-4 bg-white rounded-lg shadow-md active:scale-95 transition-transform flex items-center space-x-3"
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center space-x-3">
                <Beer className="text-purple-500" size={24} />
                <div>
                  <h3 className="font-semibold">🎲 Verre Surprise</h3>
                  <p className="text-gray-600 text-sm">Configurer le tirage aléatoire</p>
                </div>
              </div>
              <span className="text-gray-400">→</span>
            </div>
          </button>

          {/* Protection Voyage */}
          <button
            onClick={async () => {
              const newValue = !tripPasswordProtected;

              try {
                // Sauvegarder dans Firebase
                await saveToFirebase('tripSettings', {
                  isProtected: newValue,
                  updatedAt: new Date().toISOString()
                });

                // Mettre à jour l'état local
                setTripPasswordProtected(newValue);

                alert(newValue
                  ? '🔒 Section Voyage protégée !\nAuthentification requise pour y accéder.'
                  : '🔓 Section Voyage accessible sans authentification.');
              } catch (error) {
                console.error('Erreur sauvegarde protection Voyage:', error);
                alert('Erreur lors de la sauvegarde');
              }
            }}
            className="w-full p-4 bg-white rounded-lg shadow-md active:scale-95 transition-transform"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Plane className="text-orange-500" size={24} />
                <div className="text-left">
                  <p className="font-semibold">Protection Voyage</p>
                  <p className="text-sm text-gray-600">
                    {tripPasswordProtected ? '🔒 Activée' : '🔓 Désactivée'}
                  </p>
                </div>
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
          <button
            onClick={() => navigateTo('settings-bar-threshold')}
            className="w-full p-4 bg-white rounded-lg shadow-md active:scale-95 transition-transform"
          >
            <div className="flex items-center space-x-3">
              <span className="text-purple-500 text-2xl">🍺</span>
              <div className="text-left">
                <h3 className="font-semibold">Seuil Ouverture Bar</h3>
                <p className="text-gray-600 text-sm">
                  Actuellement : {barOpenThreshold} bouteilles minimum
                </p>
              </div>
            </div>
          </button>

          {/* Bloc saison, volontairement tout en bas : on ne consulte une
              archive et on ne clôture qu'exceptionnellement. */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center space-x-3">
              <History className="text-purple-500" size={24} />
              <div className="text-left">
                <h3 className="font-semibold">Saison</h3>
                <p className="text-gray-600 text-sm">
                  En cours : {seasonLabel(activeSeasonId)}
                </p>
              </div>
            </div>

            {seasons.length > 1 && (
              <select
                value={viewedSeasonId}
                onChange={(e) => selectSeason(e.target.value)}
                className="w-full p-2 border rounded-lg bg-white mt-3"
              >
                {seasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {seasonLabel(season.id)}
                    {season.id === activeSeasonId ? ' — en cours' : ' — archivée'}
                  </option>
                ))}
              </select>
            )}

            {isViewingArchive && (
              <p className="text-xs text-orange-700 bg-orange-50 rounded-lg p-2 mt-3">
                Tu consultes une saison archivée. Les modifications que tu fais ici
                n'apparaissent pas dans la saison en cours.
              </p>
            )}

            <button
              onClick={() => navigateTo('settings-repair-balances')}
              className="w-full mt-3 p-2 text-sm text-purple-600 border border-purple-200 rounded-lg active:scale-95 transition-transform"
            >
              Réparer les soldes reportés
            </button>
          </div>

          <button
            onClick={() => navigateTo('settings-close-season')}
            className="w-full p-4 bg-white border-2 border-purple-200 rounded-lg shadow-md active:scale-95 transition-transform"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-purple-500 text-2xl">🎓</span>
                <div className="text-left">
                  <h3 className="font-semibold">Clôturer la saison</h3>
                  <p className="text-gray-600 text-sm">
                    Archiver {seasonLabel(activeSeasonId).toLowerCase()} et en commencer une nouvelle
                  </p>
                </div>
              </div>
              <span className="text-gray-400">→</span>
            </div>
          </button>

        </div>
        <div className="mt-6">
          <button
            onClick={() => {
              setSettingsAuthenticated(false);
              alert('🔒 Session fermée ! Vous devrez ressaisir le mot de passe.');
              navigateTo('home');
            }}
            className="w-full p-4 bg-red-500 text-white rounded-lg shadow-md active:scale-95 transition-transform"
          >
            <div className="flex items-center justify-center space-x-2">
              <span>🔒</span>
              <span>Fermer la session</span>
            </div>
          </button>
        </div>


      </div>
    );
  }


  if (screen === 'settings-repair-balances') {
    return (
      <RepairBalances
        Header={Header}
        navigateTo={navigateTo}
        activeSeasonId={activeSeasonId}
        viewedSeasonId={viewedSeasonId}
        seasons={seasons}
        members={members}
        orders={orders}
        updateInFirebase={updateInFirebase}
      />
    );
  }

  if (screen === 'settings-close-season') {
    return (
      <CloseSeason
        Header={Header}
        navigateTo={navigateTo}
        activeSeasonId={activeSeasonId}
        viewedSeasonId={viewedSeasonId}
        products={products}
        members={members}
        bros={bros}
        jobs={jobs}
        orders={orders}
        financialTransactions={financialTransactions}
        barOpenThreshold={barOpenThreshold}
        hourlyRate={hourlyRate}
        surpriseSettings={surpriseSettings}
        popularProducts={popularProducts}
        financialGoal={financialGoal}
      />
    );
  }

  if (screen === 'settings-report') {
    return (
      <AnnualReport
        Header={Header}
        navigateTo={navigateTo}
        orders={orders}
        jobs={jobs}
        financialTransactions={financialTransactions}
        members={members}
        bros={bros}
        products={products}
        stockMovements={stockMovements}
      />
    );
  }

  if (screen === 'settings-surprise') {
    // ⚖️ Nouvelle table de pondération
    const rarityLabels = {
      70: "🟩 Commun",
      40: "🟦 Normal",
      15: "🟪 Rare",
      1: "🟨 Légendaire"
    };

    return (
      <div className="min-h-screen bg-gray-50">
        <Header
          title="Paramètres du Verre Surprise"
          onBack={() => navigateTo('settings')}
        />

        <div className="p-4 space-y-6">
          {/* ✅ Activation */}
          <div className="bg-white p-4 rounded-lg shadow-md">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={surpriseSettings.enabled}
                onChange={(e) =>
                  setSurpriseSettings({
                    ...surpriseSettings,
                    enabled: e.target.checked
                  })
                }
                className="w-5 h-5 mr-3"
              />
              <label className="text-sm font-medium">
                Activer le verre surprise dans la carte
              </label>
            </div>
          </div>

          {/* 💰 Prix */}
          <div className="bg-white p-4 rounded-lg shadow-md">
            <h3 className="font-semibold mb-3">💰 Prix du verre surprise</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Prix unitaire (€)
                </label>
                <input
                  type="number"
                  value={surpriseSettings.price}
                  onChange={(e) =>
                    setSurpriseSettings({
                      ...surpriseSettings,
                      price: parseFloat(e.target.value)
                    })
                  }
                  className="w-full p-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Prix par mètre (11)
                </label>
                <input
                  type="number"
                  value={surpriseSettings.pricePer11}
                  onChange={(e) =>
                    setSurpriseSettings({
                      ...surpriseSettings,
                      pricePer11: parseFloat(e.target.value)
                    })
                  }
                  className="w-full p-2 border rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* 🍺 Produits éligibles */}
          <div className="bg-white p-4 rounded-lg shadow-md">
            <h3 className="font-semibold mb-3">🍺 Produits pouvant tomber</h3>
            <div className="max-h-64 overflow-y-auto border rounded-lg p-3">
              {products.length === 0 && (
                <p className="text-gray-500 text-sm">
                  Aucun produit disponible.
                </p>
              )}
              {products.map((p) => (
                <label key={p.id} className="flex items-center mb-1">
                  <input
                    type="checkbox"
                    checked={surpriseSettings.eligibleProducts.includes(p.id)}
                    onChange={(e) => {
                      const newList = e.target.checked
                        ? [...surpriseSettings.eligibleProducts, p.id]
                        : surpriseSettings.eligibleProducts.filter(
                          (id) => id !== p.id
                        );
                      setSurpriseSettings({
                        ...surpriseSettings,
                        eligibleProducts: newList
                      });
                    }}
                    className="w-4 h-4 mr-2"
                  />
                  {p.name}
                </label>
              ))}
            </div>
          </div>

          {/* 🎯 Pondération des bières */}
          <div className="space-y-4 mt-6">
            <h3 className="font-semibold text-gray-800">
              🎯 Pondération des bières
            </h3>
            <p className="text-sm text-gray-600">
              Définit la rareté et les chances d’apparition de chaque bière lors
              d’un tirage surprise.
            </p>

            {surpriseSettings.eligibleProducts.map((pid) => {
              const product = products.find((p) => p.id === pid);
              const weight = surpriseSettings.weights?.[pid] ?? 3; // par défaut : normal

              return (
                <div
                  key={pid}
                  className="flex items-center justify-between bg-white p-3 border rounded-lg shadow-sm"
                >
                  <div>
                    <h4 className="font-medium">{product?.name}</h4>
                    <p className="text-xs text-gray-500">
                      Rareté actuelle :{" "}
                      <span className="font-semibold">
                        {rarityLabels[weight] || "❓ Inconnue"}
                      </span>
                    </p>
                  </div>

                  <select
                    value={weight}
                    onChange={(e) =>
                      setSurpriseSettings((prev) => ({
                        ...prev,
                        weights: {
                          ...prev.weights,
                          [pid]: parseFloat(e.target.value)
                        }
                      }))
                    }
                    className="border rounded-lg p-2 text-sm"
                  >
                    <option value={70}>🟩 Commun</option>
                    <option value={40}>🟦 Normal</option>
                    <option value={15}>🟪 Rare</option>
                    <option value={1}>🟨 Légendaire</option>
                  </select>
                </div>
              );
            })}
          </div>
          {/* 🌟 Produits exclusifs au verre surprise */}
          <div className="bg-white p-4 rounded-lg shadow-md">
            <h3 className="font-semibold mb-1">🌟 Produits exclusifs au verre surprise</h3>
            <p className="text-xs text-gray-500 mb-3">
              Ces produits n'apparaissent que dans le tirage surprise et ont leur propre stock.
            </p>

            {/* Liste des produits exclusifs existants */}
            {(surpriseSettings.exclusiveProducts || []).map((ep) => (
              <div key={ep.id} className="border rounded-lg p-3 mb-2 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <input
                    type="text"
                    value={ep.name}
                    onChange={(e) => {
                      const updated = surpriseSettings.exclusiveProducts.map(p =>
                        p.id === ep.id ? { ...p, name: e.target.value } : p
                      );
                      setSurpriseSettings({ ...surpriseSettings, exclusiveProducts: updated });
                    }}
                    placeholder="Nom du produit"
                    className="flex-1 border rounded p-1 text-sm mr-2"
                  />
                  <button
                    onClick={() => {
                      const updated = surpriseSettings.exclusiveProducts.filter(p => p.id !== ep.id);
                      setSurpriseSettings({ ...surpriseSettings, exclusiveProducts: updated });
                    }}
                    className="text-red-500 font-bold text-lg px-2"
                  >
                    🗑️
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  {/* Stock */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">Stock :</span>
                    <button
                      onClick={() => {
                        const updated = surpriseSettings.exclusiveProducts.map(p =>
                          p.id === ep.id ? { ...p, stock: Math.max(0, (p.stock || 0) - 1) } : p
                        );
                        setSurpriseSettings({ ...surpriseSettings, exclusiveProducts: updated });
                      }}
                      className="w-7 h-7 bg-red-100 text-red-600 rounded font-bold"
                    >−</button>
                    <span className="w-8 text-center font-semibold">{ep.stock || 0}</span>
                    <button
                      onClick={() => {
                        const updated = surpriseSettings.exclusiveProducts.map(p =>
                          p.id === ep.id ? { ...p, stock: (p.stock || 0) + 1 } : p
                        );
                        setSurpriseSettings({ ...surpriseSettings, exclusiveProducts: updated });
                      }}
                      className="w-7 h-7 bg-green-100 text-green-600 rounded font-bold"
                    >+</button>
                  </div>

                  {/* Rareté */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">Rareté :</span>
                    <select
                      value={surpriseSettings.weights?.[ep.id] ?? 40}
                      onChange={(e) =>
                        setSurpriseSettings(prev => ({
                          ...prev,
                          weights: { ...prev.weights, [ep.id]: parseFloat(e.target.value) }
                        }))
                      }
                      className="border rounded p-1 text-xs"
                    >
                      <option value={70}>🟩 Commun</option>
                      <option value={40}>🟦 Normal</option>
                      <option value={15}>🟪 Rare</option>
                      <option value={1}>🟨 Légendaire</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}

            {/* Bouton pour ajouter un nouveau produit exclusif */}
            <button
              onClick={() => {
                const newProduct = {
                  id: 'excl_' + Date.now(),
                  name: '',
                  stock: 0
                };
                setSurpriseSettings({
                  ...surpriseSettings,
                  exclusiveProducts: [...(surpriseSettings.exclusiveProducts || []), newProduct]
                });
              }}
              className="w-full p-2 border-2 border-dashed border-purple-300 text-purple-600 rounded-lg text-sm mt-2"
            >
              ➕ Ajouter un produit exclusif
            </button>
          </div>

          {/* 💾 Bouton sauvegarde */}
          <button
            onClick={saveSurpriseSettings}
            className="w-full p-3 bg-blue-500 text-white rounded-lg active:scale-95 transition-transform"
          >
            💾 Enregistrer les paramètres
          </button>
        </div>
      </div>
    );
  }



  if (screen === 'settings-bar-threshold') {


    const saveThreshold = async () => {
      const threshold = parseInt(newThreshold);
      if (threshold > 0) {
        try {
          await saveToFirebase('barSettings', {
            openThreshold: threshold,
            updatedAt: new Date().toISOString()
          });
          setBarOpenThreshold(threshold);
          alert(`✅ Seuil mis à jour : ${threshold} bouteilles minimum`);
          navigateTo('settings');
        } catch (error) {
          console.error('Erreur sauvegarde seuil:', error);
          alert('Erreur lors de la sauvegarde');
        }
      }
    };

    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Seuil Ouverture Bar" onBack={() => navigateTo('settings')} />

        <div className="p-4 space-y-6">
          {/* Explication */}
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-800 mb-2">🍺 Seuil d'Ouverture</h3>
            <p className="text-sm text-blue-700">
              Nombre minimum de bouteilles vendues pour considérer le bar comme "ouvert"
              dans les statistiques (période de 10h à 10h le lendemain).
            </p>
          </div>

          {/* Configuration actuelle */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h3 className="font-semibold mb-3">⚙️ Configuration</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🍺 Nombre minimum de bouteilles *
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={newThreshold}
                  onChange={(e) => setNewThreshold(e.target.value)}
                  className="w-full p-3 border rounded-lg"
                  placeholder="Nombre de bouteilles"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Recommandé : entre 5 et 15 bouteilles selon la taille de votre établissement
                </p>
              </div>

              {/* Aperçu */}
              {newThreshold && parseInt(newThreshold) !== barOpenThreshold && (
                <div className="bg-yellow-50 p-3 rounded-lg">
                  <h4 className="font-medium text-yellow-800 mb-1">📊 Impact du changement :</h4>
                  <div className="text-sm text-yellow-700 space-y-1">
                    <p>• Ancien seuil : {barOpenThreshold} bouteilles</p>
                    <p>• Nouveau seuil : {newThreshold} bouteilles</p>
                    <p>• Les statistiques seront recalculées automatiquement</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Exemples */}
          <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
            <h4 className="font-semibold text-green-800 mb-2">💡 Exemples :</h4>
            <div className="text-sm text-green-700 space-y-1">
              <p>• <strong>5 bouteilles :</strong> Petite soirée privée</p>
              <p>• <strong>8 bouteilles :</strong> Soirée standard (défaut)</p>
              <p>• <strong>15 bouteilles :</strong> Grande soirée/événement</p>
              <p>• <strong>25 bouteilles :</strong> Soirée exceptionnelle uniquement</p>
            </div>
          </div>

          {/* Boutons */}
          <div className="flex space-x-3">
            <button
              onClick={() => navigateTo('settings')}
              className="flex-1 p-3 bg-gray-500 text-white rounded-lg active:scale-95 transition-transform"
            >
              Annuler
            </button>
            <button
              onClick={saveThreshold}
              disabled={!newThreshold || parseInt(newThreshold) === barOpenThreshold || parseInt(newThreshold) < 1}
              className="flex-1 p-3 bg-purple-500 text-white rounded-lg disabled:bg-gray-300 active:scale-95 transition-transform"
            >
              💾 Sauvegarder
            </button>
          </div>
        </div>
      </div>
    );
  }


  if (screen === 'settings-products') {
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
            {/* Case à cocher pour prix externe */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="hasExternalPrice"
                checked={showExternalPrice}
                onChange={(e) => setShowExternalPrice(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="hasExternalPrice" className="text-sm">
                Prix différent pour membres externes
              </label>
            </div>

            {/* Champ prix externe (conditionnel) */}
            {showExternalPrice && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  💰 Prix pour membres externes
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Prix pour externes"
                    value={newProduct.externalPrice || ''}
                    onChange={(e) => setNewProduct({ ...newProduct, externalPrice: e.target.value })}
                    className="w-full p-3 border rounded-lg pr-8"
                  />
                  <span className="absolute right-3 top-3 text-gray-500">€</span>
                </div>
              </div>
            )}

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

  if (screen === 'settings-stock') {
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


  if (screen === 'settings-rate') {


    const updateRate = async () => {
      const rate = parseFloat(newRate);
      if (!(rate > 0)) return;

      setHourlyRate(rate);
      try {
        // Sans cette écriture le tarif repartait à 10,00 € à chaque
        // rechargement de l'app.
        await saveToFirebase('jobSettings', {
          hourlyRate: rate,
          updatedAt: new Date().toISOString()
        });
        navigateTo('settings');
      } catch (error) {
        console.error('Erreur sauvegarde du tarif horaire:', error);
        alert('Le tarif est appliqué mais n\'a pas pu être enregistré.');
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

  if (screen === 'settings-history') {
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

  if (screen === 'settings-goal') {
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

  if (screen === 'settings-popular') {

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

  return null;
};

export default SettingsDomain;
