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
} from "../utils/storage";
import { getNextBatchSequence, sendDataToSheet, fetchLastBatch, updateRemoteRow } from "../utils/api";
import { AuthContext } from "../context/AuthContext";
// La generación de PDF se manejará en una utilidad separada o aquí si es simple

export default function ManualScreen({ navigation, route }) {
  const { user } = useContext(AuthContext); 
  const { updateSheetRow, fetchGlobalConfig, saveGlobalConfig } = require('../utils/api');

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
  // Corrección: usar fecha local en lugar de UTC para evitar saltos de fecha en la tarde
  const getLocalDate = () => {
      const now = new Date();
      const Y = now.getFullYear();
      const M = (now.getMonth() + 1).toString().padStart(2, '0');
      const D = now.getDate().toString().padStart(2, '0');
      return `${Y}-${M}-${D}`;
  };

  const [dateStr, setDateStr] = useState(isEditing ? item.Date : getLocalDate());
  
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

  const prefetchSequence = async () => {
      setLastBatchId(null);
      setPrefetchedSeq(null); 
      setIsFetchingSeq(true);
      try {
           const [yIn, mIn, dIn] = dateStr.split('-').map(Number);
           const dateObj = new Date(yIn, mIn - 1, dIn);
           
           // Ejecución Paralela para Velocidad
           const dailyPromise = getNextBatchSequence(grade, dateObj);
           const absolutePromise = fetchLastBatch(grade);

           // Esperar a ambos (o manejar fallos visualmente)
           const [seqData, absoluteLast] = await Promise.all([dailyPromise, absolutePromise]);

           setPrefetchedSeq(seqData);
           
           let foundDaily = false;
           if (seqData && typeof seqData.lastSeq !== 'undefined' && seqData.lastSeq !== null && seqData.lastSeq > 0) {
              const prefix = seqData.dateStr;
              const s = seqData.lastSeq.toString().padStart(3, "0");
              const fullId = `${prefix}I${s}`;
              setLastBatchId(fullId);
              foundDaily = true;
           }

           // Respaldo si no se encuentra diario
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
          const updateData = {
              Batch: batchId, // Clave
              SAE: sae,
              HeatNo: heat,
              BundleNo: bundle,
              Weight: weight,
              // Grado, Fecha usualmente no editables fácilmente ya que definen el ID del Lote, pero permitimos que pasen
              // ¿Si Admin cambia Grado, ID de Lote no coincide lógicamente? 
              // Requisito de usuario: "Editar los registros...". 
              // Por simplicidad, actualizamos campos en el ID de Lote EXISTENTE. Cambiar ID de Lote es peligroso.
          };

          if (route.params?.isRemote) {
              await updateRemoteRow(batchId, updateData);
              Alert.alert("Éxito", "Registro actualizado remotamente");
              navigation.goBack();
              return;
          }

          // Actualizar Hoja (Edición Local)
          await updateSheetRow(updateData);
          
          // Actualizar Historial (Local) requiere modificar el ítem en almacenamiento
          // No podemos modificar fácilmente un ítem en lista historial desde aquí sin acción global de store o re-lectura.
          // TRUCO: No actualizaremos historial local aquí, PERO `HistoryScreen` usualmente recarga. 
          // Sin embargo, para ser amables, deberíamos intentar. 
          // Por ahora, solo alertar y volver.
          Alert.alert("Éxito", "Registro actualizado");
          navigation.goBack();
          return;
      }

      // --- MODO NUEVO ---
      // 1. Generar ID de Lote
      // Parsear fecha seleccionada
      const [yIn, mIn, dIn] = dateStr.split("-").map(Number);
      const dateObj = new Date(yIn, mIn - 1, dIn);
      const yLocal = dateObj.getFullYear().toString().slice(-2);
      const mLocal = (dateObj.getMonth() + 1).toString().padStart(2, "0");
      const dLocal = dateObj.getDate().toString().padStart(2, "0");
      const localDateStr = `${yLocal}${mLocal}${dLocal}`;
      const storageKey = `${localDateStr}_${grade}`;

      let seqToUse = 1;
      let seqData = null;

      if (prefetchedSeq) {
          seqData = prefetchedSeq;
      } else {
           seqData = await getNextBatchSequence(grade, dateObj);
      }

      const localSeq = await getLocalSequence(storageKey);
      const serverNext = seqData ? seqData.seq : null;
      const localNext = localSeq + 1;

      if (serverNext) {
        seqToUse = serverNext;
      } else {
        seqToUse = localNext;
      }

      let prefix = seqData && seqData.dateStr ? seqData.dateStr : localDateStr;

      // Manejar Cambio de Fecha (si servidor avanzó la fecha)
      let finalDateToSave = dateStr;
      if (prefix !== localDateStr) {
           // Parsear YYMMDD a YYYY-MM-DD
           const yy = prefix.substring(0, 2);
           const mm = prefix.substring(2, 4);
           const dd = prefix.substring(4, 6);
           finalDateToSave = `20${yy}-${mm}-${dd}`;
           Alert.alert("Aviso", `Secuencia llena. Se cambió la fecha a ${finalDateToSave}.`);
      }

      // Verificar desbordamiento (comprobación de cordura)
      if (seqToUse > 999) { Alert.alert("Error", "Secuencia > 999"); setLoading(false); return; }

      const s = seqToUse.toString().padStart(3, "0");
      batchId = `${prefix}I${s}`;

      // 2. Preparar Datos
      const dataToSave = {
        SAE: sae, Grade: grade, HeatNo: heat, Batch: batchId, BundleNo: bundle, Weight: weight, Date: finalDateToSave,
        Operator: user ? user.name : "Unknown",
      };

      // 3. Guardar
      // 3. Guardar
      await saveScanToHistory(dataToSave);
      
      // Esperar sincronización hoja para asegurar datos en servidor antes de pedir potencialmente la siguiente secuencia
      try {
          await sendDataToSheet(dataToSave);
      } catch (e) {
          console.error("Sheet Sync Error:", e);
          Alert.alert("Advertencia", "Se guardó localmente pero falló el envío a la hoja de cálculo.");
      }

      const newSaeMap = { ...saeMap, [grade]: sae };
      const newLastBatchMap = { ...lastBatchMap, [grade]: batchId }; // Actualizar mapa de lotes
      
      setSaeMap(newSaeMap); 
      setLastBatchMap(newLastBatchMap);

      await saveManualData({ SAE_MAP: newSaeMap, LAST_BATCH_MAP: newLastBatchMap }); 
      await saveLocalSequence(storageKey, seqToUse);

      Alert.alert("Éxito", `Datos guardados. Lote: ${batchId}`);
      
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
            <Text style={styles.label}>Fecha (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={dateStr}
              onChangeText={setDateStr}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#888"
              returnKeyType="next"
              onSubmitEditing={() => hasPrivilege ? saeRef.current?.focus() : heatRef.current?.focus()}
              blurOnSubmit={false}
            />
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
