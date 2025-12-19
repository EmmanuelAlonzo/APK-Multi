import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, SafeAreaView, Platform, StatusBar } from 'react-native';
import { saveScriptUrl, getScriptUrl, DEFAULT_SCRIPT_URL } from '../utils/storage';

export default function SettingsScreen({ navigation, route }) {
    // URL is now read-only logic or just fixed. 
    // Requirement: "Elimina la opcion de editar el script... que nadie pueda tocarlo"
    // We will just show it as info or hide it? "que si se debe actualizar sea mediante este codigo"
    // So we will remove the input.
    
    const [url, setUrl] = useState('');
    const { user, logout } = React.useContext(require('../context/AuthContext').AuthContext);
    const { updateUserPin } = require('../utils/api');

    const [newPin, setNewPin] = useState('');
    const [changingPin, setChangingPin] = useState(false);

    const isInitial = route.params?.isInitial ?? false;

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        const savedUrl = await getScriptUrl();
        setUrl(savedUrl || DEFAULT_SCRIPT_URL);
    };

    const handleChangePin = async () => {
        if (!user || !user.name) {
            Alert.alert("Error", "No hay usuario identificado para cambiar PIN");
            return;
        }
        if (!newPin.trim() || newPin.length < 4) {
             Alert.alert("Error", "El PIN debe tener al menos 4 dígitos");
             return;
        }

        setChangingPin(true);
        try {
            const success = await updateUserPin(user.name, newPin);
            if (success) {
                Alert.alert("Éxito", "Tu PIN ha sido actualizado");
                setNewPin('');
            } else {
                Alert.alert("Error", "No se pudo actualizar el PIN. Verifica tu conexión.");
            }
        } catch (e) {
            Alert.alert("Error", e.message);
        } finally {
            setChangingPin(false);
        }
    };

    const handleLogout = async () => {
        Alert.alert(
            "Cerrar Sesión",
            "¿Estás seguro de que deseas salir?",
            [
                { text: "Cancelar", style: "cancel" },
                { 
                    text: "Salir", 
                    style: "destructive", 
                    onPress: async () => {
                       await logout();
                       // Force reset to Login to avoid staying on Settings
                       // (since Settings exists in both Auth and App stacks)
                       navigation.reset({
                           index: 0,
                           routes: [{ name: 'Login' }],
                       });
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Configuración</Text>
                
                {/* Script Info Only (No Edit) */}
                <View style={styles.infoBox}>
                    <Text style={styles.label}>Estado de Conexión:</Text>
                    <Text style={styles.description}>
                        Conectado a Google Apps Script (V8 - Roles)
                    </Text>
                    <Text style={[styles.description, {fontSize: 10}]}>{url}</Text>
                </View>

                {/* --- SECCIÓN CAMBIAR PIN --- */}
                {!isInitial && user && (
                    <View style={styles.section}>
                        <View style={styles.divider} />
                        <Text style={styles.label}>Cambiar Contraseña (PIN)</Text>
                        <Text style={styles.description}>
                            Usuario actual: {user.name}
                        </Text>
                        
                        <TextInput
                            style={styles.input}
                            value={newPin}
                            onChangeText={setNewPin}
                            placeholder="Nuevo PIN (ej. 1234)"
                            placeholderTextColor="#888"
                            keyboardType="numeric"
                            secureTextEntry
                        />
                         <TouchableOpacity style={[styles.button, styles.pinButton]} onPress={handleChangePin} disabled={changingPin}>
                            <Text style={styles.buttonText}>{changingPin ? "Actualizando..." : "Actualizar PIN"}</Text>
                        </TouchableOpacity>

                        <View style={styles.divider} />
                         <TouchableOpacity style={[styles.button, styles.logoutButton]} onPress={handleLogout}>
                            <Text style={styles.buttonText}>Cerrar Sesión</Text>
                        </TouchableOpacity>
                    </View>
                )}


                {!isInitial && (
                    <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={() => navigation.goBack()}>
                        <Text style={styles.cancelButtonText}>Volver</Text>
                    </TouchableOpacity>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    content: {
        padding: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    label: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    description: {
        fontSize: 14,
        color: '#666',
        marginBottom: 12,
    },
    input: {
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        marginBottom: 20,
        minHeight: 80,
        textAlignVertical: 'top',
        color: '#000',
    },
    button: {
        backgroundColor: '#2196F3',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 10,
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    cancelButton: {
        backgroundColor: 'transparent',
    },
    cancelButtonText: {
        color: '#666',
        fontSize: 16,
    },
    section: {
        marginTop: 20,
    },
    divider: {
        height: 1,
        backgroundColor: '#ddd',
        marginBottom: 20,
    },
    pinButton: {
        backgroundColor: '#FF9800', 
    },
    logoutButton: {
        backgroundColor: '#f44336', // Red
        marginTop: 10,
    },
    infoBox: {
        backgroundColor: '#e3f2fd',
        padding: 10,
        borderRadius: 8,
        marginBottom: 20
    }
});
