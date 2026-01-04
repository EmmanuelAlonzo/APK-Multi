/**
 * qrParser.js
 * 
 * Lógica heurística para extraer datos de etiquetas de proveedores (Benxi, Jiujiang, etc.)
 * Intenta encontrar SAE, Grado (Medida), Peso y Colada (Heat/Batch) en texto desordenado.
 */

export const parseSteelLabel = (rawData) => {
    const text = rawData || "";
    // Limpieza más agresiva: reemplazar todo lo que NO sea alphanumeric, - . ; : / por espacios
    // y luego usar esos separadores para dividir.
    // Agregamos [ ] ( ) = como separadores también.
    const cleanText = text.replace(/[^\w\s\-\.\;\:\/\(\)\[\]=]/g, " "); 
    
    // Dividir por cualquier separador común
    const tokens = cleanText.split(/[\s;\:\/\(\)\[\]=]+/).filter(t => t.length > 0);

    let result = {
        raw: text,
        sae: "",
        grade: "",
        weight: "",
        heat: "",
        bundle: ""
    };

    // 1. SAE (Busqueda global)
    const saeMatch = text.match(/SAE\s*(\d{4})/i) || text.match(/\b(1006|1008|1010|1018|1022)\b/);
    if (saeMatch) {
         result.sae = saeMatch[0].toLowerCase().includes('sae') ? saeMatch[0] : `SAE ${saeMatch[0]}`;
         result.sae = result.sae.replace("SAE", "SAE ");
    }

    // 2. Iterar Tokens
    for (let token of tokens) {
        const num = parseFloat(token);
        const isNum = !isNaN(num);
        const upperToken = token.toUpperCase();
        let usedForGrade = false;

        // --- DETECTAR GRADO ---
        // (Igual que antes: 5.0 - 16.0)
        if (isNum && num >= 5.0 && num <= 16.0) {
            // Evitar confundir con, por ejemplo, el mes "06" de una fecha.
            // Generalmente el grado tiene decimales o es un entero aislado.
            // Si ya tenemos grado, no sobrescribimos tan fácil.
            if (!result.grade) {
                result.grade = normalizeGrade(token);
                usedForGrade = true;
            }
        }

        // --- DETECTAR PESO ---
        // 500 - 5000. 
        // En la captura vimos ";2085;". Al limpiar por ";" y " " debería aislarse "2085".
        if (isNum && Math.floor(num) === num && num >= 500 && num <= 5000) {
             const isYear = (num >= 2020 && num <= 2030);
             // Solo aceptamos "años" si están cerca de una palabra Weight o Kg, o si no hemos encontrado otro peso mejor.
             // Prioridad: Si el token actual NO es un año, es mejor candidato.
             if (!isYear) {
                 result.weight = num.toString();
             } else {
                 // Si es un año (2025), solo lo tomamos si no hay peso aún y si el texto crudo tiene "kg" pegado
                 if (!result.weight && text.toLowerCase().includes(token + "kg")) {
                     result.weight = num.toString();
                 }
             }
        }

        // --- DETECTAR COLADA (HEAT) ---
        // (Lógica existente...)
        if (token.length >= 8 && token.length <= 16) {
             const digits = token.replace(/[^0-9]/g, "").length;
             const total = token.length;
             const isDate = (token.match(/-/g) || []).length >= 2;
             
             if (!isDate && digits > 0) {
                 const digitRatio = digits / total;
                 if (digitRatio > 0.4) {
                      const currentBestDigits = result.heat ? result.heat.replace(/[^0-9]/g, "").length : 0;
                      if (digits > currentBestDigits) {
                          result.heat = token;
                      }
                 }
             }
        }

        // --- DETECTAR BUNDLE/ROLLO (Coil) ---
        // Entero pequeño/mediano.
        // Rango: 1 - 499 (evitando solaparse con peso > 500)
        // RESTRICCIÓN: No debe tener guiones (-). 
        // parseFloat("151-2018") da 151, lo cual es erroneo. Debemos verificar el token string.
        
        // Verificar si es puramente numérico (sin letras ni guiones)
        const isPureNumber = /^\d+$/.test(token);
        
        if (isPureNumber && isNum && Math.floor(num) === num && num > 0 && num < 500) {
             const isLikelyGrade = (num >= 5 && num <= 16);
             
             if (!isLikelyGrade) {
                 // Candidato fuerte a Rollo (ej. 28, 150)
                 if (!result.bundle) result.bundle = num.toString();
             } else {
                 // Es ambiguo (ej. 10, 7, 5.5). Podría ser Grado 10mm o Rollo 10.
                 
                 // CRITERIO MEJORADO:
                 // 1. Si tiene ceros a la izquierda (007, 07), es Rollo.
                 // 2. Si ya tenemos Grado (y este token NO se usó para Grado), y no tiene decimales "." (es entero puro style), es Rollo.
                 
                 if (token.startsWith('0') && token.length > 1) {
                     result.bundle = num.toString();
                 } else if (result.grade && !usedForGrade && !token.includes('.')) {
                     // Ejemplo: grade="7.00" ya detectado. Token actual="7".
                     if (!result.bundle) result.bundle = num.toString();
                 }
             }
        }
    }

    if (result.sae) result.sae = result.sae.replace(/\s+/g, " ").trim();
    return result;
};

const normalizeGrade = (raw) => {
    if (!raw) return "";
    const f = parseFloat(raw);
    if (isNaN(f)) return "";
    return f.toFixed(2);
};
