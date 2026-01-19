import React, { useState, useEffect, useContext } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
} from "react-native";
import { useFocusEffect } from '@react-navigation/native';
// import DateTimePicker from '@react-native-community/datetimepicker'; // Skipping for simplicity, using TextInput/Date logic or default today
import {
  saveScanToHistory,
  saveManualData,
  getManualData,
  getLocalSequence,
  saveLocalSequence,
  updateHistoryItemByBatchId,
  getDailyEditCount,
  incrementDailyEditCount,
} from "../utils/storage";
import { getNextBatchSequence, sendDataToSheet, fetchLastBatch, updateRemoteRow } from "../utils/api";
import { AuthContext } from "../context/AuthContext";
// La generación de PDF se manejará en una utilidad separada o aquí si es simple

export default function ManualScreen({ navigation, route }) {
  const { user } = useContext(AuthContext); 
  const { updateSheetRow, fetchGlobalConfig, saveGlobalConfig, saveGlobalConfigDate } = require('../utils/api');

  // Parámetros de Modo Edición
  const { isEditing, item } = route.params || {};

  const [sae, setSae] = useState(isEditing ? String(item.SAE || "") : "");
  // Normalizar grado para asegurar que coincida con los valores de los botones (ej. "5.5" -> "5.50")
  const formattedGrade = isEditing && item.Grade 
        ? parseFloat(item.Grade).toFixed(2) 
        : "7.00";
  const [grade, setGrade] = useState(formattedGrade);
  
  const [heat, setHeat] = useState(isEditing ? String(item.HeatNo || "") : "");
  const [bundle, setBundle] = useState(isEditing ? String(item.BundleNo || item.Coil || item.coil || "") : "");
  const [weight, setWeight] = useState(isEditing ? String(item.Weight || "") : "");

  const getLocalDate = () => {
      const now = new Date();
      const Y = now.getFullYear();
      const M = (now.getMonth() + 1).toString().padStart(2, '0');
      const D = now.getDate().toString().padStart(2, '0');
      return `${Y}-${M}-${D}`;
  };
  // Robust initialization for Date
  const getInitialDate = () => {
       if (isEditing) {
           return item.Date || item.date || item.fecha || getLocalDate();
       }
       return getLocalDate();
  };
  const [dateStr, setDateStr] = useState(getInitialDate());
  
  const [loading, setLoading] = useState(false);
  const [prefetchedSeq, setPrefetchedSeq] = useState(null);
  const [isFetchingSeq, setIsFetchingSeq] = useState(false);
  const [lastBatchId, setLastBatchId] = useState(null);
  const [saeMap, setSaeMap] = useState({});
  const [globalSaeMap, setGlobalSaeMap] = useState({}); // Nuevo: Almacenar mapa de configuración global
  const [lastBatchMap, setLastBatchMap] = useState({}); // Nuevo: Mapa local de Últimos Lotes por Grado
  // const [debugLogs, setDebugLogs] = useState(""); // DEBUG REMOVED


  useEffect(() => {
    console.log("DEBUG: ManualScreen Montado v3 - Verificando lógica de escáner");
    if (!isEditing) {
        loadPersistedData();
        
        // --- LOGICA DE ESCÁNER ---
        // Si venimos del escáner con datos
        if (route.params?.scannedData) {
            const { sae: s, grade: g, weight: w, heat: h, bundle: b } = route.params.scannedData;
            
            if (s) setSae(s);
            if (g) setGrade(g); // Esto disparará prefetchSequence automáticamente
            if (w) setWeight(w);
            if (h) setHeat(h);
            if (b) setBundle(b);
            
            // Opcional: Avisar al usuario
            // Alert.alert("Escáner", "Datos cargados automáticamente.");
        }
    }
  }, [route.params?.scannedData]);

  const loadPersistedData = async () => {
    const data = await getManualData();
    if (data.SAE_MAP) {
      setSaeMap(data.SAE_MAP);
    }
    if (data.LAST_BATCH_MAP) {
        setLastBatchMap(data.LAST_BATCH_MAP);
    }
  };



  /* --- Lógica de SAE Global --- */
  const fetchConfig = async () => {
    // Solo buscar si no estamos editando un ítem existente
    if (isEditing) return;
    
    // Obtener configuración global
    const configMap = await fetchGlobalConfig();
    
    if (configMap) {
        // Verificar si realmente cambió para evitar re-renderizados innecesarios
        // Esto previene que el useEffect dependiente de globalSaeMap se dispare y sobrescriba la entrada del usuario
        setGlobalSaeMap(prev => {
            if (JSON.stringify(prev) === JSON.stringify(configMap)) {
                return prev; // No cambiar estado si es idéntico
            }
            return configMap;
        });
    }
  };

  const handleSetGlobal = async () => {
      if (!sae) {
          Alert.alert("Error", "Ingresa un valor en SAE primero");
          return;
      }
      setLoading(true); 
      // ESTRATEGIA DEFINITIVA: Usar prefijo "G-" para forzar tratamiento de TEXTO y evitar duplicados numéricos.
      // Clave será "G-10.00". Esto es único y string.
      const safeKey = `G-${grade}`;
      const success = await saveGlobalConfig(sae, safeKey); 
      setLoading(false);
      
      if (success) {
          // Actualizar mapa local con la nueva clave (y la simple para fallback visual)
          const newGlobalMap = { ...globalSaeMap, [grade]: sae, [safeKey]: sae };
          setGlobalSaeMap(newGlobalMap);
          
          // ELIMINADO: No actualizar historial local aquí. 
          // Mantener Global y Local separados asegura que si se borra el Global, 
          // no caigamos en una copia local "fantasma" creada por la acción de Admin.

          Alert.alert("Éxito", `SAE Global para Grado ${grade} actualizado`);
      } else {
          Alert.alert("Error", "No se pudo actualizar el SAE Global en el servidor");
      }
  };

  const handleSetGlobalDate = async () => {
      // Validar formato fecha
      const regex = /^\d{4}-\d{2}-\d{2}$/;
      if (!regex.test(dateStr)) {
          Alert.alert("Formato Inválido", "La fecha debe ser YYYY-MM-DD");
          return;
      }
      
      setLoading(true);
      const success = await saveGlobalConfigDate(dateStr);
      setLoading(false);
      
      if (success) {
          Alert.alert("Éxito", "Fecha Semilla Global actualizada. Se aplicará a todos los nuevos lotes/grados.");
          // Forzar refresco visual
          setManualDateOverride(false); // Ya no es override manual local, ahora es Global
          setDateSource('global'); 
      } else {
          Alert.alert("Error", "No se pudo guardar la fecha global.");
      }
  };

  useEffect(() => {
    if (!isEditing) {
        loadPersistedData();
        fetchConfig(); // Obtener SAE global
        prefetchSequence();
    }
  }, []); // Ejecutar una vez al montar

  // ... (manteniendo otros efectos pero eliminando duplicados si los hay)

  // Ayudante para encontrar SAE de forma robusta
  const getSaeFromMap = (map, g) => {
      if (!map) return null;
      
      // 1. Intentar clave Segura con Prefijo "G-" (Prioridad Máxima)
      if (map[`G-${g}`]) return map[`G-${g}`];
      
      // 2. Intentar coincidencia directa
      if (map[g]) return map[g];
      
      // 3. Intentar normalización numérica (legacy)
      const asNum = parseFloat(g).toString(); 
      if (map[asNum]) return map[asNum];

      // 4. Búsqueda profunda numérica
      const target = parseFloat(g);
      const key = Object.keys(map).find(k => parseFloat(k) === target);
      if (key) return map[key];

      return null;
  };
  
  const prevGradeRef = React.useRef(grade);
  
  useEffect(() => {
    if (!isEditing) {
        // Determinar si cambiamos de grado
        const hasGradeChanged = prevGradeRef.current !== grade;
        prevGradeRef.current = grade;

        // Determinar SAE basado ÚNICAMENTE en Global (ignorando historial local para evitar "fantasmas")
        const globalValue = getSaeFromMap(globalSaeMap, grade);
        
        
        // Estrategia: "Solo Global o Vacío"
        // Si hay valor global, úsalo. Si no, permite que el usuario escriba libremente.
        
        if (hasGradeChanged) {
            // Si el usuario acaba de cambiar el grado, limpiamos el campo (o ponemos el global si hay).
            setSae(globalValue || "");
            
            // OPTIMIZACIÓN UI: Mostrar Último Lote CACHEADO inmediatamente
            if (lastBatchMap[grade]) {
                setLastBatchId(lastBatchMap[grade]); // Feedback instantáneo
            } else {
                setLastBatchId(null);
            }
            
            prefetchSequence(); 
        } else {
             if (globalValue) {
                 setSae(globalValue);
             }
        }
    }
  }, [grade, globalSaeMap]); // Eliminada dependencia dateStr para evitar reinicios por fecha

  /* Estado para indicador de origen de fecha y bloqueo manual */
  const [dateSource, setDateSource] = useState(null); // 'sticky' | 'global' | 'rollover' | 'manual'
  const [manualDateOverride, setManualDateOverride] = useState(false); // [NUEVO] Flag override

  const handleDateChange = (text) => {
      setDateStr(text);
      if (text.length === 10) { // Formato completo YYYY-MM-DD
          setManualDateOverride(true);
          // La UI se actualizará cuando prefetch termine y confirme manual
      }
  };

  const prefetchSequence = async () => {
      setLastBatchId(null);
      setPrefetchedSeq(null); 
      // Si el usuario fijó manual, source es manual. Si no, reseteamos a null.
      if (manualDateOverride) {
          setDateSource('manual');
      } else {
          setDateSource(null);
      }
      
      setIsFetchingSeq(true);
      try {
           // Si tenemos override, usamos la fecha del Input. Si no, Today.
           let dateToUse = new Date(); // Default 'now'
           if (manualDateOverride) {
               const [my, mm, md] = dateStr.split('-').map(Number);
               if (!isNaN(my) && !isNaN(mm) && !isNaN(md)) {
                   dateToUse = new Date(my, mm - 1, md);
               }
           }
           
           // Ejecución Paralela: Pasamos manualDateOverride como 3er argumento!
           const dailyPromise = getNextBatchSequence(grade, dateToUse, manualDateOverride);
           const absolutePromise = fetchLastBatch(grade);

           // Esperar a ambos
           const [seqData, absoluteLast] = await Promise.all([dailyPromise, absolutePromise]);

           setPrefetchedSeq(seqData);
           
           if (seqData) {
               // ACTUALIZACIÓN DE FECHA
               // Solo actualizamos el Input visual si NO estamos en modo manual override
               // O si el servidor nos dice que hubo un Rollover Crítico (aunque en manual override no debería pasar rollover auto)
               
               if (!manualDateOverride && seqData.dateStr) {
                   // Convertir YYMMDD -> YYYY-MM-DD
                   const yy = seqData.dateStr.substring(0, 2);
                   const mm = seqData.dateStr.substring(2, 4);
                   const dd = seqData.dateStr.substring(4, 6);
                   const newDateStr = `20${yy}-${mm}-${dd}`;
                   
                   setDateStr(newDateStr);
                   
                   // Determinar origen
                   if (seqData.isRollover) {
                       setDateSource('rollover');
                   } else if (seqData.lastSeq !== null) {
                       setDateSource('sticky'); 
                   } else {
                       setDateSource('global'); 
                   }
               }
           }
           
           let foundDaily = false;
           if (seqData && typeof seqData.lastSeq !== 'undefined' && seqData.lastSeq !== null && seqData.lastSeq > 0) {
              const prefix = seqData.dateStr;
              const s = seqData.lastSeq.toString().padStart(3, "0");
              const fullId = `${prefix}I${s}`;
              setLastBatchId(fullId);
              foundDaily = true;
           }

           // Respaldo
           if (!foundDaily) {
                if (absoluteLast && absoluteLast.trim().length > 0 && absoluteLast !== "null") {
                    setLastBatchId(absoluteLast);
                } else {
                    setLastBatchId(null);
                }
           }

      } catch (e) {
          console.log("Prefetch Failed:", e);
      } finally {
          setIsFetchingSeq(false);
      }
  };

  const handleSave = async () => {
    if (!sae || !heat || !weight) {
      Alert.alert("Error", "Por favor completa los campos requeridos");
      return;
    }

    setLoading(true);
    try {
      let batchId = isEditing ? item.Batch : "UNKNOWN";

      // --- MODO EDICIÓN ---
      if (isEditing) {
          // [NUEVO] LIMITE PARA AUXILIARES
          if (user && (user.role === 'auxiliar' || user.role === 'Auxiliar')) {
               const currentCount = await getDailyEditCount();
               if (currentCount >= 10) {
                   Alert.alert("Límite Alcanzado", "Has alcanzado el límite de 10 ediciones diarias para Auxiliares.");
                   setLoading(false);
                   return;
               }
          }

          // 1. Datos para Historial Local (Solo claves limpias / Inglés)
          const localData = {
              Batch: batchId.trim(),
              SAE: sae,
              HeatNo: heat,
              BundleNo: bundle,
              Weight: weight,
              Date: dateStr,
              Grade: grade,
              Operator: user ? user.name : (item.Operator || "Unknown"),
              UniqueId: item.UniqueId || item.uniqueId || item.uid,
          };

          // 2. Datos para Google Sheet (Incluye Alias en Español)
          const sheetPayload = {
              ...localData,
              "Batch ID": batchId.trim(), Lote: batchId.trim(),
              "Heat No": heat, Colada: heat,
              "Bundle No": bundle, Coil: bundle,
              Peso: weight,
              "Fecha": dateStr,
              Grado: grade,
              Usuario: localData.Operator
          };

          if (route.params?.isRemote) {
              console.log("Enviando actualización remota:", JSON.stringify(sheetPayload));
              const response = await updateRemoteRow(batchId, sheetPayload);
              console.log("Respuesta servidor:", response);

              if (response && response.success) {
                   // [NUEVO] INCREMENTAR CONTADOR
                   if (user && (user.role === 'auxiliar' || user.role === 'Auxiliar')) await incrementDailyEditCount();

                  Alert.alert("Éxito", "Registro actualizado remotamente");
                  navigation.goBack();
              } else {
                  const msg = response?.error || "Error desconocido al actualizar";
                  Alert.alert("Error Remoto", msg);
              }
              return;
          }

          // --- EDICIÓN LOCAL ---
          console.log("Enviando actualización hoja:", JSON.stringify(sheetPayload));
          // Actualizar Hoja
          const sheetResponse = await updateSheetRow(sheetPayload);
          console.log("Respuesta hoja:", sheetResponse);

          // Actualizar Historial Local
          await updateHistoryItemByBatchId(batchId, localData);

          // Validar respuesta de hoja (RESTAURADO)
          let successSheet = false;
          if (sheetResponse && typeof sheetResponse === 'object' && sheetResponse.success) {
              successSheet = true;
          } else if (typeof sheetResponse === 'string' && (sheetResponse === 'Success' || sheetResponse.includes('updated'))) {
               successSheet = true;
          }

          if (!successSheet) {
               // Extracción de mensaje de error
               let errorMsg = "Respuesta desconocida del servidor";
               if (sheetResponse && typeof sheetResponse === 'object') {
                   errorMsg = sheetResponse.error || JSON.stringify(sheetResponse);
               } else if (typeof sheetResponse === 'string') {
                   errorMsg = sheetResponse.substring(0, 200); 
               }
               
               Alert.alert(
                   "Guardado Parcial (Local)", 
                   "Se actualizó en su dispositivo, pero NO en Google Sheets.\n\nError: " + errorMsg,
                   [{ text: "Entendido", onPress: () => navigation.goBack() }]
               );
          } else {
               // [NUEVO] INCREMENTAR CONTADOR
               if (user && (user.role === 'auxiliar' || user.role === 'Auxiliar')) await incrementDailyEditCount();


               Alert.alert(
                   "Éxito", 
                   "Registro actualizado correctamente.",
                   [{ text: "OK", onPress: () => navigation.goBack() }]
               );

          }
          return;
      }

      // --- MODO NUEVO ---
      // --- MODO NUEVO ---
      // 1. Generar ID de Lote
      // Usamos dateStr directamente, ya que prefetchSequence() ya se encargó de poner la fecha correcta (Sticky o Global)
      const [yIn, mIn, dIn] = dateStr.split("-").map(Number);
      // Re-formatear a YYMMDD para el ID
      const yLocal = yIn.toString().slice(-2);
      const mLocal = mIn.toString().padStart(2, "0");
      const dLocal = dIn.toString().padStart(2, "0");
      const batchDatePart = `${yLocal}${mLocal}${dLocal}`;
      
      const storageKey = `${batchDatePart}_${grade}`;

      let seqToUse = 1;
      let seqData = null;

      if (prefetchedSeq) {
          seqData = prefetchedSeq;
      } else {
           // Fallback seguro
           try {
               const now = new Date(yIn, mIn - 1, dIn);
               seqData = await getNextBatchSequence(grade, now); 
           } catch (e) {
               console.warn("Falló verificación secuencia fallback:", e);
               seqData = null;
           }
      }

      // IMPORTANTE: seqData YA trae la secuencia correcta (N+1) calculada en api.js
      const serverNext = seqData ? seqData.seq : null;
      // Local lo usamos solo de respaldo extremo
      const localSeq = await getLocalSequence(storageKey);
      
      if (serverNext) {
        seqToUse = serverNext;
      } else {
        seqToUse = localSeq + 1;
      }
      
      // Validaciones finales
      if (seqToUse > 999) { 
          Alert.alert(
              "Error Crítico", 
              "Secuencia 999 excedida. El sistema debería haber hecho rollover. Intenta cambiar de grado y volver para refrescar."
          ); 
          setLoading(false); 
          return; 
      }

      const s = seqToUse.toString().padStart(3, "0");
      batchId = `${batchDatePart}I${s}`;

      // 2. Preparar Datos
      const dataToSave = {
        SAE: sae, Grade: grade, HeatNo: heat, Batch: batchId, BundleNo: bundle, Weight: weight, Date: dateStr, // dateStr ya es la fecha final correcta
        Operator: user ? user.name : "Unknown",
      };

      // 3. Guardar
      // 3. Guardar
      await saveScanToHistory(dataToSave);
      
      // [OPTIMIZACIÓN] Enviar a Hoja en SEGUNDO PLANO (Fire & Forget)
      sendDataToSheet(dataToSave).catch(e => {
          console.error("Background Sheet Sync Error:", e);
      });

      const newSaeMap = { ...saeMap, [grade]: sae };
      const newLastBatchMap = { ...lastBatchMap, [grade]: batchId }; // Actualizar mapa de lotes
      
      setSaeMap(newSaeMap); 
      setLastBatchMap(newLastBatchMap);

      await saveManualData({ SAE_MAP: newSaeMap, LAST_BATCH_MAP: newLastBatchMap }); 
      await saveLocalSequence(storageKey, seqToUse);

      Alert.alert("Éxito", `Lote Generado: ${batchId}`);
      
      setHeat(""); setBundle(""); setWeight("");
      
      // Forzar obtención secuencia fresca próxima vez
      setPrefetchedSeq(null);
      prefetchSequence();

    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Ocurrió un error inesperado");
    } finally {
      setLoading(false);
    }
  };

  const saeRef = React.useRef(null);
  const heatRef = React.useRef(null);
  const bundleRef = React.useRef(null);
  const weightRef = React.useRef(null);


  const hasPrivilege = user && ['administrador', 'supervisor', 'verificador'].includes(user.role);

  // Efecto Consolidado para Cambio de Grado y Auto-relleno
  // Refrescar secuencia cuando la pantalla entra en foco
  useFocusEffect(
    React.useCallback(() => {
      if(!isEditing) {
          fetchConfig(); // Asegurar que tenemos las últimas SAE Globales de otros dispositivos
          prefetchSequence(); // También actualizar secuencia
      }
    }, [grade, dateStr, isEditing]) // Dependencias disparan re-ejecución si cambian también, pero principalmente el foco
  );

  // ELIMINADO: useEffect duplicado que causaba conflictos con la lógica principal.
  // La lógica principal (líneas 150-180 aprox) ya maneja 'setSae' basándose SOLO en Global.

  // ¿Disparador Pre-fetch separado para evitar sobrescribir SAE en solo cambio de fecha?
  // Realmente, si fecha cambia, SAE no debería cambiar, pero Secuencia sí.
  // ¿El efecto superior reinicia SAE al cambiar fecha si incluí dateStr?
  // Espera, incluí dateStr en array dependencias en el contenido de archivo previo. 
  // Si fecha cambia, `globalSaeMap[grade]` sigue igual, así que re-establece SAE al mismo valor. Seguro.

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{isEditing ? `Editar Lote: ${item?.Batch}` : "Ingreso Manual"}</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.form}>
          {/* Visualización Último Lote - Persistente */}
          <View style={styles.infoBox}>
              {/* DEBUG REMOVED */}
              
              {isFetchingSeq && !lastBatchId ? ( // Solo mostrar "Sincronizando" si NO tenemos un dato cacheado para mostrar
                  <Text style={styles.infoText}>Sincronizando secuencia...</Text>
              ) : lastBatchId ? (
                  <Text style={styles.infoText}>Último Lote: {lastBatchId} {isFetchingSeq ? "..." : ""}</Text>
              ) : (
                  <Text style={[styles.infoText, { color: '#888' }]}>Último Lote: --</Text>
              )}
          </View>

          {/* Date */}
          <View style={styles.inputGroup}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                <Text style={styles.label}>Fecha (YYYY-MM-DD)</Text>
                {dateSource && (
                    <Text style={{fontSize: 12, fontWeight: 'bold', color: 
                        dateSource === 'sticky' ? '#FFC107' : // Amber
                        dateSource === 'rollover' ? '#4CAF50' : // Green
                        dateSource === 'global' ? '#2196F3' : // Blue
                        dateSource === 'manual' ? '#E91E63' : '#AAA' // Pink for Manual
                    }}>
                        {dateSource === 'sticky' ? '🔒 Lote Activo' : 
                         dateSource === 'rollover' ? '🔄 Nuevo Ciclo' : 
                         dateSource === 'global' ? '★ Config. Global' : 
                         dateSource === 'manual' ? '✎ Manual (Fijo)' : ''}
                    </Text>
                )}
            </View>
            
            {hasPrivilege ? (
                <View>
                    <TextInput
                      style={[styles.input, dateSource === 'sticky' && {borderColor: '#FFC107', borderWidth: 1}]}
                      value={dateStr}
                      onChangeText={handleDateChange} 
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#888"
                      returnKeyType="next"
                      onSubmitEditing={() => saeRef.current?.focus()}
                      blurOnSubmit={false}
                    />
                    <TouchableOpacity onPress={handleSetGlobalDate} style={{marginTop: 5, padding: 5, alignSelf: 'flex-start'}}>
                        <Text style={{color: '#E91E63', fontSize: 13, fontWeight: 'bold'}}>
                            ★ FIJAR COMO GLOBAL (Todos los Grados)
                        </Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={{
                    backgroundColor: '#f0f0f0', 
                    borderRadius: 8, 
                    padding: 12,
                    borderWidth: dateSource === 'sticky' ? 1 : 0,
                    borderColor: '#FFC107'
                }}>
                    <Text style={{fontSize: 16, color: '#333'}}>
                        {dateStr}
                    </Text>
                </View>
            )}
          </View>

          {/* SAE - Visible only for Privileged, but state exists for all */}
          {hasPrivilege ? (
            <View style={styles.inputGroup}>
                <Text style={styles.label}>SAE</Text>
                <TextInput
                ref={saeRef}
                style={styles.input}
                value={sae}
                onChangeText={setSae}
                placeholder="Ej. SAE1006"
                placeholderTextColor="#888"
                returnKeyType="next"
                onSubmitEditing={() => heatRef.current?.focus()}
                blurOnSubmit={false}
                />
                <TouchableOpacity onPress={handleSetGlobal} style={{marginTop: 5, padding: 5, alignSelf: 'flex-start'}}>
                    <Text style={{color: '#2196F3', fontSize: 13, fontWeight: 'bold'}}>
                        ★ FIJAR COMO GLOBAL
                    </Text>
                </TouchableOpacity>
            </View>
          ) : (
            // Oculto para usuarios normales, ¿quizás mostrar etiqueta pequeña?
            // "Eliminales ese campo" -> Eliminar entrada.
            // Mostremos Texto Solo Lectura para que sepan que se aplica.
             <View style={styles.inputGroup}>
                <Text style={styles.label}>SAE (Automático)</Text>
                <Text style={{fontSize: 16, color: '#555', padding: 12, backgroundColor: '#f0f0f0', borderRadius: 8}}>
                    {sae || "No definido"}
                </Text>
            </View>
          )}

          {/* Grado */}
          <View style={styles.inputGroup}>

            <Text style={styles.label}>Grado (Grade)</Text>
            <View style={styles.gradeContainer}>
              {[
                "5.50",
                "6.00",
                "6.50",
                "7.00",
                "8.00",
                "9.00",
                "10.00",
                "12.00",
              ].map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[
                    styles.gradeButton,
                    grade === g && styles.gradeSelected,
                  ]}
                  onPress={() => setGrade(g)}
                >
                  <Text
                    style={[
                      styles.gradeText,
                      grade === g && styles.gradeTextSelected,
                    ]}
                  >
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Heat */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Colada (Heat)</Text>
            <TextInput
              ref={heatRef}
              style={styles.input}
              value={heat}
              onChangeText={setHeat}
              placeholder="Ej. 252101992"
              placeholderTextColor="#888"
              returnKeyType="next"
              onSubmitEditing={() => bundleRef.current?.focus()}
              blurOnSubmit={false}
            />
          </View>

          {/* Bundle */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Coil/Bundle</Text>
            <TextInput
              ref={bundleRef}
              style={styles.input}
              value={bundle}
              onChangeText={setBundle}
              placeholder="Ej. 37"
              placeholderTextColor="#888"
              keyboardType="numeric"
              returnKeyType="next"
              onSubmitEditing={() => weightRef.current?.focus()}
              blurOnSubmit={false}
            />
          </View>

          {/* Weight */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Peso (Kg)</Text>
            <TextInput
              ref={weightRef}
              style={styles.input}
              value={weight}
              onChangeText={setWeight}
              placeholder="Ej. 2068"
              placeholderTextColor="#888"
              keyboardType="numeric"
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />
          </View>

          {/* Button */}
          <TouchableOpacity
            style={[styles.saveButton, loading && styles.disabled, isEditing && styles.editButton]}
            onPress={handleSave}
            disabled={loading}
          >
            <Text style={styles.saveButtonText}>
              {loading ? "Procesando..." : (isEditing ? "Actualizar Registro" : "Guardar Datos")}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212", // Dark Background
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  header: {
    padding: 20,
    backgroundColor: "#000", // Pure Black Header
    flexDirection: "row",
    alignItems: "center",
    elevation: 4,
    borderBottomWidth: 2,
    borderBottomColor: '#D32F2F', // Red Line
  },
  backButton: {
    marginRight: 15,
  },
  backText: {
    fontSize: 16,
    color: "#DDD",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
  },
  form: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#E0E0E0", // Light Text
  },
  input: {
    borderWidth: 1,
    borderColor: "#444", // Dark border
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#2C2C2C", // Dark Input
    color: "#FFF", // White Text
  },
  gradeContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  gradeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#333", // Dark Grey Button
    borderWidth: 1,
    borderColor: "#555"
  },
  gradeSelected: {
    backgroundColor: "#D32F2F", 
    borderColor: "#D32F2F"
  },
  gradeText: {
    color: "#EEE",
  },
  gradeTextSelected: {
    color: "white",
    fontWeight: "bold",
  },
  saveButton: {
    backgroundColor: "#000",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#D32F2F', 
  },
  disabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    letterSpacing: 1
  },
  editButton: {
    backgroundColor: '#D32F2F',
    borderWidth: 0
  },
  infoBox: {
    backgroundColor: '#1E1E1E', // Dark Card
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 5,
    borderLeftColor: '#D32F2F', 
    alignItems: 'center',
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  infoText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16
  }
});
