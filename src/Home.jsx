import React from 'react';
import { Beer, Wrench, Coins, Plane, Settings, WifiOff } from 'lucide-react';
import Modal from './components/Modal';
import SeasonBanner from './components/SeasonBanner';
import AnimatedAmount from './components/AnimatedAmount';
import { plural } from './lib/format';
import { seasonLabel } from './lib/seasons';

const greeting = () => {
  const hour = new Date().getHours();
  return hour >= 18 || hour < 5 ? 'Bonsoir' : 'Bonjour';
};

/** Grande tuile de section, cousue comme un écusson. */
const Tile = ({ className = '', index, onClick, icon: Icon, title, children }) => (
  <button
    onClick={onClick}
    style={{ animationDelay: `${index * 70}ms` }}
    className={`stitch tile-press animate-rise text-left rounded-[22px] p-4 min-h-[118px] flex flex-col justify-between gap-5 shadow-md ${className}`}
  >
    <span className="tile-icon w-9 h-9 rounded-xl grid place-items-center">
      <Icon size={19} />
    </span>
    <span className="block">
      <span className="block font-display text-xl font-bold leading-none">{title}</span>
      {children}
    </span>
  </button>
);

const Home = ({
  navigateTo,
  tripPasswordProtected,
  settingsAuthenticated,
  showModal,
  modalType,
  setShowModal,
  setModalType,
  randomTripMessage,
  isOnline,
  stats = { debtTotal: 0, openSlates: 0, unpaidJobs: 0 },
  viewedSeasonId,
  isViewingArchive,
  backToActiveSeason
}) => {
  const openTrip = () => {
    if (tripPasswordProtected && !settingsAuthenticated) {
      setModalType('trip-locked');
      setShowModal(true);
    } else {
      navigateTo('trip');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <header className="app-header sticky top-0 z-30 bg-gray-50/85 backdrop-blur-md">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          {viewedSeasonId ? (
            <span className="font-mono text-xs px-2.5 py-1 rounded-full bg-white ring-1 ring-gray-200 text-gray-600">
              {seasonLabel(viewedSeasonId)}
            </span>
          ) : <span />}
          {isOnline ? (
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 ring-4 ring-green-500/20" title="En ligne" />
          ) : (
            <WifiOff size={16} className="text-red-500" aria-label="Hors ligne" />
          )}
        </div>
        {isViewingArchive && (
          <SeasonBanner seasonId={viewedSeasonId} onBackToActive={backToActiveSeason} />
        )}
      </header>

      <div className="px-5 pt-3 pb-5">
        <p className="text-sm text-gray-600">Gestion Patro</p>
        <h1 className="font-display text-4xl font-extrabold tracking-tight leading-none mt-1">
          {greeting()}
        </h1>
      </div>

      <div className="px-4 grid grid-cols-2 gap-3">
        <Tile
          index={0}
          onClick={() => navigateTo('bar')}
          icon={Beer}
          title="Bar"
          className="col-span-2 bg-bar-500 text-white"
        >
          <span className="flex items-end justify-between gap-3 mt-2">
            <span className="text-sm text-white/90">
              {stats.openSlates > 0
                ? `${plural(stats.openSlates, 'ardoise ouverte', 'ardoises ouvertes')}`
                : 'Aucune ardoise en négatif'}
            </span>
            {stats.debtTotal < 0 && (
              <span className="text-right leading-none">
                <AnimatedAmount
                  value={Math.abs(stats.debtTotal)}
                  className="block font-display text-3xl font-extrabold tracking-tight"
                />
                <span className="text-xs text-white/85">à récupérer</span>
              </span>
            )}
          </span>
        </Tile>

        <Tile index={1} onClick={() => navigateTo('boulots')} icon={Wrench} title="Boulots" className="bg-boulots-500 text-white">
          <span className="block text-sm text-white/90 mt-1.5">
            {stats.unpaidJobs > 0 ? `${stats.unpaidJobs} à payer` : 'Tout est payé'}
          </span>
        </Tile>

        <Tile index={2} onClick={() => navigateTo('finance')} icon={Coins} title="Finance" className="bg-finance-500 text-white">
          <span className="block text-sm text-white/90 mt-1.5">Caisse et comptes</span>
        </Tile>

        <Tile index={3} onClick={openTrip} icon={Plane} title="Voyage" className="bg-voyage-500 text-white">
          <span className="block text-sm text-white/90 mt-1.5">
            {tripPasswordProtected ? 'Protégé' : 'Dépenses, calendrier'}
          </span>
        </Tile>

        <Tile
          index={4}
          onClick={() => navigateTo(settingsAuthenticated ? 'settings' : 'settings-password')}
          icon={Settings}
          title="Réglages"
          className="stitch-quiet bg-white text-gray-900 ring-1 ring-gray-200 [&_.tile-icon]:bg-purple-500/15 [&_.tile-icon]:text-purple-600"
        >
          <span className="block text-sm text-gray-600 mt-1.5">Carte, stock, saison</span>
        </Tile>
      </div>

      <Modal
        isOpen={showModal && modalType === 'trip-locked'}
        onClose={() => setShowModal(false)}
        title="Section verrouillée"
      >
        <div className="space-y-4">
          <div className="bg-pink-50 p-5 rounded-2xl text-center">
            <div className="text-5xl mb-3" aria-hidden="true">🔒</div>
            {randomTripMessage && (
              <>
                <h3 className="text-xl font-bold text-pink-800 mb-2">{randomTripMessage.title}</h3>
                <p className="text-sm text-pink-700">{randomTripMessage.description}</p>
              </>
            )}
          </div>

          <button
            onClick={() => setShowModal(false)}
            className="w-full p-3 bg-voyage-500 text-white rounded-2xl font-semibold active:scale-95 transition-transform"
          >
            Fermer
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default Home;
