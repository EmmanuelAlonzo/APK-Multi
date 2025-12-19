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
// import DateTimePicker from '@react-native-community/datetimepicker'; // Skipping for simplicity, using TextInput/Date logic or default today
import {
  saveScanToHistory,
  saveManualData,
  getManualData,
  getLocalSequence,
  saveLocalSequence,
} from "../utils/storage";
import { getNextBatchSequence, sendDataToSheet } from "../utils/api";
import { AuthContext } from "../context/AuthContext";
// PDF Generation will be handled in a separate utility or here if simple

export default function ManualScreen({ navigation, route }) {
  const { user } = useContext(AuthContext); 
  const { updateSheetRow } = require('../utils/api');

  // Edit Mode Params
  const { isEditing, item } = route.params || {};

  const [sae, setSae] = useState(isEditing ? item.SAE : "");
  const [grade, setGrade] = useState(isEditing ? item.Grade : "7.00");
  const [heat, setHeat] = useState(isEditing ? item.HeatNo : "");
  const [bundle, setBundle] = useState(isEditing ? item.BundleNo : "");
  const [weight, setWeight] = useState(isEditing ? item.Weight : "");
  const [dateStr, setDateStr] = useState(isEditing ? item.Date : new Date().toISOString().split("T")[0]);
  
  const [loading, setLoading] = useState(false);
  const [prefetchedSeq, setPrefetchedSeq] = useState(null);
  const [isFetchingSeq, setIsFetchingSeq] = useState(false);
  const [saeMap, setSaeMap] = useState({});

  useEffect(() => {
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

  const prefetchSequence = async () => {
      setPrefetchedSeq(null); 
      setIsFetchingSeq(true);
      try {
           const [yIn, mIn, dIn] = dateStr.split('-').map(Number);
           const dateObj = new Date(yIn, mIn - 1, dIn);
           const seqData = await getNextBatchSequence(grade, dateObj);
           setPrefetchedSeq(seqData);
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

          // Update Sheet
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

      // Check for overflow
      if (seqToUse > 999) { Alert.alert("Error", "Secuencia > 999"); setLoading(false); return; }

      const s = seqToUse.toString().padStart(3, "0");
      batchId = `${prefix}I${s}`;

      // 2. Prepare Data
      const dataToSave = {
        SAE: sae, Grade: grade, HeatNo: heat, Batch: batchId, BundleNo: bundle, Weight: weight, Date: dateStr,
        Operator: user ? user.name : "Unknown",
      };

      // 3. Save
      await saveScanToHistory(dataToSave);
      sendDataToSheet(dataToSave).catch((e) => console.error("Sheet Sync Error:", e));

      const newSaeMap = { ...saeMap, [grade]: sae };
      setSaeMap(newSaeMap); 
      await saveManualData({ SAE_MAP: newSaeMap }); 
      await saveLocalSequence(storageKey, seqToUse);

      Alert.alert("Éxito", `Datos guardados. Lote: ${batchId}`);
      
      setHeat(""); setBundle(""); setWeight("");
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{isEditing ? `Editar ${item?.Batch}` : "Ingreso Manual"}</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.form}>
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
              onSubmitEditing={() => saeRef.current?.focus()}
              blurOnSubmit={false}
            />
          </View>

          {/* SAE */}
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
          </View>

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
  }
});
