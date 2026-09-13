import React, { useState } from 'react';
import NotificationPrompt from './components/NotificationPrompt';
import {
  BarChart3, CheckCircle, Clock, Minus, Plus, Settings, Trash2, User, Wrench
} from 'lucide-react';
import Modal from './components/Modal';
import HeaderBase from './components/Header';
import { formatCurrency, formatDate } from './lib/format';
import { canManage as canManageAccount } from './auth/account';

const BoulotsDomain = ({
  screen,
  navigateTo,
  loading,
  isOnline,
  showModal,
  modalType,
  setShowModal,
  setModalType,
  bros,
  setBros,
  jobs,
  setJobs,
  scheduledJobs,
  setScheduledJobs,
  hourlyRate,
  isSupported,
  permission,
  requestPermission,
  account,
  newJob,
  setNewJob,
  paymentMethod,
  setPaymentMethod,
  saveToFirebase,
  updateInFirebase,
  deleteFromFirebase,
}) => {
  const Header = ({ title, onBack }) => (
    <HeaderBase title={title} onBack={onBack} loading={loading} isOnline={isOnline} />
  );

  // Un animé ne voit que les boulots programmés, et ne répond que pour lui-même,
  // à travers le Bro auquel son compte est relié.
  const canManage = canManageAccount(account?.profile);
  const myBroId = account?.profile?.broId || null;
  const myUid = account?.user?.uid || null;
  // Modifier ou supprimer : les animateurs, et l'auteur pour ses propres boulots.
  const canEditJob = (job) => canManage || (myUid && job.createdBy === myUid);

  // ===== ÉTAT LOCAL AUX ÉCRANS BOULOTS =====
  const [showBroDropdown, setShowBroDropdown] = useState(false);
  const [newBroName, setNewBroName] = useState('');
  const [newScheduledJob, setNewScheduledJob] = useState({
    description: '', date: new Date().toISOString().split('T')[0],
    timeStart: '09:00', estimatedHours: 1, location: '', contactName: '', contactPhone: '', customRate: 10.00, brosNeeded: 1,
    registeredBros: [], status: 'planned'
  });
  const [editingScheduledJob, setEditingScheduledJob] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);

  // ===== HELPER LOCAL =====
  // Contact du boulot : « Nom · 0470 12 34 56 », ou vide s'il n'y en a pas.
  const contactLine = (job) => [job.contactName, job.contactPhone].filter(Boolean).join(' · ');
  const telHref = (phone) => `tel:${String(phone).replace(/[^\d+]/g, '')}`;

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

  // ===== HANDLERS PROPRES À BOULOTS =====
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

  // NOUVELLE FONCTION : Créer un lien Google Calendar
  const createGoogleCalendarLink = (job) => {
    const startDate = new Date(`${job.date}T${job.timeStart || '09:00'}:00`);
    const endDate = new Date(startDate.getTime() + (job.estimatedHours || 1) * 60 * 60 * 1000);

    // Format: YYYYMMDDTHHMMSS
    const formatDate = (date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: `🔧 ${job.description}`,
      dates: `${formatDate(startDate)}/${formatDate(endDate)}`,
      details: `
Boulot Patro:
📝 ${job.description}
💰 Tarif: ${formatCurrency(job.customRate)}/h
⏱️ Durée estimée: ${job.estimatedHours}h
👥 Bro requis: ${job.brosNeeded}
📍 Lieu: ${job.location || 'À préciser'}${contactLine(job) ? `\n📞 Contact: ${contactLine(job)}` : ''}

Bro inscrits (${job.registeredBros.length}/${job.brosNeeded}):
${job.registeredBros.map(reg => {
        const bro = bros.find(b => b.id === reg.broId);
        return `• ${bro?.name || 'Inconnu'}`;
      }).join('\n')}

💸 Coût total estimé: ${formatCurrency(job.customRate * job.estimatedHours * job.brosNeeded)}
    `.trim(),
      location: job.location || ''
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
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

  const addScheduledJob = async () => {
    if (newScheduledJob.description.trim() && newScheduledJob.brosNeeded > 0) {
      const scheduledJob = {
        description: newScheduledJob.description.trim(),
        date: newScheduledJob.date,
        timeStart: newScheduledJob.timeStart,
        estimatedHours: newScheduledJob.estimatedHours,
        location: newScheduledJob.location.trim(),
        contactName: (newScheduledJob.contactName || '').trim(),
        contactPhone: (newScheduledJob.contactPhone || '').trim(),
        customRate: newScheduledJob.customRate,
        brosNeeded: newScheduledJob.brosNeeded,
        registeredBros: [],
        unavailableBros: [],
        status: 'planned',
        createdBy: myUid,
        createdByName: account?.profile?.displayName || null
      };

      try {
        await saveToFirebase('scheduledJobs', scheduledJob);
        setNewScheduledJob({
          description: '',
          date: new Date().toISOString().split('T')[0],
          timeStart: '09:00',
          estimatedHours: 1,
          location: '',
          contactName: '',
          contactPhone: '',
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
        contactName: (newScheduledJob.contactName || '').trim(),
        contactPhone: (newScheduledJob.contactPhone || '').trim(),
        customRate: newScheduledJob.customRate,
        brosNeeded: newScheduledJob.brosNeeded,
        // Garder les Bro déjà inscrits
        registeredBros: editingScheduledJob.registeredBros,
        unavailableBros: editingScheduledJob.unavailableBros || [],
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
          contactName: '',
          contactPhone: '',
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
        registeredBros: updatedRegisteredBros,
        // S'inscrire annule un « ne peut pas » donné plus tôt.
        unavailableBros: (job.unavailableBros || []).filter(u => u.broId !== broId)
      });

    } catch (error) {
      alert('Erreur lors de l\'inscription');
    }
  };

  /**
   * « Ne peut pas venir » : le Bro a répondu non. Il sort de la liste des
   * inscrits s'il y était, et n'apparaît plus dans « À relancer ».
   */
  const markBroUnavailable = async (jobId, broId) => {
    const job = scheduledJobs.find(j => j.id === jobId);
    if (!job) return;

    const unavailable = job.unavailableBros || [];
    if (unavailable.some(u => u.broId === broId)) return;

    try {
      await updateInFirebase('scheduledJobs', jobId, {
        registeredBros: job.registeredBros.filter(reg => reg.broId !== broId),
        unavailableBros: [...unavailable, { broId, markedAt: new Date().toISOString() }]
      });
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement de l\'indisponibilité:', error);
      alert('Erreur lors de l\'enregistrement de la réponse');
    }
  };

  /** Annule un « ne peut pas » : le Bro repasse dans « À relancer ». */
  const clearBroUnavailable = async (jobId, broId) => {
    const job = scheduledJobs.find(j => j.id === jobId);
    if (!job) return;

    try {
      await updateInFirebase('scheduledJobs', jobId, {
        unavailableBros: (job.unavailableBros || []).filter(u => u.broId !== broId)
      });
    } catch (error) {
      console.error('Erreur lors de l\'annulation de la réponse:', error);
      alert('Erreur lors de l\'annulation de la réponse');
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

  if (screen === 'boulots') {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Section Boulots" onBack={() => navigateTo('home')} />

        <div className="p-6 space-y-4">
          <NotificationPrompt
            isSupported={isSupported}
            permission={permission}
            requestPermission={requestPermission}
          />

          <button
            onClick={() => navigateTo('boulots-scheduled')}
            className="w-full p-4 bg-white rounded-lg shadow-md active:scale-95 transition-transform"
          >
            <div className="flex items-center space-x-3">
              <Clock className="text-green-500" size={24} />
              <div className="text-left">
                <h3 className="font-semibold">Boulots programmés</h3>
                <p className="text-gray-600 text-sm">Planning, inscriptions, proposer un boulot</p>
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
                <p className="text-gray-600 text-sm">Heures, gains et classement</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigateTo('boulots-validate')}
            className="w-full p-4 bg-white rounded-lg shadow-md active:scale-95 transition-transform"
          >
            <div className="flex items-center space-x-3">
              <CheckCircle className="text-green-500" size={24} />
              <div className="text-left">
                <h3 className="font-semibold">Valider les boulots</h3>
                <p className="text-gray-600 text-sm">Finaliser les boulots faits</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigateTo('boulots-history')}
            className="w-full p-4 bg-white rounded-lg shadow-md active:scale-95 transition-transform"
          >
            <div className="flex items-center space-x-3">
              <CheckCircle className="text-green-500" size={24} />
              <div className="text-left">
                <h3 className="font-semibold">Boulots terminés</h3>
                <p className="text-gray-600 text-sm">Avec statut des paiements</p>
              </div>
            </div>
          </button>

          {canManage && (<>
          <button
            onClick={() => navigateTo('boulots-new')}
            className="w-full p-4 bg-white rounded-lg shadow-md active:scale-95 transition-transform"
          >
            <div className="flex items-center space-x-3">
              <Plus className="text-green-500" size={24} />
              <div className="text-left">
                <h3 className="font-semibold">Enregistrer un boulot fait</h3>
                <p className="text-gray-600 text-sm">Heures de chacun et paiement</p>
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
          </>)}
        </div>
      </div>
    );
  }

  if (screen === 'boulots-scheduled') {
    return (
      <div className="min-h-screen bg-gray-50">



        <Header title="Boulots programmés" onBack={() => navigateTo('boulots')} />

        <div className="p-4">

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
                                    {job.createdByName && (
                                      <p className="text-xs text-gray-400">Proposé par {job.createdByName}</p>
                                    )}
                                    {(job.contactName || job.contactPhone) && (
                                      <p className="text-xs text-gray-500">
                                        📞 {job.contactName}
                                        {job.contactPhone && (
                                          <a
                                            href={telHref(job.contactPhone)}
                                            className={`text-blue-600 underline ${job.contactName ? 'ml-1' : ''}`}
                                          >
                                            {job.contactPhone}
                                          </a>
                                        )}
                                      </p>
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
                                        const calendarUrl = createGoogleCalendarLink(job);
                                        window.open(calendarUrl, '_blank');
                                      }}
                                      className="p-1 text-blue-500 hover:bg-blue-50 rounded active:scale-95 transition-transform"
                                      title="Ajouter à Google Calendar"
                                    >
                                      <span className="text-sm">📅</span>
                                    </button>
                                    {canEditJob(job) && (<>
                                    <button
                                      onClick={() => {
                                        // Pré-remplir le formulaire avec les données existantes
                                        setNewScheduledJob({
                                          description: job.description,
                                          date: job.date,
                                          timeStart: job.timeStart || '09:00',
                                          estimatedHours: job.estimatedHours || 1,
                                          location: job.location || '',
                                          contactName: job.contactName || '',
                                          contactPhone: job.contactPhone || '',
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
                                    </>)}
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
                                          {canManage && (
                                          <button
                                            onClick={() => removeBroFromScheduled(job.id, registration.broId)}
                                            className="text-red-500 hover:text-red-700"
                                            aria-label="Retirer ce Bro"
                                          >
                                            <Minus size={12} />
                                          </button>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <p className="text-xs text-gray-500 mb-3">Aucun Bro inscrit</p>
                                )}

                                {/* Réponses : qui ne peut pas, à qui demander */}
                                {(() => {
                                  const unavailableIds = new Set((job.unavailableBros || []).map(u => u.broId));
                                  const registeredIds = new Set(job.registeredBros.map(reg => reg.broId));
                                  const unavailable = bros.filter(bro => unavailableIds.has(bro.id));
                                  // À relancer : ni inscrit, ni « ne peut pas », ni déjà pris ce jour-là.
                                  const toAsk = bros.filter(bro =>
                                    !registeredIds.has(bro.id) &&
                                    !unavailableIds.has(bro.id) &&
                                    !scheduledJobs.some(otherJob =>
                                      otherJob.id !== job.id &&
                                      otherJob.date === job.date &&
                                      otherJob.registeredBros.some(reg => reg.broId === bro.id)
                                    )
                                  );

                                  return (
                                    <div className="space-y-2 mb-3">
                                      {unavailable.length > 0 && (
                                        <div>
                                          <p className="text-xs font-medium text-gray-600 mb-1">
                                            Ne peuvent pas ({unavailable.length}) :
                                          </p>
                                          <div className="flex flex-wrap gap-1.5">
                                            {unavailable.map(bro => (
                                              <span key={bro.id} className="px-2 py-0.5 rounded-full text-xs bg-gray-200 text-gray-600 line-through">
                                                {bro.name}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      {canManage && job.registeredBros.length < job.brosNeeded && toAsk.length > 0 && (
                                        <div>
                                          <p className="text-xs font-medium text-gray-600 mb-1">
                                            À relancer ({toAsk.length}) :
                                          </p>
                                          <div className="flex flex-wrap gap-1.5">
                                            {toAsk.map(bro => (
                                              <span key={bro.id} className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-800">
                                                {bro.name}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}

                                {/* Ma réponse, en grand : pour tout le monde, animateurs compris */}
                                {(() => {
                                  if (!myBroId) {
                                    return (
                                      <p className="text-xs text-orange-800 bg-orange-50 rounded-lg p-2 mb-2">
                                        Ton compte n'est pas relié à ton nom : fais-le dans Réglages → Comptes, ou demande à un animateur.
                                      </p>
                                    );
                                  }
                                  const mine = job.registeredBros.some(reg => reg.broId === myBroId);
                                  const cannot = (job.unavailableBros || []).some(u => u.broId === myBroId);
                                  const full = job.registeredBros.length >= job.brosNeeded;

                                  return (
                                    <div className="space-y-2 mb-3">
                                      <p className="text-sm font-medium text-gray-700">
                                        {mine
                                          ? '✅ Tu es inscrit'
                                          : cannot
                                            ? "✗ Tu as dit que tu ne pouvais pas venir"
                                            : full
                                              ? "L'équipe est complète"
                                              : 'Tu viens ?'}
                                      </p>
                                      <div className="grid grid-cols-2 gap-2">
                                        <button
                                          onClick={() => (mine ? removeBroFromScheduled(job.id, myBroId) : registerBroToJob(job.id, myBroId))}
                                          disabled={!mine && full}
                                          className={`p-3 rounded-xl text-base font-bold active:scale-95 transition-transform disabled:opacity-50 ${mine
                                            ? 'bg-white border-2 border-green-500 text-green-700'
                                            : 'bg-green-500 text-white shadow-md'
                                            }`}
                                        >
                                          {mine ? 'Me désinscrire' : 'Je viens'}
                                        </button>
                                        <button
                                          onClick={() => (cannot ? clearBroUnavailable(job.id, myBroId) : markBroUnavailable(job.id, myBroId))}
                                          className={`p-3 rounded-xl text-base font-bold active:scale-95 transition-transform ${cannot
                                            ? 'bg-white border-2 border-gray-400 text-gray-700'
                                            : 'bg-gray-100 text-gray-700'
                                            }`}
                                        >
                                          {cannot ? 'Annuler' : 'Je ne peux pas'}
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })()}

                                {/* Inscrire quelqu'un d'autre, en petit */}
                                {hasEnoughBros ? (
                                  <div className="p-2 bg-green-100 border border-green-300 rounded text-center">
                                    <p className="text-sm text-green-800 font-medium">✅ Équipe complète</p>
                                    <p className="text-xs text-green-700">Passe par « Valider les boulots » une fois le boulot fait</p>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => { setSelectedJob(job); setModalType('register-bro'); setShowModal(true); }}
                                    className="w-full py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 rounded-lg active:scale-95 transition-transform"
                                  >
                                    + Inscrire quelqu'un d'autre
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

          {/* Proposer un boulot : ouvert à tous, en bas de la liste */}
          <div className="mt-6">
            <button
              onClick={() => { setModalType('schedule-job'); setShowModal(true); }}
              className="w-full p-3 bg-green-500 text-white rounded-lg font-semibold active:scale-95 transition-transform"
            >
              <div className="flex items-center justify-center space-x-2">
                <Plus size={20} />
                <span>Programmer un boulot</span>
              </div>
            </button>
            {!canManage && (
              <p className="text-xs text-gray-500 text-center mt-2">
                Tu pourras modifier ou supprimer les boulots que tu as programmés.
              </p>
            )}
          </div>
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
              contactName: '',
              contactPhone: '',
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

            {/* Contact sur place */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📞 Contact
              </label>
              <div className="space-y-2">
                <input
                  type="text"
                  value={newScheduledJob.contactName || ''}
                  onChange={(e) => setNewScheduledJob({ ...newScheduledJob, contactName: e.target.value })}
                  className="w-full p-3 border rounded-lg"
                  placeholder="Nom de la personne à contacter"
                  autoComplete="off"
                />
                <input
                  type="tel"
                  inputMode="tel"
                  value={newScheduledJob.contactPhone || ''}
                  onChange={(e) => setNewScheduledJob({ ...newScheduledJob, contactPhone: e.target.value })}
                  className="w-full p-3 border rounded-lg"
                  placeholder="Téléphone, ex : 0470 12 34 56"
                  autoComplete="off"
                />
              </div>
            </div>

            {/* Durée estimée AVEC BOUTONS +/- */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ⏱️ Durée estimée *
              </label>
              <div className="flex items-center space-x-2">
                {/* Bouton - */}
                <button
                  type="button"
                  onClick={() => setNewScheduledJob({
                    ...newScheduledJob,
                    estimatedHours: Math.max(0.5, (newScheduledJob.estimatedHours || 1) - 0.5)
                  })}
                  className="w-10 h-10 bg-red-500 text-white rounded-lg font-bold active:scale-95 transition-transform"
                >
                  -
                </button>

                {/* Champ */}
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="12"
                  value={newScheduledJob.estimatedHours}
                  onChange={(e) => setNewScheduledJob({
                    ...newScheduledJob,
                    estimatedHours: parseFloat(e.target.value) || 1
                  })}
                  className="flex-1 p-3 border rounded-lg text-center font-medium"
                />

                {/* Bouton + */}
                <button
                  type="button"
                  onClick={() => setNewScheduledJob({
                    ...newScheduledJob,
                    estimatedHours: Math.min(12, (newScheduledJob.estimatedHours || 1) + 0.5)
                  })}
                  className="w-10 h-10 bg-green-500 text-white rounded-lg font-bold active:scale-95 transition-transform"
                >
                  +
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Durée estimée du boulot par personne (par pas de 0.5h)
              </p>
            </div>

            {/* Tarif horaire AVEC BOUTONS +/- */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                💰 Tarif horaire *
              </label>
              <div className="flex items-center space-x-2">
                {/* Bouton - */}
                <button
                  type="button"
                  onClick={() => setNewScheduledJob({
                    ...newScheduledJob,
                    customRate: Math.max(0, (newScheduledJob.customRate || hourlyRate) - 0.25)
                  })}
                  className="w-10 h-10 bg-red-500 text-white rounded-lg font-bold active:scale-95 transition-transform"
                >
                  -
                </button>

                {/* Champ */}
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  value={newScheduledJob.customRate}
                  onChange={(e) => setNewScheduledJob({
                    ...newScheduledJob,
                    customRate: parseFloat(e.target.value) || 0
                  })}
                  className="flex-1 p-3 border rounded-lg text-center font-medium"
                />

                {/* Bouton + */}
                <button
                  type="button"
                  onClick={() => setNewScheduledJob({
                    ...newScheduledJob,
                    customRate: (newScheduledJob.customRate || hourlyRate) + 0.25
                  })}
                  className="w-10 h-10 bg-green-500 text-white rounded-lg font-bold active:scale-95 transition-transform"
                >
                  +
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                €/heure (par pas de 0.25€)
              </p>
            </div>

            {/* Nombre de Bro AVEC BOUTONS +/- */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                👥 Nombre de Bro nécessaires *
              </label>
              <div className="flex items-center space-x-2">
                {/* Bouton - */}
                <button
                  type="button"
                  onClick={() => setNewScheduledJob({
                    ...newScheduledJob,
                    brosNeeded: Math.max(1, (newScheduledJob.brosNeeded || 1) - 1)
                  })}
                  className="w-10 h-10 bg-red-500 text-white rounded-lg font-bold active:scale-95 transition-transform"
                >
                  -
                </button>

                {/* Champ */}
                <input
                  type="number"
                  min="1"
                  max={bros.length}
                  value={newScheduledJob.brosNeeded}
                  onChange={(e) => setNewScheduledJob({
                    ...newScheduledJob,
                    brosNeeded: parseInt(e.target.value) || 1
                  })}
                  className="flex-1 p-3 border rounded-lg text-center font-medium"
                />

                {/* Bouton + */}
                <button
                  type="button"
                  onClick={() => setNewScheduledJob({
                    ...newScheduledJob,
                    brosNeeded: Math.min(bros.length, (newScheduledJob.brosNeeded || 1) + 1)
                  })}
                  className="w-10 h-10 bg-green-500 text-white rounded-lg font-bold active:scale-95 transition-transform"
                >
                  +
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Nombre de personnes requises (max: {bros.length} Bro disponibles)
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
                {contactLine(newScheduledJob) && (
                  <p>📞 Contact: {contactLine(newScheduledJob)}</p>
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
        {/* Modal pour inscrire un Bro */}
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

            {/* Compteur de places avec mise à jour en temps réel */}
            <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-gray-700 font-medium">
                Bro inscrits :
              </p>
              <span className={`font-bold text-lg ${selectedJob && selectedJob.registeredBros.length >= selectedJob.brosNeeded
                ? 'text-green-600'
                : 'text-orange-600'
                }`}>
                {selectedJob?.registeredBros.length} / {selectedJob?.brosNeeded}
              </span>
            </div>

            {/* Message si équipe complète */}
            {selectedJob && selectedJob.registeredBros.length >= selectedJob.brosNeeded && (
              <div className="p-2 bg-green-100 border border-green-300 rounded">
                <p className="text-sm text-green-800 font-medium text-center">
                  ✅ Équipe complète !
                </p>
              </div>
            )}

            {/* Liste de TOUS les Bro */}
            <div className="space-y-2">
              {(() => {
                // Récupérer le job à jour depuis scheduledJobs
                const currentJob = scheduledJobs.find(j => j.id === selectedJob?.id);

                return bros.map(bro => {
                  // Vérifier si le Bro est déjà inscrit
                  const isRegistered = currentJob?.registeredBros.some(reg => reg.broId === bro.id);
                  const isUnavailable = (currentJob?.unavailableBros || []).some(u => u.broId === bro.id);

                  // Vérifier si le Bro a un conflit d'horaire
                  const hasConflict = scheduledJobs.some(otherJob =>
                    otherJob.id !== currentJob?.id &&
                    otherJob.date === currentJob?.date &&
                    otherJob.registeredBros.some(reg => reg.broId === bro.id)
                  );

                  const conflictingJob = hasConflict ? scheduledJobs.find(otherJob =>
                    otherJob.id !== currentJob?.id &&
                    otherJob.date === currentJob?.date &&
                    otherJob.registeredBros.some(reg => reg.broId === bro.id)
                  ) : null;

                  return (
                    <div key={bro.id} className="flex items-stretch gap-2">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();

                        if (isRegistered) {
                          // Désinscrire le Bro
                          if (confirm(`Retirer ${bro.name} de ce boulot ?`)) {
                            removeBroFromScheduled(currentJob?.id, bro.id);
                          }
                        } else {
                          // Inscrire le Bro
                          if (hasConflict) {
                            if (confirm(`⚠️ ${bro.name} est déjà inscrit sur "${conflictingJob?.description}" ce jour-là.\n\nVoulez-vous quand même l'inscrire ?`)) {
                              registerBroToJob(currentJob?.id, bro.id);
                            }
                          } else {
                            registerBroToJob(currentJob?.id, bro.id);
                          }
                        }
                      }}
                      className={`flex-1 min-w-0 border-2 rounded-lg p-3 text-left active:scale-95 transition-transform ${isRegistered
                        ? 'border-green-500 bg-green-50'
                        : isUnavailable
                          ? 'border-gray-200 bg-gray-100 opacity-70'
                          : hasConflict
                          ? 'border-orange-300 bg-orange-50'
                          : 'border-gray-200 bg-white hover:bg-gray-50'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className={`font-medium ${isRegistered ? 'text-green-700' : ''}`}>
                              {bro.name}
                            </span>
                            {isRegistered && (
                              <span className="px-2 py-1 bg-green-500 text-white text-xs rounded-full font-semibold">
                                ✓ Inscrit
                              </span>
                            )}
                            {isUnavailable && (
                              <span className="px-2 py-1 bg-gray-300 text-gray-700 text-xs rounded-full font-semibold">
                                ✗ Ne peut pas
                              </span>
                            )}
                            {!isRegistered && hasConflict && (
                              <span className="px-2 py-1 bg-orange-200 text-orange-800 text-xs rounded-full">
                                ⚠️ Conflit
                              </span>
                            )}
                          </div>
                          <span className={`text-sm ${isRegistered ? 'text-green-600' : 'text-gray-500'}`}>
                            {bro.totalHours}h totales
                          </span>
                          {!isRegistered && hasConflict && conflictingJob && (
                            <div className="text-xs text-orange-600 mt-1">
                              Déjà inscrit sur: "{conflictingJob.description}"
                            </div>
                          )}
                        </div>
                        <div className={`text-2xl ${isRegistered ? 'text-green-500' : 'text-gray-400'}`}>
                          {isRegistered ? '✓' : '→'}
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (isUnavailable) clearBroUnavailable(currentJob?.id, bro.id);
                        else markBroUnavailable(currentJob?.id, bro.id);
                      }}
                      className={`flex-none w-20 rounded-lg text-xs font-semibold border-2 active:scale-95 transition-transform ${isUnavailable
                        ? 'border-gray-400 bg-white text-gray-700'
                        : 'border-gray-200 bg-gray-50 text-gray-600'
                        }`}
                      title={isUnavailable ? 'Annuler : il peut peut-être venir' : 'Il ne peut pas venir'}
                    >
                      {isUnavailable ? 'Annuler' : 'Ne peut pas'}
                    </button>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Légende mise à jour */}
            <div className="bg-gray-50 p-3 rounded-lg">
              <h4 className="font-medium text-gray-800 mb-2">💡 Légende :</h4>
              <div className="text-sm text-gray-600 space-y-1">
                <p>• <span className="font-medium text-green-600">✓ Inscrit</span> : Bro déjà inscrit (clic pour retirer)</p>
                <p>• <span className="font-medium">Normal</span> : Bro disponible (clic pour inscrire)</p>
                <p>• <span className="font-medium text-gray-700">✗ Ne peut pas</span> : a répondu qu'il ne pouvait pas venir (« Annuler » pour revenir en arrière)</p>
                <p>• <span className="font-medium text-orange-600">⚠️ Conflit</span> : Déjà inscrit ce jour-là (clic possible avec confirmation)</p>
              </div>
            </div>

            {/* Bouton pour terminer */}
            <button
              onClick={() => { setShowModal(false); setSelectedJob(null); }}
              className="w-full p-3 bg-gray-500 text-white rounded-lg font-medium active:scale-95 transition-transform"
            >
              ✅ Terminer les inscriptions
            </button>
          </div>
        </Modal>
      </div>
    );
  }

  // 🆕 NOUVEL ÉCRAN : Validation des boulots (responsables uniquement)
  if (screen === 'boulots-validate') {
    // Filtrer les boulots qui ont au moins 1 Bro inscrit
    const jobsToValidate = scheduledJobs.filter(job => job.registeredBros.length > 0);

    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Valider les Boulots" onBack={() => navigateTo('boulots')} />

        <div className="p-4">
          {/* Avertissement responsables */}
          <div className="mb-4 bg-orange-50 border border-orange-200 p-4 rounded-lg">
            <h3 className="font-semibold text-orange-800 mb-1">🔐 Zone Responsables</h3>
            <p className="text-sm text-orange-700">
              Validez les boulots une fois l'équipe au complet ou en mode partiel si nécessaire.
            </p>
          </div>

          {jobsToValidate.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle size={48} className="mx-auto mb-2 opacity-50" />
              <p>Aucun boulot en attente de validation</p>
              <p className="text-sm mt-1">Les boulots avec des inscriptions apparaîtront ici</p>
            </div>
          ) : (
            <div className="space-y-4">
              {jobsToValidate
                .sort((a, b) => new Date(a.date) - new Date(b.date))
                .map(job => {
                  const hasEnoughBros = job.registeredBros.length >= job.brosNeeded;
                  const completionRate = (job.registeredBros.length / job.brosNeeded) * 100;

                  return (
                    <div
                      key={job.id}
                      className={`bg-white border-2 rounded-lg shadow-sm p-4 ${hasEnoughBros
                        ? 'border-green-300 bg-green-50'
                        : 'border-orange-300 bg-orange-50'
                        }`}
                    >
                      {/* En-tête du boulot */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">{job.description}</h3>
                          <p className="text-sm text-gray-600">{formatDate(job.date)}</p>
                          {job.timeStart && (
                            <p className="text-xs text-gray-500">
                              🕐 {job.timeStart} à {calculateEndTime(job.timeStart, job.estimatedHours || 1)}
                            </p>
                          )}
                        </div>

                        {/* Badge de statut */}
                        <div className={`px-3 py-1 rounded-full text-xs font-medium ${hasEnoughBros
                          ? 'bg-green-100 text-green-800'
                          : 'bg-orange-100 text-orange-800'
                          }`}>
                          {job.registeredBros.length}/{job.brosNeeded} Bro
                        </div>
                      </div>

                      {/* Barre de progression */}
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                          <span>Équipe</span>
                          <span>{completionRate.toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${hasEnoughBros ? 'bg-green-500' : 'bg-orange-500'
                              }`}
                            style={{ width: `${Math.min(completionRate, 100)}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Liste des Bro inscrits */}
                      <div className="mb-3">
                        <p className="text-sm font-medium text-gray-700 mb-2">👥 Bro inscrits :</p>
                        <div className="flex flex-wrap gap-2">
                          {job.registeredBros.map((registration, index) => {
                            const bro = bros.find(b => b.id === registration.broId);
                            return (
                              <span
                                key={index}
                                className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded font-medium"
                              >
                                {bro?.name || 'Inconnu'}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      {/* Détails financiers */}
                      <div className="bg-white bg-opacity-70 p-3 rounded-lg mb-3">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-gray-600">Tarif/h :</p>
                            <p className="font-semibold text-green-600">{formatCurrency(job.customRate)}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Durée :</p>
                            <p className="font-semibold">{job.estimatedHours}h</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Coût si complet :</p>
                            <p className="font-semibold text-blue-600">
                              {formatCurrency(job.customRate * job.estimatedHours * job.brosNeeded)}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600">Coût actuel :</p>
                            <p className="font-semibold text-orange-600">
                              {formatCurrency(job.customRate * job.estimatedHours * job.registeredBros.length)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Boutons de validation */}
                      <div className="space-y-2">
                        {/* Validation complète (si équipe complète) */}
                        {hasEnoughBros && (
                          <button
                            onClick={() => {
                              if (confirm(`✅ Valider ce boulot avec l'équipe complète ?\n\n"${job.description}"\n${job.registeredBros.length} Bro inscrits\n\nIls seront tous payés ${formatCurrency(job.customRate * job.estimatedHours)} chacun.`)) {
                                completeScheduledJob(job.id, false);
                              }
                            }}
                            className="w-full p-3 bg-green-500 text-white rounded-lg font-semibold active:scale-95 transition-transform"
                          >
                            ✅ Valider avec équipe complète
                          </button>
                        )}

                        {/* Validation partielle (toujours disponible si au moins 1 Bro) */}
                        <button
                          onClick={() => {
                            if (confirm(`⚠️ Validation PARTIELLE ?\n\n"${job.description}"\nSeulement ${job.registeredBros.length} Bro sur ${job.brosNeeded} requis\n\nCoût total : ${formatCurrency(job.customRate * job.estimatedHours * job.registeredBros.length)}\n\nSeuls les Bro inscrits seront payés.`)) {
                              completeScheduledJob(job.id, true);
                            }
                          }}
                          className={`w-full p-3 rounded-lg font-semibold active:scale-95 transition-transform ${hasEnoughBros
                            ? 'bg-orange-500 text-white'
                            : 'bg-orange-600 text-white'
                            }`}
                        >
                          {hasEnoughBros
                            ? '⚠️ Forcer validation partielle'
                            : `⚠️ Valider partiellement (${job.registeredBros.length}/${job.brosNeeded})`
                          }
                        </button>

                        {/* Bouton retirer des Bro (optionnel) */}
                        <button
                          onClick={() => {
                            setSelectedJob(job);
                            setModalType('manage-registrations');
                            setShowModal(true);
                          }}
                          className="w-full p-2 bg-gray-500 text-white rounded text-sm active:scale-95 transition-transform"
                        >
                          🔧 Gérer les inscriptions
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Modal pour gérer les inscriptions */}
        <Modal
          isOpen={showModal && modalType === 'manage-registrations'}
          onClose={() => { setShowModal(false); setSelectedJob(null); }}
          title="Gérer les inscriptions"
        >
          {selectedJob && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Boulot: <strong>{selectedJob.description}</strong>
              </p>

              <div className="space-y-2">
                {selectedJob.registeredBros.map((registration, index) => {
                  const bro = bros.find(b => b.id === registration.broId);
                  return (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium">{bro?.name || 'Inconnu'}</span>
                      <button
                        onClick={() => {
                          {
                            removeBroFromScheduled(selectedJob.id, registration.broId);
                          }
                        }}
                        className="p-2 bg-red-500 text-white rounded active:scale-95 transition-transform"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Modal>
      </div>
    );
  }

  if (screen === 'boulots-bros') {
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
              <div key={bro.id} className="bg-white rounded-lg shadow-sm overflow-hidden">
                <button
                  onClick={() => navigateTo('bro-details', null, bro)}
                  className="w-full p-4 text-left hover:bg-gray-50 active:scale-95 transition-transform"
                >
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
                      <div className="text-gray-400">→</div>
                    </div>
                  </div>
                </button>
                <div className="px-4 pb-4 flex justify-end">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteBro(bro.id);
                    }}
                    className="p-2 text-red-500 hover:bg-red-50 rounded active:scale-95 transition-transform"
                  >
                    <Trash2 size={16} />
                  </button>
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

  if ((screen === 'boulots-new' || screen === 'boulots-bros') && !canManage) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Boulots" onBack={() => navigateTo('boulots')} />
        <p className="m-4 text-sm text-gray-700 bg-white rounded-2xl p-4">Réservé aux animateurs.</p>
      </div>
    );
  }

  if (screen === 'boulots-new') {
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

  if (screen === 'boulots-history') {
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
                .sort((a, b) => {
                  // 1. Priorité : non payés d'abord
                  if (a.isPaid !== b.isPaid) {
                    return a.isPaid - b.isPaid; // false (0) avant true (1)
                  }

                  // 2. Ensuite : ordre chronologique (plus récent d'abord)
                  const getDate = (job) => new Date(job.date || job.timestamp || job.createdAt);
                  return getDate(b) - getDate(a);
                })
                .map(job => (
                  <div key={job.id} className="bg-white p-4 rounded-lg shadow-sm">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="font-medium">{job.broName}</h3>
                          {/* Marquer payé : c'est l'animateur qui remet l'argent, lui seul confirme. */}
                          <button
                            onClick={() => {
                              if (!canManage) return;
                              setSelectedJob(job);
                              setModalType('toggle-job-payment');
                              setShowModal(true);
                            }}
                            disabled={!canManage}
                            title={canManage ? undefined : 'Seul un animateur peut marquer un paiement'}
                            className={`px-2 py-1 rounded-full text-xs font-medium active:scale-95 transition-transform disabled:active:scale-100 ${job.isPaid
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
          isOpen={canManage && showModal && modalType === 'toggle-job-payment'}
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

  if (screen === 'boulots-stats') {
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
                        '#0E8F5F', '#3D5AFE', '#6D4AFF', '#E85D12', '#E8435A', '#D99A06'
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

  return null;
};

export default BoulotsDomain;
