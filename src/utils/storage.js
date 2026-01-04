import AsyncStorage from "@react-native-async-storage/async-storage";

export const SCRIPT_URL_KEY = 'script_url_v13'; // Incrementar para invalidar caché
export const HISTORY_KEY = "scan_history";
export const MANUAL_DATA_KEY = 'manual_data_v2';
export const PREFERRED_BROWSER_KEY = 'preferred_browser_pkg';

export const savePreferredBrowser = async (pkg) => {
  try {
    await AsyncStorage.setItem(PREFERRED_BROWSER_KEY, pkg);
  } catch (e) {
    console.error("Error saving browser pref:", e);
  }
};

export const getPreferredBrowser = async () => {
  try {
    return await AsyncStorage.getItem(PREFERRED_BROWSER_KEY);
  } catch (e) {
    return null;
  }
};

// URL Base del Script de Google Apps (Actualizada V4)
export const DEFAULT_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzSsd97dss1xKoyfbu_wjyaKyTOCef096AJnngxRL4XL9AKb-qm8s21wy6yQwv_lYKVQw/exec";

export const saveScriptUrl = async (url) => {
  try {
    await AsyncStorage.setItem(SCRIPT_URL_KEY, url);
  } catch (e) {
    console.error("Error saving script URL:", e);
  }
};

export const getScriptUrl = async () => {
  try {
    const url = await AsyncStorage.getItem(SCRIPT_URL_KEY);
    return url || null; // Devolver null si no está configurado para disparar configuración
  } catch (e) {
    console.error("Error getting script URL:", e);
    return null;
  }
};

// Generador de UUID simple (v4-like)
export const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const saveScanToHistory = async (scanData) => {
  try {
    const historyJson = await AsyncStorage.getItem(HISTORY_KEY);
    const history = historyJson ? JSON.parse(historyJson) : [];

    // Asegurar que tenga UniqueId
    if (!scanData.UniqueId) {
      scanData.UniqueId = generateUUID();
    }

    const newRecord = {
      id: Date.now(), // ID Local secuencial (timestamp)
      data: scanData,
      timestamp: new Date().toISOString(),
    };

    history.unshift(newRecord); // Agregar al principio
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    return true;
  } catch (e) {
    console.error("Error saving history:", e);
    return false;
  }
};

export const getScanHistory = async () => {
  try {
    const historyJson = await AsyncStorage.getItem(HISTORY_KEY);
    return historyJson ? JSON.parse(historyJson) : [];
  } catch (e) {
    console.error("Error getting history:", e);
    return [];
  }
};

export const clearHistory = async () => {
  try {
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify([]));
    return true;
  } catch (e) {
    console.error("Error clearing history:", e);
    return false;
  }
};

export const deleteHistoryItem = async (id, uniqueId = null) => {
  try {
    const historyJson = await AsyncStorage.getItem(HISTORY_KEY);
    if (!historyJson) return false;

    const history = JSON.parse(historyJson);

    // Filtrado robusto:
    // 1. Si se proporciona uniqueId, usarlo como criterio principal si existe en item.data
    // 2. Si no, o si falla, usar el ID local (timestamp)

    const newHistory = history.filter((item) => {
      if (uniqueId && item.data && item.data.UniqueId) {
        // Si el ítem tiene UniqueId, comparar con ese
        return item.data.UniqueId !== uniqueId;
      }
      // Fallback al ID local
      return item.id !== id;
    });

    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
    return true;
  } catch (e) {
    console.error("Error deleting history item:", e);
    return false;
  }
};

export const saveManualData = async (data) => {
  try {
    await AsyncStorage.setItem(MANUAL_DATA_KEY, JSON.stringify(data));
  } catch (e) {
    console.error(e);
  }
};


export const getManualData = async () => {
  try {
    const data = await AsyncStorage.getItem(MANUAL_DATA_KEY);
    return data ? JSON.parse(data) : {};
  } catch (e) {
    return {};
  }
};

export const getLocalSequence = async (key) => {
  try {
    const val = await AsyncStorage.getItem("seq_" + key);
    return val ? parseInt(val) : 0;
  } catch (e) {
    return 0;
  }
};

export const saveLocalSequence = async (key, val) => {
  try {
    await AsyncStorage.setItem("seq_" + key, val.toString());
  } catch (e) {
    console.error(e);
  }
};

export const decrementLocalSequence = async (key) => {
  try {
    const current = await getLocalSequence(key);
    if (current > 0) {
      await AsyncStorage.setItem("seq_" + key, (current - 1).toString());
    }
  } catch (e) {
    console.error(e);
  }
};

export const updateHistoryItemByBatchId = async (batchId, newData) => {
  try {
    const historyJson = await AsyncStorage.getItem(HISTORY_KEY);
    if (!historyJson) return false;

    let history = JSON.parse(historyJson);
    let found = false;

    history = history.map(item => {
      if (item.data && item.data.Batch === batchId) {
        found = true;
        return {
          ...item,
          data: { ...item.data, ...newData }
        };
      }
      return item;
    });

    if (found) {
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
      return true;
    }
    return false;
    return false;
  } catch (e) {
    console.error("Error updating history item:", e);
    return false;
  }
};

// --- CONTROL DE EDICIONES DIARIAS (AUXILIAR) ---
export const getDailyEditCount = async () => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const key = `DAILY_EDITS_${today}`;
    const count = await AsyncStorage.getItem(key);
    return count ? parseInt(count, 10) : 0;
  } catch (e) {
    return 0;
  }
};

export const incrementDailyEditCount = async () => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const key = `DAILY_EDITS_${today}`;
    const current = await getDailyEditCount();
    await AsyncStorage.setItem(key, (current + 1).toString());
    return current + 1;
  } catch (e) {
    console.error("Error incrementing edit count:", e);
    return 0;
  }
};
// --- LIMPIEZA AUTOMÁTICA (06:00 AM / PM) ---
export const LAST_CLEANUP_KEY = "last_auto_cleanup_ts";

export const checkAndAutoClearHistory = async () => {
  try {
    const lastCleanupStr = await AsyncStorage.getItem(LAST_CLEANUP_KEY);
    const lastCleanup = lastCleanupStr ? parseInt(lastCleanupStr, 10) : 0;
    const now = new Date();
    const currentTs = now.getTime();

    // Determinar los puntos de corte de hoy
    const today6am = new Date(now); today6am.setHours(6, 0, 0, 0);
    const today6pm = new Date(now); today6pm.setHours(18, 0, 0, 0);

    // Determinar el umbral relevante más reciente (El último hito de las 6 que debió pasar)
    let threshold = null;

    if (now >= today6pm) {
      // Ya pasaron las 6 PM hoy
      threshold = today6pm.getTime();
    } else if (now >= today6am) {
      // Ya pasaron las 6 AM hoy, pero no las 6 PM
      threshold = today6am.getTime();
    } else {
      // Es madrugada (antes de las 6 AM), el último hito fue las 6 PM de ayer
      const yesterday6pm = new Date(now);
      yesterday6pm.setDate(now.getDate() - 1);
      yesterday6pm.setHours(18, 0, 0, 0);
      threshold = yesterday6pm.getTime();
    }

    // Si la última limpieza es ANTERIOR al umbral más reciente, limpiar
    if (lastCleanup < threshold) {
      console.log("Ejecutando limpieza automática...");
      await clearHistory();
      await AsyncStorage.setItem(LAST_CLEANUP_KEY, currentTs.toString());
      return true; // Indica que se limpió
    }

    return false; // No era necesario
  } catch (e) {
    console.error("Auto Cleanup Error:", e);
    return false;
  }
};
