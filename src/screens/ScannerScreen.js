import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, Button, TouchableOpacity, Alert, Modal, ScrollView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { saveScanToHistory } from '../utils/storage'; 
import { AuthContext } from '../context/AuthContext'; 

export default function ScannerScreen({ navigation }) {
    const { user } = useContext(AuthContext); // Get authenticated user
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [scannedData, setScannedData] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);

    const [torch, setTorch] = useState(false); // Flashlight state

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

    const handleBarCodeScanned = ({ type, data }) => {
        setScanned(true);
        setScannedData(data);
        setModalVisible(true);
    };

    const handleSave = async () => {
        // Here we can parse the data if it's JSON
        let dataToSave = scannedData;
        try {
            const parsed = JSON.parse(scannedData);
            dataToSave = parsed;
        } catch (e) {
            // Not JSON, keep as string
        }

        // Attach Operator
        if (typeof dataToSave === 'object') {
            dataToSave.Operator = user ? user.name : "Unknown";
        } else {
            // Converts string to object to attach operator?
            // Or we just save object wrapper? 
            // Current storage handles mixed, but let's wrap it to be consistent with sheet columns.
            dataToSave = {
                RawData: dataToSave,
                Operator: user ? user.name : "Unknown",
                Date: new Date().toISOString()
            };
        }

        const success = await saveScanToHistory(dataToSave);
        if (success) {
            Alert.alert("Guardado", "Datos guardados en el historial");
            setModalVisible(false);
            setScanned(false);
        } else {
            Alert.alert("Error", "No se pudo guardar");
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
                        <Text style={styles.modalTitle}>Datos Escaneados</Text>
                        <ScrollView style={styles.dataScroll}>
                            <Text style={styles.modalText}>{scannedData}</Text>
                        </ScrollView>
                        
                        <View style={styles.buttonContainer}>
                            <TouchableOpacity
                                style={[styles.button, styles.buttonSave]}
                                onPress={handleSave}
                            >
                                <Text style={styles.textStyle}>Guardar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.button, styles.buttonClose]}
                                onPress={() => {
                                    setModalVisible(false);
                                    setScanned(false);
                                }}
                            >
                                <Text style={styles.textStyle}>Cancelar</Text>
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
        backgroundColor: '#E5E5E5', // Grey Modal
        borderRadius: 8,
        padding: 35,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.5,
        shadowRadius: 4,
        elevation: 10,
        width: '90%',
        maxHeight: '80%',
        borderWidth: 2,
        borderColor: '#D32F2F', // Red Border
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 15,
        color: '#111',
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
        gap: 10,
    },
    button: {
        borderRadius: 4,
        padding: 10,
        elevation: 2,
        minWidth: 100,
    },
    buttonSave: {
        backgroundColor: '#111', // Black
        borderWidth: 1,
        borderColor: '#D32F2F', 
    },
    buttonClose: {
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#333'
    },
    textStyle: {
        color: 'white',
        fontWeight: 'bold',
        textAlign: 'center',
    },
    // Need explicit text color for Close button since it's white?
    // Yes, or simplify. Let's make Close Red.
    buttonCloseRed: {
        backgroundColor: '#D32F2F', 
    },
    modalText: {
        marginBottom: 15,
        textAlign: 'center',
        color: '#333',
        fontSize: 16
    },
    torchButton: {
        position: 'absolute',
        top: 50,
        right: 20,
        backgroundColor: 'rgba(255,255,255,0.2)', // Subtler
        padding: 15,
        borderRadius: 30,
        borderWidth: 1,
        borderColor: '#FFF'
    },
    torchText: {
        color: 'white',
        fontWeight: 'bold',
    },
    rescanContainer: {
        position: 'absolute',
        bottom: 50,
        alignSelf: 'center',
        backgroundColor: '#FFF',
        padding: 15,
        borderRadius: 8,
        elevation: 5
    }
});
