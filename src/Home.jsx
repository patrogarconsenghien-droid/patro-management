import React from 'react';
import { Beer, Wrench, DollarSign, Plane, Settings } from 'lucide-react';
import Modal from './components/Modal';
import HeaderBase from './components/Header';

const Home = ({
  navigateTo,
  tripPasswordProtected,
  settingsAuthenticated,
  showModal,
  modalType,
  setShowModal,
  setModalType,
  randomTripMessage,
  loading,
  isOnline,
}) => {
  const Header = ({ title, onBack }) => (
    <HeaderBase title={title} onBack={onBack} loading={loading} isOnline={isOnline} />
  );

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

        {/* BOUTON VOYAGE */}
        <button
          onClick={() => {
            if (tripPasswordProtected && !settingsAuthenticated) {
              setModalType('trip-locked');
              setShowModal(true);
            } else {
              navigateTo('trip');
            }
          }}
          className="w-full p-6 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl shadow-lg active:scale-95 transition-transform"
        >
          <div className="flex items-center space-x-4">
            <Plane size={32} />
            <div className="text-left">
              <h3 className="text-xl font-semibold">Section Voyage</h3>
              <p className="text-orange-100">Dépenses, calendrier, budget</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => {
            if (settingsAuthenticated) {
              navigateTo('settings');
            } else {
              navigateTo('settings-password');
            }
          }}
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
      {/* Modal - Section Voyage Bloquée */}
      <Modal
        isOpen={showModal && modalType === 'trip-locked'}
        onClose={() => setShowModal(false)}
        title="🔒 Section Bloquée"
      >
        <div className="space-y-4">
          <div className="bg-orange-50 border border-orange-200 p-5 rounded-lg text-center">
            <div className="text-6xl mb-4">🔒</div>

            {randomTripMessage && (
              <>
                <h3 className="text-xl font-semibold text-orange-800 mb-2">
                  {randomTripMessage.title}
                </h3>
                <p className="text-sm text-orange-700">
                  {randomTripMessage.description}
                </p>
              </>
            )}
          </div>

          <button
            onClick={() => setShowModal(false)}
            className="w-full p-3 bg-orange-500 text-white rounded-lg active:scale-95 transition-transform"
          >
            Fermer
          </button>
        </div>
      </Modal>

    </div>
  );
};

export default Home;
