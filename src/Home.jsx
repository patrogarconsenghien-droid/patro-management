import React from 'react';
import { Beer, Wrench, Coins, Plane, Settings, WifiOff, LogOut, Clock, MapPin } from 'lucide-react';
import { SECTIONS, canManage, firstNameOf } from './auth/account';
import Modal from './components/Modal';
import SeasonBanner from './components/SeasonBanner';
import NotificationPrompt from './components/NotificationPrompt';
import AnimatedAmount from './components/AnimatedAmount';
import { formatDate, plural, roundHours } from './lib/format';
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

const todayIso = () => new Date().toISOString().split('T')[0];

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
  backToActiveSeason,
  isSupported,
  permission,
  requestPermission,
  account,
  scheduledJobs = [],
  jobs = [],
  bros = [],
  sectionId
}) => {
  const profile = account?.profile;
  const manager = canManage(profile);
  const firstName = firstNameOf(profile);
  const myBroId = profile?.broId || null;

  // Mes prochains boulots : ceux à venir où je suis inscrit.
  const today = todayIso();
  const upcoming = scheduledJobs
    .filter((job) => job.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.timeStart).localeCompare(String(b.timeStart)));
  const myNext = myBroId
    ? upcoming.filter((job) => (job.registeredBros || []).some((reg) => reg.broId === myBroId)).slice(0, 3)
    : [];
  // Boulots qui cherchent du monde, où je n'ai pas encore répondu.
  const openForMe = upcoming.filter((job) =>
    (job.registeredBros || []).length < job.brosNeeded &&
    !(job.registeredBros || []).some((reg) => reg.broId === myBroId) &&
    !(job.unavailableBros || []).some((u) => u.broId === myBroId)
  ).length;

  // Mes stats : heures de la saison et classement parmi les Bro.
  const hoursByBro = new Map();
  jobs.forEach((job) => {
    if (!job.broId) return;
    hoursByBro.set(job.broId, (hoursByBro.get(job.broId) || 0) + (Number(job.hours) || 0));
  });
  const myHours = roundHours(hoursByBro.get(myBroId) || 0);
  const ranking = bros
    .map((bro) => ({ id: bro.id, hours: hoursByBro.get(bro.id) || 0 }))
    .sort((a, b) => b.hours - a.hours);
  const myRank = myBroId ? ranking.findIndex((r) => r.id === myBroId) + 1 : 0;

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
              {SECTIONS[sectionId] ? `${SECTIONS[sectionId]} · ` : ''}{seasonLabel(viewedSeasonId)}
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
          {greeting()}{firstName ? `, ${firstName}` : ''}
        </h1>
      </div>

      <div className="px-4 mb-3 empty:hidden">
        <NotificationPrompt
          isSupported={isSupported}
          permission={permission}
          requestPermission={requestPermission}
        />
      </div>

      {!myBroId && (
        <div className="px-4 mb-3">
          <p className="text-sm text-orange-800 bg-orange-50 rounded-2xl p-3">
            Ton compte n'est pas relié à ton nom de Bro : tes boulots et tes stats n'apparaissent pas.
            {manager ? ' Fais-le dans Réglages → Comptes.' : ' Demande à un animateur de le faire.'}
          </p>
        </div>
      )}

      {/* Mes prochains boulots */}
      <div className="px-4 mb-3">
        <div className="bg-white rounded-[22px] shadow-sm ring-1 ring-gray-200 p-4">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="font-display text-lg font-bold">Mes prochains boulots</h2>
            <button onClick={() => navigateTo('boulots-scheduled')} className="text-sm font-semibold text-boulots-600">
              Tout voir →
            </button>
          </div>

          {myNext.length === 0 ? (
            <p className="text-sm text-gray-500">Tu n'es inscrit à aucun boulot à venir.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {myNext.map((job) => (
                <li key={job.id}>
                  <button
                    onClick={() => navigateTo('boulots-scheduled')}
                    className="w-full py-2.5 text-left flex items-start gap-3"
                  >
                    <span className="flex-none w-11 text-center rounded-xl bg-boulots-50 text-boulots-700 py-1">
                      <span className="block font-display text-lg font-extrabold leading-none">{job.date.slice(8, 10)}</span>
                      <span className="block text-[10px] uppercase tracking-wide">
                        {new Date(job.date).toLocaleDateString('fr-BE', { month: 'short' }).replace('.', '')}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold truncate">{job.description}</span>
                      <span className="block text-xs text-gray-500 truncate">
                        <Clock size={11} className="inline -mt-0.5 mr-1" />{job.timeStart || '—'}
                        {job.location && <><span className="mx-1">·</span><MapPin size={11} className="inline -mt-0.5 mr-1" />{job.location}</>}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {openForMe > 0 && (
            <button
              onClick={() => navigateTo('boulots-scheduled')}
              className="mt-3 w-full py-2.5 rounded-xl bg-boulots-500 text-white text-sm font-bold active:scale-95 transition-transform"
            >
              {plural(openForMe, 'boulot cherche', 'boulots cherchent')} du monde — répondre
            </button>
          )}
        </div>
      </div>

      {/* Mes stats */}
      {myBroId && (
        <div className="px-4 mb-3 grid grid-cols-2 gap-3">
          <button onClick={() => navigateTo('boulots-stats')} className="bg-white rounded-[22px] shadow-sm ring-1 ring-gray-200 p-4 text-left active:scale-95 transition-transform">
            <p className="text-xs text-gray-500">Mes heures cette saison</p>
            <p className="font-display text-3xl font-extrabold tracking-tight mt-1">{myHours} h</p>
          </button>
          <button onClick={() => navigateTo('boulots-stats')} className="bg-white rounded-[22px] shadow-sm ring-1 ring-gray-200 p-4 text-left active:scale-95 transition-transform">
            <p className="text-xs text-gray-500">Mon classement</p>
            <p className="font-display text-3xl font-extrabold tracking-tight mt-1">
              {myRank > 0 ? `${myRank}e` : '—'}
              <span className="text-base font-semibold text-gray-400"> / {ranking.length}</span>
            </p>
          </button>
        </div>
      )}

      <div className="px-4 grid grid-cols-2 gap-3">
        <Tile index={0} onClick={() => navigateTo('boulots')} icon={Wrench} title="Boulots" className="col-span-2 bg-boulots-500 text-white">
          <span className="block text-sm text-white/90 mt-1.5">
            {manager && stats.unpaidJobs > 0
              ? `${stats.unpaidJobs} à payer · programmer, valider, stats`
              : 'Programmer, valider, stats'}
          </span>
        </Tile>

        {manager && (<>
        <Tile index={1} onClick={() => navigateTo('bar')} icon={Beer} title="Bar" className="bg-bar-500 text-white">
          <span className="block text-sm text-white/90 mt-1.5">
            {stats.openSlates > 0 ? plural(stats.openSlates, 'ardoise ouverte', 'ardoises ouvertes') : 'Aucune ardoise'}
            {stats.debtTotal < 0 && (
              <AnimatedAmount value={Math.abs(stats.debtTotal)} className="block font-display text-xl font-extrabold tracking-tight mt-0.5" />
            )}
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
          <span className="block text-sm text-gray-600 mt-1.5">Comptes, carte, saison</span>
        </Tile>
        </>)}
      </div>

      <div className="px-5 mt-8 flex items-center justify-between gap-3 text-sm text-gray-500">
        <span className="truncate">{profile?.email}</span>
        <button
          onClick={() => { if (confirm("Te déconnecter de l'app ?")) account?.signOut(); }}
          className="flex-none flex items-center gap-1.5 font-semibold text-gray-700 active:scale-95 transition-transform"
        >
          <LogOut size={16} />
          Se déconnecter
        </button>
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
