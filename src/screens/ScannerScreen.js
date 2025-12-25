import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, Button, TouchableOpacity, Alert, Modal, ScrollView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { saveScanToHistory } from '../utils/storage'; 
import { AuthContext } from '../context/AuthContext'; 

export default function ScannerScreen({ navigation }) {
    const { user } = useContext(AuthContext); // Obtener usuario autenticado
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [scannedData, setScannedData] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);

    const [torch, setTorch] = useState(false); // Estado de linterna

    if (!permission) {
        return <View />;
    }

    if (!permission.granted) {
        return (
            <View style={styles.container}>
                <Text style={{ textAlign: 'center', marginBottom: 20 }}>Necesitamos permiso para usar la cámara</Text>
                <Button onPress={requestPermission} title="Dar permiso" />
            </View>
        );
    }

    const { parseSteelLabel } = require('../utils/qrParser');
    const { getNextBatchSequence, sendDataToSheet, fetchLastBatch } = require('../utils/api');
    const { getLocalSequence, saveLocalSequence } = require('../utils/storage');

    const handleBarCodeScanned = ({ type, data }) => {
        setScanned(true);
        const parsed = parseSteelLabel(data);
        setScannedData(parsed); 
        setModalVisible(true);
    };

    const handleSmartSave = async () => {
        if (!scannedData || !scannedData.grade || !scannedData.weight) {
            Alert.alert("Error", "Faltan datos críticos (Grado o Peso) para generar el lote.");
            return;
        }

        const { sae, grade, heat, weight, bundle } = scannedData;
        const operator = user ? user.name : "Unknown";
        
        // 1. Calcular Fecha Local
        const now = new Date();
        const Y = now.getFullYear();
        const M = (now.getMonth() + 1).toString().padStart(2, '0');
        const D = now.getDate().toString().padStart(2, '0');
        const dateStr = `${Y}-${M}-${D}`; // YYYY-MM-DD
        
        const yLocal = now.getFullYear().toString().slice(-2);
        const mLocal = (now.getMonth() + 1).toString().padStart(2, '0');
        const dLocal = now.getDate().toString().padStart(2, '0');
        const localDateStr = `${yLocal}${mLocal}${dLocal}`; // YYMMDD

        Alert.alert("Guardando...", "Generando lote y enviando datos...");

        try {
            // 2. Obtener Secuencia
            // Intentar obtener del servidor, fallback a local
            const seqData = await getNextBatchSequence(grade, now);
            let seqToUse = 1;
            let prefix = localDateStr;

            if (seqData && seqData.seq) {
                seqToUse = seqData.seq;
                if (seqData.dateStr) prefix = seqData.dateStr;
            } else {
                 // Fallback local
                 const storageKey = `${localDateStr}_${grade}`;
                 const localSeq = await getLocalSequence(storageKey);
                 seqToUse = localSeq + 1;
            }

            // Validar límites
            if (seqToUse > 999) { Alert.alert("Error", "Secuencia > 999"); return; }

            // 3. Construir Batch ID
            const s = seqToUse.toString().padStart(3, "0");
            const batchId = `${prefix}I${s}`;

            // 4. Guardar
            const dataToSave = {
                SAE: sae || "SAE Genérico", // Default si no hay
                Grade: grade,
                HeatNo: heat || "N/A",
                Batch: batchId,
                BundleNo: bundle || "",
                Weight: weight,
                Date: dateStr,
                Operator: operator
            };

            await saveScanToHistory(dataToSave);
            await sendDataToSheet(dataToSave); // Esto puede fallar si no hay internet

            // Actualizar contador local
            const storageKey = `${localDateStr}_${grade}`;
            await saveLocalSequence(storageKey, seqToUse);

            Alert.alert("¡Éxito!", `Lote Generado: ${batchId}\nGuardado en Historial y Hoja.`);
            setModalVisible(false);
            setScanned(false);

        } catch (e) {
            Alert.alert("Error", "Fallo al guardar: " + e.message);
        }
    };



    return (
        <View style={styles.container}>
            <CameraView
                style={StyleSheet.absoluteFillObject}
                facing="back"
                enableTorch={torch} 
                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                barcodeScannerSettings={{
                    barcodeTypes: ["qr", "code128"],
                }}
            />
            
            {/* Flashlight Button */}
            <TouchableOpacity 
                style={styles.torchButton} 
                onPress={() => setTorch(!torch)}
            >
                <Text style={styles.torchText}>{torch ? '🔦 APAGAR' : '🔦 ENCENDER'}</Text>
            </TouchableOpacity>

            {scanned && (
                <View style={styles.rescanContainer}>
                    <Button title={'Toca para escanear de nuevo'} onPress={() => setScanned(false)} />
                </View>
            )}

            {/* Modal de Confirmación Inteligente */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => {
                    setModalVisible(false);
                    setScanned(false);
                }}
            >
                <View style={styles.centeredView}>
                    <View style={styles.modalView}>
                        <Text style={styles.modalTitle}>Etiqueta Detectada</Text>
                        
                        {scannedData ? (
                            <View style={styles.dataContainer}>
                                <View style={styles.row}>
                                    <Text style={styles.label}>SAE:</Text>
                                    <Text style={styles.value}>{scannedData.sae || "---"}</Text>
                                </View>
                                <View style={styles.row}>
                                    <Text style={styles.label}>Grado:</Text>
                                    <Text style={styles.value}>{scannedData.grade || "---"}</Text>
                                </View>
                                <View style={styles.row}>
                                    <Text style={styles.label}>Peso:</Text>
                                    <Text style={styles.value}>{scannedData.weight ? `${scannedData.weight} Kg` : "---"}</Text>
                                </View>
                                <View style={styles.row}>
                                    <Text style={styles.label}>Colada:</Text>
                                    <Text style={styles.value}>{scannedData.heat || "---"}</Text>
                                </View>
                                <View style={styles.row}>
                                    <Text style={styles.label}>Coil:</Text>
                                    <Text style={styles.value}>{scannedData.bundle || "---"}</Text>
                                </View>
                                
                                {(!scannedData.grade || !scannedData.weight) && (
                                    <View>
                                        <Text style={{color:'red', marginTop:10, fontWeight:'bold', textAlign:'center'}}>
                                            ⚠️ Faltan datos clave (Grado/Peso)
                                        </Text>
                                        <Text style={{fontSize: 10, color: '#888', marginTop: 5, textAlign: 'center'}}>
                                            Raw: {JSON.stringify(scannedData.raw)}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        ) : (
                            <Text>Analizando...</Text>
                        )}
                        
                        <View style={styles.buttonContainer}>
                            <TouchableOpacity
                                style={[styles.button, styles.buttonSave]}
                                onPress={handleSmartSave}
                            >
                                <Text style={styles.textStyle}>GUARDAR Y GENERAR LOTE</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.button, styles.buttonClose]}
                                onPress={() => {
                                    setModalVisible(false);
                                    setScanned(false);
                                }}
                            >
                                <Text style={[styles.textStyle, { color: '#FFF' }]}>Cancelar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        backgroundColor: '#000', // Camera bg
    },
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 22,
        backgroundColor: 'rgba(0,0,0,0.8)', // Darker overlay
    },
    modalView: {
        margin: 20,
        backgroundColor: '#1E1E1E', // Dark Grey Modal
        borderRadius: 10,
        padding: 30,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 5,
        elevation: 10,
        width: '90%',
        maxHeight: '80%',
        borderWidth: 1,
        borderColor: '#333', 
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 20,
        color: '#FFF', // White Title
    },
    dataScroll: {
        width: '100%',
        marginBottom: 20,
        backgroundColor: '#FFF',
        borderRadius: 4,
        padding: 10,
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 15,
        justifyContent: 'center',
        width: '100%'
    },
    button: {
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 20,
        elevation: 2,
        flex: 1,
    },
    buttonSave: {
        backgroundColor: '#D32F2F', // Red Primary
    },
    buttonClose: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#666',
    },
    textStyle: {
        color: 'white',
        fontWeight: 'bold',
        textAlign: 'center',
        fontSize: 14
    },
    // Need explicit text color for Close button since it's white?
    // Yes, or simplify. Let's make Close Red.
    buttonCloseRed: {
        backgroundColor: '#D32F2F', 
    },
    modalText: {
        marginBottom: 15,
        textAlign: 'center',
        color: '#DDD',
        fontSize: 16
    },
    torchButton: {
        position: 'absolute',
        top: 50,
        right: 20,
        backgroundColor: 'rgba(0,0,0,0.5)', // Darker transparent
        padding: 12,
        borderRadius: 50,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)'
    },
    torchText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
    rescanContainer: {
        position: 'absolute',
        bottom: 50,
        alignSelf: 'center',
        backgroundColor: '#333', // Dark pill
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 30,
        elevation: 5,
        borderWidth: 1,
        borderColor: '#555'
    },
    dataContainer: {
        width: '100%',
        marginBottom: 25,
        backgroundColor: '#2C2C2C', // Inner Dark Card
        padding: 15,
        borderRadius: 8,
        borderLeftWidth: 3,
        borderLeftColor: '#D32F2F'
    },
    row: {
        flexDirection: 'row',
        marginBottom: 10,
        borderBottomWidth: 1,
        borderColor: '#444', // Darker border
        paddingBottom: 4
    },
    label: {
        width: 80,
        fontWeight: 'bold',
        color: '#AAA' // Light Grey Label
    },
    value: {
        flex: 1,
        fontWeight: 'bold',
        color: '#FFF', // White Value
        fontSize: 16
    }
});
