import AsyncStorage from "@react-native-async-storage/async-storage";

export const SCRIPT_URL_KEY = 'script_url_v9'; // Bump to invalidate cache
export const HISTORY_KEY = "scan_history";
export const MANUAL_DATA_KEY = 'manual_data_v2'; 

// URL por defecto (V8 - Roles - New Deployment)
export const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzjXq24USuI5HO1RqTmfBWRn945KlryGGKFoZEhZ2-1FH0PryNVfFkgxvK7SiNWbi228w/exec';

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
    return url || null; // Return null if not set to trigger setup
  } catch (e) {
    console.error("Error getting script URL:", e);
    return null;
  }
};

export const saveScanToHistory = async (scanData) => {
  try {
    const historyJson = await AsyncStorage.getItem(HISTORY_KEY);
    const history = historyJson ? JSON.parse(historyJson) : [];

    const newRecord = {
      id: Date.now(),
      data: scanData,
      timestamp: new Date().toISOString(),
    };

    history.unshift(newRecord); // Add to beginning
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

export const deleteHistoryItem = async (id) => {
  try {
    const historyJson = await AsyncStorage.getItem(HISTORY_KEY);
    if (!historyJson) return false;

    const history = JSON.parse(historyJson);
    const newHistory = history.filter((item) => item.id !== id);

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
