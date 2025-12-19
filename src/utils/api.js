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

    let url = `${scriptUrl}?grade=${grade}&date=${queryDate}`;
    
    console.log("Fetching sequence from:", url);

    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error("Network response not ok:", response.status);
            throw new Error('Network response was not ok');
        }
        
        const text = await response.text();
        console.log("Raw response:", text);
        
        try {
            const data = JSON.parse(text);
            // The script returns { "result": "success", "maxSeq": N }
            // We need to return { seq: N+1, dateStr: ... }
            let seq = 1;
            if (data && typeof data.maxSeq !== 'undefined') {
                seq = parseInt(data.maxSeq) + 1;
            }
            if (seq > 999) seq = 1; // Rollover logic
            
            return {
                seq: seq,
                dateStr: dateStr
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
