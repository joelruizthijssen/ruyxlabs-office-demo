import { overrideApi } from '../index.js';
import {
  getSettings, settingsUpdate, settingsAcceptLegal,
  settingsSetLogo, settingsRemoveLogo,
  settingsSetFirma, settingsRemoveFirma,
  settingsSetMembrete, settingsRemoveMembrete,
  datosResetPrueba,
} from '../repository/settings.js';

export default function mount() {
  overrideApi('settings', {
    get: () => getSettings(),
    update: (data) => settingsUpdate(data),
    acceptLegal: () => settingsAcceptLegal(),
    resetPrueba: () => datosResetPrueba(),
    setLogo: (buffer, ext) => settingsSetLogo(buffer, ext),
    removeLogo: () => settingsRemoveLogo(),
    setFirma: (buffer, ext) => settingsSetFirma(buffer, ext),
    removeFirma: () => settingsRemoveFirma(),
    setMembrete: (buffer, ext) => settingsSetMembrete(buffer, ext),
    removeMembrete: () => settingsRemoveMembrete(),
  });
  overrideApi('app', {
    licenseState: () => ({ status: 'active', licenseActivated: true, daysLeft: null }),
    relaunch: () => window.location.reload(),
  });
}
