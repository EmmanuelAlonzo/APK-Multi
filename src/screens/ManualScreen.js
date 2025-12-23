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
// PDF Generation will be handled in a separate utility or here if simple

export default function ManualScreen({ navigation, route }) {
  const { user } = useContext(AuthContext); 
  const { updateSheetRow, fetchGlobalConfig, saveGlobalConfig } = require('../utils/api');

  // Edit Mode Params
  const { isEditing, item } = route.params || {};

  const [sae, setSae] = useState(isEditing ? String(item.SAE || "") : "");
  // Normalize grade to ensure it matches button values (e.g., "5.5" -> "5.50")
  const formattedGrade = isEditing && item.Grade 
        ? parseFloat(item.Grade).toFixed(2) 
        : "7.00";
  const [grade, setGrade] = useState(formattedGrade);
  
  const [heat, setHeat] = useState(isEditing ? String(item.HeatNo || "") : "");
  const [bundle, setBundle] = useState(isEditing ? String(item.BundleNo || item.Coil || item.coil || "") : "");
  const [weight, setWeight] = useState(isEditing ? String(item.Weight || "") : "");
  // Fix: use local date instead of UTC to avoid date skipping in evening
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
  const [globalSaeMap, setGlobalSaeMap] = useState({}); // New: Store global config map

  useEffect(() => {
    console.log("DEBUG: ManualScreen Mounted v2 - Checking fallback logic"); // Version check
    if (!isEditing) {
        loadPersistedData();
    }
  }, []);

  const loadPersistedData = async () => {
    const data = await getManualData();
    if (data.SAE_MAP) {
      setSaeMap(data.SAE_MAP);
      if (data.SAE_MAP["7.00"]) {
        setSae(data.SAE_MAP["7.00"]);
      }
    }
  };

  useEffect(() => {
    if(!isEditing) {
        setSae(saeMap[grade] || "");
        prefetchSequence();
    }
  }, [grade, saeMap, dateStr]);

  /* --- Global SAE Logic --- */
  const fetchConfig = async () => {
    // Only fetch if not editing an existing item (we want to preserve its historical data)
    if (isEditing) return;
    
    // Fetch global config
    const configMap = await fetchGlobalConfig();
    if (configMap) {
        setGlobalSaeMap(configMap);
        // If we have a global SAE for current grade, set it?
        // Or wait for effect?
        // Let's set it if current grade has one.
        if (configMap[grade]) {
            setSae(configMap[grade]);
        }
    }
  };

  const handleSetGlobal = async () => {
      if (!sae) {
          Alert.alert("Error", "Ingresa un valor en SAE primero");
          return;
      }
      setLoading(true); 
      const success = await saveGlobalConfig(sae, grade); // Pass grade
      setLoading(false);
      
      if (success) {
          // 1. Update Global Map State immediately
          const newGlobalMap = { ...globalSaeMap, [grade]: sae };
          setGlobalSaeMap(newGlobalMap);
          
          // 2. Update Local History Map State immediately (to stay in sync)
          const newSaeMap = { ...saeMap, [grade]: sae };
          setSaeMap(newSaeMap);
          // Persist local history too, so it survives reload even if fetchConfig fails
          saveManualData({ SAE_MAP: newSaeMap }).catch(e => console.log(e));

          Alert.alert("Éxito", `SAE Global para Grado ${grade} actualizado`);
      } else {
          Alert.alert("Error", "No se pudo actualizar el SAE Global en el servidor");
      }
  };

  useEffect(() => {
    if (!isEditing) {
        loadPersistedData();
        fetchConfig(); // Fetch global SAE
        prefetchSequence();
    }
  }, []); // Run once on mount

  // ... (keeping other effects but removing duplications if any)

  useEffect(() => {
    // Determine if we should clear prefetched seq when parameters change
    // Logic: if grade/date changes, prefetch again.
    if(!isEditing) {
        // Global SAE logic: If we have a global SAE for this grade, use it.
        // User requested Global SAE updates "everyone".
        // If globalSaeMap has entry for this grade, prefer it over previous local input unless typed?
        // Simplicity: When switching grade, reset to global default if exists.
        
        if (globalSaeMap[grade]) {
             setSae(globalSaeMap[grade]);
        } else if (saeMap[grade]) {
             // Fallback to local history if no global
             setSae(saeMap[grade]);
        } else {
             setSae(""); // Clear if neither
        }
        
        prefetchSequence();
    }
  }, [grade, dateStr, globalSaeMap]); // Added globalSaeMap dependency

  const prefetchSequence = async () => {
      setLastBatchId(null);
      setPrefetchedSeq(null); 
      setIsFetchingSeq(true);
      try {
           const [yIn, mIn, dIn] = dateStr.split('-').map(Number);
           const dateObj = new Date(yIn, mIn - 1, dIn);
           
           // Parallel Execution for Speed
           const dailyPromise = getNextBatchSequence(grade, dateObj);
           const absolutePromise = fetchLastBatch(grade);

           // Wait for both (or handle failures gracefully)
           // We use allSettled or just all. simple all is strict, but fetchLastBatch handles its own errors returning null.
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

           // Fallback if daily not found
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

      // --- EDIT MODE ---
      if (isEditing) {
          const updateData = {
              Batch: batchId, // Key
              SAE: sae,
              HeatNo: heat,
              BundleNo: bundle,
              Weight: weight,
              // Grade, Date usually not editable easily as they define Batch ID, but we allow them to pass through
              // If Admin changes Grade, Batch ID logically mismatch? 
              // User requirement: "Editar los registros...". 
              // For simplicity, we update fields on the EXISTING Batch ID. Changing Batch ID is dangerous.
          };

          if (route.params?.isRemote) {
              await updateRemoteRow(batchId, updateData);
              Alert.alert("Éxito", "Registro actualizado remotamente");
              navigation.goBack();
              return;
          }

          // Update Sheet (Local Edit)
          await updateSheetRow(updateData);
          
          // Update History (Local) requires modifying the item in storage
          // We can't easily modify one item in history list from here without a global store action or re-read.
          // TRICK: We will not update local history here, BUT `HistoryScreen` usually reloads. 
          // However, to be nice, we should try. 
          // For now, let's just alert and go back.
          Alert.alert("Éxito", "Registro actualizado");
          navigation.goBack();
          return;
      }

      // --- NEW MODE ---
      // 1. Generate Batch ID
      // Parse selected date
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

      // Handle Date Rollover (if server advanced the date)
      let finalDateToSave = dateStr;
      if (prefix !== localDateStr) {
           // Parse YYMMDD to YYYY-MM-DD
           const yy = prefix.substring(0, 2);
           const mm = prefix.substring(2, 4);
           const dd = prefix.substring(4, 6);
           finalDateToSave = `20${yy}-${mm}-${dd}`;
           Alert.alert("Aviso", `Secuencia llena. Se cambió la fecha a ${finalDateToSave}.`);
      }

      // Check for overflow (sanity check)
      if (seqToUse > 999) { Alert.alert("Error", "Secuencia > 999"); setLoading(false); return; }

      const s = seqToUse.toString().padStart(3, "0");
      batchId = `${prefix}I${s}`;

      // 2. Prepare Data
      const dataToSave = {
        SAE: sae, Grade: grade, HeatNo: heat, Batch: batchId, BundleNo: bundle, Weight: weight, Date: finalDateToSave,
        Operator: user ? user.name : "Unknown",
      };

      // 3. Save
      // 3. Save
      await saveScanToHistory(dataToSave);
      
      // Await sheet sync to ensure server has the data before we potentially ask for the next sequence
      try {
          await sendDataToSheet(dataToSave);
      } catch (e) {
          console.error("Sheet Sync Error:", e);
          Alert.alert("Advertencia", "Se guardó localmente pero falló el envío a la hoja de cálculo.");
      }

      const newSaeMap = { ...saeMap, [grade]: sae };
      setSaeMap(newSaeMap); 
      await saveManualData({ SAE_MAP: newSaeMap }); 
      await saveLocalSequence(storageKey, seqToUse);

      Alert.alert("Éxito", `Datos guardados. Lote: ${batchId}`);
      
      setHeat(""); setBundle(""); setWeight("");
      
      // Force fresh sequence fetch next time
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

  // Consolidated Effect for Grade Change & Auto-fill
  // Refresh sequence when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if(!isEditing) {
          prefetchSequence();
      }
    }, [grade, dateStr, isEditing]) // Dependencies trigger re-run if changed too, but mainly focus
  );

  useEffect(() => {
    if(!isEditing) {
        // Priority 1: Global SAE for this Grade
        if (globalSaeMap[grade]) {
             setSae(globalSaeMap[grade]);
        } 
        // Priority 2: Local History Map (if no global)
        else if (saeMap[grade]) {
             setSae(saeMap[grade]);
        } 
        // Default: Empty
        else {
             setSae(""); 
        }
        
        prefetchSequence();
    }
  }, [grade, globalSaeMap, saeMap]); // Ensure Date doesn't trigger unrelated SAE changes, but prefetch needs it. Removed dateStr from this dependency to separate concerns? No, prefetch needs it.

  // Separate Pre-fetch trigger to avoid overriding SAE on just date change?
  // Actually, if date changes, SAE shouldn't change, but Sequence should.
  // The above effect resets SAE on date change if I included dateStr?
  // Wait, I included dateStr in the dependency array in the previous file content. 
  // If date changes, `globalSaeMap[grade]` is still same, so it re-sets SAE to same value. Safe.

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
          {/* Last Batch Display - Persistent */}
          <View style={styles.infoBox}>
              {isFetchingSeq ? (
                  <Text style={styles.infoText}>Sincronizando secuencia...</Text>
              ) : lastBatchId ? (
                  <Text style={styles.infoText}>Último Lote: {lastBatchId}</Text>
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
            // Hidden for normal users, maybe show a small label?
            // "Eliminales ese campo" -> Remove input.
            // Let's show a Read-Only Text so they know it's being applied.
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
    backgroundColor: "#fff",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  header: {
    padding: 20,
    backgroundColor: "#f5f5f5",
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    marginRight: 15,
  },
  backText: {
    fontSize: 16,
    color: "#2196F3",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
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
    color: "#333",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fafafa",
    color: "#000", // Enforce black text
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
    backgroundColor: "#e0e0e0",
  },
  gradeSelected: {
    backgroundColor: "#2196F3",
  },
  gradeText: {
    color: "#333",
  },
  gradeTextSelected: {
    color: "white",
    fontWeight: "bold",
  },
  saveButton: {
    backgroundColor: "#4CAF50",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  disabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  editButton: {
    backgroundColor: '#FF9800'
  },
  infoBox: {
    backgroundColor: '#e3f2fd',
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 5,
    borderLeftColor: '#2196F3',
    alignItems: 'center',
  },
  infoText: {
    color: '#0d47a1',
    fontWeight: 'bold',
    fontSize: 16,
  }
});
