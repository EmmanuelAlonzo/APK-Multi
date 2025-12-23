import { getScriptUrl, DEFAULT_SCRIPT_URL } from './storage';

export const getActiveScriptUrl = async () => {
    const url = await getScriptUrl();
    return url || DEFAULT_SCRIPT_URL; // Fallback to default if not set/null? 
    // Wait, the requirement says "option from start to set sheet".
    // If it returns null, we should probably prompt user. 
    // But for api calls, we might want a fallback if they skip it?
    // Let's assume if it's null, the App should redirect to Settings.
};

export const getNextBatchSequence = async (grade, dateObj = null) => {
    const scriptUrl = await getActiveScriptUrl();
    if (!scriptUrl) throw new Error("Script URL not configured");

    const now = dateObj || new Date();
    // YYMMDD format for internal logic/return
    const yStr = now.getFullYear().toString().slice(-2);
    const mStr = (now.getMonth() + 1).toString().padStart(2, '0');
    const dStr = now.getDate().toString().padStart(2, '0');
    const dateStr = `${yStr}${mStr}${dStr}`;

    // YYMMDD for Query Param (Legacy script likely uses this key)
    const queryDate = `${yStr}${mStr}${dStr}`;

    let url = `${scriptUrl}?grade=${grade}&date=${queryDate}&_t=${Date.now()}`;
    
    console.log("Fetching sequence from:", url);

    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error("Network response not ok:", response.status);
            throw new Error('Network response was not ok');
        }
        
        const text = await response.text();
        console.log("Sequence API Response:", text); // DEBUG LOG
        
        try {
            const data = JSON.parse(text);
            // The script returns { "result": "success", "maxSeq": N }
            // We need to return { seq: N+1, dateStr: ... }
            let seq = 1;
            let lastSeq = null;
            if (data && typeof data.maxSeq !== 'undefined') {
                const max = parseInt(data.maxSeq);
                if (!isNaN(max)) {
                    lastSeq = max; // Capture maxSeq as lastSeq
                    seq = max + 1;
                }
            }
            if (seq > 999) seq = 1; 
            
            // Check for effectiveDate from server (Date Rollover)
            let finalDateStr = dateStr;
            if (data && data.effectiveDate) {
                finalDateStr = data.effectiveDate;
            }

            return {
                seq: seq,
                lastSeq: lastSeq,
                dateStr: finalDateStr
            };
        } catch (e) {
            console.error("JSON Parse Error:", e);
            throw new Error("No se pudo leer la respuesta del servidor (JSON inválido)");
        }
    } catch (error) {
        console.error("Error fetching sequence:", error);
        throw error;
    }
};

export const sendDataToSheet = async (data) => {
    const scriptUrl = await getActiveScriptUrl();
    if (!scriptUrl) throw new Error("Script URL not configured");

    try {
        const response = await fetch(scriptUrl, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        
        // Google Apps Script usually returns a redirect or text.
        // fetch follows redirects by default.
        const text = await response.text();
        return text;
    } catch (error) {
        console.error("Error sending to sheet:", error);
        throw error;
    }
};

export const fetchExternalBulkData = async (externalUrl) => {
    const scriptUrl = await getActiveScriptUrl();
    if (!scriptUrl) throw new Error("Script URL not configured");

    try {
        // Encode the external URL properly
        const url = `${scriptUrl}?action=getExternalBulkData&url=${encodeURIComponent(externalUrl)}`;
        console.log("Fetching external bulk data from:", url); // Log URL for debugging
        const response = await fetch(url);
        
        if (!response.ok) throw new Error('Network response was not ok');
        
        const json = await response.json();
        
        // Handle error returned by GAS
        if (json.error) {
            throw new Error("Server Error: " + json.error);
        }

        return json;
    } catch (error) {
        console.error("Error fetching external bulk data:", error);
        throw error;
    }
};

export const fetchPaginatedData = async (page = 1, pageSize = 100) => {
    const scriptUrl = await getActiveScriptUrl();
    if (!scriptUrl) throw new Error("Script URL not configured");

    try {
        const url = `${scriptUrl}?action=getPaginatedData&page=${page}&pageSize=${pageSize}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        const json = await response.json();
        if (json.error) throw new Error(json.error);
        
        // NORMALIZE DATA (Handle Spanish/English Keys & Fuzzy Matching)
        if (json.data && Array.isArray(json.data)) {
            json.data = json.data.map(item => {
                // Helper to find value by regex key
                const findVal = (regex) => {
                    const key = Object.keys(item).find(k => regex.test(k));
                    return key ? item[key] : undefined;
                };

                return {
                    Batch: findVal(/(batch|lote)/i) || 'N/A',
                    Grade: findVal(/(grade|grado)/i) || '',
                    SAE: findVal(/(sae)/i) || '',
                    HeatNo: findVal(/(heat|heatno|colada)/i) || '',
                    // Bundle: Look for Bundle, Coil, Rollo, Bobina, Paquete (matched anywhere in key)
                    BundleNo: findVal(/(bundle|bundleno|coil|rollo|paquete|bobina)/i) || '',
                    Weight: findVal(/(weight|peso)/i) || 0,
                    Date: findVal(/(date|fecha)/i) || '',
                    ...item // Keep original keys
                };
            });
        }
        
        return json;
    } catch (e) {
        console.error("Pagination Fetch Error:", e);
        throw e;
    }
};

export const updateRemoteRow = async (batchId, updateData) => {
    const scriptUrl = await getActiveScriptUrl();
    if (!scriptUrl) throw new Error("Script URL not configured");

    try {
        const url = `${scriptUrl}?action=updateRow`;
        const payload = { ...updateData, Batch: batchId };
        
        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) throw new Error('Network response was not ok');
        const json = await response.json();
        if (json.error) throw new Error(json.error);
        return json;
    } catch (e) {
        console.error("Remote Update Error:", e);
        throw e;
    }
};

export const fetchBulkData = async () => {
    const scriptUrl = await getActiveScriptUrl();
    if (!scriptUrl) throw new Error("Script URL not configured");

    try {
        const url = `${scriptUrl}?action=getBulkData`;
        console.log("Fetching bulk data from:", url);
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        
        const json = await response.json();
        return json; // Should be array of objects
    } catch (error) {
        console.error("Error fetching bulk data:", error);
        throw error;
    }
};

// ... (fetchBulkData)


export const fetchLastBatch = async (grade) => {
    const scriptUrl = await getActiveScriptUrl();
    if (!scriptUrl) return null;

    try {
        const url = `${scriptUrl}?action=getLastBatch&grade=${grade}&_t=${Date.now()}`;
        console.log("Fetching absolute last batch from:", url); // Log URL
        const response = await fetch(url);
        const text = await response.text();
        console.log("Last Batch Response (Raw):", text); // Log response
        return text; 
    } catch (error) {
        console.error("Error fetching last batch:", error);
        return null;
    }
};

export const fetchUsersFromScript = async () => {
    const scriptUrl = await getActiveScriptUrl();
    if (!scriptUrl) return []; // If no script, can't get users.

    try {
        const url = `${scriptUrl}?action=getUsers`;
        console.log("Fetching users from:", url);
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        
        const json = await response.json();
        if (Array.isArray(json)) {
            return json;
        } else {
            console.error("fetchUsersFromScript: Expected array but got", json);
            const typeVar = typeof json;
            const preview = JSON.stringify(json).substring(0, 50);
            throw new Error(`Respuesta inválida del servidor (No es array). Tipo: ${typeVar}. Contenido: ${preview}...`);
        }
    } catch (error) {
        console.error("Error fetching users:", error);
        throw error; // Rethrow to handle in Context
    }
};

// Deprecated: fetchSheetCsv (Removing or keeping as fallback? Removing per plan)
export const deleteFromSheet = async (batchId, grade) => {
    const scriptUrl = await getActiveScriptUrl();
    if (!scriptUrl) return;

    try {
        // We send Grade to ensure we don't delete same Batch ID from another Grade
        // IMPORTANT: JSON.stringify drops keys with 'undefined' values. We must ensure grade is valid or null-ish but preserved if possible,
        // but our script now REQUIRES it. If grade is missing, we shouldn't even call it, or we send a placeholder that won't match.
        if (!grade) {
             console.warn("Attempting to delete without Grade, this may be rejected by server safety check.");
        }

        const payload = {
            action: 'delete',
            Batch: batchId,
            Grade: grade || "" // Send empty string instead of undefined to ensure key exists
        };

        const response = await fetch(scriptUrl, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        
        const text = await response.text();
        console.log("Delete from sheet response:", text);
        return text;
    } catch (error) {
        console.error("Error deleting from sheet:", error);
        // Don't throw, just log
    }
};

export const updateUserPin = async (name, newPin) => {
    const scriptUrl = await getActiveScriptUrl();
    if (!scriptUrl) throw new Error("Script URL not configured");

    try {
        const payload = {
            action: 'changePin',
            name: name,
            newPin: newPin
        };

        const response = await fetch(scriptUrl, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        
        const text = await response.text();
        return text === "Success";
    } catch (error) {
        console.error("Error updating PIN:", error);
        throw error;
    }
};

export const updateSheetRow = async (data) => {
    const scriptUrl = await getActiveScriptUrl();
    if (!scriptUrl) return;

    try {
        const payload = {
            action: 'update',
            ...data // Should contain Batch, and fields to update (SAE, HeatNo, etc.)
        };

        const response = await fetch(scriptUrl, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        
        const text = await response.text();
        console.log("Update sheet response:", text);
        return text;
    } catch (error) {
        console.error("Error updating sheet:", error);
        throw error;
    }
};

export const fetchGlobalConfig = async () => {
    const scriptUrl = await getActiveScriptUrl();
    if (!scriptUrl) return null;

    try {
        const url = `${scriptUrl}?action=getConfig`;
        // console.log("Fetching config from:", url);
        const response = await fetch(url);
        // It should return { "7.00": "SAE1006", "5.50": "SAE...", ... }
        const json = await response.json();
        return json;
    } catch (error) {
        console.error("Error fetching config:", error);
        return null; // Fail gracefully
    }
};

export const saveGlobalConfig = async (saeValue, grade) => {
    const scriptUrl = await getActiveScriptUrl();
    if (!scriptUrl) return false;

    try {
        const payload = {
            action: 'setConfig',
            sae: saeValue,
            grade: grade // Send the grade to save specific SAE
        };

        const response = await fetch(scriptUrl, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        
        const text = await response.text();
        return text === "Success";
    } catch (error) {
        console.error("Error saving config:", error);
        return false;
    }
};
