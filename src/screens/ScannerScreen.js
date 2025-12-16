import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Button, TouchableOpacity, Alert, Modal, ScrollView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { saveScanToHistory } from '../utils/storage'; 

export default function ScannerScreen({ navigation }) {
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
    },
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 22,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalView: {
        margin: 20,
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 35,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
        width: '90%',
        maxHeight: '80%',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 15,
    },
    dataScroll: {
        width: '100%',
        marginBottom: 20,
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 10,
    },
    button: {
        borderRadius: 10,
        padding: 10,
        elevation: 2,
        minWidth: 100,
    },
    buttonSave: {
        backgroundColor: '#2196F3',
    },
    buttonClose: {
        backgroundColor: '#FF5252',
    },
    textStyle: {
        color: 'white',
        fontWeight: 'bold',
        textAlign: 'center',
    },
    modalText: {
        marginBottom: 15,
        textAlign: 'center',
    },
    torchButton: {
        position: 'absolute',
        top: 50,
        right: 20,
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: 15,
        borderRadius: 30,
    },
    torchText: {
        color: 'white',
        fontWeight: 'bold',
    },
    rescanContainer: {
        position: 'absolute',
        bottom: 50,
        alignSelf: 'center',
        backgroundColor: 'white',
        padding: 10,
        borderRadius: 10
    }
});
