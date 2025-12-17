import React, { useState, useEffect } from "react";
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
// PDF Generation will be handled in a separate utility or here if simple

export default function ManualScreen({ navigation }) {
  const [sae, setSae] = useState("");
  const [grade, setGrade] = useState("7.00"); // Default
  const [heat, setHeat] = useState("");
  const [bundle, setBundle] = useState("");
  const [weight, setWeight] = useState("");
  // Date string YYYY-MM-DD for input
  const [dateStr, setDateStr] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [loading, setLoading] = useState(false);

  // Optimización: Pre-carga de secuencia
  const [prefetchedSeq, setPrefetchedSeq] = useState(null); // { seq, dateStr }
  const [isFetchingSeq, setIsFetchingSeq] = useState(false);

  // New: Map to store SAE per Grade
  const [saeMap, setSaeMap] = useState({});

  useEffect(() => {
    loadPersistedData();
  }, []);

  const loadPersistedData = async () => {
    const data = await getManualData();
    // Check for new map structure
    if (data.SAE_MAP) {
      setSaeMap(data.SAE_MAP);
      // Set initial SAE based on current default grade (7.00)
      if (data.SAE_MAP["7.00"]) {
        setSae(data.SAE_MAP["7.00"]);
      }
    }
    // Fallback/Migration: If user had old single SAE, we could map it,
    // but plan says reset is acceptable. We'll start clean or use map.
  };

  // Update SAE input when Grade changes
  useEffect(() => {
    setSae(saeMap[grade] || "");
    
    // Trigger Prefetch when Grade or Date changes
    prefetchSequence();
  }, [grade, saeMap, dateStr]);

  const prefetchSequence = async () => {
      setPrefetchedSeq(null); // Reset previous
      setIsFetchingSeq(true);
      try {
           const [yIn, mIn, dIn] = dateStr.split('-').map(Number);
           const dateObj = new Date(yIn, mIn - 1, dIn);
           const seqData = await getNextBatchSequence(grade, dateObj);
           console.log("Prefetch Success:", seqData);
           setPrefetchedSeq(seqData);
      } catch (e) {
          console.log("Prefetch Failed (will retry on save):", e);
      } finally {
          setIsFetchingSeq(false);
      }
  };

  const handleSave = async () => {
    if (!sae || !heat || !weight) {
      Alert.alert(
        "Error",
        "Por favor completa los campos requeridos (SAE, Colada, Peso)"
      );
      return;
    }

    setLoading(true);
    try {
      // 1. Generate Batch ID (Sequence)
      let batchId = "UNKNOWN";
      // Parse selected date
      const [yIn, mIn, dIn] = dateStr.split("-").map(Number);
      const dateObj = new Date(yIn, mIn - 1, dIn);

      // Construct Key for Local Storage: dateStr + Grade
      const yLocal = dateObj.getFullYear().toString().slice(-2);
      const mLocal = (dateObj.getMonth() + 1).toString().padStart(2, "0");
      const dLocal = dateObj.getDate().toString().padStart(2, "0");
      const localDateStr = `${yLocal}${mLocal}${dLocal}`;
      const storageKey = `${localDateStr}_${grade}`;

      let seqToUse = 1;

      try {
        let seqData = null;

        // OPTIMIZATION: Use Prefetched Data if available
        if (prefetchedSeq) {
            console.log("Using Prefetched Sequence!");
            seqData = prefetchedSeq;
        } else {
             console.log("Prefetch missed, fetching now...");
             // Fetch Server Max (Standard way)
             seqData = await getNextBatchSequence(grade, dateObj);
        }

        // Fetch Local Max
        const localSeq = await getLocalSequence(storageKey);

        // API currently returns { seq: serverMax + 1 } (next available)
        const serverNext = seqData.seq;
        const localNext = localSeq + 1;

        // --- SYNC STRATEGY: SERVER AUTHORITATIVE ---
        // If we successfully got a sequence from the server, we trust it.
        // This allows reusing numbers if they were deleted (e.g. 002 is free).
        // The previous logic (Math.max) prevented filling gaps.
        console.log(`Seq Sync - Server: ${serverNext}, Local: ${localNext}`);

        if (serverNext) {
          seqToUse = serverNext;
          // Auto-correct local sequence if it drifted apart
          if (localNext !== serverNext) {
            console.log("Adjusting local sequence to match server.");
          }
        } else {
          // Fallback should not happen here as we are in try block of API
          seqToUse = localNext;
        }

        if (seqToUse > 999) {
          Alert.alert(
            "Aviso",
            "La secuencia llegó a 999. Por favor cambia la fecha para reiniciar."
          );
          setLoading(false);
          return;
        }

        // formatBatchId
        let prefix = "";
        if (seqData.dateStr) {
          prefix = seqData.dateStr;
        } else {
          prefix = localDateStr;
        }

        const s = seqToUse.toString().padStart(3, "0");
        // Added "I" separator: 251215I001
        batchId = `${prefix}I${s}`;
      } catch (e) {
        console.error("Failed to get sequence:", e);
        // Fallback to local only logic
        const localSeq = await getLocalSequence(storageKey);
        seqToUse = localSeq + 1;
        const s = seqToUse.toString().padStart(3, "0");
        batchId = `${localDateStr}I${s}`;

        // Offline Sequence Warning
        const proceed = await new Promise((resolve) => {
          Alert.alert(
            "Sin conexión",
            "No se pudo obtener la secuencia del servidor. ¿Deseas guardar sin sincronizar secuencia (Lote podría duplicarse)?",
            [
              { text: "Cancelar", onPress: () => resolve(false) },
              { text: "Continuar (Riesgo)", onPress: () => resolve(true) },
            ]
          );
        });

        if (!proceed) {
          setLoading(false);
          return;
        }
      }

      // 2. Prepare Data
      const dataToSave = {
        SAE: sae,
        Grade: grade,
        HeatNo: heat,
        Batch: batchId,
        BundleNo: bundle,
        Weight: weight,
        Date: dateStr,
      };

      // 3. Save to History (Local)
      await saveScanToHistory(dataToSave);

      // 4. Save to Sheets (Async - Fire and Forget to speed up UI)
      sendDataToSheet(dataToSave).catch((e) => {
        console.error("Sheet Sync Error:", e);
        // We don't block the user, but we log it. Data is safe locally.
      });

      // 5. Persist relevant fields & SEQUENCE
      // Update Map
      const newSaeMap = { ...saeMap, [grade]: sae };
      setSaeMap(newSaeMap); // Update state

      await saveManualData({ SAE_MAP: newSaeMap }); // Save Map
      await saveLocalSequence(storageKey, seqToUse);

      Alert.alert("Éxito", `Datos guardados. Lote generado: ${batchId}`);

      // Clear fields (except SAE?)
      setHeat("");
      setBundle("");
      setWeight("");
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Ocurrió un error inesperado");
    } finally {
      setLoading(false);
      // Refresh Prefetch for NEXT item immediately
      prefetchSequence();
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
        <Text style={styles.title}>Ingreso Manual</Text>
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
              keyboardType="numeric"
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />
          </View>

          {/* Button */}
          <TouchableOpacity
            style={[styles.saveButton, loading && styles.disabled]}
            onPress={handleSave}
            disabled={loading}
          >
            <Text style={styles.saveButtonText}>
              {loading ? "Guardando..." : "Guardar Datos"}
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
});
